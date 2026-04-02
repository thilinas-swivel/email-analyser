# Teams App Setup Guide

## Overview
This guide covers deploying the Email Intelligence Dashboard as a Microsoft Teams personal tab app.

---

## 1. Azure AD App Registration Updates

Your existing app registration (`1de2ae6b-d413-4750-b62e-3606af211aee`) needs these additional configurations:

### a) Add a Client Secret
1. Go to **Azure Portal → App Registrations → Your App → Certificates & secrets**
2. Click **New client secret**, give it a description, pick expiry
3. Copy the secret value → set as `AZURE_CLIENT_SECRET` env var

### b) Expose an API (for Teams SSO)
1. Go to **Expose an API**
2. Set the **Application ID URI** to:
   ```
   api://YOUR_DOMAIN/1de2ae6b-d413-4750-b62e-3606af211aee
   ```
   For local dev: `api://localhost:3001/1de2ae6b-d413-4750-b62e-3606af211aee`

3. Add a scope:
   - Scope name: `access_as_user`
   - Who can consent: **Admins and users**
   - Admin consent display name: `Access Email Intelligence as the user`
   - Admin consent description: `Allow the app to access Email Intelligence on behalf of the signed-in user`
   - State: **Enabled**

4. Add authorized client applications (Teams clients):
   - `1fec8e78-bce4-4aaf-ab1b-5451cc387264` (Teams desktop/mobile)
   - `5e3ce6c0-2b1f-4285-8d4b-75ee78787346` (Teams web)
   - Select the `access_as_user` scope for both

### c) API Permissions
Ensure these **delegated** permissions are granted (with admin consent):
- `User.Read`
- `Mail.Read`
- `Mail.ReadBasic`

### d) Add SPA Redirect URI
Ensure your deployed URL is registered as a **Single-page application** redirect URI:
- `https://YOUR_DOMAIN/` (production)
- `http://localhost:3001` (local dev)

---

## 2. Environment Variables

```env
# .env.local
NEXT_PUBLIC_AZURE_CLIENT_ID=1de2ae6b-d413-4750-b62e-3606af211aee
NEXT_PUBLIC_AZURE_TENANT_ID=1c9c1873-35f4-41c9-a094-0279b9c8dd76
NEXT_PUBLIC_REDIRECT_URI=https://YOUR_DOMAIN
AZURE_CLIENT_SECRET=your-client-secret-here
ANTHROPIC_API_KEY=your-anthropic-key
```

> `AZURE_CLIENT_SECRET` is **server-side only** (no `NEXT_PUBLIC_` prefix). It's used by the OBO token exchange endpoint at `/api/auth/teams-token`.

---

## 3. Prepare the Teams Manifest

1. Open `teams-manifest/manifest.json`
2. Replace ALL placeholders:
   - `{{MICROSOFT_APP_ID}}` → `1de2ae6b-d413-4750-b62e-3606af211aee`
   - `{{YOUR_DOMAIN}}` → your deployed domain (e.g., `email-intel.azurewebsites.net`)
3. Replace `color.png` and `outline.png` with real PNG icons:
   - `color.png`: 192×192 px, full color
   - `outline.png`: 32×32 px, white outline on transparent
4. Zip the 3 files (`manifest.json`, `color.png`, `outline.png`) into `email-intelligence.zip`

---

## 4. Deploy the Next.js App

Deploy to any HTTPS-enabled host. Examples:
- **Azure App Service**: `az webapp up --name email-intel --runtime "NODE:20-lts"`
- **Vercel**: `vercel --prod`

Ensure the deployed URL matches `validDomains` in the manifest and the Azure AD redirect URIs.

---

## 5. Install in Teams

### Option A: Developer Portal
1. Go to https://dev.teams.microsoft.com/apps
2. Click **Import app** → upload your zip
3. Click **Publish → Publish to your org**
4. An admin approves in **Teams Admin Center → Manage apps**

### Option B: Sideload (for testing)
1. In Teams, click **Apps → Manage your apps → Upload a custom app**
2. Select the zip file
3. The app appears as a personal tab

---

## 6. How Auth Works in Teams

```
User opens Teams tab
  → Teams JS SDK initializes
  → getAuthToken() returns SSO ID token (no popup!)
  → Client sends ID token to /api/auth/teams-token
  → Server exchanges via OBO flow → Graph access token
  → Client uses Graph token to read Outlook emails
```

When running outside Teams (browser), the normal MSAL redirect flow is used.

---

## 7. Troubleshooting

| Issue | Fix |
|-------|-----|
| `consent_required` error | Admin must grant consent: Azure Portal → App Registration → API permissions → Grant admin consent |
| `invalid_grant` from OBO | Check that `AZURE_CLIENT_SECRET` is correct and not expired |
| App doesn't load in Teams | Check CSP headers allow `frame-ancestors` for Teams domains |
| Teams SSO returns error | Verify the Application ID URI matches `api://DOMAIN/CLIENT_ID` |
| Icons not showing | Ensure icons are actual PNG files (not SVG renamed to .png) |
