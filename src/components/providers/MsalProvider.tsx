"use client";

import { MsalProvider as MsalReactProvider } from "@azure/msal-react";
import {
  PublicClientApplication,
  EventType,
  EventMessage,
  AuthenticationResult,
} from "@azure/msal-browser";
import { msalConfig } from "@/lib/msal-config";
import { useEffect, useState } from "react";

const msalInstance = new PublicClientApplication(msalConfig);

export default function MsalProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    msalInstance.initialize().then(async () => {
      // Only process redirect if the URL contains a hash with auth data
      const hash = window.location.hash;
      if (hash && (hash.includes("code=") || hash.includes("error="))) {
        try {
          const response = await msalInstance.handleRedirectPromise();
          if (response) {
            msalInstance.setActiveAccount(response.account);
          }
        } catch (err) {
          console.error("Redirect handling error:", err);
        }
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
    });
  }, []);

  if (!isInitialized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="animate-pulse text-slate-400">Initializing...</div>
      </div>
    );
  }

  return (
    <MsalReactProvider instance={msalInstance}>{children}</MsalReactProvider>
  );
}
