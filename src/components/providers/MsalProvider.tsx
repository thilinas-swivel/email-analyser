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
  isInTeams,
  notifyTeamsAppLoaded,
} from "@/lib/teams-context";

const msalInstance = new PublicClientApplication(msalConfig);

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

  useEffect(() => {
    (async () => {
      // Try Teams first — quick timeout means this won't block on browsers
      const teamsDetected = await initializeTeams();
      setInTeams(teamsDetected);

      if (teamsDetected) {
        // Inside Teams: notify that we're loaded, MSAL is still initialized
        // but auth will use Teams SSO → OBO instead of redirect.
        await msalInstance.initialize();
        await notifyTeamsAppLoaded();
        setIsInitialized(true);
        return;
      }

      // Browser flow: normal MSAL redirect handling
      await msalInstance.initialize();

      // Always call handleRedirectPromise - it's safe to call even without a redirect
      try {
        const response = await msalInstance.handleRedirectPromise();
        if (response) {
          msalInstance.setActiveAccount(response.account);
          // Clear the hash from URL after successful login
          if (window.location.hash) {
            window.history.replaceState(null, "", window.location.pathname);
          }
        }
      } catch (err) {
        console.error("Redirect handling error:", err);
      }

      const accounts = msalInstance.getAllAccounts();
      if (accounts.length > 0) {
        msalInstance.setActiveAccount(accounts[0]);
      }

      msalInstance.addEventCallback((event: EventMessage) => {
        if (
          event.eventType === EventType.LOGIN_SUCCESS &&
          event.payload
        ) {
          const payload = event.payload as AuthenticationResult;
          msalInstance.setActiveAccount(payload.account);
        }
      });

      setIsInitialized(true);
    })();
  }, []);

  if (!isInitialized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="animate-pulse text-slate-400">Initializing...</div>
      </div>
    );
  }

  return (
    <TeamsContext.Provider value={{ inTeams }}>
      <MsalReactProvider instance={msalInstance}>{children}</MsalReactProvider>
    </TeamsContext.Provider>
  );
}
