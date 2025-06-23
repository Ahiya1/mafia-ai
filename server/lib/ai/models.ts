import {
  AIActionRequest,
  AIResponse,
  AIModel,
  APIUsageStats,
  MODEL_CONFIGS,
  AI_PERSONALITIES,
  AIDecisionContext,
  AIPersonality,
} from "../types/ai";
import { PlayerRole, GamePhase } from "../types/game";

export class AIModelManager {
  private usageStats: Map<AIModel, APIUsageStats> = new Map();
  private readonly fallbackResponses = {
    discussion: [
      "I need to think about this more carefully.",
      "Something seems off about the recent events.",
      "We should consider all the evidence before deciding.",
      "I'm not entirely convinced by the arguments so far.",
      "Let me share my observations from this round.",
    ],
    vote: [
      "Based on the discussion patterns, I think this person is suspicious.",
      "The voting history suggests we should eliminate this player.",
      "My analysis points to this being the right choice.",
      "This player's behavior has been concerning.",
      "I believe this is our best option for finding mafia.",
    ],
    night_action: [
      "kill", // For mafia
      "heal", // For healer
    ],
  };

  constructor() {
    // Initialize usage stats for all models
    Object.values(AIModel).forEach((model) => {
      this.usageStats.set(model, {
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
  }

  async generateResponse(request: AIActionRequest): Promise<AIResponse> {
    const startTime = Date.now();

    try {
      console.log(
        `🤖 Generating ${request.type} response for ${request.personality.model}`
      );

      // For demo purposes, use smart fallback responses that consider context
      const response = await this.generateSmartFallbackResponse(request);

      const responseTime = Date.now() - startTime;
      const tokensUsed = this.estimateTokenUsage(request, response);
      const cost = this.calculateCost(
        request.personality.model,
        tokensUsed.input,
        tokensUsed.output
      );

      // Update usage stats
      this.updateUsageStats(
        request.personality.model,
        tokensUsed.input,
        tokensUsed.output,
        responseTime,
        cost
      );

      return {
        content: response,
        confidence: 0.8,
        reasoning: `Generated using ${request.personality.archetype} approach`,
        metadata: {
          model: request.personality.model,
          tokensUsed: tokensUsed.input + tokensUsed.output,
          responseTime,
          cost,
          timestamp: new Date(),
        },
      };
    } catch (error) {
      console.error(`❌ AI response generation failed:`, error);

      // Update error stats
      const stats = this.usageStats.get(request.personality.model)!;
      stats.errorRate =
        (stats.errorRate * stats.totalRequests + 1) / (stats.totalRequests + 1);

      // Return fallback response
      return this.getFallbackResponse(request);
    }
  }

  private async generateSmartFallbackResponse(
    request: AIActionRequest
  ): Promise<string> {
    const { type, context, personality, constraints } = request;

    switch (type) {
      case "discussion":
        return this.generateDiscussionResponse(context, personality);

      case "vote":
        return this.generateVoteReasoning(context, personality);

      case "night_action":
        return this.generateNightActionResponse(context, personality);

      default:
        return "I need to think about this situation more carefully.";
    }
  }

  private generateDiscussionResponse(
    context: AIDecisionContext,
    personality: AIPersonality
  ): string {
    const { round, eliminatedPlayers, gameHistory } = context;
    const { communicationStyle, archetype, suspicionLevel } = personality;

    const responses: string[] = [];

    // Base response on archetype
    switch (archetype) {
      case "analytical_detective":
        responses.push(
          "Looking at the voting patterns from previous rounds...",
          "The elimination sequence suggests a particular strategy.",
          "We need to analyze the behavioral patterns more carefully.",
          "The timing of certain statements has been suspicious.",
          "Mathematical probability suggests we should focus on..."
        );
        break;

      case "creative_storyteller":
        responses.push(
          "I have a theory about what's really happening here.",
          "The way this game is unfolding reminds me of...",
          "Something about the group dynamics feels off to me.",
          "I'm getting strong intuitive feelings about certain players.",
          "Let me paint a picture of what I think is happening..."
        );
        break;

      case "direct_analyst":
        responses.push(
          "Here's what I think: someone is clearly manipulating the votes.",
          "We're wasting time. The evidence points to specific players.",
          "Cut through the noise - who benefits from recent eliminations?",
          "Stop overcomplicating this. The patterns are obvious.",
          "Focus: who's been consistently suspicious throughout?"
        );
        break;
    }

    // Add round-specific context
    if (round > 1 && eliminatedPlayers.length > 0) {
      responses.push(
        `After ${eliminatedPlayers.length} eliminations, we need to change strategy.`,
        "The remaining players' behavior is becoming more telling.",
        "With fewer people left, every vote becomes critical."
      );
    }

    // Adjust for personality traits
    if (suspicionLevel > 7) {
      responses.push(
        "I'm becoming increasingly suspicious of certain players.",
        "Too many coincidences are happening for this to be random.",
        "Someone is definitely trying to mislead us."
      );
    }

    const baseResponse =
      responses[Math.floor(Math.random() * responses.length)];

    // Adjust message length based on communication style
    switch (communicationStyle.averageMessageLength) {
      case "short":
        return baseResponse.split(".")[0] + ".";
      case "long":
        return (
          baseResponse + " " + this.addDetailedAnalysis(context, personality)
        );
      default:
        return baseResponse;
    }
  }

  private generateVoteReasoning(
    context: AIDecisionContext,
    personality: AIPersonality
  ): string {
    const reasons = [
      "Their voting pattern has been inconsistent with citizen behavior.",
      "They've been deflecting suspicion rather than finding mafia.",
      "Their questions seem designed to confuse rather than clarify.",
      "The timing of their statements has been suspicious.",
      "They've been too eager to eliminate certain players.",
      "Their behavior changed significantly after the last elimination.",
      "They haven't contributed meaningful analysis to help citizens.",
      "Their alliances seem strategically motivated rather than genuine.",
    ];

    const reason = reasons[Math.floor(Math.random() * reasons.length)];

    if (personality.communicationStyle.averageMessageLength === "long") {
      return `${reason} Additionally, when I consider the broader context of this game, their actions become even more suspicious.`;
    }

    return reason;
  }

  private generateNightActionResponse(
    context: AIDecisionContext,
    personality: AIPersonality
  ): string {
    // This is just for logging/debugging - actual night actions are handled by game logic
    if (context.role === PlayerRole.MAFIA_LEADER) {
      return "Choosing elimination target based on threat assessment";
    } else if (context.role === PlayerRole.HEALER) {
      return "Selecting protection target based on risk analysis";
    }
    return "Considering night action options";
  }

  private addDetailedAnalysis(
    context: AIDecisionContext,
    personality: AIPersonality
  ): string {
    const additions = [
      "Looking at the meta-game, certain players are positioning themselves advantageously.",
      "The vote distribution suggests coordinated behavior among some players.",
      "Communication patterns reveal potential hidden alliances.",
      "Recent eliminations have disproportionately affected one faction.",
      "The psychological dynamics between players are shifting tellingly.",
    ];

    return additions[Math.floor(Math.random() * additions.length)];
  }

  private getFallbackResponse(request: AIActionRequest): AIResponse {
    const fallbacks = this.fallbackResponses[request.type] || [
      "I need more time to think.",
    ];
    const content = fallbacks[Math.floor(Math.random() * fallbacks.length)];

    return {
      content,
      confidence: 0.5,
      reasoning: "Fallback response due to AI service unavailability",
      metadata: {
        model: request.personality.model,
        tokensUsed: 50,
        responseTime: 1000,
        cost: 0.001,
        timestamp: new Date(),
      },
    };
  }

  private estimateTokenUsage(
    request: AIActionRequest,
    response: string
  ): { input: number; output: number } {
    // Rough estimation: 1 token ≈ 4 characters
    const inputTokens = Math.ceil(JSON.stringify(request).length / 4);
    const outputTokens = Math.ceil(response.length / 4);

    return { input: inputTokens, output: outputTokens };
  }

  private calculateCost(
    model: AIModel,
    inputTokens: number,
    outputTokens: number
  ): number {
    const config = MODEL_CONFIGS[model];
    const inputCost = (inputTokens / 1000000) * config.costPerInputToken;
    const outputCost = (outputTokens / 1000000) * config.costPerOutputToken;
    return inputCost + outputCost;
  }

  private updateUsageStats(
    model: AIModel,
    inputTokens: number,
    outputTokens: number,
    responseTime: number,
    cost: number
  ): void {
    const stats = this.usageStats.get(model)!;

    stats.totalRequests++;
    stats.totalTokensInput += inputTokens;
    stats.totalTokensOutput += outputTokens;
    stats.totalCost += cost;
    stats.averageResponseTime =
      (stats.averageResponseTime * (stats.totalRequests - 1) + responseTime) /
      stats.totalRequests;
    stats.lastUsed = new Date();

    this.usageStats.set(model, stats);
  }

  // Public API methods
  getUsageStats(): Map<AIModel, APIUsageStats> {
    return new Map(this.usageStats);
  }

  getPersonalityPoolInfo(): any {
    const personalities = Object.values(AI_PERSONALITIES);

    return {
      total: personalities.length,
      byModel: personalities.reduce((acc, p) => {
        acc[p.model] = (acc[p.model] || 0) + 1;
        return acc;
      }, {} as Record<AIModel, number>),
      byArchetype: personalities.reduce((acc, p) => {
        acc[p.archetype] = (acc[p.archetype] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      models: Object.values(AIModel),
      archetypes: [
        "analytical_detective",
        "creative_storyteller",
        "direct_analyst",
      ],
    };
  }

  getTotalCost(): number {
    return Array.from(this.usageStats.values()).reduce(
      (total, stats) => total + stats.totalCost,
      0
    );
  }

  resetStats(): void {
    this.usageStats.clear();
    Object.values(AIModel).forEach((model) => {
      this.usageStats.set(model, {
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
  }
}
