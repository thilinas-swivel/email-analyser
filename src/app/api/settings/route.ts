import { NextRequest, NextResponse } from "next/server";
import { getUserSettings, saveUserSettings } from "@/lib/settings-store";
import { DEFAULT_SETTINGS } from "@/lib/prompt-settings";
import type { PromptSettings } from "@/lib/types";

export async function GET(request: NextRequest) {
  const userEmail = request.nextUrl.searchParams.get("userEmail");
  if (!userEmail) {
    return NextResponse.json(
      { error: "Missing userEmail parameter" },
      { status: 400 }
    );
  }

  const stored = await getUserSettings(userEmail);
  const settings = stored
    ? { ...DEFAULT_SETTINGS, ...stored }
    : DEFAULT_SETTINGS;

  return NextResponse.json({ settings, fromStorage: !!stored });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const userEmail: string | undefined = body.userEmail;
  const settings: PromptSettings | undefined = body.settings;

  if (!userEmail || !settings) {
    return NextResponse.json(
      { error: "Missing userEmail or settings" },
      { status: 400 }
    );
  }

  const ok = await saveUserSettings(userEmail, settings);
  if (!ok) {
    return NextResponse.json(
      { error: "Failed to save settings" },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
