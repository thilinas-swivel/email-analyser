"use client";

import * as microsoftTeams from "@microsoft/teams-js";

let teamsInitialized = false;
let teamsInitPromise: Promise<boolean> | null = null;

/**
 * Initializes the Teams SDK. Returns true if running inside Teams, false otherwise.
 * Safe to call multiple times — only initializes once.
 */
export function initializeTeams(): Promise<boolean> {
  if (teamsInitPromise) return teamsInitPromise;

  teamsInitPromise = (async () => {
    try {
      await microsoftTeams.app.initialize();
      teamsInitialized = true;
      return true;
    } catch {
      teamsInitialized = false;
      return false;
    }
  })();

  return teamsInitPromise;
}

/**
 * Returns true if the app is currently running inside Microsoft Teams.
 */
export function isInTeams(): boolean {
  return teamsInitialized;
}

/**
 * Get an access token via Teams SSO. Teams will return a token for the
 * currently-signed-in user without any popup or redirect.
 *
 * The token returned is an ID token that must be exchanged server-side
 * for a Graph access token using the On-Behalf-Of (OBO) flow.
 */
export async function getTeamsSsoToken(): Promise<string> {
  const result = await microsoftTeams.authentication.getAuthToken();
  return result;
}

/**
 * Notifies Teams that the app has loaded (removes loading indicator).
 */
export async function notifyTeamsAppLoaded(): Promise<void> {
  if (teamsInitialized) {
    await microsoftTeams.app.notifyAppLoaded();
    await microsoftTeams.app.notifySuccess();
  }
}
