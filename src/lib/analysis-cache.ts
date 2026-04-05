import { TableClient, odata } from "@azure/data-tables";
import { BlobServiceClient, ContainerClient } from "@azure/storage-blob";
import type { LLMBatchResult, LLMEmailAnalysis } from "./claude-service";

const CACHE_TTL_DAYS = 30; // Cache individual email analyses for 30 days
const ANALYSIS_SCHEMA_VERSION = 2;
const TABLE_NAME = "emailanalysiscache";
const BLOB_CONTAINER = "analysis-cache";

// New: Store individual email analyses with email ID as the key
interface EmailAnalysisEntity {
  partitionKey: string; // user email hash
  rowKey: string; // email ID (sanitized)
  analysisJson: string; // JSON of LLMEmailAnalysis
  schemaVersion?: number;
  createdAt: string;
  expiresAt: string;
}

// Store executive summary separately (one per user, updated with each analysis)
interface SummaryEntity {
  partitionKey: string; // user email hash
  rowKey: string; // "SUMMARY"
  executiveSummary: string;
  lastUpdated: string;
}

// Lazy-initialized clients
let tableClient: TableClient | null = null;
let blobContainerClient: ContainerClient | null = null;

function getTableClient(): TableClient | null {
  if (!process.env.AZURE_STORAGE_CONNECTION_STRING) {
    console.warn("AZURE_STORAGE_CONNECTION_STRING not set, caching disabled");
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

function getBlobContainerClient(): ContainerClient | null {
  if (!process.env.AZURE_STORAGE_CONNECTION_STRING) {
    return null;
  }

  if (!blobContainerClient) {
    const blobServiceClient = BlobServiceClient.fromConnectionString(
      process.env.AZURE_STORAGE_CONNECTION_STRING
    );
    blobContainerClient = blobServiceClient.getContainerClient(BLOB_CONTAINER);
  }
  return blobContainerClient;
}

// Ensure table and blob container exist (call once on startup)
export async function ensureCacheTable(): Promise<boolean> {
  const tableClientRef = getTableClient();
  const blobClientRef = getBlobContainerClient();

  if (!tableClientRef) return false;

  try {
    await tableClientRef.createTable();
    console.log(`Cache table '${TABLE_NAME}' created or already exists`);
  } catch (error: unknown) {
    const err = error as { statusCode?: number };
    if (err.statusCode !== 409) {
      console.error("Failed to create cache table:", error);
      return false;
    }
  }

  if (blobClientRef) {
    try {
      await blobClientRef.createIfNotExists();
      console.log(`Blob container '${BLOB_CONTAINER}' created or already exists`);
    } catch (error) {
      console.error("Failed to create blob container:", error);
    }
  }

  return true;
}

// Hash user email to create partition key
function hashUserEmail(email: string): string {
  return email.toLowerCase().replace(/[^a-z0-9]/g, "_");
}

// Sanitize email ID for use as row key (Azure Table has restrictions)
function sanitizeEmailId(emailId: string): string {
  // Azure Table row key cannot contain / \ # ?
  return emailId.replace(/[\/\\#?]/g, "_");
}

export interface CacheResult {
  hit: boolean;
  data?: LLMBatchResult;
  analyzedEmailIds?: string[];
  cachedCount?: number;
}

/**
 * Get cached analyses for specific email IDs
 * Returns which emails are already cached and their analyses
 */
export async function getCachedAnalyses(
  userEmail: string,
  emailIds: string[]
): Promise<{ cachedAnalyses: LLMEmailAnalysis[]; cachedIds: Set<string> }> {
  const client = getTableClient();
  if (!client || emailIds.length === 0) {
    return { cachedAnalyses: [], cachedIds: new Set() };
  }

  const partitionKey = hashUserEmail(userEmail);
  const cachedAnalyses: LLMEmailAnalysis[] = [];
  const cachedIds = new Set<string>();
  const now = new Date();

  // Query in batches (Azure Table has limits)
  const BATCH_SIZE = 50;
  for (let i = 0; i < emailIds.length; i += BATCH_SIZE) {
    const batch = emailIds.slice(i, i + BATCH_SIZE);
    
    for (const emailId of batch) {
      try {
        const rowKey = sanitizeEmailId(emailId);
        const entity = await client.getEntity<EmailAnalysisEntity>(partitionKey, rowKey);
        
        // Check if expired
        if (new Date(entity.expiresAt) > now && entity.analysisJson) {
          const analysis = JSON.parse(entity.analysisJson) as LLMEmailAnalysis;
          const isCurrentSchema =
            entity.schemaVersion === ANALYSIS_SCHEMA_VERSION &&
            Object.prototype.hasOwnProperty.call(analysis, "draftReply");

          if (isCurrentSchema) {
            cachedAnalyses.push(analysis);
            cachedIds.add(emailId);
          }
        }
      } catch {
        // Not found - will be analyzed
      }
    }
  }

  console.log(`Cache lookup for ${userEmail}: ${cachedIds.size}/${emailIds.length} emails cached`);
  return { cachedAnalyses, cachedIds };
}

/**
 * Get cached executive summary for user
 */
export async function getCachedSummary(userEmail: string): Promise<string | null> {
  const client = getTableClient();
  if (!client) return null;

  const partitionKey = hashUserEmail(userEmail);
  
  try {
    const entity = await client.getEntity<SummaryEntity>(partitionKey, "SUMMARY");
    return entity.executiveSummary || null;
  } catch {
    return null;
  }
}

/**
 * Save individual email analyses to cache
 */
export async function saveCachedAnalyses(
  userEmail: string,
  analyses: LLMEmailAnalysis[],
  executiveSummary?: string
): Promise<boolean> {
  const client = getTableClient();
  if (!client || analyses.length === 0) {
    return false;
  }

  const partitionKey = hashUserEmail(userEmail);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + CACHE_TTL_DAYS * 24 * 60 * 60 * 1000);

  console.log(`Saving ${analyses.length} email analyses for ${userEmail}`);

  // Save each analysis as a separate entity
  let savedCount = 0;
  for (const analysis of analyses) {
    try {
      const entity: EmailAnalysisEntity = {
        partitionKey,
        rowKey: sanitizeEmailId(analysis.id),
        analysisJson: JSON.stringify(analysis),
        schemaVersion: ANALYSIS_SCHEMA_VERSION,
        createdAt: now.toISOString(),
        expiresAt: expiresAt.toISOString(),
      };
      await client.upsertEntity(entity, "Replace");
      savedCount++;
    } catch (error) {
      console.error(`Failed to cache analysis for email ${analysis.id}:`, error);
    }
  }

  // Save/update executive summary
  if (executiveSummary) {
    try {
      const summaryEntity: SummaryEntity = {
        partitionKey,
        rowKey: "SUMMARY",
        executiveSummary,
        lastUpdated: now.toISOString(),
      };
      await client.upsertEntity(summaryEntity, "Replace");
    } catch (error) {
      console.error("Failed to save executive summary:", error);
    }
  }

  console.log(`Cached ${savedCount}/${analyses.length} email analyses`);
  return savedCount > 0;
}

/**
 * Legacy compatibility: Get cached analysis (delegates to new system)
 */
export async function getCachedAnalysis(
  _userEmail: string,
  _startDate: string,
  _endDate: string
): Promise<CacheResult> {
  // This function now returns empty - actual caching is per-email
  // The API route will use getCachedAnalyses directly
  void _userEmail;
  void _startDate;
  void _endDate;
  console.log("getCachedAnalysis called - now using per-email caching");
  return { hit: false };
}

/**
 * Legacy compatibility: Merge cached analysis (delegates to new system)
 */
export async function mergeCachedAnalysis(
  userEmail: string,
  _startDate: string,
  _endDate: string,
  newResult: LLMBatchResult,
  _newEmailIds: string[]
): Promise<boolean> {
  // Save individual analyses using the new system
  void _startDate;
  void _endDate;
  void _newEmailIds;
  return saveCachedAnalyses(
    userEmail,
    newResult.analyses || [],
    newResult.executiveSummary
  );
}

/**
 * Clear all cached analyses for a user
 */
export async function clearCachedAnalysis(
  userEmail: string,
  _startDate: string,
  _endDate: string
): Promise<boolean> {
  void _startDate;
  void _endDate;
  const client = getTableClient();
  if (!client) return false;

  const partitionKey = hashUserEmail(userEmail);
  console.log(`Clearing all cached analyses for ${userEmail}`);

  try {
    // Query all entities for this user and delete them
    const entities = client.listEntities<EmailAnalysisEntity>({
      queryOptions: { filter: odata`PartitionKey eq ${partitionKey}` }
    });
    
    let deletedCount = 0;
    for await (const entity of entities) {
      try {
        await client.deleteEntity(entity.partitionKey!, entity.rowKey!);
        deletedCount++;
      } catch {
        // Ignore delete errors
      }
    }
    
    console.log(`Deleted ${deletedCount} cached entries for ${userEmail}`);
    return true;
  } catch (error) {
    console.error("Failed to clear cache:", error);
    return false;
  }
}

