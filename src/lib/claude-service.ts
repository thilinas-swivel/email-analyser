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
  bodyContent: string;
  receivedDateTime: string;
  importance: string;
  hasAttachments: boolean;
  recipientType: "to" | "cc" | "bcc"; // Whether user is in TO, CC, or BCC
  toRecipients?: string[]; // Names of TO recipients
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
  replyNeeded: boolean;
  draftReply: string | null;
  keyTopics: string[];
}

export interface AttentionItem {
  priority: "critical" | "high" | "medium";
  title: string;
  description: string;
  emailCount: number;
  senders: string[];
}

export interface LLMBatchResult {
  analyses: LLMEmailAnalysis[];
  executiveSummary: string;
  attentionItems?: AttentionItem[];
}

const MAX_EMAILS_PER_BATCH = 5;
const MAX_BATCH_CHARS = 45000;

function estimateEmailSize(email: EmailForAnalysis): number {
  return (
    email.subject.length +
    email.from.length +
    email.fromEmail.length +
    email.bodyPreview.length +
    email.bodyContent.length +
    (email.toRecipients?.join(", ").length ?? 0) +
    250
  );
}

function chunkEmailsForAnalysis(emails: EmailForAnalysis[]): EmailForAnalysis[][] {
  const batches: EmailForAnalysis[][] = [];
  let currentBatch: EmailForAnalysis[] = [];
  let currentSize = 0;

  for (const email of emails) {
    const emailSize = estimateEmailSize(email);
    const wouldOverflow =
      currentBatch.length > 0 &&
      (currentBatch.length >= MAX_EMAILS_PER_BATCH || currentSize + emailSize > MAX_BATCH_CHARS);

    if (wouldOverflow) {
      batches.push(currentBatch);
      currentBatch = [];
      currentSize = 0;
    }

    currentBatch.push(email);
    currentSize += emailSize;
  }

  if (currentBatch.length > 0) {
    batches.push(currentBatch);
  }

  return batches;
}

function buildPrompt(
  emails: EmailForAnalysis[],
  settings?: PromptSettings,
  userEmail?: string,
  userName?: string
): string {
  const emailList = emails
    .map(
      (e, i) =>
        `--- EMAIL ${i + 1} (id: ${e.id}) ---
From: ${e.from} <${e.fromEmail}>
To: ${e.toRecipients?.join(", ") || "(not specified)"}
User is in: ${e.recipientType.toUpperCase()}
Subject: ${e.subject}
Date: ${e.receivedDateTime}
Importance: ${e.importance}
Attachments: ${e.hasAttachments ? "Yes" : "No"}
Preview: ${e.bodyPreview}
Full Body:
"""
${e.bodyContent || "(empty)"}
"""
---`
    )
    .join("\n\n");

  const userContext = userEmail 
    ? `\nYOU ARE ANALYZING FOR: ${userEmail}${userName ? ` (${userName})` : ""}\nDetermine if THIS specific user needs to reply, not if the email needs a reply in general. Use the full body as the primary source of truth; the preview is only a convenience.\n`
    : "";

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
${userContext}${categorizationGuidance}${buyingGuidance}${priorityGuidance}${summaryGuidance}${customKeywordsNote}
For each email provide:
- "id": the email id provided
- "category": one of: "Finance & Billing", "Client Communication", "Internal / Team", "Sales & Partnerships", "Legal & Compliance", "Marketing", "Product & Development", "HR & Recruitment", "Operations", "Newsletters & Updates", "Meeting & Calendar", "Support & Issues"
- "summary": a 1-sentence executive summary (max 25 words) based on the full body
- "priority": "critical", "high", "medium", or "low" — based on business impact for a C-suite executive
- "sentiment": "positive", "neutral", "negative", or "urgent"
- "buyingSignal": an object with:
  - "score": 0-10 (0 = no buying intent, 10 = ready to purchase)
  - "intent": brief description of the buying intent, or "none"
  - "stage": "no-signal", "awareness", "consideration", "decision", or "purchase"
- "actionRequired": a brief recommended action, or null if no action needed
- "replyNeeded": true/false - Determine if the USER BEING ANALYZED needs to reply. Consider:
  
  RECIPIENT TYPE IS CRITICAL:
  * "User is in: CC" means they are CC'd — usually FYI only, reply NOT needed unless explicitly addressed by name
  * "User is in: TO" means they are a direct recipient — more likely to need a reply if action is requested
  * "User is in: BCC" means they are blind copied — almost never needs reply (silent observer)
  
  Set FALSE for:
  * CC'd emails where user is not mentioned by name in the body
  * FYI/informational emails (status reports, weekly updates, newsletters)
  * Out-of-office (OOO) notifications or sick leave announcements
  * Meeting invites or calendar events (these are accepted/declined, not replied to)
  * Automated notifications or system alerts
  * Broadcasts or group announcements not specifically addressing the user
  * Emails addressed to a group/team where user is not singled out
  * Emails where someone else in TO is clearly the primary respondent
  
  Set TRUE only when:
  * User is in TO AND sender explicitly asks THEM a question
  * Sender addresses the user by name and requests their specific input
  * User's decision, approval, or sign-off is specifically requested
  * User is the sole or primary TO recipient and action is requested
  * Email clearly requires this user's response to move forward
- "draftReply": if "replyNeeded" is true, draft a concise professional reply as the analyzed user. If false, return null.
  Rules for "draftReply":
  * Use the sender's context from the full body.
  * Keep it executive-friendly: concise, clear, and polite.
  * Do not invent facts, dates, or commitments not present in the email.
  * If a necessary detail is missing, use a neutral placeholder like [decision] or [date].
  * Return plain text only, no markdown.
- "keyTopics": array of 1-3 key topic words

Also provide:
1. An "executiveSummary" (1-2 sentences) with a high-level overview of the inbox status.
2. An "attentionItems" array with TOP 5 most important areas that need immediate attention (sorted by priority):
   - "priority": "critical", "high", or "medium"
   - "title": short attention-grabbing title (3-6 words, action-oriented)
   - "description": what needs to be done and why (1 sentence, ~15-20 words)
   - "emailCount": how many emails relate to this item
   - "senders": array of sender names involved (max 3)

Focus attentionItems on: urgent client matters, pending decisions, time-sensitive requests, important meetings, revenue opportunities, or critical issues.

Return ONLY valid JSON in this exact format:
{
  "analyses": [ { ...fields above for each email... } ],
  "executiveSummary": "...",
  "attentionItems": [
    { "priority": "critical", "title": "...", "description": "...", "emailCount": 1, "senders": ["..."] },
    ...up to 5 items
  ]
}

EMAILS:

${emailList}`;
}

export async function analyzeWithClaude(
  emails: EmailForAnalysis[],
  settings?: PromptSettings,
  userEmail?: string,
  userName?: string
): Promise<LLMBatchResult> {
  const allAnalyses: LLMEmailAnalysis[] = [];
  let lastSummary = "";
  let lastAttentionItems: AttentionItem[] = [];
  const batches = chunkEmailsForAnalysis(emails);

  console.log(`Starting analysis of ${emails.length} emails in ${batches.length} batches`);

  for (const [index, batch] of batches.entries()) {
    const batchNum = index + 1;
    const totalBatches = batches.length;
    console.log(`Processing batch ${batchNum}/${totalBatches} (${batch.length} emails)`);
    
    const prompt = buildPrompt(batch, settings, userEmail, userName);

    const response = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 8192,
      messages: [{ role: "user", content: prompt }],
    });

    const text =
      response.content[0].type === "text" ? response.content[0].text : "";

    // Check if response was truncated
    if (response.stop_reason === "max_tokens") {
      console.warn(`Batch ${batchNum}: Response truncated due to max_tokens limit`);
    }

    // Extract JSON from response (handle markdown code blocks)
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error(`Batch ${batchNum}: Failed to parse Claude response:`, text.substring(0, 500));
      continue;
    }

    try {
      const parsed: LLMBatchResult = JSON.parse(jsonMatch[0]);
      console.log(`Batch ${batchNum}: parsed ${parsed.analyses?.length || 0} analyses`);
      if (parsed.analyses && Array.isArray(parsed.analyses)) {
        allAnalyses.push(...parsed.analyses);
      }
      lastSummary = parsed.executiveSummary || lastSummary;
      if (parsed.attentionItems && Array.isArray(parsed.attentionItems)) {
        lastAttentionItems = parsed.attentionItems;
      }
    } catch (parseErr) {
      console.error(`Batch ${batchNum}: JSON parse error:`, parseErr);
      console.error(`Batch ${batchNum}: Raw JSON (first 500 chars):`, jsonMatch[0].substring(0, 500));
    }
  }

  // If we had multiple batches, ask Claude for a combined summary with attention items
  if (batches.length > 1 && allAnalyses.length > 0) {
    const criticalItems = allAnalyses
      .filter((a) => a.priority === "critical" || a.priority === "high")
      .slice(0, 10)
      .map((a) => `- [${a.priority}] ${a.summary} (from: ${emails.find(e => e.id === a.id)?.from || 'Unknown'})`)
      .join("\n");

    const buyingItems = allAnalyses
      .filter((a) => a.buyingSignal.score >= 5)
      .slice(0, 5)
      .map((a) => `- Score ${a.buyingSignal.score}: ${a.buyingSignal.intent} (from: ${emails.find(e => e.id === a.id)?.from || 'Unknown'})`)
      .join("\n");

    const summaryResponse = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: `You're briefing a C-suite executive. Based on these email highlights, provide:

HIGH PRIORITY:
${criticalItems || "None"}

BUYING SIGNALS:
${buyingItems || "None"}

Total emails analyzed: ${allAnalyses.length}

Return JSON with:
1. "executiveSummary": 1-2 sentence overview
2. "attentionItems": array of TOP 5 areas needing attention, each with:
   - "priority": "critical", "high", or "medium"
   - "title": action-oriented title (3-6 words)
   - "description": what to do and why (15-20 words)
   - "emailCount": number of related emails
   - "senders": array of sender names (max 3)

Return ONLY valid JSON:
{
  "executiveSummary": "...",
  "attentionItems": [...]
}`,
        },
      ],
    });

    const summaryText =
      summaryResponse.content[0].type === "text"
        ? summaryResponse.content[0].text
        : "";
    
    const summaryJsonMatch = summaryText.match(/\{[\s\S]*\}/);
    if (summaryJsonMatch) {
      try {
        const summaryParsed = JSON.parse(summaryJsonMatch[0]);
        lastSummary = summaryParsed.executiveSummary || lastSummary;
        if (summaryParsed.attentionItems && Array.isArray(summaryParsed.attentionItems)) {
          lastAttentionItems = summaryParsed.attentionItems;
        }
      } catch {
        // If parsing fails, use the raw text as summary
        lastSummary = summaryText;
      }
    } else {
      lastSummary = summaryText;
    }
  }

  console.log(`Claude analysis complete: ${allAnalyses.length} total analyses from ${emails.length} emails`);
  
  return {
    analyses: allAnalyses,
    executiveSummary: lastSummary,
    attentionItems: lastAttentionItems.length > 0 ? lastAttentionItems : undefined,
  };
}
