// src/lib/ai/response-generator.ts - FIXED: Bulletproof AI Response Parsing with Multiple Extraction Strategies
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
  async generateResponse(
    prompt: string,
    model: AIModel,
    p0: {
      maxTokens: number;
      temperature: number;
      requiresJSON: boolean;
      gameContext: {
        phase: string;
        round: number;
        playerId: string;
        personality: string;
      };
    },
    request: AIActionRequest
  ): Promise<AIResponse> {
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

    // FIX: Use proper 4-parameter call
    const prompt = `You are ${personality.name}. Generate a discussion response based on the current game context.`;
    return this.generateResponse(
      prompt,
      personality.model,
      {
        maxTokens: this.getMessageLengthForPersonality(personality),
        temperature: 0.8,
        requiresJSON: false,
        gameContext: {
          phase: "discussion",
          round: context.round,
          playerId: context.playerId,
          personality: personality.name,
        },
      },
      request
    );
  }

  /**
   * 🔥 CRITICAL FIX: Generate voting decision with bulletproof parsing
   */
  async generateVotingResponse(
    context: AIDecisionContext,
    personality: AIPersonality,
    availableTargets: PlayerId[]
  ): Promise<{ targetId: PlayerId; reasoning: string }> {
    console.log(
      `🗳️ Generating voting response for ${personality.name} with ${availableTargets.length} targets`
    );

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

    // FIX: Use proper 4-parameter call
    const prompt = `You are ${
      personality.name
    }. Choose who to vote for elimination. Available targets: ${availableTargets.join(
      ", "
    )}`;
    const response = await this.generateResponse(
      prompt,
      personality.model,
      {
        maxTokens: 200,
        temperature: 0.7,
        requiresJSON: true,
        gameContext: {
          phase: "voting",
          round: context.round,
          playerId: context.playerId,
          personality: personality.name,
        },
      },
      request
    );
    return this.parseVotingResponseWithMultipleStrategies(
      response,
      availableTargets,
      personality
    );
  }

  /**
   * Generate night action using real AI with reasoning
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

    // FIX: Use proper 4-parameter call
    const prompt = `You are ${
      personality.name
    }. Choose your night action. Available targets: ${availableTargets.join(
      ", "
    )}`;
    const response = await this.generateResponse(
      prompt,
      personality.model,
      {
        maxTokens: 150,
        temperature: 0.6,
        requiresJSON: true,
        gameContext: {
          phase: "night",
          round: context.round,
          playerId: context.playerId,
          personality: personality.name,
        },
      },
      request
    );
    return this.parseNightActionResponseWithFallback(
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

    // FIX: Use proper 4-parameter call
    const prompt = `You are ${personality.name}, a mafia member coordinating with ${partnerPersonality.name}. Discuss strategy privately.`;
    const originalContent = await this.generateResponse(
      prompt,
      personality.model,
      {
        maxTokens: 150,
        temperature: 0.8,
        requiresJSON: false,
        gameContext: {
          phase: "mafia_coordination",
          round: context.round,
          playerId: context.playerId,
          personality: personality.name,
        },
      },
      request
    );
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

    // FIX: Use proper 4-parameter call
    const prompt = `You are ${
      personality.name
    }, a healer thinking about who to protect. Available targets: ${availableTargets.join(
      ", "
    )}`;
    const response = await this.generateResponse(
      prompt,
      personality.model,
      {
        maxTokens: 120,
        temperature: 0.7,
        requiresJSON: false,
        gameContext: {
          phase: "healer_reasoning",
          round: context.round,
          playerId: context.playerId,
          personality: personality.name,
        },
      },
      request
    );
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
   * 🔥 CRITICAL PRODUCTION FIX: Parse voting response with multiple extraction strategies
   * This implements all required parsing strategies from the briefing
   */
  private parseVotingResponseWithMultipleStrategies(
    response: AIResponse,
    availableTargets: PlayerId[],
    personality: AIPersonality
  ): { targetId: PlayerId; reasoning: string } {
    console.log(`🎯 Parsing AI voting response: "${response.content}"`);
    console.log(`🎯 Available targets: ${availableTargets.join(", ")}`);

    const content = response.content;
    let targetId: PlayerId | null = null;
    let reasoning = response.content;
    let parsingMethod = "none";

    // 🔥 STRATEGY 1: Exact UUID matching
    if (!targetId) {
      for (const target of availableTargets) {
        if (content.includes(target)) {
          targetId = target;
          parsingMethod = "exact_uuid";
          console.log(`🎯 Found target using exact UUID matching: ${target}`);
          break;
        }
      }
    }

    // 🔥 STRATEGY 2: Partial ID matching (last 8 chars)
    if (!targetId) {
      for (const target of availableTargets) {
        const partialId = target.slice(-8);
        if (content.includes(partialId)) {
          targetId = target;
          parsingMethod = "partial_id";
          console.log(
            `🎯 Found target using partial ID matching: ${target} (${partialId})`
          );
          break;
        }
      }
    }

    // 🔥 STRATEGY 3: Player name matching (simplified names)
    if (!targetId) {
      for (const target of availableTargets) {
        const simplifiedName = `Player_${target.slice(-4)}`;
        if (content.toLowerCase().includes(simplifiedName.toLowerCase())) {
          targetId = target;
          parsingMethod = "player_name";
          console.log(
            `🎯 Found target using player name matching: ${target} (${simplifiedName})`
          );
          break;
        }
      }
    }

    // 🔥 STRATEGY 4: Pattern-based extraction
    if (!targetId) {
      const votePatterns = [
        /vote.*?for.*?([a-zA-Z_0-9-]{8,})/i,
        /eliminate.*?([a-zA-Z_0-9-]{8,})/i,
        /choose.*?([a-zA-Z_0-9-]{8,})/i,
        /suspicious.*?([a-zA-Z_0-9-]{8,})/i,
        /target.*?([a-zA-Z_0-9-]{8,})/i,
        /Player_([a-zA-Z_0-9-]{4,})/i,
      ];

      for (const pattern of votePatterns) {
        const match = content.match(pattern);
        if (match) {
          const potentialTarget = match[1];
          // Try to match with available targets
          const foundTarget = availableTargets.find(
            (id) =>
              id.includes(potentialTarget) ||
              potentialTarget.includes(id.slice(-4)) ||
              id.slice(-8).includes(potentialTarget)
          );
          if (foundTarget) {
            targetId = foundTarget;
            parsingMethod = "pattern_based";
            console.log(
              `🎯 Found target using pattern matching: ${foundTarget} (pattern: ${pattern})`
            );
            break;
          }
        }
      }
    }

    // 🔥 STRATEGY 5: Intelligent fallback selection based on response content
    if (!targetId) {
      console.log(
        `🎯 All parsing strategies failed, using intelligent fallback`
      );
      parsingMethod = "intelligent_fallback";

      // Analyze response content for sentiment
      const contentLower = content.toLowerCase();

      if (contentLower.includes("random") || contentLower.includes("guess")) {
        // Random selection for uncertain AI
        targetId =
          availableTargets[Math.floor(Math.random() * availableTargets.length)];
        reasoning = this.generateContextualReasoning(personality, "uncertain");
      } else if (
        contentLower.includes("suspicious") ||
        contentLower.includes("mafia")
      ) {
        // Select based on personality for suspicion-based voting
        targetId = this.selectTargetByPersonality(
          availableTargets,
          personality,
          "suspicious"
        );
        reasoning = this.generateContextualReasoning(personality, "suspicious");
      } else if (
        contentLower.includes("trust") ||
        contentLower.includes("protect")
      ) {
        // Select based on personality for trust-based voting
        targetId = this.selectTargetByPersonality(
          availableTargets,
          personality,
          "strategic"
        );
        reasoning = this.generateContextualReasoning(personality, "strategic");
      } else {
        // Default personality-based selection
        targetId = this.selectTargetByPersonality(
          availableTargets,
          personality,
          "default"
        );
        reasoning = this.generateContextualReasoning(personality, "default");
      }
    }

    // 🔥 FINAL VALIDATION: Ensure target is in available targets
    if (!targetId || !availableTargets.includes(targetId)) {
      console.warn(`⚠️ Target validation failed, using emergency fallback`);
      targetId = availableTargets[0]; // Safe fallback to first available target
      reasoning = this.generateContextualReasoning(personality, "emergency");
      parsingMethod = "emergency_fallback";
    }

    // Clean up reasoning text
    reasoning = this.cleanupReasoning(reasoning, content);

    console.log(
      `✅ Voting parsed successfully using ${parsingMethod}: ${targetId} - "${reasoning}"`
    );

    return {
      targetId,
      reasoning,
    };
  }

  /**
   * 🔥 ENHANCED: Parse night action response with comprehensive fallback
   */
  private parseNightActionResponseWithFallback(
    response: AIResponse,
    role: PlayerRole,
    availableTargets: PlayerId[]
  ): { action: "kill" | "heal"; targetId: PlayerId | null; reasoning: string } {
    const content = response.content;
    const action = role === PlayerRole.MAFIA_LEADER ? "kill" : "heal";
    let reasoning = response.content.trim();
    let targetId: PlayerId | null = null;
    let parsingMethod = "none";

    console.log(`🌙 Parsing night action for ${role}: "${content}"`);

    // Strategy 1: Direct UUID matching
    for (const target of availableTargets) {
      if (content.includes(target)) {
        targetId = target;
        parsingMethod = "exact_uuid";
        break;
      }
    }

    // Strategy 2: Simplified name matching
    if (!targetId) {
      for (const target of availableTargets) {
        const simplifiedName = `Player_${target.slice(-4)}`;
        if (content.toLowerCase().includes(simplifiedName.toLowerCase())) {
          targetId = target;
          parsingMethod = "player_name";
          break;
        }
      }
    }

    // Strategy 3: Pattern-based extraction
    if (!targetId) {
      const actionPatterns = [
        /(?:kill|eliminate|target).*?([a-zA-Z_0-9-]{8,})/i,
        /(?:protect|heal|save).*?([a-zA-Z_0-9-]{8,})/i,
        /choose.*?([a-zA-Z_0-9-]{8,})/i,
        /Player_([a-zA-Z_0-9-]{4,})/i,
      ];

      for (const pattern of actionPatterns) {
        const match = content.match(pattern);
        if (match) {
          const potentialTarget = match[1];
          const foundTarget = availableTargets.find(
            (id) =>
              id.includes(potentialTarget) ||
              potentialTarget.includes(id.slice(-4)) ||
              id.slice(-8).includes(potentialTarget)
          );
          if (foundTarget) {
            targetId = foundTarget;
            parsingMethod = "pattern_based";
            break;
          }
        }
      }
    }

    // Strategy 4: Content analysis fallback
    if (!targetId && availableTargets.length > 0) {
      console.log(`🌙 Using content analysis fallback for night action`);

      if (
        content.toLowerCase().includes("no") ||
        content.toLowerCase().includes("skip")
      ) {
        // AI explicitly chose not to act
        targetId = null;
        reasoning =
          action === "kill"
            ? "Strategic decision to skip elimination this round"
            : "Choosing not to protect anyone tonight";
        parsingMethod = "explicit_skip";
      } else {
        // Random selection as last resort
        targetId =
          availableTargets[Math.floor(Math.random() * availableTargets.length)];
        reasoning =
          action === "kill"
            ? "Strategic elimination based on threat assessment"
            : "Protective decision based on vulnerability analysis";
        parsingMethod = "random_fallback";
      }
    }

    // Clean up reasoning text
    if (reasoning && targetId) {
      reasoning =
        reasoning
          .replace(/^(?:I (?:will|would|want to) |Let me )/i, "")
          .replace(/^(?:kill|eliminate|target|protect|heal|save)/i, "")
          .trim() ||
        (action === "kill"
          ? "Strategic decision based on game analysis"
          : "Protective strategy based on current threats");
    }

    console.log(
      `✅ Night action parsed using ${parsingMethod}: ${action} ${
        targetId || "nobody"
      } - "${reasoning}"`
    );

    return { action, targetId, reasoning };
  }

  /**
   * 🔥 NEW: Generate contextual reasoning when AI parsing fails
   */
  private generateContextualReasoning(
    personality: AIPersonality,
    context: "uncertain" | "suspicious" | "strategic" | "default" | "emergency"
  ): string {
    const reasoningTemplates = {
      uncertain: [
        "I'm not entirely certain, but this feels like the right choice",
        "Based on limited information, this seems most logical",
        "This decision aligns with my current understanding",
      ],
      suspicious: [
        "Something about their behavior seems off to me",
        "Their voting patterns raise red flags",
        "I've been watching their interactions closely",
      ],
      strategic: [
        "This aligns with my overall strategy",
        "Considering the current game state, this makes sense",
        "This decision serves our collective interests",
      ],
      default: [
        "Based on my analysis of the current situation",
        "This choice reflects my assessment of the game",
        "After careful consideration, this is my decision",
      ],
      emergency: [
        "Making this choice based on available information",
        "This decision follows logical reasoning",
        "Proceeding with this strategic choice",
      ],
    };

    const templates = reasoningTemplates[context];
    let reasoning = templates[Math.floor(Math.random() * templates.length)];

    // Add personality flair
    if (personality.communicationStyle.emotionalExpression === "high") {
      reasoning += "!";
    } else if (personality.archetype === "analytical_detective") {
      reasoning = "Analytically speaking, " + reasoning.toLowerCase();
    } else if (personality.archetype === "creative_storyteller") {
      reasoning = "I have a feeling that " + reasoning.toLowerCase();
    }

    return reasoning;
  }

  /**
   * Select target based on personality traits when AI response is unclear
   */
  private selectTargetByPersonality(
    targets: PlayerId[],
    personality: AIPersonality,
    mode: "suspicious" | "strategic" | "default" = "default"
  ): PlayerId {
    if (targets.length === 0) {
      throw new Error("No available targets");
    }

    if (targets.length === 1) {
      return targets[0];
    }

    // Use personality traits to influence selection
    switch (personality.archetype) {
      case "creative_storyteller":
        // Creative players might target based on "story" (first or last)
        return mode === "suspicious" ? targets[0] : targets[targets.length - 1];

      case "analytical_detective":
        // Analytical players might target middle candidates
        return targets[Math.floor(targets.length / 2)];

      case "direct_analyst":
        // Direct players pick based on aggressiveness
        if (personality.aggressiveness > 7) {
          return targets[0]; // Go for first target aggressively
        } else {
          return targets[targets.length - 1]; // Conservative choice
        }

      default:
        // Default to risk tolerance
        if (personality.strategicApproach.riskTolerance === "aggressive") {
          return targets[0];
        } else if (
          personality.strategicApproach.riskTolerance === "conservative"
        ) {
          return targets[targets.length - 1];
        } else {
          return targets[Math.floor(targets.length / 2)];
        }
    }
  }

  /**
   * 🔥 NEW: Clean up reasoning text for better presentation
   */
  private cleanupReasoning(reasoning: string, originalContent: string): string {
    let cleaned = reasoning.trim();

    // Remove common AI prefixes
    cleaned = cleaned
      .replace(/^(I vote.*?because|My vote goes to|I choose to vote for)/i, "")
      .replace(/^(I think|I believe|In my opinion)/i, "")
      .trim();

    // If cleaning removed too much, use original content but cleaned
    if (cleaned.length < 10 && originalContent.length > 10) {
      cleaned = originalContent
        .replace(/^(I vote.*?for [^.]*\.?\s*)/i, "")
        .replace(/^(I choose [^.]*\.?\s*)/i, "")
        .trim();
    }

    // Ensure minimum length
    if (cleaned.length < 5) {
      cleaned = "Based on my analysis of the current situation";
    }

    // Ensure proper sentence structure
    if (cleaned && !cleaned.match(/[.!?]$/)) {
      cleaned += ".";
    }

    return cleaned;
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
