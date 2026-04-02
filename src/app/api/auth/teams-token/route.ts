import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/auth/teams-token
 *
 * Exchanges a Teams SSO token (ID token) for a Microsoft Graph access token
 * using the OAuth 2.0 On-Behalf-Of (OBO) flow.
 *
 * Required env vars:
 *   NEXT_PUBLIC_AZURE_CLIENT_ID
 *   AZURE_CLIENT_SECRET
 *   NEXT_PUBLIC_AZURE_TENANT_ID
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const ssoToken: string | undefined = body?.ssoToken;

    if (!ssoToken || typeof ssoToken !== "string") {
      return NextResponse.json(
        { error: "Missing ssoToken in request body" },
        { status: 400 }
      );
    }

    const clientId = process.env.NEXT_PUBLIC_AZURE_CLIENT_ID;
    const clientSecret = process.env.AZURE_CLIENT_SECRET;
    const tenantId = process.env.NEXT_PUBLIC_AZURE_TENANT_ID || "common";

    if (!clientId || !clientSecret) {
      return NextResponse.json(
        { error: "Server is missing Azure AD configuration" },
        { status: 500 }
      );
    }

    const tokenEndpoint = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;

    const params = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: ssoToken,
      requested_token_use: "on_behalf_of",
      scope: "https://graph.microsoft.com/User.Read https://graph.microsoft.com/Mail.Read https://graph.microsoft.com/Mail.ReadBasic",
    });

    const tokenResponse = await fetch(tokenEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok) {
      console.error("OBO token exchange failed:", tokenData);

      // If consent is needed, return the specific error so the client can handle it
      if (
        tokenData.error === "interaction_required" ||
        tokenData.error === "invalid_grant"
      ) {
        return NextResponse.json(
          {
            error: "consent_required",
            message:
              "Admin consent or user consent is required for Graph API permissions.",
          },
          { status: 403 }
        );
      }

      return NextResponse.json(
        { error: tokenData.error_description || "Token exchange failed" },
        { status: 502 }
      );
    }

    return NextResponse.json({
      accessToken: tokenData.access_token,
      expiresIn: tokenData.expires_in,
    });
  } catch (err) {
    console.error("Teams token exchange error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
