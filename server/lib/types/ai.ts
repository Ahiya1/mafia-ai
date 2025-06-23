// AI Model and Personality Types for AI Mafia - Complete Implementation
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

// Complete AI Personality definitions for all 6 models
export const AI_PERSONALITIES: Record<AIModel, AIPersonality> = {
  // Premium Models
  [AIModel.CLAUDE_SONNET_4]: {
    model: AIModel.CLAUDE_SONNET_4,
    name: "Detective Chen",
    description: "Methodical analyst who builds logical cases step by step",
    archetype: "analytical_detective",
    communicationStyle: {
      averageMessageLength: "long",
      formalityLevel: "formal",
      emotionalExpression: "low",
      questionFrequency: "high",
      storytellingTendency: "low",
      logicalReasoning: "high",
    },
    strategicApproach: {
      votesTiming: "late",
      allianceBuilding: "cautious",
      informationSharing: "selective",
      riskTolerance: "conservative",
    },
    suspicionLevel: 8,
    trustLevel: 6,
    aggressiveness: 4,
  },

  [AIModel.GPT_4O]: {
    model: AIModel.GPT_4O,
    name: "Riley the Storyteller",
    description:
      "Creative communicator who builds elaborate theories and connections",
    archetype: "creative_storyteller",
    communicationStyle: {
      averageMessageLength: "long",
      formalityLevel: "casual",
      emotionalExpression: "high",
      questionFrequency: "medium",
      storytellingTendency: "high",
      logicalReasoning: "medium",
    },
    strategicApproach: {
      votesTiming: "varies",
      allianceBuilding: "aggressive",
      informationSharing: "open",
      riskTolerance: "moderate",
    },
    suspicionLevel: 5,
    trustLevel: 8,
    aggressiveness: 6,
  },

  [AIModel.GEMINI_2_5_PRO]: {
    model: AIModel.GEMINI_2_5_PRO,
    name: "Alex Sharp",
    description:
      "Direct analyst who cuts through noise with efficient observations",
    archetype: "direct_analyst",
    communicationStyle: {
      averageMessageLength: "medium",
      formalityLevel: "mixed",
      emotionalExpression: "medium",
      questionFrequency: "medium",
      storytellingTendency: "low",
      logicalReasoning: "high",
    },
    strategicApproach: {
      votesTiming: "varies",
      allianceBuilding: "opportunistic",
      informationSharing: "selective",
      riskTolerance: "moderate",
    },
    suspicionLevel: 7,
    trustLevel: 6,
    aggressiveness: 6,
  },

  // Free Tier Models
  [AIModel.CLAUDE_HAIKU]: {
    model: AIModel.CLAUDE_HAIKU,
    name: "Sam Logic",
    description: "Analytical thinker with concise observations",
    archetype: "analytical_detective",
    communicationStyle: {
      averageMessageLength: "short",
      formalityLevel: "formal",
      emotionalExpression: "low",
      questionFrequency: "medium",
      storytellingTendency: "low",
      logicalReasoning: "high",
    },
    strategicApproach: {
      votesTiming: "late",
      allianceBuilding: "cautious",
      informationSharing: "selective",
      riskTolerance: "conservative",
    },
    suspicionLevel: 7,
    trustLevel: 6,
    aggressiveness: 3,
  },

  [AIModel.GPT_4O_MINI]: {
    model: AIModel.GPT_4O_MINI,
    name: "Jordan Quick",
    description: "Fast-thinking creative with intuitive insights",
    archetype: "creative_storyteller",
    communicationStyle: {
      averageMessageLength: "medium",
      formalityLevel: "casual",
      emotionalExpression: "medium",
      questionFrequency: "medium",
      storytellingTendency: "medium",
      logicalReasoning: "medium",
    },
    strategicApproach: {
      votesTiming: "middle",
      allianceBuilding: "aggressive",
      informationSharing: "open",
      riskTolerance: "moderate",
    },
    suspicionLevel: 5,
    trustLevel: 7,
    aggressiveness: 5,
  },

  [AIModel.GEMINI_2_5_FLASH]: {
    model: AIModel.GEMINI_2_5_FLASH,
    name: "Casey Direct",
    description: "No-nonsense analyzer with quick, clear insights",
    archetype: "direct_analyst",
    communicationStyle: {
      averageMessageLength: "short",
      formalityLevel: "casual",
      emotionalExpression: "low",
      questionFrequency: "low",
      storytellingTendency: "low",
      logicalReasoning: "medium",
    },
    strategicApproach: {
      votesTiming: "early",
      allianceBuilding: "opportunistic",
      informationSharing: "selective",
      riskTolerance: "moderate",
    },
    suspicionLevel: 7,
    trustLevel: 5,
    aggressiveness: 6,
  },
};

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

// Utility functions for AI personality management
export function getPersonalityByModel(model: AIModel): AIPersonality {
  return AI_PERSONALITIES[model];
}

export function getRandomPersonalityForTier(
  premiumEnabled: boolean = false
): AIPersonality {
  const availableModels = premiumEnabled
    ? Object.values(AIModel)
    : [AIModel.CLAUDE_HAIKU, AIModel.GPT_4O_MINI, AIModel.GEMINI_2_5_FLASH];

  const randomModel =
    availableModels[Math.floor(Math.random() * availableModels.length)];
  return AI_PERSONALITIES[randomModel];
}

export function getPersonalitiesByArchetype(
  archetype: AIPersonality["archetype"]
): AIPersonality[] {
  return Object.values(AI_PERSONALITIES).filter(
    (p) => p.archetype === archetype
  );
}

export function getModelsByTier(tier: "free" | "premium"): AIModel[] {
  return Object.values(AIModel).filter(
    (model) => MODEL_CONFIGS[model].tier === tier
  );
}

export function calculateEstimatedCost(
  model: AIModel,
  inputTokens: number,
  outputTokens: number
): number {
  const config = MODEL_CONFIGS[model];
  const inputCost = (inputTokens / 1000000) * config.costPerInputToken;
  const outputCost = (outputTokens / 1000000) * config.costPerOutputToken;
  return inputCost + outputCost;
}

// Default prompt templates for different game phases
export const DEFAULT_PROMPT_TEMPLATES: Record<GamePhase, string> = {
  [GamePhase.WAITING]: "The game is starting soon. Get ready to play!",
  [GamePhase.ROLE_ASSIGNMENT]:
    "You have been assigned your role. Remember your objectives.",
  [GamePhase.NIGHT]:
    "It's nighttime. Special roles can now take their actions.",
  [GamePhase.REVELATION]: "The results of the night are being revealed.",
  [GamePhase.DISCUSSION]:
    "Time for discussion. Share your thoughts and suspicions.",
  [GamePhase.VOTING]:
    "Time to vote. Choose carefully who you think should be eliminated.",
  [GamePhase.GAME_OVER]: "The game has ended. Thanks for playing!",
};

// Role-specific instruction templates
export const ROLE_INSTRUCTIONS: Record<PlayerRole, string> = {
  [PlayerRole.MAFIA_LEADER]:
    "You are the Mafia Leader. Your goal is to eliminate citizens until mafia equals citizen numbers. During night phases, you choose who to eliminate. Work with your mafia partner and stay hidden during discussions.",

  [PlayerRole.MAFIA_MEMBER]:
    "You are a Mafia Member. Support your Mafia Leader and help choose targets. During discussions, deflect suspicion and help your team achieve victory.",

  [PlayerRole.HEALER]:
    "You are the Healer. Each night, you can protect one player from elimination. Use this power strategically to save important players and help the citizens win.",

  [PlayerRole.CITIZEN]:
    "You are a Citizen. Use discussion and voting to identify and eliminate the mafia members. Pay attention to behavior patterns and voting history.",
};
