import Anthropic from "@anthropic-ai/sdk";
import { PromptSettings } from "./types";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || "",
});

const CLAUDE_MODEL = process.env.CLAUDE_MODEL || "claude-sonnet-4-6";

export interface EmailForAnalysis {
  id: string;
  subject: string;
  from: string;
  fromEmail: string;
  bodyPreview: string;
  receivedDateTime: string;
  importance: string;
  hasAttachments: boolean;
}

export interface LLMEmailAnalysis {
  id: string;
  category: string;
  summary: string;
  priority: "critical" | "high" | "medium" | "low";
  sentiment: "positive" | "neutral" | "negative" | "urgent";
  buyingSignal: {
    score: number;
    intent: string;
    stage: "no-signal" | "awareness" | "consideration" | "decision" | "purchase";
  };
  actionRequired: string | null;
  keyTopics: string[];
}

export interface LLMBatchResult {
  analyses: LLMEmailAnalysis[];
  executiveSummary: string;
}

function buildPrompt(emails: EmailForAnalysis[], settings?: PromptSettings): string {
  const emailList = emails
    .map(
      (e, i) =>
        `--- EMAIL ${i + 1} (id: ${e.id}) ---
From: ${e.from} <${e.fromEmail}>
Subject: ${e.subject}
Date: ${e.receivedDateTime}
Importance: ${e.importance}
Attachments: ${e.hasAttachments ? "Yes" : "No"}
Preview: ${e.bodyPreview}
---`
    )
    .join("\n\n");

  const categorizationGuidance = settings?.categorizationPrompt
    ? `\nCATEGORIZATION GUIDANCE:\n${settings.categorizationPrompt}\n`
    : "";

  const buyingGuidance = settings?.buyingSignalPrompt
    ? `\nBUYING SIGNAL GUIDANCE:\n${settings.buyingSignalPrompt}\n`
    : "";

  const priorityGuidance = settings?.priorityPrompt
    ? `\nPRIORITY GUIDANCE:\n${settings.priorityPrompt}\n`
    : "";

  const summaryGuidance = settings?.executiveSummaryPrompt
    ? `\nEXECUTIVE SUMMARY GUIDANCE:\n${settings.executiveSummaryPrompt}\n`
    : "";

  const customKeywordsNote =
    settings?.customKeywords && settings.customKeywords.length > 0
      ? `\nADDITIONAL BUYING KEYWORDS TO WATCH FOR: ${settings.customKeywords.join(", ")}\n`
      : "";

  return `You are an executive email analyst for a C-suite leader. Analyze each email below and return structured JSON.
${categorizationGuidance}${buyingGuidance}${priorityGuidance}${summaryGuidance}${customKeywordsNote}
For each email provide:
- "id": the email id provided
- "category": one of: "Finance & Billing", "Client Communication", "Internal / Team", "Sales & Partnerships", "Legal & Compliance", "Marketing", "Product & Development", "HR & Recruitment", "Operations", "Newsletters & Updates", "Meeting & Calendar", "Support & Issues"
- "summary": a 1-sentence executive summary (max 20 words)
- "priority": "critical", "high", "medium", or "low" — based on business impact for a C-suite executive
- "sentiment": "positive", "neutral", "negative", or "urgent"
- "buyingSignal": an object with:
  - "score": 0-10 (0 = no buying intent, 10 = ready to purchase)
  - "intent": brief description of the buying intent, or "none"
  - "stage": "no-signal", "awareness", "consideration", "decision", or "purchase"
- "actionRequired": a brief recommended action, or null if no action needed
- "keyTopics": array of 1-3 key topic words

Also provide an "executiveSummary" (2-3 sentences) highlighting the most important items across all emails that need the executive's attention.

Return ONLY valid JSON in this exact format:
{
  "analyses": [ { ...fields above for each email... } ],
  "executiveSummary": "..."
}

EMAILS:

${emailList}`;
}

export async function analyzeWithClaude(
  emails: EmailForAnalysis[],
  settings?: PromptSettings
): Promise<LLMBatchResult> {
  // Process in batches of 20 to stay within context limits
  const BATCH_SIZE = 20;
  const allAnalyses: LLMEmailAnalysis[] = [];
  let lastSummary = "";

  for (let i = 0; i < emails.length; i += BATCH_SIZE) {
    const batch = emails.slice(i, i + BATCH_SIZE);
    const prompt = buildPrompt(batch, settings);

    const response = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 4096,
      messages: [{ role: "user", content: prompt }],
    });

    const text =
      response.content[0].type === "text" ? response.content[0].text : "";

    // Extract JSON from response (handle markdown code blocks)
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error("Failed to parse Claude response:", text);
      continue;
    }

    try {
      const parsed: LLMBatchResult = JSON.parse(jsonMatch[0]);
      allAnalyses.push(...parsed.analyses);
      lastSummary = parsed.executiveSummary;
    } catch (parseErr) {
      console.error("JSON parse error:", parseErr);
    }
  }

  // If we had multiple batches, ask Claude for a combined summary
  if (emails.length > BATCH_SIZE && allAnalyses.length > 0) {
    const criticalItems = allAnalyses
      .filter((a) => a.priority === "critical" || a.priority === "high")
      .slice(0, 10)
      .map((a) => `- [${a.priority}] ${a.summary}`)
      .join("\n");

    const buyingItems = allAnalyses
      .filter((a) => a.buyingSignal.score >= 5)
      .slice(0, 5)
      .map((a) => `- Score ${a.buyingSignal.score}: ${a.buyingSignal.intent}`)
      .join("\n");

    const summaryResponse = await anthropic.messages.create({
      model: "claude-sonnet-4-5-20250514",
      max_tokens: 512,
      messages: [
        {
          role: "user",
          content: `You're briefing a C-suite executive. Write a 2-3 sentence executive summary based on these email highlights:

HIGH PRIORITY:
${criticalItems || "None"}

BUYING SIGNALS:
${buyingItems || "None"}

Total emails analyzed: ${allAnalyses.length}
Return only the summary text, no JSON.`,
        },
      ],
    });

    lastSummary =
      summaryResponse.content[0].type === "text"
        ? summaryResponse.content[0].text
        : lastSummary;
  }

  return {
    analyses: allAnalyses,
    executiveSummary: lastSummary,
  };
}
