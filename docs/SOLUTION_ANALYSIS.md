# MailSense - Solution Analysis Document

**Project:** MailSense - AI-Powered Executive Email Dashboard
**Date:** 2026-04-05
**Framework:** Next.js 16.2.1 with App Router
**AI Provider:** Anthropic Claude API
**Auth:** Microsoft Azure AD (MSAL) + Microsoft Graph API
**Platform:** Web (standalone) and Microsoft Teams (embedded)

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Architecture & Tech Stack](#2-architecture--tech-stack)
3. [Directory Structure](#3-directory-structure)
4. [Core Features](#4-core-features)
5. [Data Flow](#5-data-flow)
6. [API Routes](#6-api-routes)
7. [State Management](#7-state-management)
8. [Configuration](#8-configuration)
9. [Notable Patterns](#9-notable-patterns)

---

## 1. Executive Summary

**MailSense** is an AI-powered email analytics dashboard built for C-suite executives who use Microsoft Outlook. It solves the problem of email overload by automatically:

- **Categorizing unread emails** into 12+ categories (Finance, Client Communication, Internal/Team, Sales, Legal, Marketing, etc.)
- **Identifying unreplied emails** by checking if the user has sent a reply in the same conversation thread
- **Detecting buying signals** using 40+ keywords with scoring (Hot/Warm/Prospect)
- **Tracking client threads** with urgency scoring and priority ratings
- **Generating AI-powered executive briefings** summarizing the most important items

The application runs both as a standalone web application and can be embedded inside **Microsoft Teams**.

---

## 2. Architecture & Tech Stack

### Framework

| Component | Version |
|-----------|---------|
| Next.js | 16.2.1 (App Router) |
| React | 19.2.4 |
| TypeScript | Strict mode enabled |
| React Compiler (Babel) | Enabled for automatic memoization |
| Tailwind CSS | v4 via `@tailwindcss/postcss` |
| Output | Standalone Docker-friendly build |

### Key Libraries

| Library | Purpose |
|---------|---------|
| `@azure/msal-browser` + `@azure/msal-react` | Azure AD / Microsoft identity authentication |
| `@microsoft/microsoft-graph-client` | Microsoft Graph API for reading email |
| `@anthropic-ai/sdk` | Claude AI for email analysis |
| `@microsoft/teams-js` | Microsoft Teams SDK (SSO, embedding) |
| `recharts` | Charts (Area, Pie, Bar) |
| `date-fns` | Date manipulation |
| `lucide-react` | Icons |
| `@azure/data-tables` + `@azure/storage-blob` | Azure Table/Blob storage for analysis caching |

### Architecture Pattern

- **Server Components** for layout/metadata
- **Client Components** (`"use client"`) for all interactive dashboard elements
- **API Routes** (`src/app/api/`) for server-side operations (token exchange, AI analysis)
- **Service modules** (`src/lib/`) for business logic, Graph API, Claude, caching
- **Context-based state** for Teams integration (`TeamsContext`)

---

## 3. Directory Structure

```
src/
├── app/
│   ├── layout.tsx              # Root layout with MSAL provider
│   ├── page.tsx                # Home redirect to Dashboard
│   ├── globals.css             # Tailwind + custom scrollbar
│   ├── settings/
│   │   └── page.tsx            # Settings page wrapper
│   └── api/
│       ├── analyze/
│       │   └── route.ts        # POST: Claude email analysis endpoint
│       └── auth/
│           └── teams-token/
│               └── route.ts    # POST: Teams SSO token → Graph token exchange
├── components/
│   ├── providers/
│   │   └── MsalProvider.tsx    # MSAL init, Teams detection, auth error handling
│   ├── dashboard/
│   │   ├── Dashboard.tsx        # Main orchestrator component
│   │   ├── DashboardHeader.tsx # Top bar with profile, refresh, date picker
│   │   ├── StatsOverview.tsx    # KPI cards (threads, critical, avg response, etc.)
│   │   ├── ExecutiveSummary.tsx# AI briefing with attention items
│   │   ├── TrendChart.tsx      # Unread volume over time (AreaChart)
│   │   ├── TopSendersTable.tsx # Most active external contacts
│   │   ├── UnreadSection.tsx   # Unread emails by category (PieChart + list)
│   │   ├── UnrepliedSection.tsx# Unreplied by category (BarChart + expandable)
│   │   ├── BuyingSignalsSection.tsx # Emails with buying intent (table)
│   │   ├── ClientTrackerTable.tsx   # Client threads with urgency/buy intent
│   │   ├── InternalEmailsTracker.tsx # Internal (same-domain) threads
│   │   ├── CategoryEmailsModal.tsx  # Drill-down modal for category emails
│   │   └── DateRangePicker.tsx      # Date range selector (presets + custom)
│   └── settings/
│       └── SettingsPage.tsx    # AI prompt settings, filters, internal toggle
└── lib/
    ├── msal-config.ts          # MSAL Configuration, loginRequest, graphScopes
    ├── graph-service.ts        # Microsoft Graph API calls (emails, profile)
    ├── claude-service.ts       # Claude API prompt building, batch analysis
    ├── email-analyzer.ts       # Keyword-based email categorization, thread building
    ├── analysis-cache.ts       # Azure Table/Blob caching for AI results
    ├── prompt-settings.ts     # Default + localStorage AI prompt settings
    ├── teams-context.ts        # Teams SDK initialization, SSO token retrieval
    └── types.ts                # TypeScript interfaces (Email, DashboardStats, etc.)
```

---

## 4. Core Features

### 4.1 Authentication Flow (MSAL / Azure AD)

There are **two authentication paths**:

#### Browser Flow (standalone web app)

1. User clicks "Sign in with Microsoft"
2. `instance.loginRedirect(loginRequest)` triggers Azure AD redirect
3. After login, `handleRedirectPromise()` captures the token
4. Token stored in MSAL's `localStorage` cache
5. `acquireTokenSilent()` fetches Graph API tokens for subsequent calls

#### Teams SSO Flow (embedded in Teams)

1. `initializeTeams()` detects Teams environment via `microsoftTeams.app.initialize()`
2. `getTeamsSsoToken()` gets a Teams SSO ID token (no popup/redirect)
3. POST to `/api/auth/teams-token` which performs **OAuth 2.0 OBO flow** (On-Behalf-Of):
   - Sends the ID token to `https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token`
   - Exchanges it for a Microsoft Graph access token using `AZURE_CLIENT_SECRET`
4. The Graph access token is returned to the client

### 4.2 Email Fetching (Microsoft Graph API)

Three key Graph API calls in `src/lib/graph-service.ts`:

```typescript
getUserProfile(token)           // GET /me  → displayName, mail, jobTitle, photo
getUnreadEmails(token, top=200)  // GET /me/messages?$filter=isRead eq false
getAllRecentEmails(token, start, end, top=1000) // Paginated, includes body
getSentEmails(token, start, end) // GET /me/mailFolders/sentItems/messages
```

Emails include: `id, subject, from, toRecipients, ccRecipients, receivedDateTime, bodyPreview, importance, categories, hasAttachments, conversationId, flag`.

### 4.3 Email Analysis

#### Phase 1 - Instant Keyword-Based (Synchronous)

The `analyzeEmails()` function in `email-analyzer.ts` runs immediately:

- **Categorizes emails** using keyword matching against 12 categories:
  - Client Communication, Internal/Team, Sales Inquiry, Finance, Legal, Marketing, HR/Recruitment, IT/Technical, Product, Event/Meeting, Personal, Other
- **Identifies unreplied emails** by checking if the user has sent a reply in the same `conversationId`
- **Builds client threads** grouped by sender email (excluding internal/noise addresses)
- **Builds internal threads** grouped by sender address (same domain as user)
- **Calculates urgency scores** based on age, importance, and flag status

#### Phase 2 - Claude AI Enrichment (Async, Background)

The `analyzeWithClaude()` function in `claude-service.ts` processes emails in batches of 10:

1. Builds a detailed prompt with:
   - Email metadata (from, to, subject, body preview, recipient type TO/CC/BCC)
   - Custom prompt guidance from settings (categorization, buying signals, priority)
   - Custom buying keywords from user settings
2. Claude returns structured JSON with per-email analysis plus executive summary
3. Results are cached in Azure Table Storage for reuse

The prompt instructs Claude to determine `replyNeeded` by analyzing whether the user is in TO/CC/BCC and whether the email explicitly requests the user's response.

### 4.4 Dashboard Components

The main `Dashboard.tsx` component orchestrates:

1. Date range selection (default: last month)
2. Token acquisition (Teams or browser)
3. Parallel fetch of profile + emails + sent emails
4. Instant keyword analysis → rendered immediately
5. Background AI enrichment → re-renders with AI results

---

## 5. Data Flow

The complete path from user action to AI analysis result:

```
User opens Dashboard
    │
    ├─► [Teams?] ──► getTeamsSsoToken() ──► POST /api/auth/teams-token
    │                                           └── OBO flow ──► Graph access token
    │
    └─► [Browser?] ──► acquireTokenSilent() ──► Graph access token
    │
    ▼
getUserProfile(token)          ──► User display name, email, photo
getAllRecentEmails(token)      ──► Array<Email> (up to 1000)
getSentEmails(token)           ──► Array<Email> (sent items for reply detection)
    │
    ▼
analyzeEmails(allEmails, sentEmails, dateRange, settings, userEmail)
    │
    ├─ Categorize unread: keyword matching against CATEGORY_KEYWORDS
    ├─ Find unreplied: emails where conversationId has NO sent item
    ├─ Build client threads: group by sender address (external only)
    ├─ Build internal threads: group by sender address (same domain)
    ├─ Calculate urgency: days + importance + flag
    └─ Returns: DashboardStats (rendered immediately)
    │
    ▼
POST /api/analyze { emails, promptSettings, userEmail, startDate, endDate }
    │
    ├─ Check per-email cache (Azure Table) ──► return cached analyses
    │
    ├─ Analyze uncached emails with Claude (batches of 10)
    │      └── buildPrompt() → Claude Messages API
    │      └── Parse JSON response → LLMBatchResult
    │      └── Save to Azure Table cache
    │
    └─ Return: { analyses, executiveSummary, attentionItems, fromCache, newEmailsAnalyzed }
    │
    ▼
enrichWithLLMResults(dashboardStats, allEmails, llmResult)
    │
    ├─ Re-categorize emails using LLM categories
    ├─ Upgrade buying signals with LLM scores/stages
    ├─ Update client thread urgency from LLM priority
    ├─ Update internal thread replyNeeded from LLM analysis
    └─ Returns: enriched DashboardStats (re-render)
```

---

## 6. API Routes

### `POST /api/analyze`

**Purpose:** Claude AI email analysis endpoint

**Request Body:**
```typescript
{
  emails: EmailForAnalysis[],
  promptSettings: PromptSettings,
  userEmail: string,
  startDate: string,
  endDate: string,
  forceRefresh?: boolean
}
```

**Behavior:**
1. Checks Azure Table cache for each email ID
2. Sends uncached emails to Claude in batches of 10
3. Saves new analyses to Azure Table cache
4. Returns combined results

**Response:**
```typescript
{
  analyses: LLMEmailAnalysis[],
  executiveSummary: string,
  attentionItems: AttentionItem[],
  fromCache: number,
  newEmailsAnalyzed: number
}
```

### `POST /api/auth/teams-token`

**Purpose:** OAuth 2.0 On-Behalf-Of flow for Teams SSO

**Request Body:**
```typescript
{
  ssoToken: string  // Teams SSO ID token
}
```

**Behavior:**
1. Exchanges the Teams SSO ID token for a Microsoft Graph access token
2. Uses `AZURE_CLIENT_SECRET` for confidential client flow

**Response:**
```typescript
{
  accessToken: string,
  expiresIn: number
}
```

---

## 7. State Management

- **React `useState` + `useCallback`** in `Dashboard.tsx` for all application state
- **`useTeamsContext`** custom React context to share `inTeams` flag across components
- **`MsalProvider`** wraps the app providing MSAL instance via React context
- **`localStorage`** for user prompt settings (persisted via `prompt-settings.ts`)
- **No Redux/Zustand/Jotai** — state is co-located and relatively simple

---

## 8. Configuration

### Environment Variables

```bash
# Azure AD / Microsoft Entra ID (required for auth)
NEXT_PUBLIC_AZURE_CLIENT_ID=     # App registration client ID
NEXT_PUBLIC_AZURE_TENANT_ID=     # Directory tenant ID
NEXT_PUBLIC_REDIRECT_URI=        # Redirect URI (default: http://localhost:3001)
AZURE_CLIENT_SECRET=              # For Teams OBO flow token exchange

# Anthropic Claude API (required for AI analysis)
ANTHROPIC_API_KEY=               # API key from console.anthropic.com
CLAUDE_MODEL=                     # Model name (default: claude-sonnet-4-6)

# Azure Storage (optional, for analysis caching)
AZURE_STORAGE_CONNECTION_STRING= # Connection string for Table/Blob storage
```

### Azure AD App Registration Requirements

The app registration must have:
- **Web platform** redirect URIs configured
- **API permissions:** `Mail.Read`, `User.Read` (Graph API delegated permissions)
- **Implicit grant:** ID tokens enabled (for MSAL)

---

## 9. Notable Patterns

### 1. Two-Phase Dashboard Rendering

Keyword analysis renders instantly; AI analysis runs in background and "upgrades" the dashboard when complete. Users see data immediately without waiting for Claude.

### 2. Per-Email Caching

Instead of caching whole date-range analyses, individual email analyses are cached by email ID using Azure Table Storage. This means only truly new emails are sent to Claude on refresh.

### 3. Recipient Type Awareness

The prompt explicitly teaches Claude about TO/CC/BCC distinction, instructing it that CC'd emails generally don't need replies unless the user is specifically addressed.

### 4. Noise Filtering

Multiple layers of filtering exclude system/automated emails from analytics:
- Email address patterns (noreply@, microsoft.com)
- Sender name patterns ("in teams", "power bi")
- Same-domain detection for internal emails

### 5. Teams Embedding

The app detects its Teams environment before initializing MSAL, allowing seamless SSO without any login popup when embedded in Teams.

### 6. Batch AI Processing

Emails are sent to Claude in batches of 10 with `max_tokens=8192`. For large inboxes, a second pass asks Claude to synthesize a combined executive summary from the batch results.

### 7. Reply Detection

An email is considered "unreplied" if no sent item exists with the same `conversationId`. This is a Graph API-side filtering approach.

### 8. Internal Email Tracking

Emails from the same domain as the user are tracked separately in the "Internal Email Tracker" section, with a settings toggle to disable this feature entirely.

### 9. Content Security Policy

Configured in `next.config.ts` to allow embedding in Teams iframes via `frame-ancestors`.

---

## Appendix: Key Type Definitions

### Email Interface (types.ts)

```typescript
interface Email {
  id: string;
  subject: string;
  from: { emailAddress: { name: string; address: string } };
  toRecipients: { emailAddress: { name: string; address: string } }[];
  ccRecipients: { emailAddress: { name: string; address: string } }[];
  receivedDateTime: string;
  bodyPreview: string;
  importance: 'low' | 'normal' | 'high';
  categories?: string[];
  hasAttachments: boolean;
  conversationId: string;
  flag?: { flagStatus: 'notFlagged' | 'flagged' | 'complete' };
}
```

### DashboardStats Interface (types.ts)

```typescript
interface DashboardStats {
  totalUnread: number;
  unreadByCategory: Record<string, number>;
  unrepliedByCategory: Record<string, number>;
  buyingSignals: Email[];
  clientThreads: ClientThread[];
  internalThreads: InternalThread[];
  topSenders: SenderStats[];
  trendData: TrendDataPoint[];
  averageResponseDays: number;
  criticalCount: number;
  threadsAwaitingReply: number;
  emailsWithBuyIntent: number;
}
```

---

*Document generated from codebase analysis on 2026-04-05*
