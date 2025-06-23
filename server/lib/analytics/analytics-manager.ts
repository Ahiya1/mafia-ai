// server/lib/analytics/analytics-manager.ts
import { createClient } from "@supabase/supabase-js";
import { PlayerRole, GamePhase, AIModel } from "../types/game";

export interface GameAnalyticsEvent {
  gameSessionId: string;
  eventType:
    | "message"
    | "vote"
    | "elimination"
    | "phase_change"
    | "night_action";
  eventData: any;
  gamePhase: GamePhase;
  roundNumber: number;
  playerId?: string;
  aiModel?: AIModel;
  aiCost?: number;
  aiTokensUsed?: number;
  aiResponseTimeMs?: number;
}

export interface PlayerSessionData {
  gameSessionId: string;
  userId?: string;
  playerName: string;
  playerType: "human" | "ai";
  aiModel?: AIModel;
  assignedRole: PlayerRole;
  survivedRounds: number;
  wasEliminated: boolean;
  eliminationRound?: number;
  eliminationCause?: "voted_out" | "mafia_kill";
  votesCast: number;
  accurateVotes: number;
  votedForMafia: number;
  messagesSent: number;
  averageMessageLength: number;
  aiPlayersIdentified: number;
  aiDetectionAccuracy: number;
  wonGame: boolean;
}

export interface AIUsageData {
  modelName: AIModel;
  provider: "openai" | "anthropic" | "google";
  tier: "free" | "premium";
  date: string;
  totalRequests: number;
  totalTokensInput: number;
  totalTokensOutput: number;
  totalCost: number;
  averageResponseTimeMs: number;
  errorCount: number;
  successRate: number;
  gamesUsedIn: number;
  uniqueUsers: number;
}

export interface ResearchInsights {
  periodStart: string;
  periodEnd: string;
  avgAiDetectionRate: number;
  mostSuccessfulStrategies: any;
  votingPatternAnalysis: any;
  communicationTrends: any;
  aiModelEffectiveness: any;
  humanVsAiWinRates: any;
  personalityPreferenceData: any;
  userEngagementMetrics: any;
  packageConversionRates: any;
  costOptimizationData: any;
  totalGamesAnalyzed: number;
  totalPlayersAnalyzed: number;
}

export class AnalyticsManager {
  private supabase;

  constructor() {
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }

  // Real-time event tracking
  async trackGameEvent(event: GameAnalyticsEvent): Promise<void> {
    try {
      await this.supabase.from("game_analytics").insert({
        game_session_id: event.gameSessionId,
        event_type: event.eventType,
        event_data: event.eventData,
        game_phase: event.gamePhase,
        round_number: event.roundNumber,
        player_id: event.playerId,
        ai_model: event.aiModel,
        ai_cost: event.aiCost || 0,
        ai_tokens_used: event.aiTokensUsed || 0,
        ai_response_time_ms: event.aiResponseTimeMs || 0,
      });
    } catch (error) {
      console.error("Error tracking game event:", error);
    }
  }

  // Player session completion
  async recordPlayerSession(data: PlayerSessionData): Promise<void> {
    try {
      await this.supabase.from("player_sessions").insert({
        game_session_id: data.gameSessionId,
        user_id: data.userId,
        player_name: data.playerName,
        player_type: data.playerType,
        ai_model: data.aiModel,
        assigned_role: data.assignedRole,
        survived_rounds: data.survivedRounds,
        was_eliminated: data.wasEliminated,
        elimination_round: data.eliminationRound,
        elimination_cause: data.eliminationCause,
        votes_cast: data.votesCast,
        accurate_votes: data.accurateVotes,
        voted_for_mafia: data.votedForMafia,
        messages_sent: data.messagesSent,
        average_message_length: data.averageMessageLength,
        ai_players_identified: data.aiPlayersIdentified,
        ai_detection_accuracy: data.aiDetectionAccuracy,
        won_game: data.wonGame,
      });
    } catch (error) {
      console.error("Error recording player session:", error);
    }
  }

  // AI usage tracking (aggregated daily)
  async updateAIUsageStats(usage: Partial<AIUsageData>): Promise<void> {
    try {
      const today = new Date().toISOString().split("T")[0];

      // Upsert AI usage stats
      await this.supabase.from("ai_usage_stats").upsert(
        {
          model_name: usage.modelName,
          provider: usage.provider,
          tier: usage.tier,
          date: today,
          total_requests: usage.totalRequests || 0,
          total_tokens_input: usage.totalTokensInput || 0,
          total_tokens_output: usage.totalTokensOutput || 0,
          total_cost: usage.totalCost || 0,
          average_response_time_ms: usage.averageResponseTimeMs || 0,
          error_count: usage.errorCount || 0,
          success_rate: usage.successRate || 100.0,
          games_used_in: usage.gamesUsedIn || 0,
          unique_users: usage.uniqueUsers || 0,
        },
        {
          onConflict: "model_name,date",
        }
      );
    } catch (error) {
      console.error("Error updating AI usage stats:", error);
    }
  }

  // Advanced analytics queries
  async getPlayerBehaviorInsights(
    timeframe: "day" | "week" | "month" = "week"
  ): Promise<any> {
    try {
      const daysBack = timeframe === "day" ? 1 : timeframe === "week" ? 7 : 30;
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - daysBack);

      const { data, error } = await this.supabase
        .from("player_sessions")
        .select(
          `
          assigned_role,
          player_type,
          ai_model,
          won_game,
          ai_detection_accuracy,
          votes_cast,
          accurate_votes,
          messages_sent,
          average_message_length,
          survived_rounds,
          was_eliminated,
          elimination_cause
        `
        )
        .gte("created_at", startDate.toISOString())
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Analyze data
      const insights = this.analyzePlayerBehavior(data || []);
      return insights;
    } catch (error) {
      console.error("Error getting player behavior insights:", error);
      return null;
    }
  }

  async getAIModelPerformance(
    timeframe: "day" | "week" | "month" = "week"
  ): Promise<any> {
    try {
      const daysBack = timeframe === "day" ? 1 : timeframe === "week" ? 7 : 30;
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - daysBack);

      const { data, error } = await this.supabase
        .from("ai_usage_stats")
        .select("*")
        .gte("date", startDate.toISOString().split("T")[0])
        .order("date", { ascending: false });

      if (error) throw error;

      return this.analyzeAIPerformance(data || []);
    } catch (error) {
      console.error("Error getting AI model performance:", error);
      return null;
    }
  }

  async getGameTrends(
    timeframe: "day" | "week" | "month" = "week"
  ): Promise<any> {
    try {
      const daysBack = timeframe === "day" ? 1 : timeframe === "week" ? 7 : 30;
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - daysBack);

      const { data, error } = await this.supabase
        .from("game_sessions")
        .select(
          `
          started_at,
          ended_at,
          duration_seconds,
          winner,
          total_rounds,
          total_ai_cost,
          ai_requests_made,
          total_players,
          human_players,
          ai_players,
          premium_models_enabled
        `
        )
        .gte("started_at", startDate.toISOString())
        .not("ended_at", "is", null)
        .order("started_at", { ascending: false });

      if (error) throw error;

      return this.analyzeGameTrends(data || []);
    } catch (error) {
      console.error("Error getting game trends:", error);
      return null;
    }
  }

  // Business intelligence
  async getRevenueAnalytics(
    timeframe: "day" | "week" | "month" = "month"
  ): Promise<any> {
    try {
      const daysBack = timeframe === "day" ? 1 : timeframe === "week" ? 7 : 30;
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - daysBack);

      const { data, error } = await this.supabase
        .from("payment_transactions")
        .select(
          `
          amount,
          currency,
          status,
          package_name,
          games_purchased,
          created_at,
          completed_at
        `
        )
        .gte("created_at", startDate.toISOString())
        .eq("status", "completed")
        .order("created_at", { ascending: false });

      if (error) throw error;

      return this.analyzeRevenue(data || []);
    } catch (error) {
      console.error("Error getting revenue analytics:", error);
      return null;
    }
  }

  // Generate research insights (weekly aggregation)
  async generateResearchInsights(): Promise<void> {
    try {
      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - 7);
      const weekEnd = new Date();

      // Get comprehensive data
      const [playerData, gameData, aiData] = await Promise.all([
        this.getPlayerBehaviorInsights("week"),
        this.getGameTrends("week"),
        this.getAIModelPerformance("week"),
      ]);

      const insights: Partial<ResearchInsights> = {
        periodStart: weekStart.toISOString().split("T")[0],
        periodEnd: weekEnd.toISOString().split("T")[0],
        avgAiDetectionRate: playerData?.averageAIDetectionRate || 0,
        mostSuccessfulStrategies: playerData?.successfulStrategies || {},
        votingPatternAnalysis: playerData?.votingPatterns || {},
        communicationTrends: playerData?.communicationTrends || {},
        aiModelEffectiveness: aiData?.modelComparison || {},
        humanVsAiWinRates: gameData?.winRateAnalysis || {},
        personalityPreferenceData: aiData?.personalityStats || {},
        userEngagementMetrics: gameData?.engagementMetrics || {},
        packageConversionRates: {}, // Would need payment data analysis
        costOptimizationData: aiData?.costAnalysis || {},
        totalGamesAnalyzed: gameData?.totalGames || 0,
        totalPlayersAnalyzed: playerData?.totalPlayers || 0,
      };

      // Store insights
      await this.supabase.from("research_insights").insert(insights);
    } catch (error) {
      console.error("Error generating research insights:", error);
    }
  }

  // Private analysis methods
  private analyzePlayerBehavior(sessions: any[]): any {
    const humanSessions = sessions.filter((s) => s.player_type === "human");
    const aiSessions = sessions.filter((s) => s.player_type === "ai");

    return {
      totalPlayers: sessions.length,
      humanPlayers: humanSessions.length,
      aiPlayers: aiSessions.length,
      averageAIDetectionRate: this.average(
        humanSessions.map((s) => s.ai_detection_accuracy)
      ),
      winRateByRole: this.groupBy(sessions, "assigned_role", "won_game"),
      averageGameLength: this.average(sessions.map((s) => s.survived_rounds)),
      eliminationPatterns: this.groupBy(
        sessions.filter((s) => s.was_eliminated),
        "elimination_cause"
      ),
      communicationTrends: {
        averageMessagesPerPlayer: this.average(
          sessions.map((s) => s.messages_sent)
        ),
        averageMessageLength: this.average(
          sessions.map((s) => s.average_message_length)
        ),
      },
      votingPatterns: {
        averageVotesPerPlayer: this.average(sessions.map((s) => s.votes_cast)),
        votingAccuracy: this.average(
          sessions.map((s) => s.accurate_votes / Math.max(s.votes_cast, 1))
        ),
      },
    };
  }

  private analyzeAIPerformance(stats: any[]): any {
    const byModel = this.groupBy(stats, "model_name");

    return {
      modelComparison: Object.entries(byModel).reduce(
        (acc, [model, data]: [string, any]) => {
          acc[model] = {
            totalRequests: this.sum(data, "total_requests"),
            totalCost: this.sum(data, "total_cost"),
            averageResponseTime: this.average(
              data.map((d: any) => d.average_response_time_ms)
            ),
            successRate: this.average(data.map((d: any) => d.success_rate)),
            costPerRequest:
              this.sum(data, "total_cost") /
              Math.max(this.sum(data, "total_requests"), 1),
          };
          return acc;
        },
        {} as any
      ),
      costAnalysis: {
        totalCost: this.sum(stats, "total_cost"),
        costByProvider: this.groupBy(stats, "provider", "total_cost"),
        costByTier: this.groupBy(stats, "tier", "total_cost"),
      },
    };
  }

  private analyzeGameTrends(games: any[]): any {
    return {
      totalGames: games.length,
      averageGameDuration: this.average(games.map((g) => g.duration_seconds)),
      winRateAnalysis: {
        citizens:
          games.filter((g) => g.winner === "citizens").length / games.length,
        mafia: games.filter((g) => g.winner === "mafia").length / games.length,
      },
      averageRounds: this.average(games.map((g) => g.total_rounds)),
      costMetrics: {
        averageCostPerGame: this.average(games.map((g) => g.total_ai_cost)),
        totalAICost: this.sum(games, "total_ai_cost"),
        averageRequestsPerGame: this.average(
          games.map((g) => g.ai_requests_made)
        ),
      },
      playerDistribution: {
        averageHumans: this.average(games.map((g) => g.human_players)),
        averageAI: this.average(games.map((g) => g.ai_players)),
        premiumModelUsage:
          games.filter((g) => g.premium_models_enabled).length / games.length,
      },
    };
  }

  private analyzeRevenue(transactions: any[]): any {
    return {
      totalRevenue: this.sum(transactions, "amount"),
      transactionCount: transactions.length,
      averageTransactionValue: this.average(transactions.map((t) => t.amount)),
      revenueByPackage: this.groupBy(transactions, "package_name", "amount"),
      gamesPerDollar:
        this.sum(transactions, "games_purchased") /
        Math.max(this.sum(transactions, "amount"), 1),
    };
  }

  // Utility methods
  private average(numbers: number[]): number {
    return numbers.length
      ? numbers.reduce((a, b) => a + b, 0) / numbers.length
      : 0;
  }

  private sum(objects: any[], key: string): number {
    return objects.reduce((sum, obj) => sum + (obj[key] || 0), 0);
  }

  private groupBy(array: any[], key: string, valueKey?: string): any {
    return array.reduce((groups, item) => {
      const group = item[key];
      if (!groups[group]) groups[group] = [];
      groups[group].push(valueKey ? item[valueKey] : item);
      return groups;
    }, {});
  }
}

// Export singleton
export const analyticsManager = new AnalyticsManager();
