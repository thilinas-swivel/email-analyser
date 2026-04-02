import { Configuration, LogLevel } from "@azure/msal-browser";

const clientId = process.env.NEXT_PUBLIC_AZURE_CLIENT_ID || "";
const tenantId = process.env.NEXT_PUBLIC_AZURE_TENANT_ID || "";
const redirectUri = process.env.NEXT_PUBLIC_REDIRECT_URI || "http://localhost:3001";

// Log config in development for debugging
if (typeof window !== "undefined") {
  console.log("MSAL Config:", {
    clientId: clientId ? `${clientId.substring(0, 8)}...` : "NOT SET",
    tenantId: tenantId ? `${tenantId.substring(0, 8)}...` : "NOT SET (using common)",
    redirectUri,
  });
}

export const msalConfig: Configuration = {
  auth: {
    clientId,
    authority: `https://login.microsoftonline.com/${tenantId || "common"}`,
    redirectUri,
  },
  cache: {
    cacheLocation: "localStorage",
  },
  system: {
    allowRedirectInIframe: true,
    redirectNavigationTimeout: 10000,
    loggerOptions: {
      loggerCallback: (level, message, containsPii) => {
        if (containsPii) return;
        switch (level) {
          case LogLevel.Error:
            console.error(message);
            break;
          case LogLevel.Warning:
            console.warn(message);
            break;
        }
      },
    },
  },
};

export const loginRequest = {
  scopes: ["User.Read", "Mail.Read", "Mail.ReadBasic"],
};

export const graphScopes = {
  scopes: ["User.Read", "Mail.Read", "Mail.ReadBasic"],
};
