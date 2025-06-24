// src/lib/ai/response-generator.ts - FIXED: Added reasoning to night action responses
import {
  AIActionRequest,
  AIResponse,
  AIDecisionContext,
  AIPersonality,
  AIModel,
} from "../../types/ai";
import { PlayerRole, GamePhase, PlayerId } from "../../types/game";
import { AIModelManager } from "./models";

export class AIResponseGenerator {
  private aiManager: AIModelManager;
  private responseCache: Map<string, AIResponse> = new Map();
  private requestQueue: Map<string, Promise<AIResponse>> = new Map();

  constructor() {
    this.aiManager = new AIModelManager();
  }

  /**
   * Generate AI response for any game action
   */
  async generateResponse(request: AIActionRequest): Promise<AIResponse> {
    const cacheKey = this.generateCacheKey(request);

    // Check cache first
    const cached = this.responseCache.get(cacheKey);
    if (cached && this.isCacheValid(cached)) {
      console.log(`🎯 Using cached response for ${request.personality.name}`);
      return cached;
    }

    // Check if already processing this request
    const existing = this.requestQueue.get(cacheKey);
    if (existing) {
      console.log(
        `⏳ Waiting for existing request for ${request.personality.name}`
      );
      return existing;
    }

    // Generate new response
    const responsePromise = this.generateNewResponse(request);
    this.requestQueue.set(cacheKey, responsePromise);

    try {
      const response = await responsePromise;

      // Cache successful responses
      this.responseCache.set(cacheKey, response);

      // Clean up queue
      this.requestQueue.delete(cacheKey);

      console.log(
        `✅ Generated ${request.type} response for ${request.personality.name}: "${response.content}"`
      );
      return response;
    } catch (error) {
      this.requestQueue.delete(cacheKey);
      console.error(
        `❌ Failed to generate response for ${request.personality.name}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Generate discussion response using real AI
   */
  async generateDiscussionResponse(
    context: AIDecisionContext,
    personality: AIPersonality
  ): Promise<AIResponse> {
    const request: AIActionRequest = {
      type: "discussion",
      context: this.enhanceContext(context),
      personality,
      constraints: {
        maxLength: this.getMessageLengthForPersonality(personality),
        timeLimit: 30000,
      },
    };

    return this.generateResponse(request);
  }

  /**
   * Generate voting decision using real AI
   */
  async generateVotingResponse(
    context: AIDecisionContext,
    personality: AIPersonality,
    availableTargets: PlayerId[]
  ): Promise<{ targetId: PlayerId; reasoning: string }> {
    const request: AIActionRequest = {
      type: "vote",
      context: this.enhanceContext(context),
      personality,
      constraints: {
        maxLength: 200,
        mustVote: true,
        availableTargets,
        timeLimit: 30000,
      },
    };

    const response = await this.generateResponse(request);
    return this.parseVotingResponse(response, availableTargets, personality);
  }

  /**
   * FIXED: Generate night action using real AI with reasoning
   */
  async generateNightActionResponse(
    context: AIDecisionContext,
    personality: AIPersonality,
    availableTargets: PlayerId[]
  ): Promise<{
    action: "kill" | "heal";
    targetId: PlayerId | null;
    reasoning: string;
  }> {
    const request: AIActionRequest = {
      type: "night_action",
      context: this.enhanceContext(context),
      personality,
      constraints: {
        maxLength: 150,
        availableTargets,
        timeLimit: 45000,
      },
    };

    const response = await this.generateResponse(request);
    return this.parseNightActionResponse(
      response,
      context.role,
      availableTargets
    );
  }

  /**
   * Generate mafia coordination message (private between mafia members)
   */
  async generateMafiaCoordination(
    context: AIDecisionContext,
    personality: AIPersonality,
    partnerPersonality: AIPersonality,
    targetOptions: PlayerId[]
  ): Promise<string> {
    const enhancedContext = {
      ...this.enhanceContext(context),
      gameHistory: [
        ...context.gameHistory,
        `[MAFIA PRIVATE] Coordinating with ${partnerPersonality.name}`,
        `[MAFIA PRIVATE] Available targets: ${targetOptions.length} players`,
      ],
    };

    const request: AIActionRequest = {
      type: "discussion",
      context: enhancedContext,
      personality,
      constraints: {
        maxLength: 150,
        timeLimit: 20000,
      },
    };

    // Add special mafia coordination context
    const originalContent = await this.generateResponse(request);
    return `[MAFIA CHAT] ${originalContent.content}`;
  }

  /**
   * Generate healer decision reasoning (for spectators)
   */
  async generateHealerReasoning(
    context: AIDecisionContext,
    personality: AIPersonality,
    availableTargets: PlayerId[]
  ): Promise<string> {
    const enhancedContext = {
      ...this.enhanceContext(context),
      gameHistory: [
        ...context.gameHistory,
        `[HEALER THOUGHTS] Considering who to protect tonight...`,
        `[HEALER THOUGHTS] Available to protect: ${availableTargets.length} players`,
      ],
    };

    const request: AIActionRequest = {
      type: "night_action",
      context: enhancedContext,
      personality,
      constraints: {
        maxLength: 120,
        availableTargets,
        timeLimit: 25000,
      },
    };

    const response = await this.generateResponse(request);
    return `[HEALER THOUGHTS] ${response.content}`;
  }

  /**
   * Enhanced context with better information for AI decision making
   */
  private enhanceContext(context: AIDecisionContext): AIDecisionContext {
    return {
      ...context,
      gameHistory: this.formatGameHistory(context.gameHistory),
      playerStatus: this.buildPlayerStatus(context),
      eliminationHistory: this.buildEliminationHistory(context),
    };
  }

  /**
   * Format game history for better AI understanding
   */
  private formatGameHistory(history: string[]): string[] {
    return history.slice(-8).map((entry, index) => {
      // Add context indicators
      if (entry.includes("eliminated")) {
        return `🔥 ${entry}`;
      }
      if (entry.includes("voted")) {
        return `🗳️ ${entry}`;
      }
      if (entry.includes("suspicious")) {
        return `🤔 ${entry}`;
      }
      return entry;
    });
  }

  /**
   * Build comprehensive player status
   */
  private buildPlayerStatus(context: AIDecisionContext) {
    return {
      living: context.livingPlayers.map((id) => ({
        id,
        name: `Player_${id.slice(-4)}`, // Simplified name for AI
        suspicionLevel: context.suspicionLevels[id] || 5,
        trustLevel: context.trustLevels[id] || 5,
      })),
      eliminated: context.eliminatedPlayers.map((id) => ({
        id,
        name: `Player_${id.slice(-4)}`,
        role: "unknown" as any, // AI shouldn't know eliminated roles
      })),
    };
  }

  /**
   * Build elimination history for pattern recognition
   */
  private buildEliminationHistory(context: AIDecisionContext) {
    return context.eliminatedPlayers.map((playerId, index) => ({
      round: index + 1,
      playerName: `Player_${playerId.slice(-4)}`,
      playerId,
      role: "unknown" as any,
      cause: (index % 2 === 0 ? "voted_out" : "mafia_kill") as
        | "voted_out"
        | "mafia_kill",
      timestamp: new Date(),
    }));
  }

  /**
   * Parse voting response from AI to extract target and reasoning
   */
  private parseVotingResponse(
    response: AIResponse,
    availableTargets: PlayerId[],
    personality: AIPersonality
  ): { targetId: PlayerId; reasoning: string } {
    const content = response.content.toLowerCase();

    // Try to extract target from AI response
    let targetId: PlayerId | null = null;
    let reasoning = response.content;

    // Look for voting patterns in AI response
    const votePatterns = [
      /vote.*?for.*?([a-zA-Z_0-9-]+)/i,
      /eliminate.*?([a-zA-Z_0-9-]+)/i,
      /choose.*?([a-zA-Z_0-9-]+)/i,
      /suspicious.*?([a-zA-Z_0-9-]+)/i,
    ];

    for (const pattern of votePatterns) {
      const match = response.content.match(pattern);
      if (match) {
        const potentialTarget = match[1];
        // Try to match with available targets
        const foundTarget = availableTargets.find(
          (id) =>
            id.includes(potentialTarget) ||
            potentialTarget.includes(id.slice(-4))
        );
        if (foundTarget) {
          targetId = foundTarget;
          break;
        }
      }
    }

    // Fallback: use personality-based decision
    if (!targetId) {
      console.log(
        `🎯 AI didn't specify clear target, using personality-based selection for ${personality.name}`
      );
      targetId = this.selectTargetByPersonality(availableTargets, personality);
      reasoning = this.generatePersonalityBasedReasoning(personality);
    }

    return {
      targetId,
      reasoning:
        reasoning.replace(/^I vote.*?because/i, "").trim() || reasoning,
    };
  }

  /**
   * FIXED: Parse night action response from AI with reasoning
   */
  private parseNightActionResponse(
    response: AIResponse,
    role: PlayerRole,
    availableTargets: PlayerId[]
  ): { action: "kill" | "heal"; targetId: PlayerId | null; reasoning: string } {
    const content = response.content.toLowerCase();
    const action = role === PlayerRole.MAFIA_LEADER ? "kill" : "heal";
    let reasoning = response.content.trim();

    // Try to extract target from AI response
    let targetId: PlayerId | null = null;

    const actionPatterns = [
      /(?:kill|eliminate|target).*?([a-zA-Z_0-9-]+)/i,
      /(?:protect|heal|save).*?([a-zA-Z_0-9-]+)/i,
      /choose.*?([a-zA-Z_0-9-]+)/i,
    ];

    for (const pattern of actionPatterns) {
      const match = response.content.match(pattern);
      if (match) {
        const potentialTarget = match[1];
        const foundTarget = availableTargets.find(
          (id) =>
            id.includes(potentialTarget) ||
            potentialTarget.includes(id.slice(-4))
        );
        if (foundTarget) {
          targetId = foundTarget;
          break;
        }
      }
    }

    // Fallback: random selection if AI didn't specify clearly
    if (!targetId && availableTargets.length > 0) {
      targetId =
        availableTargets[Math.floor(Math.random() * availableTargets.length)];
      reasoning =
        action === "kill"
          ? "Strategic elimination based on threat assessment"
          : "Protective decision based on vulnerability analysis";
      console.log(
        `🎯 AI didn't specify clear target, selected random: ${targetId}`
      );
    } else if (!targetId) {
      // No targets available
      reasoning =
        action === "kill"
          ? "No suitable targets identified this round"
          : "No one requires protection at this time";
    }

    // Clean up reasoning text
    reasoning =
      reasoning
        .replace(/^(?:I (?:will|would|want to) |Let me )/i, "")
        .replace(/^(?:kill|eliminate|target|protect|heal|save)/i, "")
        .trim() ||
      (action === "kill"
        ? "Strategic decision based on game analysis"
        : "Protective strategy based on current threats");

    return { action, targetId, reasoning };
  }

  /**
   * Select target based on personality traits when AI response is unclear
   */
  private selectTargetByPersonality(
    targets: PlayerId[],
    personality: AIPersonality
  ): PlayerId {
    if (targets.length === 0) {
      throw new Error("No available targets");
    }

    // Use personality traits to influence selection
    if (personality.strategicApproach.riskTolerance === "aggressive") {
      // Aggressive players might target early in list
      return targets[0];
    } else if (personality.strategicApproach.riskTolerance === "conservative") {
      // Conservative players might target later in list
      return targets[targets.length - 1];
    } else {
      // Moderate players pick middle
      return targets[Math.floor(targets.length / 2)];
    }
  }

  /**
   * Generate reasoning based on personality when AI doesn't provide clear reasoning
   */
  private generatePersonalityBasedReasoning(
    personality: AIPersonality
  ): string {
    const reasoningByArchetype = {
      analytical_detective: [
        "Based on behavioral patterns I've observed",
        "The voting history suggests suspicious activity",
        "Logical analysis points to this choice",
      ],
      creative_storyteller: [
        "I have a strong feeling about this person",
        "Something about their story doesn't add up",
        "My intuition is telling me this is right",
      ],
      direct_analyst: [
        "This is the most logical choice",
        "Direct evidence points here",
        "No point overthinking - this is it",
      ],
    };

    const options =
      reasoningByArchetype[personality.archetype] ||
      reasoningByArchetype.analytical_detective;
    return options[Math.floor(Math.random() * options.length)];
  }

  /**
   * Get message length based on personality communication style
   */
  private getMessageLengthForPersonality(personality: AIPersonality): number {
    switch (personality.communicationStyle.averageMessageLength) {
      case "short":
        return 80;
      case "long":
        return 250;
      default:
        return 150;
    }
  }

  /**
   * Generate cache key for response caching
   */
  private generateCacheKey(request: AIActionRequest): string {
    return `${request.personality.name}_${request.type}_${request.context.phase}_${request.context.round}`;
  }

  /**
   * Check if cached response is still valid
   */
  private isCacheValid(response: AIResponse): boolean {
    const age = Date.now() - response.metadata.timestamp.getTime();
    return age < 300000; // 5 minutes cache
  }

  /**
   * Generate new response using the real AI system
   */
  private async generateNewResponse(
    request: AIActionRequest
  ): Promise<AIResponse> {
    try {
      // Use the real AI manager to generate responses
      const response = await this.aiManager.generateResponse(request);

      // Log for debugging
      console.log(
        `🤖 ${request.personality.name} (${request.personality.model}) - ${request.type}:`,
        {
          prompt_type: request.type,
          response_length: response.content.length,
          confidence: response.confidence,
          cost: response.metadata.cost,
          tokens: response.metadata.tokensUsed,
        }
      );

      return response;
    } catch (error) {
      console.error(
        `Failed to generate AI response for ${request.personality.name}:`,
        error
      );

      // Return a personality-appropriate fallback
      return {
        content: this.generateEmergencyFallback(request),
        confidence: 0.2,
        metadata: {
          model: request.personality.model,
          tokensUsed: 0,
          responseTime: 1000,
          cost: 0,
          timestamp: new Date(),
        },
      };
    }
  }

  /**
   * Emergency fallback when AI completely fails
   */
  private generateEmergencyFallback(request: AIActionRequest): string {
    const personality = request.personality;

    switch (request.type) {
      case "discussion":
        return personality.archetype === "analytical_detective"
          ? "I'm analyzing the situation carefully."
          : personality.archetype === "creative_storyteller"
          ? "I have some thoughts about what's happening here."
          : "Let me think about this.";

      case "vote":
        return "I need to make a decision based on what I've observed.";

      case "night_action":
        return personality.archetype === "analytical_detective"
          ? "Making a calculated strategic decision."
          : personality.archetype === "creative_storyteller"
          ? "Following my instincts on this choice."
          : "Choosing based on current game state.";

      default:
        return "I'm considering my options.";
    }
  }

  /**
   * Public API for getting usage statistics
   */
  getUsageStats() {
    return this.aiManager.getUsageStats();
  }

  /**
   * Clean up old cache entries
   */
  cleanupCache(): void {
    const now = Date.now();
    for (const [key, response] of this.responseCache.entries()) {
      if (!this.isCacheValid(response)) {
        this.responseCache.delete(key);
      }
    }
    console.log(
      `🧹 Cleaned up response cache, ${this.responseCache.size} entries remaining`
    );
  }
}

// Export singleton instance
export const aiResponseGenerator = new AIResponseGenerator();
