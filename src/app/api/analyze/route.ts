import { NextRequest, NextResponse } from "next/server";
import { analyzeWithClaude, EmailForAnalysis } from "@/lib/claude-service";
import { PromptSettings } from "@/lib/types";

export async function POST(request: NextRequest) {
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: "ANTHROPIC_API_KEY is not configured" },
        { status: 500 }
      );
    }

    const body = await request.json();
    const emails: EmailForAnalysis[] = body.emails;
    const promptSettings: PromptSettings | undefined = body.promptSettings;

    if (!emails || !Array.isArray(emails) || emails.length === 0) {
      return NextResponse.json(
        { error: "No emails provided" },
        { status: 400 }
      );
    }

    // Limit to 200 emails max per request
    const limitedEmails = emails.slice(0, 200);
    const result = await analyzeWithClaude(limitedEmails, promptSettings);

    return NextResponse.json(result);
  } catch (error) {
    console.error("Email analysis error:", error);
    return NextResponse.json(
      { error: "Failed to analyze emails" },
      { status: 500 }
    );
  }
}
