// server/lib/types/ai.ts - Enhanced with Context Operations
import { PlayerRole, GamePhase, PlayerId } from "./game";

// Re-export AIModel from game types
export { AIModel } from "./game";

// 🆕 NEW: Context Operation Types for AI Coordination
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
  playerStatus?: any;
  eliminationHistory?: any;
}

export interface AIPersonality {
  model: AIModel;
  name: string;
  description: string;
  archetype: "analytical_detective" | "creative_storyteller" | "direct_analyst";
  communicationStyle: {
    averageMessageLength: "short" | "medium" | "long";
    formalityLevel: "casual" | "mixed" | "formal";
    emotionalExpression: "low" | "medium" | "high";
    questionFrequency: "low" | "medium" | "high";
    storytellingTendency: "low" | "medium" | "high";
    logicalReasoning: "low" | "medium" | "high";
  };
  strategicApproach: {
    votesTiming: "early" | "middle" | "late" | "varies";
    allianceBuilding: "cautious" | "opportunistic" | "aggressive";
    informationSharing: "secretive" | "selective" | "open";
    riskTolerance: "conservative" | "moderate" | "aggressive";
  };
  suspicionLevel: number; // 1-10
  trustLevel: number; // 1-10
  aggressiveness: number; // 1-10
}

export interface AIActionRequest {
  type: "discussion" | "vote" | "night_action";
  context: AIDecisionContext;
  personality: AIPersonality;
  constraints: {
    maxLength?: number;
    timeLimit?: number;
    mustVote?: boolean;
    availableTargets?: PlayerId[];
  };
}

export interface AIResponse {
  content: string;
  confidence: number;
  metadata: {
    model: AIModel;
    tokensUsed: number;
    responseTime: number;
    cost: number;
    timestamp: Date;
  };
}

// 🆕 NEW: API Usage Stats interface
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

// 🆕 NEW: Context Manager Interface
export interface ContextManagerInterface {
  // Core context operations
  trigger(
    playerId: PlayerId,
    context: TemporaryContextData
  ): Promise<AIResponse>;
  update(playerId: PlayerId, context: PersistentContextData): void;
  push(context: BroadcastContextData): void;

  // Context building
  buildPlayerContext(playerId: PlayerId): AIDecisionContext;

  // State management
  isPlayerContextReady(playerId: PlayerId): boolean;
  clearPlayerContext(playerId: PlayerId): void;

  // Analytics
  getContextStats(): ContextStats;
}

export interface TemporaryContextData {
  type: "discussion_turn" | "voting_turn" | "night_action";
  data: any;
  requiresResponse: boolean;
  timeoutMs?: number;
}

export interface PersistentContextData {
  type: "role_assignment" | "player_status" | "game_state";
  data: any;
}

export interface BroadcastContextData {
  type: "phase_change" | "elimination_result" | "full_discussion" | "game_end";
  data: any;
  targetedPlayers?: PlayerId[];
}

export interface ContextStats {
  totalTriggers: number;
  totalUpdates: number;
  totalPushes: number;
  averageResponseTime: number;
  activeContexts: number;
  errorRate: number;
}

// 🆕 NEW: Name Registry Interface
export interface NameRegistryInterface {
  // Core name mapping
  registerPlayer(name: string, id: PlayerId, gameId: string): void;
  getId(name: string, gameId: string): PlayerId | null;
  getName(id: PlayerId, gameId: string): string | null;

  // Validation
  isNameRegistered(name: string, gameId: string): boolean;
  isIdRegistered(id: PlayerId, gameId: string): boolean;

  // Game management
  createGameMapping(gameId: string): void;
  clearGameMapping(gameId: string): void;

  // Analytics
  getRegistryStats(): any;
}

// 🆕 NEW: Response Parser Interface
export interface ResponseParserInterface {
  // Core parsing
  parseResponse(
    response: string,
    expectedType: "discussion" | "voting" | "night_action",
    availableTargets: string[]
  ): ParsedAIResponse;

  // Validation
  validateDiscussionResponse(response: any): ValidationResult;
  validateVotingResponse(
    response: any,
    availableTargets: string[]
  ): ValidationResult;
  validateNightActionResponse(
    response: any,
    availableTargets: string[]
  ): ValidationResult;

  // Fallback generation
  generateFallbackResponse(
    type: "discussion" | "voting" | "night_action",
    personality: AIPersonality,
    availableTargets: string[]
  ): ParsedAIResponse;
}

export interface ParsedAIResponse {
  isValid: boolean;
  responseType: "discussion" | "voting" | "night_action";
  data: DiscussionResponseData | VotingResponseData | NightActionResponseData;
  errors: string[];
  parsingMethod:
    | "json"
    | "cleaned_json"
    | "pattern"
    | "content_analysis"
    | "fallback"
    | "emergency"
    | string;
  confidence: number;
}

export interface DiscussionResponseData {
  message: string;
}

export interface VotingResponseData {
  message: string;
  vote_target: string;
}

export interface NightActionResponseData {
  action: "kill" | "heal";
  target: string;
  reasoning: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

// 🆕 NEW: AI Context Builder Interface
export interface AIContextBuilderInterface {
  // Context building
  buildDiscussionContext(playerId: PlayerId): AIDecisionContext;
  buildVotingContext(playerId: PlayerId): AIDecisionContext;
  buildNightActionContext(playerId: PlayerId): AIDecisionContext;

  // Context enhancement
  enhanceWithGameHistory(context: AIDecisionContext): AIDecisionContext;
  enhanceWithSuspicionData(context: AIDecisionContext): AIDecisionContext;
  enhanceWithPlayerStatus(context: AIDecisionContext): AIDecisionContext;

  // Context validation
  validateContext(context: AIDecisionContext): ValidationResult;

  // Context analytics
  getContextBuildingStats(): any;
}

// AI Model Configuration
export const MODEL_CONFIGS: Record<AIModel, ModelConfig> = {
  [AIModel.CLAUDE_SONNET_4]: {
    provider: "anthropic",
    modelName: "claude-3-5-sonnet-20241022",
    maxTokensPerRequest: 1000,
    costPerInputToken: 0.003,
    costPerOutputToken: 0.015,
    tier: "premium",
  },
  [AIModel.CLAUDE_HAIKU]: {
    provider: "anthropic",
    modelName: "claude-3-5-haiku-20241022",
    maxTokensPerRequest: 500,
    costPerInputToken: 0.00025,
    costPerOutputToken: 0.00125,
    tier: "free",
  },
  [AIModel.GPT_4O]: {
    provider: "openai",
    modelName: "gpt-4o",
    maxTokensPerRequest: 1000,
    costPerInputToken: 0.0025,
    costPerOutputToken: 0.01,
    tier: "premium",
  },
  [AIModel.GPT_4O_MINI]: {
    provider: "openai",
    modelName: "gpt-4o-mini",
    maxTokensPerRequest: 500,
    costPerInputToken: 0.00015,
    costPerOutputToken: 0.0006,
    tier: "free",
  },
  [AIModel.GEMINI_2_5_PRO]: {
    provider: "google",
    modelName: "gemini-2.5-pro",
    maxTokensPerRequest: 1000,
    costPerInputToken: 0.00125,
    costPerOutputToken: 0.005,
    tier: "premium",
  },
  [AIModel.GEMINI_2_5_FLASH]: {
    provider: "google",
    modelName: "gemini-2.5-flash",
    maxTokensPerRequest: 500,
    costPerInputToken: 0.000075,
    costPerOutputToken: 0.0003,
    tier: "free",
  },
};

export interface ModelConfig {
  provider: "openai" | "anthropic" | "google";
  modelName: string;
  maxTokensPerRequest: number;
  costPerInputToken: number;
  costPerOutputToken: number;
  tier: "free" | "premium";
}
