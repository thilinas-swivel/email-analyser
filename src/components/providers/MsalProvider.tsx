"use client";

import { MsalProvider as MsalReactProvider } from "@azure/msal-react";
import {
  PublicClientApplication,
  EventType,
  EventMessage,
  AuthenticationResult,
} from "@azure/msal-browser";
import { msalConfig } from "@/lib/msal-config";
import { useEffect, useState, createContext, useContext } from "react";
import {
  initializeTeams,
  notifyTeamsAppLoaded,
} from "@/lib/teams-context";

// Create MSAL instance lazily on client side only
let msalInstance: PublicClientApplication | null = null;

function getMsalInstance(): PublicClientApplication {
  if (!msalInstance) {
    msalInstance = new PublicClientApplication(msalConfig);
  }
  return msalInstance;
}

interface TeamsContextValue {
  inTeams: boolean;
}

const TeamsContext = createContext<TeamsContextValue>({ inTeams: false });

export function useTeamsContext() {
  return useContext(TeamsContext);
}

export default function MsalProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isInitialized, setIsInitialized] = useState(false);
  const [inTeams, setInTeams] = useState(false);
  const [instance, setInstance] = useState<PublicClientApplication | null>(null);

  const clearAuthAndRetry = () => {
    // Clear MSAL cache from localStorage
    const localKeys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.startsWith("msal.") || key.includes("login.windows"))) {
        localKeys.push(key);
      }
    }
    localKeys.forEach((key) => localStorage.removeItem(key));

    // Clear MSAL cache from sessionStorage
    const sessionKeys: string[] = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key && (key.startsWith("msal.") || key.includes("login.windows"))) {
        sessionKeys.push(key);
      }
    }
    sessionKeys.forEach((key) => sessionStorage.removeItem(key));

    // Reload the page — with clean state the login screen will show
    window.location.reload();
  };

  useEffect(() => {
    (async () => {
      // Get or create MSAL instance on client side
      const nextInstance = getMsalInstance();
      setInstance(nextInstance);

      // Try Teams first — quick timeout means this won't block on browsers
      const teamsDetected = await initializeTeams();
      setInTeams(teamsDetected);

      if (teamsDetected) {
        await nextInstance.initialize();
        await notifyTeamsAppLoaded();
        setIsInitialized(true);
        return;
      }

      // Browser flow: normal MSAL redirect handling
      await nextInstance.initialize();

      try {
        const redirectResult = await nextInstance.handleRedirectPromise();

        if (redirectResult && redirectResult.account) {
          console.log("Login successful, setting active account");
          nextInstance.setActiveAccount(redirectResult.account);
          if (window.location.hash) {
            window.history.replaceState(null, "", window.location.pathname);
          }
        }
      } catch (err) {
        console.warn("Redirect handling error (non-fatal):", err);
        const errorMsg = err instanceof Error ? err.message : String(err);
        if (errorMsg.includes("interaction_in_progress")) {
          // Stale interaction lock — clear MSAL storage and reload
          clearAuthAndRetry();
          return;
        }
        // For timed_out and other errors: just proceed.
        // If there are stale accounts, acquireTokenSilent will either
        // succeed (refreshing the token) or fail — at which point the
        // Dashboard will redirect to login.
      }

      const accounts = nextInstance.getAllAccounts();
      console.log("Accounts found:", accounts.length);
      if (accounts.length > 0) {
        nextInstance.setActiveAccount(accounts[0]);
      }

      nextInstance.addEventCallback((event: EventMessage) => {
        if (
          event.eventType === EventType.LOGIN_SUCCESS &&
          event.payload
        ) {
          const payload = event.payload as AuthenticationResult;
          nextInstance.setActiveAccount(payload.account);
        }
      });

      setIsInitialized(true);
    })();
  }, []);

  if (!isInitialized || !instance) {
    return null;
  }

  return (
    <TeamsContext.Provider value={{ inTeams }}>
      <MsalReactProvider instance={instance}>{children}</MsalReactProvider>
    </TeamsContext.Provider>
  );
}
