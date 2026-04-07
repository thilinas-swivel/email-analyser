import { TableClient } from "@azure/data-tables";
import type { PromptSettings } from "./types";

const TABLE_NAME = "usersettings";

let tableClient: TableClient | null = null;
let tableReady = false;

function getTableClient(): TableClient | null {
  if (!process.env.AZURE_STORAGE_CONNECTION_STRING) {
    return null;
  }
  if (!tableClient) {
    tableClient = TableClient.fromConnectionString(
      process.env.AZURE_STORAGE_CONNECTION_STRING,
      TABLE_NAME
    );
  }
  return tableClient;
}

async function ensureTable(): Promise<void> {
  if (tableReady) return;
  const client = getTableClient();
  if (!client) return;
  try {
    await client.createTable();
  } catch (error: unknown) {
    const err = error as { statusCode?: number };
    if (err.statusCode !== 409) {
      console.error("Failed to create settings table:", error);
    }
  }
  tableReady = true;
}

function hashUserEmail(email: string): string {
  return email.toLowerCase().replace(/[^a-z0-9]/g, "_");
}

interface SettingsEntity {
  partitionKey: string;
  rowKey: string;
  settingsJson: string;
  updatedAt: string;
}

export async function getUserSettings(
  userEmail: string
): Promise<PromptSettings | null> {
  await ensureTable();
  const client = getTableClient();
  if (!client) return null;

  try {
    const entity = await client.getEntity<SettingsEntity>(
      hashUserEmail(userEmail),
      "SETTINGS"
    );
    if (entity.settingsJson) {
      return JSON.parse(entity.settingsJson) as PromptSettings;
    }
    return null;
  } catch {
    // Not found
    return null;
  }
}

export async function saveUserSettings(
  userEmail: string,
  settings: PromptSettings
): Promise<boolean> {
  await ensureTable();
  const client = getTableClient();
  if (!client) return false;

  try {
    const entity: SettingsEntity = {
      partitionKey: hashUserEmail(userEmail),
      rowKey: "SETTINGS",
      settingsJson: JSON.stringify(settings),
      updatedAt: new Date().toISOString(),
    };
    await client.upsertEntity(entity, "Replace");
    return true;
  } catch (error) {
    console.error("Failed to save user settings:", error);
    return false;
  }
}
