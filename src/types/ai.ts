// AI Model and Personality Types for AI Mafia
import { PlayerId, PlayerRole, GamePhase, AIModel } from "./game";

// Export AIModel enum from game types for use in other modules
export { AIModel } from "./game";

export interface AIPersonality {
  model: AIModel;
  name: string;
  description: string;
  archetype: "analytical_detective" | "creative_storyteller" | "direct_analyst";
  communicationStyle: CommunicationStyle;
  strategicApproach: StrategicApproach;
  suspicionLevel: number; // 1-10
  trustLevel: number; // 1-10
  aggressiveness: number; // 1-10
}

export interface CommunicationStyle {
  averageMessageLength: "short" | "medium" | "long";
  formalityLevel: "casual" | "formal" | "mixed";
  emotionalExpression: "low" | "medium" | "high";
  questionFrequency: "low" | "medium" | "high";
  storytellingTendency: "low" | "medium" | "high";
  logicalReasoning: "low" | "medium" | "high";
}

export interface StrategicApproach {
  votesTiming: "early" | "middle" | "late" | "varies";
  allianceBuilding: "aggressive" | "cautious" | "opportunistic";
  informationSharing: "open" | "selective" | "secretive";
  riskTolerance: "conservative" | "moderate" | "aggressive";
  deceptionStyle?: "subtle" | "bold" | "misdirection"; // Only for mafia
}

export interface AIModelConfig {
  model: AIModel;
  tier: "free" | "premium";
  provider: "openai" | "anthropic" | "google";
  modelName: string;
  costPerInputToken: number; // in dollars per million tokens
  costPerOutputToken: number; // in dollars per million tokens
  maxTokensPerRequest: number;
  supportsStreaming: boolean;
  responseTimeTarget: number; // milliseconds
}

export interface AIPromptTemplate {
  system: string;
  roleSpecific: Record<PlayerRole, string>;
  phaseSpecific: Record<GamePhase, string>;
  personalityModifiers: Record<string, string>;
}

export interface AIResponse {
  content: string;
  confidence: number;
  reasoning?: string;
  metadata: {
    model: AIModel;
    tokensUsed: number;
    responseTime: number;
    cost: number;
    timestamp: Date;
  };
}

// Player status for AI context
export interface PlayerStatus {
  living: Array<{
    id: PlayerId;
    name: string;
    role?: PlayerRole;
  }>;
  eliminated: Array<{
    id: PlayerId;
    name: string;
    role: PlayerRole;
  }>;
}

// Elimination event details
export interface EliminationEvent {
  round: number;
  playerName: string;
  playerId: PlayerId;
  role: PlayerRole;
  cause: "voted_out" | "mafia_kill";
  voteCount?: number;
  timestamp: Date;
}

// Enhanced AI Decision Context with all required properties
export interface AIDecisionContext {
  playerId: PlayerId;
  role: PlayerRole;
  phase: GamePhase;
  round: number;
  gameHistory: string[];
  livingPlayers: PlayerId[];
  eliminatedPlayers: PlayerId[];
  previousVotes: { round: number; votes: any[] }[];
  timeRemaining: number;
  suspicionLevels: Record<PlayerId, number>;
  trustLevels: Record<PlayerId, number>;

  // Additional properties for enhanced AI decision making
  playerStatus?: PlayerStatus;
  latestElimination?: EliminationEvent;
  eliminationHistory?: EliminationEvent[];
}

export interface AIActionRequest {
  type: "discussion" | "vote" | "night_action";
  context: AIDecisionContext;
  personality: AIPersonality;
  constraints: {
    maxLength?: number;
    mustVote?: boolean;
    availableTargets?: PlayerId[];
    timeLimit?: number;
  };
}

export interface MafiaCoordinationContext {
  partnerRole: PlayerRole;
  partnerId: PlayerId;
  partnerPersonality: AIPersonality;
  discussionHistory: string[];
  targetOptions: PlayerId[];
  riskAssessment: {
    suspicionLevels: Record<PlayerId, number>;
    safestTargets: PlayerId[];
    riskyTargets: PlayerId[];
  };
}

export interface HealerDecisionContext {
  previousProtections: PlayerId[];
  threatAssessment: Record<PlayerId, number>;
  publiclySuspicious: PlayerId[];
  likelyTargets: PlayerId[];
  selfPreservationRisk: number;
}

// Cost tracking and optimization
export interface APIUsageStats {
  model: AIModel;
  totalRequests: number;
  totalTokensInput: number;
  totalTokensOutput: number;
  totalCost: number;
  averageResponseTime: number;
  errorRate: number;
  lastUsed: Date;
}

export interface CostOptimizationConfig {
  maxCostPerGame: number;
  preferredModelsForFreeUsers: AIModel[];
  fallbackModel: AIModel;
  enableResponseCaching: boolean;
  maxCacheAge: number; // minutes
  rateLimitPerModel: number; // requests per minute
}

export const MODEL_CONFIGS: Record<AIModel, AIModelConfig> = {
  [AIModel.CLAUDE_SONNET_4]: {
    model: AIModel.CLAUDE_SONNET_4,
    tier: "premium",
    provider: "anthropic",
    modelName: "claude-sonnet-4-20250514",
    costPerInputToken: 3.0,
    costPerOutputToken: 15.0,
    maxTokensPerRequest: 4096,
    supportsStreaming: true,
    responseTimeTarget: 3000,
  },
  [AIModel.GPT_4O]: {
    model: AIModel.GPT_4O,
    tier: "premium",
    provider: "openai",
    modelName: "gpt-4o",
    costPerInputToken: 2.5,
    costPerOutputToken: 10.0,
    maxTokensPerRequest: 4096,
    supportsStreaming: true,
    responseTimeTarget: 2500,
  },
  [AIModel.GEMINI_2_5_PRO]: {
    model: AIModel.GEMINI_2_5_PRO,
    tier: "premium",
    provider: "google",
    modelName: "gemini-2.5-pro",
    costPerInputToken: 1.25,
    costPerOutputToken: 10.0,
    maxTokensPerRequest: 4096,
    supportsStreaming: true,
    responseTimeTarget: 2000,
  },
  [AIModel.CLAUDE_HAIKU]: {
    model: AIModel.CLAUDE_HAIKU,
    tier: "free",
    provider: "anthropic",
    modelName: "claude-3-5-haiku-20241022",
    costPerInputToken: 0.25,
    costPerOutputToken: 1.25,
    maxTokensPerRequest: 2048,
    supportsStreaming: false,
    responseTimeTarget: 1500,
  },
  [AIModel.GPT_4O_MINI]: {
    model: AIModel.GPT_4O_MINI,
    tier: "free",
    provider: "openai",
    modelName: "gpt-4o-mini",
    costPerInputToken: 0.15,
    costPerOutputToken: 0.6,
    maxTokensPerRequest: 2048,
    supportsStreaming: false,
    responseTimeTarget: 1000,
  },
  [AIModel.GEMINI_2_5_FLASH]: {
    model: AIModel.GEMINI_2_5_FLASH,
    tier: "free",
    provider: "google",
    modelName: "models/gemini-2.5-flash",
    costPerInputToken: 0.075,
    costPerOutputToken: 0.3,
    maxTokensPerRequest: 2048,
    supportsStreaming: false,
    responseTimeTarget: 800,
  },
};

// NOTE: AI personalities are now in personality-pool.ts
// Import using: import { selectGamePersonalities, FREE_TIER_PERSONALITIES, PREMIUM_TIER_PERSONALITIES } from "@/lib/ai/personality-pool";
