import { PromptSettings } from "./types";

const STORAGE_KEY_BASE = "mailsense-prompt-settings";

function storageKey(userEmail?: string): string {
  if (!userEmail) return STORAGE_KEY_BASE;
  return `${STORAGE_KEY_BASE}:${userEmail.toLowerCase()}`;
}

export const DEFAULT_SETTINGS: PromptSettings = {
  categorizationPrompt: `Categorize this email into one of: "Finance & Billing", "Client Communication", "Internal / Team", "Sales & Partnerships", "Legal & Compliance", "Marketing", "Product & Development", "HR & Recruitment", "Operations", "Newsletters & Updates", "Meeting & Calendar", "Support & Issues". Consider the sender, subject, and body content.`,
  buyingSignalPrompt: `Evaluate the buying intent of this email on a scale of 0-10. A buying signal means the sender is a NEW or POTENTIAL client exploring new project requirements, seeking assistance for new solutions, or discussing new business opportunities.

0 = No buying intent (internal emails, newsletters, notifications, routine meetings, existing project BAU communication, status updates, calendar invites, service notifications)
1-3 = Early interest (initial inquiry about capabilities, asking what services you offer, exploring potential collaboration)
4-6 = Active new opportunity (discussing specific new project requirements, requesting proposals, seeking solutions for a new problem, new client kick-off for a fresh engagement)
7-9 = Strong new business intent (budget discussions for new work, new project scoping, procurement process, contract negotiations for new engagement, RFP/RFI responses)
10 = Ready to engage (sign-off on new project, new purchase orders, new contract execution)

SCORE 0 for:
- Existing project updates, status meetings, or ongoing BAU work with current clients
- Meeting invitations, calendar scheduling, Teams/Zoom links
- Internal company emails, team updates, newsletters
- Automated notifications, service alerts (e.g. Supabase, Azure, CI/CD)
- Forwarded meeting invites without new project context
- Routine check-ins with existing clients about current work

Only score > 0 when an EXTERNAL party is genuinely exploring NEW work, NEW solutions, or NEW project requirements — not continuing existing engagements.`,
  priorityPrompt: `Assess the priority of this email for a C-suite executive:
- "critical": Requires immediate executive attention (legal risk, major client escalation, time-sensitive deal, board matters)
- "high": Important business matter needing attention within 24 hours
- "medium": Regular business communication, can be addressed within a few days
- "low": Informational, newsletters, routine updates, automated notifications`,
  executiveSummaryPrompt: `Write a 2-3 sentence executive briefing highlighting the most important items that need the executive's attention. Focus on: critical action items, high-value buying signals, urgent client issues, and strategic opportunities. Be concise and direct.`,
  defaultAnalysisStartDate: "2026-03-01",
  customKeywords: [],
  noiseEmailFilters: [
    "noreply@",
    "no-reply@",
    "donotreply@",
    "notifications@",
    "notification@",
    "mailer-daemon@",
    "postmaster@",
    "microsoft.com",
    "teams.microsoft",
    "slack.com",
    "slackbot",
    "powerbi",
    "sharepoint",
    "github.com",
    "amazonaws.com",
    "aws.amazon.com",
    "digitalocean.com",
    "supabase.com",
    "supabase.io",
    "anthropic.com",
    "read.ai",
    "readai.com",
    "mainfreight.com",
    "rooster.jobs",
    "azure.com",
  ],
  noiseNameFilters: [
    "in teams",
    "via teams",
    "power bi",
    "slack",
    "microsoft ",
  ],
  trackInternalEmails: true,
};

export function loadSettings(userEmail?: string): PromptSettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const key = storageKey(userEmail);
    let stored = localStorage.getItem(key);
    if (!stored && userEmail) {
      stored = localStorage.getItem(STORAGE_KEY_BASE);
    }
    if (!stored) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(stored);
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings: PromptSettings, userEmail?: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(storageKey(userEmail), JSON.stringify(settings));
}

/** Fetch settings from server (Azure Table), falling back to localStorage.
 *  On first load, migrates any existing localStorage settings to Azure Table. */
export async function loadSettingsAsync(userEmail: string): Promise<PromptSettings> {
  try {
    const res = await fetch(
      `/api/settings?userEmail=${encodeURIComponent(userEmail)}`
    );
    if (res.ok) {
      const data = await res.json();
      const serverHasSettings = data.fromStorage === true;
      const serverSettings = { ...DEFAULT_SETTINGS, ...data.settings };

      if (!serverHasSettings && typeof window !== "undefined") {
        // Server has no settings — migrate localStorage settings to Azure Table
        const local = loadSettings(userEmail);
        await saveSettingsAsync(local, userEmail);
        return local;
      }

      // Keep localStorage in sync as a fast cache
      if (typeof window !== "undefined") {
        localStorage.setItem(storageKey(userEmail), JSON.stringify(serverSettings));
      }
      return serverSettings;
    }
  } catch {
    // Network error — fall back to localStorage
  }
  return loadSettings(userEmail);
}

/** Save settings to server (Azure Table) and localStorage. */
export async function saveSettingsAsync(
  settings: PromptSettings,
  userEmail: string
): Promise<boolean> {
  // Always write to localStorage immediately for fast reads
  if (typeof window !== "undefined") {
    localStorage.setItem(storageKey(userEmail), JSON.stringify(settings));
  }
  try {
    const res = await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userEmail, settings }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
