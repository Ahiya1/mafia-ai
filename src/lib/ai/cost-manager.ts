// AI Cost Management and Optimization for AI Mafia
import {
  AIModel,
  AIModelConfig,
  APIUsageStats,
  CostOptimizationConfig,
  MODEL_CONFIGS,
} from "@/types/ai";

export interface CostBreakdown {
  inputTokens: number;
  outputTokens: number;
  inputCost: number;
  outputCost: number;
  totalCost: number;
  model: AIModel;
  timestamp: Date;
}

export interface GameCostSummary {
  totalCost: number;
  requestCount: number;
  modelBreakdown: Record<AIModel, CostBreakdown[]>;
  averageCostPerRequest: number;
  highestCostRequest: CostBreakdown | null;
  recommendedOptimizations: string[];
}

export interface BudgetAlert {
  type: "warning" | "critical" | "info";
  message: string;
  currentSpend: number;
  budgetLimit: number;
  percentageUsed: number;
  suggestedActions: string[];
}

export class CostManager {
  private usage: Map<AIModel, APIUsageStats> = new Map();
  private gameHistory: Map<string, CostBreakdown[]> = new Map();
  private config: CostOptimizationConfig;
  private dailySpend: number = 0;
  private dailyBudget: number;
  private lastResetDate: Date = new Date();

  constructor(config?: Partial<CostOptimizationConfig>) {
    this.config = {
      maxCostPerGame: 0.1, // $0.10 per game
      preferredModelsForFreeUsers: [
        AIModel.CLAUDE_HAIKU,
        AIModel.GPT_4O_MINI,
        AIModel.GEMINI_2_5_FLASH,
      ],
      fallbackModel: AIModel.GEMINI_2_5_FLASH, // Cheapest option
      enableResponseCaching: true,
      maxCacheAge: 30, // 30 minutes
      rateLimitPerModel: 10, // 10 requests per minute
      ...config,
    };

    this.dailyBudget = parseFloat(process.env.DAILY_AI_BUDGET || "50.00");

    // Initialize usage stats for all models
    Object.values(AIModel).forEach((model) => {
      this.usage.set(model, {
        model,
        totalRequests: 0,
        totalTokensInput: 0,
        totalTokensOutput: 0,
        totalCost: 0,
        averageResponseTime: 0,
        errorRate: 0,
        lastUsed: new Date(),
      });
    });

    // Reset daily spend if it's a new day
    this.checkDailyReset();
  }

  /**
   * Calculate cost for a specific request
   */
  calculateRequestCost(
    model: AIModel,
    inputTokens: number,
    outputTokens: number
  ): CostBreakdown {
    const config = MODEL_CONFIGS[model];
    const inputCost = (inputTokens / 1000000) * config.costPerInputToken;
    const outputCost = (outputTokens / 1000000) * config.costPerOutputToken;
    const totalCost = inputCost + outputCost;

    return {
      inputTokens,
      outputTokens,
      inputCost,
      outputCost,
      totalCost,
      model,
      timestamp: new Date(),
    };
  }

  /**
   * Record usage and update statistics
   */
  recordUsage(
    model: AIModel,
    inputTokens: number,
    outputTokens: number,
    responseTime: number,
    isError: boolean = false,
    gameId?: string
  ): CostBreakdown {
    const costBreakdown = this.calculateRequestCost(
      model,
      inputTokens,
      outputTokens
    );

    // Update usage stats
    const stats = this.usage.get(model)!;
    stats.totalRequests++;
    stats.totalTokensInput += inputTokens;
    stats.totalTokensOutput += outputTokens;
    stats.totalCost += costBreakdown.totalCost;
    stats.averageResponseTime =
      (stats.averageResponseTime * (stats.totalRequests - 1) + responseTime) /
      stats.totalRequests;
    stats.lastUsed = new Date();

    if (isError) {
      stats.errorRate =
        (stats.errorRate * (stats.totalRequests - 1) + 1) / stats.totalRequests;
    } else {
      stats.errorRate =
        (stats.errorRate * (stats.totalRequests - 1)) / stats.totalRequests;
    }

    this.usage.set(model, stats);

    // Track daily spend
    this.dailySpend += costBreakdown.totalCost;

    // Record for game-specific tracking
    if (gameId) {
      const gameBreakdowns = this.gameHistory.get(gameId) || [];
      gameBreakdowns.push(costBreakdown);
      this.gameHistory.set(gameId, gameBreakdowns);
    }

    return costBreakdown;
  }

  /**
   * Get the most cost-effective model for a given task
   */
  getOptimalModel(
    premiumEnabled: boolean = false,
    complexityLevel: "low" | "medium" | "high" = "medium"
  ): AIModel {
    const availableModels = premiumEnabled
      ? Object.values(AIModel)
      : this.config.preferredModelsForFreeUsers;

    // Check budget constraints
    const budgetAlert = this.getBudgetAlert();
    if (budgetAlert.type === "critical") {
      return this.config.fallbackModel;
    }

    // Consider complexity vs cost trade-off
    switch (complexityLevel) {
      case "low":
        return availableModels.includes(AIModel.GEMINI_2_5_FLASH)
          ? AIModel.GEMINI_2_5_FLASH
          : this.config.fallbackModel;

      case "medium":
        if (premiumEnabled && budgetAlert.type !== "warning") {
          return AIModel.GEMINI_2_5_PRO;
        }
        return availableModels.includes(AIModel.GPT_4O_MINI)
          ? AIModel.GPT_4O_MINI
          : AIModel.GEMINI_2_5_FLASH;

      case "high":
        if (premiumEnabled && budgetAlert.type === "info") {
          return AIModel.CLAUDE_SONNET_4;
        }
        return availableModels.includes(AIModel.CLAUDE_HAIKU)
          ? AIModel.CLAUDE_HAIKU
          : AIModel.GPT_4O_MINI;

      default:
        return this.config.fallbackModel;
    }
  }

  /**
   * Get cost summary for a specific game
   */
  getGameCostSummary(gameId: string): GameCostSummary {
    const breakdowns = this.gameHistory.get(gameId) || [];

    if (breakdowns.length === 0) {
      return {
        totalCost: 0,
        requestCount: 0,
        modelBreakdown: {} as Record<AIModel, CostBreakdown[]>,
        averageCostPerRequest: 0,
        highestCostRequest: null,
        recommendedOptimizations: [],
      };
    }

    const totalCost = breakdowns.reduce(
      (sum, breakdown) => sum + breakdown.totalCost,
      0
    );
    const requestCount = breakdowns.length;
    const averageCostPerRequest = totalCost / requestCount;

    // Group by model
    const modelBreakdown: Record<AIModel, CostBreakdown[]> = {} as Record<
      AIModel,
      CostBreakdown[]
    >;
    Object.values(AIModel).forEach((model) => {
      modelBreakdown[model] = breakdowns.filter((b) => b.model === model);
    });

    // Find highest cost request
    const highestCostRequest = breakdowns.reduce(
      (max, breakdown) =>
        breakdown.totalCost > (max?.totalCost || 0) ? breakdown : max,
      null as CostBreakdown | null
    );

    // Generate optimization recommendations
    const recommendedOptimizations: string[] = [];

    if (totalCost > this.config.maxCostPerGame) {
      recommendedOptimizations.push(
        `Game cost ($${totalCost.toFixed(
          4
        )}) exceeded budget ($${this.config.maxCostPerGame.toFixed(4)})`
      );
    }

    if (averageCostPerRequest > 0.01) {
      recommendedOptimizations.push(
        "Consider using more cost-effective models for routine responses"
      );
    }

    const premiumUsage = breakdowns.filter((b) =>
      [
        AIModel.CLAUDE_SONNET_4,
        AIModel.GPT_4O,
        AIModel.GEMINI_2_5_PRO,
      ].includes(b.model)
    );
    if (premiumUsage.length > breakdowns.length * 0.5) {
      recommendedOptimizations.push(
        "High premium model usage detected - consider balancing with free tier models"
      );
    }

    return {
      totalCost,
      requestCount,
      modelBreakdown,
      averageCostPerRequest,
      highestCostRequest,
      recommendedOptimizations,
    };
  }

  /**
   * Check budget status and generate alerts
   */
  getBudgetAlert(): BudgetAlert {
    const percentageUsed = (this.dailySpend / this.dailyBudget) * 100;

    if (percentageUsed >= 90) {
      return {
        type: "critical",
        message: "Daily budget nearly exhausted",
        currentSpend: this.dailySpend,
        budgetLimit: this.dailyBudget,
        percentageUsed,
        suggestedActions: [
          "Switch to free tier models only",
          "Implement request queuing",
          "Enable aggressive response caching",
        ],
      };
    } else if (percentageUsed >= 70) {
      return {
        type: "warning",
        message: "Daily budget 70% consumed",
        currentSpend: this.dailySpend,
        budgetLimit: this.dailyBudget,
        percentageUsed,
        suggestedActions: [
          "Prioritize cost-effective models",
          "Reduce premium model usage",
          "Monitor remaining budget closely",
        ],
      };
    } else {
      return {
        type: "info",
        message: "Budget usage within normal limits",
        currentSpend: this.dailySpend,
        budgetLimit: this.dailyBudget,
        percentageUsed,
        suggestedActions: ["Continue normal operations"],
      };
    }
  }

  /**
   * Get detailed usage statistics
   */
  getUsageStats(): APIUsageStats[] {
    return Array.from(this.usage.values());
  }

  /**
   * Get cost efficiency metrics
   */
  getCostEfficiencyMetrics(): {
    costPerToken: Record<AIModel, number>;
    responseTimeVsCost: Record<AIModel, { avgTime: number; avgCost: number }>;
    errorRateVsCost: Record<AIModel, { errorRate: number; avgCost: number }>;
  } {
    const costPerToken: Record<AIModel, number> = {} as Record<AIModel, number>;
    const responseTimeVsCost: Record<
      AIModel,
      { avgTime: number; avgCost: number }
    > = {} as Record<AIModel, { avgTime: number; avgCost: number }>;
    const errorRateVsCost: Record<
      AIModel,
      { errorRate: number; avgCost: number }
    > = {} as Record<AIModel, { errorRate: number; avgCost: number }>;

    this.usage.forEach((stats, model) => {
      const totalTokens = stats.totalTokensInput + stats.totalTokensOutput;
      costPerToken[model] = totalTokens > 0 ? stats.totalCost / totalTokens : 0;

      responseTimeVsCost[model] = {
        avgTime: stats.averageResponseTime,
        avgCost:
          stats.totalRequests > 0 ? stats.totalCost / stats.totalRequests : 0,
      };

      errorRateVsCost[model] = {
        errorRate: stats.errorRate,
        avgCost:
          stats.totalRequests > 0 ? stats.totalCost / stats.totalRequests : 0,
      };
    });

    return {
      costPerToken,
      responseTimeVsCost,
      errorRateVsCost,
    };
  }

  /**
   * Reset daily tracking if it's a new day
   */
  private checkDailyReset(): void {
    const now = new Date();
    if (now.toDateString() !== this.lastResetDate.toDateString()) {
      this.dailySpend = 0;
      this.lastResetDate = now;
    }
  }

  /**
   * Predict cost for a game with given configuration
   */
  predictGameCost(
    playerCount: number,
    aiCount: number,
    estimatedRounds: number = 5,
    premiumEnabled: boolean = false
  ): {
    estimatedCost: number;
    breakdown: Record<string, number>;
    confidence: number;
  } {
    // Rough estimates based on typical game flow
    const messagesPerPlayerPerRound = 2;
    const votesPerRound = aiCount;
    const nightActionsPerRound = 2; // Mafia + Healer

    const totalMessages = aiCount * messagesPerPlayerPerRound * estimatedRounds;
    const totalVotes = votesPerRound * estimatedRounds;
    const totalNightActions = nightActionsPerRound * estimatedRounds;

    const totalRequests = totalMessages + totalVotes + totalNightActions;

    // Estimate tokens per request (rough averages)
    const avgInputTokens = 800;
    const avgOutputTokens = 150;

    // Choose representative model based on tier
    const representativeModel = premiumEnabled
      ? AIModel.CLAUDE_SONNET_4
      : AIModel.GEMINI_2_5_FLASH;

    const costPerRequest = this.calculateRequestCost(
      representativeModel,
      avgInputTokens,
      avgOutputTokens
    ).totalCost;

    const estimatedCost = totalRequests * costPerRequest;

    return {
      estimatedCost,
      breakdown: {
        messages: totalMessages * costPerRequest,
        votes: totalVotes * costPerRequest,
        nightActions: totalNightActions * costPerRequest,
      },
      confidence: 0.7, // Moderate confidence due to variability
    };
  }

  /**
   * Clean up old game history to prevent memory bloat
   */
  cleanupOldGames(maxAgeHours: number = 24): void {
    const cutoffTime = new Date(Date.now() - maxAgeHours * 60 * 60 * 1000);

    for (const [gameId, breakdowns] of this.gameHistory.entries()) {
      const hasRecentActivity = breakdowns.some(
        (breakdown) => breakdown.timestamp > cutoffTime
      );

      if (!hasRecentActivity) {
        this.gameHistory.delete(gameId);
      }
    }
  }

  /**
   * Export cost data for analysis
   */
  exportCostData(): {
    usage: APIUsageStats[];
    gameHistory: Record<string, CostBreakdown[]>;
    config: CostOptimizationConfig;
    dailySpend: number;
    dailyBudget: number;
    exportTimestamp: Date;
  } {
    return {
      usage: this.getUsageStats(),
      gameHistory: Object.fromEntries(this.gameHistory),
      config: this.config,
      dailySpend: this.dailySpend,
      dailyBudget: this.dailyBudget,
      exportTimestamp: new Date(),
    };
  }
}

// Singleton instance for global cost management
export const globalCostManager = new CostManager();

// Utility functions
export function formatCost(cost: number): string {
  return `$${cost.toFixed(4)}`;
}

export function formatPercentage(value: number): string {
  return `${value.toFixed(1)}%`;
}

export function getModelTierColor(model: AIModel): string {
  const config = MODEL_CONFIGS[model];
  return config.tier === "premium" ? "#f97316" : "#3b82f6";
}
