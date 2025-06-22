// AI Model Integration for AI Mafia
import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenerativeAI } from "@google/generative-ai";
import {
  AIResponse,
  AIDecisionContext,
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

IMPORTANT RULES:
1. Stay in character at all times
2. Never reveal you are an AI
3. Keep responses natural and human-like
4. ${
      request.constraints.maxLength
        ? `Keep responses under ${request.constraints.maxLength} characters`
        : "Keep responses concise but meaningful"
    }
5. Show appropriate emotions and reactions
6. Make decisions that align with your personality and role objectives`;

    if (role === PlayerRole.MAFIA_LEADER || role === PlayerRole.MAFIA_MEMBER) {
      basePrompt += `\n\nMAFIA OBJECTIVES:
- Eliminate citizens without being detected
- Coordinate with your mafia partner
- Deflect suspicion onto innocent players
- Maintain your cover identity`;
    }

    return basePrompt;
  }

  private buildUserPrompt(request: AIActionRequest): string {
    const context = request.context;

    let prompt = `GAME SITUATION:
Round: ${context.round}
Living Players: ${context.livingPlayers.length}
Eliminated Players: ${context.eliminatedPlayers.length}
Time Remaining: ${Math.floor(context.timeRemaining / 1000)} seconds

RECENT GAME HISTORY:
${context.gameHistory.slice(-5).join("\n")}`;

    if (context.previousVotes.length > 0) {
      prompt += `\n\nPREVIOUS VOTING PATTERNS:
${context.previousVotes
  .map((v) => `Round ${v.round}: ${v.votes.length} votes cast`)
  .join("\n")}`;
    }

    switch (request.type) {
      case "discussion":
        prompt += `\n\nIt's your turn to speak in the discussion phase. What do you want to say to the group? Consider:
- What you've observed about other players
- Who you find suspicious and why
- Your theory about who the mafia might be
- How to deflect suspicion from yourself (if you're mafia)
- Building alliances or casting doubt`;
        break;

      case "vote":
        prompt += `\n\nIt's time to vote for who you think should be eliminated. Consider:
- All the evidence discussed this round
- Voting patterns from previous rounds
- Your suspicions and reasoning
- Strategic implications of your vote
        
Who do you vote to eliminate and why? Format: "I vote to eliminate [PLAYER_NAME] because [REASONING]"`;
        break;

      case "night_action":
        if (context.role === PlayerRole.MAFIA_LEADER) {
          prompt += `\n\nAs the Mafia Leader, choose who to eliminate tonight. Consider:
- Who poses the biggest threat to the mafia
- Who might be the Healer
- Strategic timing and misdirection
- Available targets: ${
            request.constraints.availableTargets?.join(", ") ||
            "All living players"
          }
          
Who do you want to eliminate? Format: "I want to eliminate [PLAYER_NAME] tonight"`;
        } else if (context.role === PlayerRole.HEALER) {
          prompt += `\n\nAs the Healer, choose who to protect tonight. Consider:
- Who is most likely to be targeted by mafia
- Strategic value of different players
- Whether to protect yourself or others
- Available targets: ${
            request.constraints.availableTargets?.join(", ") ||
            "All living players"
          }
          
Who do you want to protect? Format: "I want to protect [PLAYER_NAME] tonight"`;
        }
        break;
    }

    return prompt;
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

    return sanitized.trim();
  }

  private calculateConfidence(request: AIActionRequest): number {
    // Calculate confidence based on context and personality
    let confidence = 0.7; // Base confidence

    // Adjust based on information available
    if (request.context.gameHistory.length > 10) confidence += 0.1;
    if (request.context.round > 3) confidence += 0.1;

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
      fallbackMessages[request.type] || fallbackMessages.discussion;
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
}
