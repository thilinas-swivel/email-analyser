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

export async function POST(request: NextRequest) {
  console.log("POST /api/analyze called");
  try {
    // Initialize cache table once
    if (!tableInitialized && process.env.AZURE_STORAGE_CONNECTION_STRING) {
      await ensureCacheTable();
      tableInitialized = true;
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      console.error("ANTHROPIC_API_KEY is not configured");
      return NextResponse.json(
        { error: "ANTHROPIC_API_KEY is not configured" },
        { status: 500 }
      );
    }

    const body = await request.json();
    console.log("Request body received:", {
      emailCount: body.emails?.length,
      userEmail: body.userEmail,
      startDate: body.startDate,
      endDate: body.endDate,
      forceRefresh: body.forceRefresh,
    });
    const emails: EmailForAnalysis[] = body.emails;
    const promptSettings: PromptSettings | undefined = body.promptSettings;
    const userEmail: string = body.userEmail;
    const userName: string | undefined = body.userName;
    const startDate: string = body.startDate;
    const endDate: string = body.endDate;
    const forceRefresh: boolean = body.forceRefresh === true;

    if (!emails || !Array.isArray(emails) || emails.length === 0) {
      return NextResponse.json(
        { error: "No emails provided" },
        { status: 400 }
      );
    }

    if (!userEmail || !startDate || !endDate) {
      return NextResponse.json(
        { error: "Missing userEmail, startDate, or endDate" },
        { status: 400 }
      );
    }

    // Clear cache if force refresh requested
    if (forceRefresh) {
      await clearCachedAnalysis(userEmail, startDate, endDate);
      console.log(`Force refresh: cleared cache for ${userEmail}`);
    }

    // Get all email IDs
    const allEmailIds = emails.map((e) => e.id);

    // Check which emails are already cached (per-email caching)
    const { cachedAnalyses, cachedIds } = forceRefresh
      ? { cachedAnalyses: [], cachedIds: new Set<string>() }
      : await getCachedAnalyses(userEmail, allEmailIds);

    // Find emails that need analysis
    const uncachedEmails = emails.filter((e) => !cachedIds.has(e.id));

    console.log(`Cache status: ${cachedIds.size} cached, ${uncachedEmails.length} to analyze`);

    // If all emails are cached, return cached results
    if (uncachedEmails.length === 0 && cachedAnalyses.length > 0) {
      const cachedSummary = await getCachedSummary(userEmail);
      console.log(`Full cache hit: ${cachedAnalyses.length} analyses from cache`);
      
      return NextResponse.json({
        analyses: cachedAnalyses,
        executiveSummary: cachedSummary || "",
        fromCache: true,
        newEmailsAnalyzed: 0,
      });
    }

    // Analyze uncached emails (limit to 200)
    const emailsToAnalyze = uncachedEmails.slice(0, 200);
    
    if (emailsToAnalyze.length > 0) {
      console.log(`Analyzing ${emailsToAnalyze.length} new emails for ${userEmail}`);
      
      const newResult = await analyzeWithClaude(emailsToAnalyze, promptSettings, userEmail, userName);
      
      // Save new analyses to cache
      if (newResult.analyses && newResult.analyses.length > 0) {
        await saveCachedAnalyses(userEmail, newResult.analyses, newResult.executiveSummary);
      }

      // Merge cached + new results
      const mergedAnalyses = [...cachedAnalyses, ...(newResult.analyses || [])];
      
      console.log(`Analysis complete: ${newResult.analyses?.length || 0} new, ${cachedAnalyses.length} cached`);

      return NextResponse.json({
        analyses: mergedAnalyses,
        executiveSummary: newResult.executiveSummary || "",
        fromCache: cachedIds.size > 0,
        newEmailsAnalyzed: emailsToAnalyze.length,
      });
    }

    // No emails to analyze and no cache (shouldn't happen, but handle it)
    return NextResponse.json({
      analyses: [],
      executiveSummary: "",
      fromCache: false,
      newEmailsAnalyzed: 0,
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
