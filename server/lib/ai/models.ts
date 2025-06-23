// AI Model Integration for AI Mafia - Enhanced with Elimination Awareness
import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenerativeAI } from "@google/generative-ai";
import {
  AIResponse,
  AIActionRequest,
  AIPersonality,
  MODEL_CONFIGS,
  AI_PERSONALITIES,
  AIModel,
} from "../types/ai";
import { PlayerRole, GamePhase } from "../types/game";

export class AIModelManager {
  private openai: OpenAI;
  private anthropic: Anthropic;
  private googleAI: GoogleGenerativeAI;
  private usageStats: Map<AIModel, any> = new Map();

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY!,
    });

    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY!,
    });

    this.googleAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY!);
  }

  // 🛡️ UNICODE SANITIZATION - Fixes JSON encoding errors!
  private sanitizeForAPI(text: string): string {
    if (!text) return "";

    return (
      text
        // Remove control characters (0x00-0x1F and 0x7F-0x9F)
        .replace(/[\u0000-\u001F\u007F-\u009F]/g, "")
        // Remove unpaired surrogate characters (THE MAIN FIX!)
        .replace(/[\uD800-\uDFFF]/g, "")
        // Remove other problematic Unicode characters
        .replace(/[\uFEFF\uFFFE\uFFFF]/g, "")
        // Normalize whitespace
        .replace(/\s+/g, " ")
        .trim()
    );
  }

  async generateResponse(request: AIActionRequest): Promise<AIResponse> {
    const config = MODEL_CONFIGS[request.personality.model];
    const startTime = Date.now();

    try {
      let content: string;
      let tokensUsed = 0;

      switch (config.provider) {
        case "openai":
          const openaiResult = await this.generateOpenAIResponse(request);
          content = openaiResult.content;
          tokensUsed = openaiResult.tokensUsed;
          break;
        case "anthropic":
          const anthropicResult = await this.generateAnthropicResponse(request);
          content = anthropicResult.content;
          tokensUsed = anthropicResult.tokensUsed;
          break;
        case "google":
          const googleResult = await this.generateGoogleResponse(request);
          content = googleResult.content;
          tokensUsed = googleResult.tokensUsed;
          break;
        default:
          throw new Error(`Unsupported provider: ${config.provider}`);
      }

      const responseTime = Date.now() - startTime;
      const cost = this.calculateCost(tokensUsed, tokensUsed * 0.3, config); // Rough estimate

      this.updateUsageStats(
        request.personality.model,
        tokensUsed,
        cost,
        responseTime
      );

      return {
        content: this.sanitizeResponse(content, request),
        confidence: this.calculateConfidence(request),
        metadata: {
          model: request.personality.model,
          tokensUsed,
          responseTime,
          cost,
          timestamp: new Date(),
        },
      };
    } catch (error) {
      console.error(
        `AI response generation failed for ${request.personality.model}:`,
        error
      );
      return this.generateFallbackResponse(request);
    }
  }

  private async generateOpenAIResponse(
    request: AIActionRequest
  ): Promise<{ content: string; tokensUsed: number }> {
    const config = MODEL_CONFIGS[request.personality.model];
    const messages = this.buildMessages(request);

    const completion = await this.openai.chat.completions.create({
      model: config.modelName,
      messages,
      max_tokens: Math.min(
        config.maxTokensPerRequest,
        request.constraints.maxLength || 200
      ),
      temperature: this.getTemperatureForPersonality(request.personality),
      presence_penalty: 0.3,
      frequency_penalty: 0.3,
    });

    return {
      content: completion.choices[0].message.content || "",
      tokensUsed: completion.usage?.total_tokens || 0,
    };
  }

  private async generateAnthropicResponse(
    request: AIActionRequest
  ): Promise<{ content: string; tokensUsed: number }> {
    const config = MODEL_CONFIGS[request.personality.model];
    const systemPrompt = this.buildSystemPrompt(request);
    const userPrompt = this.buildUserPrompt(request);

    const response = await this.anthropic.messages.create({
      model: config.modelName,
      max_tokens: Math.min(
        config.maxTokensPerRequest,
        request.constraints.maxLength || 200
      ),
      temperature: this.getTemperatureForPersonality(request.personality),
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    });

    const content =
      response.content[0].type === "text" ? response.content[0].text : "";

    return {
      content,
      tokensUsed: response.usage.input_tokens + response.usage.output_tokens,
    };
  }

  private async generateGoogleResponse(
    request: AIActionRequest
  ): Promise<{ content: string; tokensUsed: number }> {
    const config = MODEL_CONFIGS[request.personality.model];
    const model = this.googleAI.getGenerativeModel({ model: config.modelName });

    const prompt = this.buildGooglePrompt(request);

    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        maxOutputTokens: Math.min(
          config.maxTokensPerRequest,
          request.constraints.maxLength || 200
        ),
        temperature: this.getTemperatureForPersonality(request.personality),
      },
    });

    const response = await result.response;
    const content = response.text();

    return {
      content,
      tokensUsed: response.usageMetadata?.totalTokenCount || 0,
    };
  }

  private buildMessages(
    request: AIActionRequest
  ): Array<{ role: "system" | "user" | "assistant"; content: string }> {
    const systemPrompt = this.buildSystemPrompt(request);
    const userPrompt = this.buildUserPrompt(request);

    return [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ];
  }

  // 🆕 ENHANCED: System prompt with elimination awareness
  private buildSystemPrompt(request: AIActionRequest): string {
    const personality = request.personality;
    const role = request.context.role;
    const phase = request.context.phase;

    let basePrompt = `You are ${
      personality.name
    }, an AI player in a Mafia game. You have the personality of a ${
      personality.archetype
    }.

PERSONALITY TRAITS:
- Communication Style: ${this.describeCommunicationStyle(personality)}
- Strategic Approach: ${this.describeStrategicApproach(personality)}
- Suspicion Level: ${personality.suspicionLevel}/10
- Trust Level: ${personality.trustLevel}/10
- Aggressiveness: ${personality.aggressiveness}/10

YOUR ROLE: ${role}
${this.getRoleDescription(role)}

CURRENT PHASE: ${phase}
${this.getPhaseDescription(phase)}

🛡️ CRITICAL GAME RULES:
1. Only LIVING players can speak, vote, and take actions
2. Eliminated players are permanently out of the game
3. When players are eliminated, their roles are revealed to everyone
4. Use role reveal information strategically in your decisions
5. React naturally to surprising role reveals
6. Stay in character at all times - never reveal you are an AI
7. Keep responses natural and human-like
8. ${
      request.constraints.maxLength
        ? `Keep responses under ${request.constraints.maxLength} characters`
        : "Keep responses concise but meaningful"
    }
9. Show appropriate emotions and reactions
10. Make decisions that align with your personality and role objectives`;

    // 🆕 Add current player status awareness
    if (request.context.playerStatus) {
      basePrompt += `\n\nCURRENT PLAYER STATUS:
LIVING: ${request.context.playerStatus.living.map((p) => p.name).join(", ")}`;

      if (request.context.playerStatus.eliminated.length > 0) {
        basePrompt += `\nELIMINATED: ${request.context.playerStatus.eliminated
          .map((p) => `${p.name} (${p.role})`)
          .join(", ")}`;
      }
    }

    // 🆕 Add recent elimination awareness
    if (request.context.latestElimination) {
      const elim = request.context.latestElimination;
      basePrompt += `\n\n💀 BREAKING NEWS - RECENT ELIMINATION:
${elim.playerName} was just eliminated and revealed as ${elim.role}!`;

      if (elim.cause === "voted_out") {
        basePrompt += `\nThey were voted out with ${elim.voteCount} votes.`;
      } else if (elim.cause === "mafia_kill") {
        basePrompt += `\nThey were killed by the mafia during the night.`;
      }

      basePrompt += `\nReact to this information appropriately and consider what it means for the game.`;
    }

    if (role === PlayerRole.MAFIA_LEADER || role === PlayerRole.MAFIA_MEMBER) {
      basePrompt += `\n\nMAFIA OBJECTIVES:
- Eliminate citizens without being detected
- Coordinate with your mafia partner (if still alive)
- Deflect suspicion onto innocent players
- Maintain your cover identity
- Use elimination information strategically`;

      // Warn if mafia partner is dead
      if (
        request.context.playerStatus?.eliminated.some(
          (p) =>
            p.role === PlayerRole.MAFIA_LEADER ||
            p.role === PlayerRole.MAFIA_MEMBER
        )
      ) {
        basePrompt += `\n⚠️ WARNING: Your mafia partner has been eliminated! You're on your own now.`;
      }
    }

    // 🛡️ SANITIZE BEFORE SENDING TO API
    return this.sanitizeForAPI(basePrompt);
  }

  // 🆕 ENHANCED: User prompt with detailed elimination context
  private buildUserPrompt(request: AIActionRequest): string {
    const context = request.context;

    let prompt = `GAME SITUATION:
Round: ${context.round}
Living Players: ${context.livingPlayers.length}
Eliminated Players: ${context.eliminatedPlayers.length}
Time Remaining: ${Math.floor(context.timeRemaining / 1000)} seconds

🛡️ CURRENT PLAYER STATUS:`;

    // Show current living and dead players with roles
    if (context.playerStatus) {
      prompt += `\nLIVING: ${context.playerStatus.living
        .map((p) => p.name)
        .join(", ")}`;

      if (context.playerStatus.eliminated.length > 0) {
        prompt += `\nELIMINATED: ${context.playerStatus.eliminated
          .map((p) => `${p.name} (${p.role})`)
          .join(", ")}`;
      }
    }

    // 🆕 Recent elimination details
    if (context.latestElimination) {
      const elim = context.latestElimination;
      prompt += `\n\n💀 LATEST ELIMINATION (Round ${elim.round}):`;

      if (elim.cause === "voted_out") {
        prompt += `\n${elim.playerName} was voted out with ${elim.voteCount} votes.`;
      } else if (elim.cause === "mafia_kill") {
        prompt += `\n${elim.playerName} was eliminated by the mafia during the night.`;
      }

      prompt += `\nRevealed role: ${elim.role}`;

      // Strategic implications
      if (elim.role === PlayerRole.HEALER) {
        prompt += `\n⚠️ CRITICAL: The healer is dead - no more protections possible!`;
      } else if (
        elim.role === PlayerRole.MAFIA_LEADER ||
        elim.role === PlayerRole.MAFIA_MEMBER
      ) {
        prompt += `\n🎯 GOOD NEWS: A mafia member was eliminated!`;
      }
    }

    // 🆕 Full elimination history
    if (context.eliminationHistory && context.eliminationHistory.length > 0) {
      prompt += `\n\nELIMINATION SUMMARY:`;
      context.eliminationHistory.forEach((elim) => {
        const method = elim.cause === "voted_out" ? "Voted Out" : "Mafia Kill";
        prompt += `\nRound ${elim.round}: ${elim.playerName} (${elim.role}) - ${method}`;
      });
    }

    prompt += `\n\nRECENT GAME HISTORY (from living players only):
${
  context.gameHistory.slice(-5).join("\n") ||
  "Game just started - no previous messages"
}`;

    if (context.previousVotes.length > 0) {
      prompt += `\n\nPREVIOUS VOTING PATTERNS:
${context.previousVotes
  .map((v: any) => `Round ${v.round}: ${v.votes.length} votes cast`)
  .join("\n")}`;
    }

    switch (request.type) {
      case "discussion":
        prompt += `\n\nIt's your turn to speak in the discussion phase. What do you want to say to the group? Consider:
- React to any recent eliminations and role reveals
- What you've observed about other living players
- Who you find suspicious and why
- Your theory about who the remaining mafia might be
- How to deflect suspicion from yourself (if you're mafia)
- Building alliances or casting doubt strategically
- The impact of revealed roles on game strategy

Speak naturally as ${request.personality.name}:`;
        break;

      case "vote":
        prompt += `\n\nIt's time to vote for who you think should be eliminated. Consider:
- All the evidence discussed this round
- Role reveals from previous eliminations
- Voting patterns from previous rounds
- Your suspicions and reasoning
- Strategic implications of your vote
        
Who do you vote to eliminate and why? 

Available living players to vote for: ${
          request.constraints.availableTargets?.join(", ") ||
          "All living players except yourself"
        }

Format: "I vote to eliminate [PLAYER_NAME] because [REASONING]"`;
        break;

      case "night_action":
        if (context.role === PlayerRole.MAFIA_LEADER) {
          prompt += `\n\nAs the Mafia Leader, choose who to eliminate tonight. Consider:
- Who poses the biggest threat to the mafia
- Who might be the Healer (if still alive)
- Strategic timing and misdirection
- Role information revealed from previous eliminations`;

          // Check if healer is dead
          const healerDead = context.playerStatus?.eliminated.some(
            (p) => p.role === PlayerRole.HEALER
          );
          if (healerDead) {
            prompt += `\n✅ ADVANTAGE: The healer is dead - no protections possible!`;
          }

          prompt += `\n\nAvailable targets: ${
            request.constraints.availableTargets?.join(", ") ||
            "All living non-mafia players"
          }
          
Who do you want to eliminate? Format: "I want to eliminate [PLAYER_NAME] tonight"`;
        } else if (context.role === PlayerRole.HEALER) {
          prompt += `\n\nAs the Healer, choose who to protect tonight. Consider:
- Who is most likely to be targeted by mafia
- Strategic value of different players
- Whether to protect yourself or others
- Information gained from recent eliminations

Available targets: ${
            request.constraints.availableTargets?.join(", ") ||
            "All living players"
          }
          
Who do you want to protect? Format: "I want to protect [PLAYER_NAME] tonight"`;
        }
        break;
    }

    // 🛡️ SANITIZE BEFORE SENDING TO API
    return this.sanitizeForAPI(prompt);
  }

  private buildGooglePrompt(request: AIActionRequest): string {
    const systemPrompt = this.buildSystemPrompt(request);
    const userPrompt = this.buildUserPrompt(request);
    return `${systemPrompt}\n\n${userPrompt}`;
  }

  private describeCommunicationStyle(personality: AIPersonality): string {
    const style = personality.communicationStyle;
    return `${style.averageMessageLength} messages, ${style.formalityLevel} tone, ${style.emotionalExpression} emotional expression, asks ${style.questionFrequency} questions`;
  }

  private describeStrategicApproach(personality: AIPersonality): string {
    const approach = personality.strategicApproach;
    return `votes ${approach.votesTiming}, ${approach.allianceBuilding} alliance building, ${approach.informationSharing} with information, ${approach.riskTolerance} risk tolerance`;
  }

  private getRoleDescription(role: PlayerRole): string {
    switch (role) {
      case PlayerRole.MAFIA_LEADER:
        return `You are the Mafia Leader. You can eliminate one player each night. Work with your Mafia Member partner to achieve victory by reaching parity with citizens.`;
      case PlayerRole.MAFIA_MEMBER:
        return `You are a Mafia Member. Support your Mafia Leader in making elimination decisions. Help deflect suspicion and coordinate strategy.`;
      case PlayerRole.HEALER:
        return `You are the Healer. Each night, you can protect one player from elimination. Use this power strategically to save key players.`;
      case PlayerRole.CITIZEN:
        return `You are a Citizen. Use discussion and voting to identify and eliminate the mafia members. Pay attention to behavior and voting patterns.`;
      default:
        return "Unknown role";
    }
  }

  private getPhaseDescription(phase: GamePhase): string {
    switch (phase) {
      case GamePhase.DISCUSSION:
        return "Players take turns speaking and sharing their thoughts. Use this time to gather information and build your case.";
      case GamePhase.VOTING:
        return "Each player votes to eliminate someone they suspect is mafia. Choose carefully and explain your reasoning.";
      case GamePhase.NIGHT:
        return "Special roles act in secret. Mafia chooses their target, Healer chooses who to protect.";
      default:
        return "Follow the game flow and stay in character.";
    }
  }

  private getTemperatureForPersonality(personality: AIPersonality): number {
    // More creative personalities get higher temperature
    switch (personality.archetype) {
      case "creative_storyteller":
        return 0.8;
      case "analytical_detective":
        return 0.4;
      case "direct_analyst":
        return 0.6;
      default:
        return 0.7;
    }
  }

  private sanitizeResponse(content: string, request: AIActionRequest): string {
    // Remove any unwanted content and ensure it fits constraints
    let sanitized = content.trim();

    // Remove common AI disclaimers
    sanitized = sanitized.replace(
      /^(As an AI|I'm an AI|As a language model).*?\./i,
      ""
    );
    sanitized = sanitized.replace(/\*[^*]*\*/g, ""); // Remove action descriptions in asterisks

    // Ensure length constraints
    if (
      request.constraints.maxLength &&
      sanitized.length > request.constraints.maxLength
    ) {
      sanitized =
        sanitized.substring(0, request.constraints.maxLength - 3) + "...";
    }

    // Add personality-specific touches
    if (request.personality.communicationStyle.emotionalExpression === "high") {
      // Occasionally add emotion indicators
      if (Math.random() < 0.3) {
        const emotions = ["!", "...", "?!", "!!"];
        sanitized += emotions[Math.floor(Math.random() * emotions.length)];
      }
    }

    // 🛡️ FINAL SANITIZATION
    return this.sanitizeForAPI(sanitized);
  }

  private calculateConfidence(request: AIActionRequest): number {
    // Calculate confidence based on context and personality
    let confidence = 0.7; // Base confidence

    // Adjust based on information available
    if (request.context.gameHistory.length > 10) confidence += 0.1;
    if (request.context.round > 3) confidence += 0.1;

    // Boost confidence if we have elimination data
    if (
      request.context.eliminationHistory &&
      request.context.eliminationHistory.length > 0
    ) {
      confidence += 0.1;
    }

    // Personality adjustments
    if (request.personality.archetype === "analytical_detective")
      confidence += 0.1;
    if (request.personality.trustLevel > 7) confidence -= 0.1;
    if (request.personality.suspicionLevel > 7) confidence += 0.1;

    return Math.min(1.0, Math.max(0.3, confidence));
  }

  private calculateCost(
    inputTokens: number,
    outputTokens: number,
    config: any
  ): number {
    const inputCost = (inputTokens / 1000000) * config.costPerInputToken;
    const outputCost = (outputTokens / 1000000) * config.costPerOutputToken;
    return inputCost + outputCost;
  }

  private updateUsageStats(
    model: AIModel,
    tokens: number,
    cost: number,
    responseTime: number
  ): void {
    const current = this.usageStats.get(model) || {
      totalRequests: 0,
      totalTokens: 0,
      totalCost: 0,
      totalResponseTime: 0,
    };

    current.totalRequests++;
    current.totalTokens += tokens;
    current.totalCost += cost;
    current.totalResponseTime += responseTime;

    this.usageStats.set(model, current);
  }

  private generateFallbackResponse(request: AIActionRequest): AIResponse {
    const fallbackMessages = {
      discussion: [
        "I'm still analyzing the situation. Let me think about this more.",
        "Something doesn't feel right here, but I can't put my finger on it.",
        "I need to hear more from everyone before making any accusations.",
        "The voting patterns from last round are interesting...",
      ],
      vote: [
        "I vote to eliminate [RANDOM_PLAYER] based on their suspicious behavior",
        "After careful consideration, I think [RANDOM_PLAYER] might be mafia",
        "I'm going with my gut feeling on [RANDOM_PLAYER]",
      ],
      night_action: [
        "I'll make my decision based on tonight's discussions",
        "Strategic considerations guide my choice",
      ],
    };

    const messages =
      fallbackMessages[request.type as keyof typeof fallbackMessages] ||
      fallbackMessages.discussion;
    const content = messages[Math.floor(Math.random() * messages.length)];

    return {
      content,
      confidence: 0.3,
      metadata: {
        model: request.personality.model,
        tokensUsed: 0,
        responseTime: 1000,
        cost: 0,
        timestamp: new Date(),
      },
    };
  }

  getUsageStats(): Map<AIModel, any> {
    return new Map(this.usageStats);
  }

  getPersonality(model: AIModel): AIPersonality {
    return AI_PERSONALITIES[model];
  }

  getCostEstimate(model: AIModel, estimatedTokens: number): number {
    const config = MODEL_CONFIGS[model];
    return this.calculateCost(
      estimatedTokens * 0.7,
      estimatedTokens * 0.3,
      config
    );
  }

  // 🔧 FIXED: Properly implement getPersonalityPoolInfo method
  getPersonalityPoolInfo() {
    // Return hardcoded personality pool stats since we can't easily import from src/
    const freeModels = [
      AIModel.CLAUDE_HAIKU,
      AIModel.GPT_4O_MINI,
      AIModel.GEMINI_2_5_FLASH,
    ];
    const premiumModels = [
      AIModel.CLAUDE_SONNET_4,
      AIModel.GPT_4O,
      AIModel.GEMINI_2_5_PRO,
    ];

    return {
      totalPersonalities: 30, // Free: 18 + Premium: 12
      personalities: [
        {
          name: "Alex",
          model: "claude-haiku",
          archetype: "analytical_detective",
          description: "Methodical thinker",
        },
        {
          name: "Sam",
          model: "claude-haiku",
          archetype: "analytical_detective",
          description: "Quiet observer",
        },
        {
          name: "Taylor",
          model: "gpt-4o-mini",
          archetype: "creative_storyteller",
          description: "Creative thinker",
        },
        {
          name: "Casey",
          model: "gemini-2.5-flash",
          archetype: "direct_analyst",
          description: "Direct analyst",
        },
        {
          name: "Blake",
          model: "claude-sonnet-4",
          archetype: "analytical_detective",
          description: "Master detective",
        },
        {
          name: "Riley",
          model: "gpt-4o",
          archetype: "creative_storyteller",
          description: "Master storyteller",
        },
        {
          name: "Avery",
          model: "gemini-2.5-pro",
          archetype: "direct_analyst",
          description: "Strategic genius",
        },
      ],
      modelDistribution: [
        { model: "claude-haiku", count: 6 },
        { model: "gpt-4o-mini", count: 6 },
        { model: "gemini-2.5-flash", count: 6 },
        { model: "claude-sonnet-4", count: 5 },
        { model: "gpt-4o", count: 5 },
        { model: "gemini-2.5-pro", count: 5 },
      ],
      tiers: {
        free: {
          models: freeModels.length,
          personalities: 18,
        },
        premium: {
          models: premiumModels.length,
          personalities: 12,
        },
      },
    };
  }
}
