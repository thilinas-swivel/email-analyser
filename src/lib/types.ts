export interface Email {
  id: string;
  subject: string;
  from: {
    emailAddress: {
      name: string;
      address: string;
    };
  };
  toRecipients: {
    emailAddress: {
      name: string;
      address: string;
    };
  }[];
  ccRecipients?: {
    emailAddress: {
      name: string;
      address: string;
    };
  }[];
  receivedDateTime: string;
  bodyPreview: string;
  isRead: boolean;
  importance: string;
  categories: string[];
  hasAttachments: boolean;
  conversationId: string;
  flag: {
    flagStatus: string;
  };
  body?: {
    contentType: string;
    content: string;
  };
}

export interface EmailCategory {
  name: string;
  count: number;
  color: string;
  emails: Email[];
}

export interface SenderStat {
  name: string;
  email: string;
  count: number;
}

export interface TrendPoint {
  date: string;
  count: number;
}

export interface ScopeBreakdown<T> {
  internal: T;
  external: T;
}

export interface UnrepliedEmail extends Email {
  daysSinceReceived: number;
  urgencyScore: number;
  urgencyLevel: "critical" | "high" | "medium" | "low";
  replyStatus: string;
  llmPriority?: "critical" | "high" | "medium" | "low";
}

export interface BuyingSignalEmail extends Email {
  signalScore: number;
  signals: string[];
  senderCompany: string;
  buyingStage?: string;
  buyingIntent?: string;
  llmSummary?: string;
  actionRequired?: string | null;
}

export interface ClientThread {
  clientName: string;
  clientEmail: string;
  company: string;
  subject: string;
  urgencyLevel: "critical" | "high" | "medium" | "low";
  daysSinceLastReply: number;
  lastReplyDate: string;
  replyStatus: string;
  replyNeeded?: boolean;
  buyingIntent: number;
  hasBuyIntent: boolean;
  matchedKeywords: string[];
  lastMessage: string;
  aiSummary?: string;
  aiDraftReply?: string | null;
  aiActionRequired?: string | null;
  emails: UnrepliedEmail[];
}

export interface InternalThread {
  senderName: string;
  senderEmail: string;
  department: string;
  subject: string;
  urgencyLevel: "critical" | "high" | "medium" | "low";
  daysSinceReceived: number;
  receivedDate: string;
  replyNeeded: boolean;
  hasReplied: boolean;
  lastMessage: string;
  aiSummary?: string;
  aiDraftReply?: string | null;
  aiActionRequired?: string | null;
  emails: UnrepliedEmail[];
}

export interface AttentionItem {
  priority: "critical" | "high" | "medium";
  title: string;
  description: string;
  emailCount: number;
  senders: string[];
}

export interface DashboardStats {
  totalUnread: number;
  totalUnreplied: number;
  totalBuyingSignals: number;
  urgentCount: number;
  criticalCount: number;
  awaitingReplyOver2d: number;
  avgResponseTime: number;
  unreadByCategory: EmailCategory[];
  unrepliedByCategory: EmailCategory[];
  buyingSignalEmails: BuyingSignalEmail[];
  clientThreads: ClientThread[];
  internalThreads: InternalThread[];
  unreadTrend: TrendPoint[];
  unreadTrendByScope: ScopeBreakdown<TrendPoint[]>;
  topSenders: SenderStat[];
  topSendersByScope: ScopeBreakdown<SenderStat[]>;
  importanceDistribution: { name: string; value: number }[];
  unreadByCategoryByScope: ScopeBreakdown<EmailCategory[]>;
  unrepliedByCategoryByScope: ScopeBreakdown<EmailCategory[]>;
  executiveSummary?: string;
  attentionItems?: AttentionItem[];
  llmEnriched?: boolean;
}

export interface PromptSettings {
  categorizationPrompt: string;
  buyingSignalPrompt: string;
  priorityPrompt: string;
  executiveSummaryPrompt: string;
  defaultAnalysisStartDate: string;
  customKeywords: string[];
  noiseEmailFilters: string[];
  noiseNameFilters: string[];
  trackInternalEmails: boolean;
}

export interface UserProfile {
  displayName: string;
  mail: string;
  jobTitle: string;
  officeLocation: string;
  photo?: string;
}
