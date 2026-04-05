import { PromptSettings } from "./types";

const STORAGE_KEY = "mailsense-prompt-settings";

export const DEFAULT_SETTINGS: PromptSettings = {
  categorizationPrompt: `Categorize this email into one of: "Finance & Billing", "Client Communication", "Internal / Team", "Sales & Partnerships", "Legal & Compliance", "Marketing", "Product & Development", "HR & Recruitment", "Operations", "Newsletters & Updates", "Meeting & Calendar", "Support & Issues". Consider the sender, subject, and body content.`,
  buyingSignalPrompt: `Evaluate the buying intent of this email on a scale of 0-10 where:
0 = No buying intent at all (internal emails, newsletters, social notifications)
1-3 = Slight interest (general inquiries, information requests)
4-6 = Active consideration (comparing options, requesting demos/trials, discussing requirements)
7-9 = Strong buying intent (budget discussions, timeline requests, procurement process, contract negotiations)
10 = Ready to purchase (purchase orders, sign-off requests, payment discussions)

IMPORTANT: Internal company emails, calendar invites, team updates, newsletters, and automated notifications should ALWAYS score 0. Only score > 0 for emails from external parties showing genuine commercial interest.`,
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

export function loadSettings(): PromptSettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(stored);
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings: PromptSettings): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}
