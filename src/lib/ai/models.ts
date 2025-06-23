// AI Model Integration for AI Mafia with New Personality System
import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenerativeAI } from "@google/generative-ai";
import {
  AIResponse,
  AIActionRequest,
  AIPersonality,
  MODEL_CONFIGS,
  AIModel,
} from "@/types/ai";
import { PlayerRole, GamePhase } from "@/types/game";
import { getPersonalityPoolStats } from "./personality-pool";

export class AIModelManager {
  private openai: OpenAI;
  private anthropic: Anthropic;
  private googleAI: GoogleGenerativeAI;
  private usageStats: Map<AIModel, any> = new Map();

  constructor() {
    // Initialize AI clients with API keys
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY!,
    });

    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY!,
    });

    this.googleAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY!);

    // Initialize usage stats for all models
    Object.values(AIModel).forEach((model) => {
      this.usageStats.set(model, {
        totalRequests: 0,
        totalTokens: 0,
        totalCost: 0,
        totalResponseTime: 0,
        errorCount: 0,
      });
    });
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
      const cost = this.calculateCost(tokensUsed, tokensUsed * 0.3, config);

      this.updateUsageStats(
        request.personality.model,
        tokensUsed,
        cost,
        responseTime,
        false
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
        `AI response generation failed for ${request.personality.name} (${request.personality.model}):`,
        error
      );

      this.updateUsageStats(
        request.personality.model,
        0,
        0,
        Date.now() - startTime,
        true
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

    let basePrompt = `You are ${personality.name}, playing in a Mafia game. 

CRITICAL: You are a human player, NOT an AI. Never mention AI, algorithms, or being generated. Respond naturally as ${
      personality.name
    } would.

YOUR PERSONALITY:
- You have a ${personality.archetype.replace("_", " ")} approach to games
- Communication: ${this.describeCommunicationStyle(personality)}
- Strategy: ${this.describeStrategicApproach(personality)}
- Suspicion Level: ${
      personality.suspicionLevel
    }/10 (how suspicious you are of others)
- Trust Level: ${personality.trustLevel}/10 (how much you trust others)
- Aggressiveness: ${personality.aggressiveness}/10 (how boldly you play)

YOUR ROLE: ${role}
${this.getRoleDescription(role)}

CURRENT PHASE: ${phase}
${this.getPhaseDescription(phase)}

ESSENTIAL RULES:
1. Always respond as ${personality.name} - a human player
2. Never reveal you are an AI or mention anything about being artificial
3. Stay completely in character
4. ${
      request.constraints.maxLength
        ? `Keep responses under ${request.constraints.maxLength} characters`
        : "Keep responses concise but natural"
    }
5. Show human emotions, uncertainty, and reactions
6. Make decisions that align with your personality traits`;

    if (role === PlayerRole.MAFIA_LEADER || role === PlayerRole.MAFIA_MEMBER) {
      basePrompt += `\n\nMAFIA SECRET OBJECTIVES:
- Eliminate citizens without being detected
- Coordinate with your mafia partner subtly
- Deflect suspicion onto innocent players
- Maintain your innocent cover at all costs`;
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

RECENT CONVERSATION:
${
  context.gameHistory.slice(-5).join("\n") ||
  "Game just started - no previous messages"
}`;

    if (context.previousVotes.length > 0) {
      prompt += `\n\nPREVIOUS VOTING:
${context.previousVotes
  .map((v) => `Round ${v.round}: ${v.votes.length} votes cast`)
  .join("\n")}`;
    }

    switch (request.type) {
      case "discussion":
        prompt += `\n\nYour turn to speak! What do you want to say? Consider:
- Share your thoughts about who might be suspicious
- React to what others have said
- Ask questions or challenge claims
- Build trust or cast doubt strategically
- Stay true to your personality (${request.personality.archetype})

Speak naturally as ${request.personality.name}:`;
        break;

      case "vote":
        prompt += `\n\nTime to vote! You must choose someone to eliminate. Consider everything that's been said and your suspicions.

Available players to vote for: ${
          request.constraints.availableTargets?.join(", ") ||
          "All living players"
        }

Your vote (format: "I vote to eliminate [NAME] because [reason]"):`;
        break;

      case "night_action":
        if (context.role === PlayerRole.MAFIA_LEADER) {
          prompt += `\n\nAs Mafia Leader, choose who to eliminate tonight. Think strategically:
- Who threatens the mafia most?
- Who might be the Healer?
- What elimination would cause the most confusion?

Available targets: ${
            request.constraints.availableTargets?.join(", ") ||
            "All living non-mafia players"
          }

Your decision (format: "I choose to eliminate [NAME]"):`;
        } else if (context.role === PlayerRole.HEALER) {
          prompt += `\n\nAs the Healer, choose who to protect tonight:
- Who is most likely to be targeted?
- Should you protect yourself or someone else?
- Who is most valuable to keep alive?

Available to protect: ${
            request.constraints.availableTargets?.join(", ") ||
            "All living players"
          }

Your decision (format: "I choose to protect [NAME]"):`;
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
    return `${style.averageMessageLength} messages, ${style.formalityLevel} tone, ${style.emotionalExpression} emotional expression`;
  }

  private describeStrategicApproach(personality: AIPersonality): string {
    const approach = personality.strategicApproach;
    return `votes ${approach.votesTiming}, ${approach.allianceBuilding} alliance building, ${approach.informationSharing} with info`;
  }

  private getRoleDescription(role: PlayerRole): string {
    switch (role) {
      case PlayerRole.MAFIA_LEADER:
        return `You are secretly part of the Mafia. Your goal is to eliminate citizens until mafia equals citizen numbers. You choose who to kill each night.`;
      case PlayerRole.MAFIA_MEMBER:
        return `You are secretly part of the Mafia. Help your Mafia Leader choose targets and deflect suspicion during discussions.`;
      case PlayerRole.HEALER:
        return `You are a Citizen with healing powers. Each night, protect someone from elimination. Find and eliminate the mafia.`;
      case PlayerRole.CITIZEN:
        return `You are an innocent Citizen. Use discussion and voting to identify and eliminate the mafia members.`;
      default:
        return "Unknown role";
    }
  }

  private getPhaseDescription(phase: GamePhase): string {
    switch (phase) {
      case GamePhase.DISCUSSION:
        return "Everyone takes turns speaking. Share thoughts and build your case.";
      case GamePhase.VOTING:
        return "Vote to eliminate someone you suspect is mafia. Choose carefully!";
      case GamePhase.NIGHT:
        return "Special roles act secretly. Mafia kills, Healer protects.";
      default:
        return "Follow the game flow and stay in character.";
    }
  }

  private getTemperatureForPersonality(personality: AIPersonality): number {
    // More creative/emotional personalities get higher temperature
    switch (personality.archetype) {
      case "creative_storyteller":
        return (
          0.8 +
          (personality.communicationStyle.emotionalExpression === "high"
            ? 0.1
            : 0)
        );
      case "analytical_detective":
        return 0.4 + (personality.aggressiveness > 7 ? 0.2 : 0);
      case "direct_analyst":
        return (
          0.6 +
          (personality.strategicApproach.riskTolerance === "aggressive"
            ? 0.1
            : 0)
        );
      default:
        return 0.7;
    }
  }

  private sanitizeResponse(content: string, request: AIActionRequest): string {
    let sanitized = content.trim();

    // Remove AI disclaimers and metadata
    sanitized = sanitized.replace(
      /^(As an AI|I'm an AI|As a language model|As Claude|As GPT).*?\./gi,
      ""
    );
    sanitized = sanitized.replace(/\*[^*]*\*/g, ""); // Remove action descriptions
    sanitized = sanitized.replace(/\[.*?\]/g, ""); // Remove bracketed instructions

    // Apply length constraints
    if (
      request.constraints.maxLength &&
      sanitized.length > request.constraints.maxLength
    ) {
      sanitized =
        sanitized.substring(0, request.constraints.maxLength - 3) + "...";
    }

    // Add personality-specific touches
    const personality = request.personality;
    if (personality.communicationStyle.emotionalExpression === "high") {
      if (Math.random() < 0.3) {
        const emotions = ["!", "...", "?!", "!!"];
        sanitized += emotions[Math.floor(Math.random() * emotions.length)];
      }
    }

    return sanitized.trim() || "I'm still thinking about this...";
  }

  private calculateConfidence(request: AIActionRequest): number {
    let confidence = 0.7; // Base confidence

    // Adjust based on available information
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
    responseTime: number,
    isError: boolean
  ): void {
    const current = this.usageStats.get(model) || {
      totalRequests: 0,
      totalTokens: 0,
      totalCost: 0,
      totalResponseTime: 0,
      errorCount: 0,
    };

    current.totalRequests++;
    current.totalTokens += tokens;
    current.totalCost += cost;
    current.totalResponseTime += responseTime;
    if (isError) current.errorCount++;

    this.usageStats.set(model, current);
  }

  private generateFallbackResponse(request: AIActionRequest): AIResponse {
    const personality = request.personality;
    const fallbackMessages = {
      discussion: [
        "I'm still analyzing what everyone has said so far.",
        "Something feels off, but I can't put my finger on it yet.",
        "I need to hear more before I make any accusations.",
        "The voting patterns are interesting...",
        "Let me think about this carefully.",
      ],
      vote: [
        `I vote to eliminate someone who seems suspicious to me`,
        `I'm going with my gut feeling on this one`,
        `Based on the discussion, I think we should eliminate someone`,
      ],
      night_action: [
        "Making my decision based on today's discussions",
        "Strategic thinking guides my choice",
      ],
    };

    const messages =
      fallbackMessages[request.type] || fallbackMessages.discussion;
    let content = messages[Math.floor(Math.random() * messages.length)];

    // Personalize fallback based on personality
    if (personality.communicationStyle.emotionalExpression === "high") {
      content += "!";
    }

    return {
      content,
      confidence: 0.3,
      metadata: {
        model: personality.model,
        tokensUsed: 0,
        responseTime: 1000,
        cost: 0,
        timestamp: new Date(),
      },
    };
  }

  // Public API
  getUsageStats(): Map<AIModel, any> {
    return new Map(this.usageStats);
  }

  getCostEstimate(model: AIModel, estimatedTokens: number): number {
    const config = MODEL_CONFIGS[model];
    return this.calculateCost(
      estimatedTokens * 0.7,
      estimatedTokens * 0.3,
      config
    );
  }

  getPersonalityPoolInfo() {
    return getPersonalityPoolStats();
  }
}
