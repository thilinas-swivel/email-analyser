# Executive Email Intelligence Dashboard

A Next.js dashboard for C-suite executives to analyze and manage their Outlook inbox with intelligent categorization, response tracking, and buying signal detection.

## Features

- **Unread Email Categorization** - Auto-categorizes unread emails into 12+ categories with pie chart and drill-down
- **Unreplied Email Tracking** - Identifies emails you haven't responded to, with urgency scoring
- **Buying Signal Detection** - Scans for 40+ buying intent keywords, ranks Hot/Warm/Prospect
- **Analytics Overview** - KPI cards: unread, unreplied, buying signals, urgent, avg response time
- **Unread Trend** - 14-day area chart of incoming unread volume
- **Top Senders** - Ranked list of most active contacts

## Setup

### 1. Register an Azure AD App

1. Go to Azure Portal > Microsoft Entra ID > App registrations > New registration
2. Redirect URI: Single-page application (SPA) > `http://localhost:3000`
3. Note the Application (client) ID and Directory (tenant) ID

### 2. API Permissions

Add delegated permissions: `User.Read`, `Mail.Read`, `Mail.ReadBasic`

### 3. Configure Environment

```bash
cp .env.example .env.local
```

Fill in `NEXT_PUBLIC_AZURE_CLIENT_ID` and `NEXT_PUBLIC_AZURE_TENANT_ID`.

### 4. Run

```bash
npm install
npm run dev
```

Open http://localhost:3000 and sign in with Microsoft.
