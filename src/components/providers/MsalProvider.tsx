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
  const [authError, setAuthError] = useState<string | null>(null);
  const [instance, setInstance] = useState<PublicClientApplication | null>(null);

  const clearAuthAndRetry = () => {
    // Clear MSAL cache from local/session storage
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.startsWith("msal.") || key.includes("login.windows"))) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((key) => localStorage.removeItem(key));
    
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key && (key.startsWith("msal.") || key.includes("login.windows"))) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((key) => sessionStorage.removeItem(key));
    
    // Reload the page
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
        // Inside Teams: notify that we're loaded, MSAL is still initialized
        // but auth will use Teams SSO → OBO instead of redirect.
        await nextInstance.initialize();
        await notifyTeamsAppLoaded();
        setIsInitialized(true);
        return;
      }

      // Browser flow: normal MSAL redirect handling
      await nextInstance.initialize();

      // Always call handleRedirectPromise - it's safe to call even without a redirect
      try {
        const response = await nextInstance.handleRedirectPromise();
        if (response && response.account) {
          console.log("Login successful, setting active account");
          nextInstance.setActiveAccount(response.account);
          // Clear the hash from URL after successful login
          if (window.location.hash) {
            window.history.replaceState(null, "", window.location.pathname);
          }
        }
      } catch (err) {
        console.error("Redirect handling error:", err);
        // Check for timeout or interaction errors that need cache clearing
        const errorMsg = err instanceof Error ? err.message : String(err);
        if (errorMsg.includes("timed_out") || errorMsg.includes("interaction_in_progress")) {
          setAuthError(errorMsg);
          return; // Don't continue - show error UI
        }
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

  if (authError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="max-w-md w-full mx-4 bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center">
          <div className="w-16 h-16 mx-auto mb-4 bg-red-500/10 rounded-full flex items-center justify-center">
            <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-white mb-2">Authentication Error</h2>
          <p className="text-slate-400 mb-6 text-sm">
            Your session timed out or was interrupted. Click below to clear the cache and try again.
          </p>
          <button
            onClick={clearAuthAndRetry}
            className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3 px-6 rounded-xl transition-colors"
          >
            Clear Cache & Retry
          </button>
        </div>
      </div>
    );
  }

  if (!isInitialized || !instance) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="animate-pulse text-slate-400">Initializing...</div>
      </div>
    );
  }

  return (
    <TeamsContext.Provider value={{ inTeams }}>
      <MsalReactProvider instance={instance}>{children}</MsalReactProvider>
    </TeamsContext.Provider>
  );
}
