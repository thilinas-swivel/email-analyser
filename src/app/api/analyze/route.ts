import { NextRequest, NextResponse } from "next/server";
import { analyzeWithClaude, EmailForAnalysis } from "@/lib/claude-service";
import { PromptSettings } from "@/lib/types";
import {
  getCachedAnalyses,
  getCachedSummary,
  saveCachedAnalyses,
  clearCachedAnalysis,
  ensureCacheTable,
} from "@/lib/analysis-cache";

// Ensure cache table exists on first request
let tableInitialized = false;

async function initTable() {
  if (!tableInitialized && process.env.AZURE_STORAGE_CONNECTION_STRING) {
    await ensureCacheTable();
    tableInitialized = true;
  }
}

/**
 * POST /api/analyze
 *
 * Two modes controlled by the presence of `cacheOnly`:
 *
 * **Phase 1 – cache check** (cacheOnly: true)
 *   Body: { cacheOnly: true, emailIds: string[], userEmail, forceRefresh?, startDate?, endDate? }
 *   Returns: { analyses, executiveSummary, uncachedIds }
 *
 * **Phase 2 – analyse uncached** (cacheOnly absent / false)
 *   Body: { emails: EmailForAnalysis[], promptSettings, userEmail, userName }
 *   Returns: { analyses, executiveSummary, newEmailsAnalyzed }
 */
export async function POST(request: NextRequest) {
  try {
    await initTable();

    const body = await request.json();
    const userEmail: string = body.userEmail;

    if (!userEmail) {
      return NextResponse.json({ error: "Missing userEmail" }, { status: 400 });
    }

    // ── Phase 1: cache-only lookup ──────────────────────────────────
    if (body.cacheOnly) {
      const emailIds: string[] = body.emailIds;
      if (!emailIds || !Array.isArray(emailIds)) {
        return NextResponse.json({ error: "Missing emailIds" }, { status: 400 });
      }

      const forceRefresh = body.forceRefresh === true;

      if (forceRefresh) {
        await clearCachedAnalysis(userEmail, body.startDate || "", body.endDate || "");
      }

      const { cachedAnalyses, cachedIds } = forceRefresh
        ? { cachedAnalyses: [], cachedIds: new Set<string>() }
        : await getCachedAnalyses(userEmail, emailIds);

      const uncachedIds = emailIds.filter((id) => !cachedIds.has(id));
      const cachedSummary =
        cachedAnalyses.length > 0 ? await getCachedSummary(userEmail) : null;

      console.log(
        `Cache check for ${userEmail}: ${cachedIds.size} cached, ${uncachedIds.length} uncached`
      );

      return NextResponse.json({
        analyses: cachedAnalyses,
        executiveSummary: cachedSummary || "",
        uncachedIds,
      });
    }

    // ── Phase 2: analyse uncached emails ────────────────────────────
    if (!process.env.ANTHROPIC_API_KEY) {
      console.error("ANTHROPIC_API_KEY is not configured");
      return NextResponse.json(
        { error: "ANTHROPIC_API_KEY is not configured" },
        { status: 500 }
      );
    }

    const emails: EmailForAnalysis[] = body.emails;
    const promptSettings: PromptSettings | undefined = body.promptSettings;
    const userName: string | undefined = body.userName;

    if (!emails || !Array.isArray(emails) || emails.length === 0) {
      return NextResponse.json({ error: "No emails provided" }, { status: 400 });
    }

    console.log(`Analyzing ${emails.length} new emails for ${userEmail}`);

    const emailsToAnalyze = emails.slice(0, 500);
    const newResult = await analyzeWithClaude(
      emailsToAnalyze,
      promptSettings,
      userEmail,
      userName
    );

    // Save new analyses to cache
    if (newResult.analyses && newResult.analyses.length > 0) {
      await saveCachedAnalyses(userEmail, newResult.analyses, newResult.executiveSummary);
    }

    console.log(
      `Analysis complete: ${newResult.analyses?.length || 0} new emails analyzed`
    );

    return NextResponse.json({
      analyses: newResult.analyses || [],
      executiveSummary: newResult.executiveSummary || "",
      newEmailsAnalyzed: emailsToAnalyze.length,
    });
  } catch (error) {
    console.error("Email analysis error:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    console.error("Error details:", { message: errorMessage, stack: errorStack });
    return NextResponse.json(
      { error: "Failed to analyze emails", details: errorMessage },
      { status: 500 }
    );
  }
}
