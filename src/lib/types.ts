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
  buyingIntent: number;
  hasBuyIntent: boolean;
  matchedKeywords: string[];
  lastMessage: string;
  emails: UnrepliedEmail[];
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
  unreadTrend: { date: string; count: number }[];
  topSenders: { name: string; email: string; count: number }[];
  importanceDistribution: { name: string; value: number }[];
  executiveSummary?: string;
  llmEnriched?: boolean;
}

export interface PromptSettings {
  categorizationPrompt: string;
  buyingSignalPrompt: string;
  priorityPrompt: string;
  executiveSummaryPrompt: string;
  customKeywords: string[];
  noiseEmailFilters: string[];
  noiseNameFilters: string[];
}

export interface UserProfile {
  displayName: string;
  mail: string;
  jobTitle: string;
  officeLocation: string;
  photo?: string;
}
