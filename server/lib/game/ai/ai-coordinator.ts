// server/lib/game/ai/ai-coordinator.ts - Fixed TypeScript Issues
import {
  AIDecisionContext,
  AIPersonality,
  AIResponse,
  DiscussionResponseData,
  VotingResponseData,
  NightActionResponseData,
} from "../../types/ai";
import { PlayerId } from "../../types/game";
import { promptBuilder } from "./prompt-builder";
import { responseParser } from "../context/response-parser";
import { aiResponseGenerator } from "../../../../src/lib/ai/response-generator";

export interface AICoordinatorInterface {
  generateDiscussionResponse(
    playerId: PlayerId,
    context: AIDecisionContext,
    personality: AIPersonality,
    temporaryContext: any
  ): Promise<AIResponse>;

  generateVotingResponse(
    playerId: PlayerId,
    context: AIDecisionContext,
    personality: AIPersonality,
    temporaryContext: any
  ): Promise<AIResponse>;

  generateNightActionResponse(
    playerId: PlayerId,
    context: AIDecisionContext,
    personality: AIPersonality,
    temporaryContext: any
  ): Promise<AIResponse>;

  generateMafiaCoordination(
    playerId: PlayerId,
    context: AIDecisionContext,
    personality: AIPersonality,
    availableTargets: string[]
  ): Promise<string>;

  generateHealerReasoning(
    playerId: PlayerId,
    context: AIDecisionContext,
    personality: AIPersonality,
    availableTargets: string[]
  ): Promise<string>;
}

export class AICoordinator implements AICoordinatorInterface {
  private coordinationStats = {
    totalRequests: 0,
    successfulResponses: 0,
    fallbacksUsed: 0,
    averageResponseTime: 0,
    errorsByPhase: new Map<string, number>(),
  };
  private totalResponseTime = 0;

  constructor() {
    console.log("🤖 AICoordinator initialized for real AI integration");
  }

  /**
   * 🔥 Generate discussion response with real AI
   */
  async generateDiscussionResponse(
    playerId: PlayerId,
    context: AIDecisionContext,
    personality: AIPersonality,
    temporaryContext: any
  ): Promise<AIResponse> {
    const startTime = Date.now();
    this.coordinationStats.totalRequests++;

    try {
      console.log(
        `💬 Generating discussion response for ${playerId.slice(-6)} (${
          personality.name
        })`
      );

      // Build the prompt using our revolutionary prompt builder
      const prompt = promptBuilder.buildDiscussionPrompt(
        context,
        personality,
        temporaryContext
      );

      // Create the request object for the 4th parameter
      const request = {
        type: "discussion" as const,
        context,
        personality,
        constraints: {
          maxLength: 150,
          timeLimit: 30000,
        },
      };

      // 🔥 REAL AI: Use the existing AI response generator with all 4 parameters
      const rawResponse = await aiResponseGenerator.generateResponse(
        prompt,
        personality.model,
        {
          maxTokens: 150,
          temperature: 0.8,
          requiresJSON: true,
          gameContext: {
            phase: "discussion",
            round: context.round,
            playerId: playerId.slice(-6),
            personality: personality.name,
          },
        },
        request // FIX: Add the missing request parameter
      );

      // Parse and validate the response - fix: use correct method signature
      const availableTargets: string[] = []; // Not needed for discussion
      const parsedResponse = responseParser.parseResponse(
        rawResponse.content,
        "discussion",
        availableTargets
      );

      if (!parsedResponse.isValid) {
        console.warn(
          `⚠️ Invalid discussion response from ${personality.name}:`,
          parsedResponse.errors
        );

        // Use fallback
        const fallbackResponse = responseParser.generateFallbackResponse(
          "discussion",
          personality,
          availableTargets
        );

        this.coordinationStats.fallbacksUsed++;

        return {
          content: (fallbackResponse.data as DiscussionResponseData).message,
          confidence: 0.3,
          metadata: {
            model: personality.model,
            tokensUsed: rawResponse.metadata?.tokensUsed || 0,
            responseTime: Date.now() - startTime,
            cost: rawResponse.metadata?.cost || 0,
            timestamp: new Date(),
          },
        };
      }

      // Success!
      this.coordinationStats.successfulResponses++;
      this.updateResponseTime(Date.now() - startTime);

      const discussionData = parsedResponse.data as DiscussionResponseData;
      console.log(
        `✅ Discussion response generated: ${discussionData.message.substring(
          0,
          50
        )}...`
      );

      return {
        content: discussionData.message,
        confidence: parsedResponse.confidence,
        metadata: {
          model: personality.model,
          tokensUsed: rawResponse.metadata?.tokensUsed || 0,
          responseTime: Date.now() - startTime,
          cost: rawResponse.metadata?.cost || 0,
          timestamp: new Date(),
        },
      };
    } catch (error) {
      console.error(
        `❌ Discussion response failed for ${personality.name}:`,
        error
      );
      this.recordError("discussion");

      // Emergency fallback
      return this.generateEmergencyFallback(
        "discussion",
        personality,
        startTime
      );
    }
  }

  /**
   * 🔥 Generate voting response with real AI
   */
  async generateVotingResponse(
    playerId: PlayerId,
    context: AIDecisionContext,
    personality: AIPersonality,
    temporaryContext: any
  ): Promise<AIResponse> {
    const startTime = Date.now();
    this.coordinationStats.totalRequests++;

    try {
      console.log(
        `🗳️ Generating voting response for ${playerId.slice(-6)} (${
          personality.name
        })`
      );

      // Build the prompt
      const prompt = promptBuilder.buildVotingPrompt(
        context,
        personality,
        temporaryContext
      );

      // Create the request object for the 4th parameter
      const request = {
        type: "vote" as const,
        context,
        personality,
        constraints: {
          maxLength: 100,
          timeLimit: 30000,
          availableTargets: temporaryContext.data?.available_targets || [],
        },
      };

      // 🔥 REAL AI: Generate response with all 4 parameters
      const rawResponse = await aiResponseGenerator.generateResponse(
        prompt,
        personality.model,
        {
          maxTokens: 100,
          temperature: 0.7,
          requiresJSON: true,
          gameContext: {
            phase: "voting",
            round: context.round,
            playerId: playerId.slice(-6),
            personality: personality.name,
          },
        },
        request // FIX: Add the missing request parameter
      );

      // Parse and validate
      const availableTargets = temporaryContext.data?.available_targets || [];
      const parsedResponse = responseParser.parseResponse(
        rawResponse.content,
        "voting",
        availableTargets
      );

      if (!parsedResponse.isValid) {
        console.warn(
          `⚠️ Invalid voting response from ${personality.name}:`,
          parsedResponse.errors
        );

        const fallbackResponse = responseParser.generateFallbackResponse(
          "voting",
          personality,
          availableTargets
        );

        this.coordinationStats.fallbacksUsed++;

        const fallbackData = fallbackResponse.data as VotingResponseData;
        return {
          content: `{"message": "${fallbackData.message}", "vote_target": "${fallbackData.vote_target}"}`,
          confidence: 0.3,
          metadata: {
            model: personality.model,
            tokensUsed: rawResponse.metadata?.tokensUsed || 0,
            responseTime: Date.now() - startTime,
            cost: rawResponse.metadata?.cost || 0,
            timestamp: new Date(),
          },
        };
      }

      this.coordinationStats.successfulResponses++;
      this.updateResponseTime(Date.now() - startTime);

      const votingData = parsedResponse.data as VotingResponseData;
      console.log(
        `✅ Voting response: ${votingData.vote_target} - "${votingData.message}"`
      );

      return {
        content: JSON.stringify(parsedResponse.data),
        confidence: parsedResponse.confidence,
        metadata: {
          model: personality.model,
          tokensUsed: rawResponse.metadata?.tokensUsed || 0,
          responseTime: Date.now() - startTime,
          cost: rawResponse.metadata?.cost || 0,
          timestamp: new Date(),
        },
      };
    } catch (error) {
      console.error(
        `❌ Voting response failed for ${personality.name}:`,
        error
      );
      this.recordError("voting");

      return this.generateEmergencyFallback(
        "voting",
        personality,
        startTime,
        temporaryContext
      );
    }
  }

  /**
   * 🔥 Generate night action response with real AI
   */
  async generateNightActionResponse(
    playerId: PlayerId,
    context: AIDecisionContext,
    personality: AIPersonality,
    temporaryContext: any
  ): Promise<AIResponse> {
    const startTime = Date.now();
    this.coordinationStats.totalRequests++;

    try {
      console.log(
        `🌙 Generating night action for ${playerId.slice(-6)} (${
          personality.name
        })`
      );

      // Build the prompt
      const prompt = promptBuilder.buildNightActionPrompt(
        context,
        personality,
        temporaryContext
      );

      // Create the request object for the 4th parameter
      const request = {
        type: "night_action" as const,
        context,
        personality,
        constraints: {
          maxLength: 120,
          timeLimit: 45000,
          availableTargets: temporaryContext.data?.available_targets || [],
        },
      };

      // 🔥 REAL AI: Generate response with all 4 parameters
      const rawResponse = await aiResponseGenerator.generateResponse(
        prompt,
        personality.model,
        {
          maxTokens: 120,
          temperature: 0.6,
          requiresJSON: true,
          gameContext: {
            phase: "night",
            round: context.round,
            playerId: playerId.slice(-6),
            personality: personality.name,
          },
        },
        request // FIX: Add the missing request parameter
      );

      // Parse and validate
      const availableTargets = temporaryContext.data?.available_targets || [];
      const parsedResponse = responseParser.parseResponse(
        rawResponse.content,
        "night_action",
        availableTargets
      );

      if (!parsedResponse.isValid) {
        console.warn(
          `⚠️ Invalid night action from ${personality.name}:`,
          parsedResponse.errors
        );

        const fallbackResponse = responseParser.generateFallbackResponse(
          "night_action",
          personality,
          availableTargets
        );

        this.coordinationStats.fallbacksUsed++;

        return {
          content: JSON.stringify(fallbackResponse.data),
          confidence: 0.3,
          metadata: {
            model: personality.model,
            tokensUsed: rawResponse.metadata?.tokensUsed || 0,
            responseTime: Date.now() - startTime,
            cost: rawResponse.metadata?.cost || 0,
            timestamp: new Date(),
          },
        };
      }

      this.coordinationStats.successfulResponses++;
      this.updateResponseTime(Date.now() - startTime);

      const actionData = parsedResponse.data as NightActionResponseData;
      console.log(`✅ Night action: ${actionData.action} ${actionData.target}`);

      return {
        content: JSON.stringify(parsedResponse.data),
        confidence: parsedResponse.confidence,
        metadata: {
          model: personality.model,
          tokensUsed: rawResponse.metadata?.tokensUsed || 0,
          responseTime: Date.now() - startTime,
          cost: rawResponse.metadata?.cost || 0,
          timestamp: new Date(),
        },
      };
    } catch (error) {
      console.error(`❌ Night action failed for ${personality.name}:`, error);
      this.recordError("night");

      return this.generateEmergencyFallback(
        "night_action",
        personality,
        startTime,
        temporaryContext
      );
    }
  }

  /**
   * 🔥 Generate mafia coordination with real AI
   */
  async generateMafiaCoordination(
    playerId: PlayerId,
    context: AIDecisionContext,
    personality: AIPersonality,
    availableTargets: string[]
  ): Promise<string> {
    try {
      console.log(
        `🔴 Generating mafia coordination for ${playerId.slice(-6)} (${
          personality.name
        })`
      );

      const prompt = promptBuilder.buildMafiaCoordinationPrompt(
        context,
        personality,
        availableTargets
      );

      // Create the request object for the 4th parameter
      const request = {
        type: "discussion" as const,
        context,
        personality,
        constraints: {
          maxLength: 100,
          timeLimit: 20000,
        },
      };

      const rawResponse = await aiResponseGenerator.generateResponse(
        prompt,
        personality.model,
        {
          maxTokens: 100,
          temperature: 0.8,
          requiresJSON: true,
          gameContext: {
            phase: "mafia_coordination",
            round: context.round,
            playerId: playerId.slice(-6),
            personality: personality.name,
          },
        },
        request // FIX: Add the missing request parameter
      );

      const parsedResponse = responseParser.parseResponse(
        rawResponse.content,
        "discussion",
        []
      );

      if (parsedResponse.isValid) {
        const discussionData = parsedResponse.data as DiscussionResponseData;
        return discussionData.message;
      } else {
        return `I think we should consider our options carefully. Who do you think poses the biggest threat?`;
      }
    } catch (error) {
      console.error(
        `❌ Mafia coordination failed for ${personality.name}:`,
        error
      );
      return `Let's discuss our strategy for tonight.`;
    }
  }

  /**
   * 🔥 Generate healer reasoning with real AI
   */
  async generateHealerReasoning(
    playerId: PlayerId,
    context: AIDecisionContext,
    personality: AIPersonality,
    availableTargets: string[]
  ): Promise<string> {
    try {
      console.log(
        `🛡️ Generating healer reasoning for ${playerId.slice(-6)} (${
          personality.name
        })`
      );

      const prompt = promptBuilder.buildHealerReasoningPrompt(
        context,
        personality,
        availableTargets
      );

      // Create the request object for the 4th parameter
      const request = {
        type: "discussion" as const,
        context,
        personality,
        constraints: {
          maxLength: 100,
          timeLimit: 25000,
        },
      };

      const rawResponse = await aiResponseGenerator.generateResponse(
        prompt,
        personality.model,
        {
          maxTokens: 100,
          temperature: 0.7,
          requiresJSON: true,
          gameContext: {
            phase: "healer_reasoning",
            round: context.round,
            playerId: playerId.slice(-6),
            personality: personality.name,
          },
        },
        request // FIX: Add the missing request parameter
      );

      const parsedResponse = responseParser.parseResponse(
        rawResponse.content,
        "discussion",
        []
      );

      if (parsedResponse.isValid) {
        const discussionData = parsedResponse.data as DiscussionResponseData;
        return discussionData.message;
      } else {
        return `I need to think carefully about who might need protection tonight.`;
      }
    } catch (error) {
      console.error(
        `❌ Healer reasoning failed for ${personality.name}:`,
        error
      );
      return `Considering who might be in danger tonight.`;
    }
  }

  /**
   * Generate emergency fallback response
   */
  private generateEmergencyFallback(
    type: string,
    personality: AIPersonality,
    startTime: number,
    temporaryContext?: any
  ): AIResponse {
    console.warn(`🚨 Emergency fallback for ${type} - ${personality.name}`);

    let content: string;

    switch (type) {
      case "discussion":
        content =
          "I'm still analyzing the situation and gathering information.";
        break;
      case "voting":
        const targets = temporaryContext?.data?.available_targets || [];
        const target = targets.length > 0 ? targets[0] : "unknown";
        content = `{"message": "Making this decision based on available information.", "vote_target": "${target}"}`;
        break;
      case "night_action":
        const actionTargets = temporaryContext?.data?.available_targets || [];
        const actionTarget =
          actionTargets.length > 0 ? actionTargets[0] : "nobody";
        const action = personality.name.includes("Mafia") ? "kill" : "heal";
        content = `{"action": "${action}", "target": "${actionTarget}", "reasoning": "Strategic decision"}`;
        break;
      default:
        content = "Analyzing the current situation.";
    }

    return {
      content,
      confidence: 0.1,
      metadata: {
        model: personality.model,
        tokensUsed: 0,
        responseTime: Date.now() - startTime,
        cost: 0,
        timestamp: new Date(),
      },
    };
  }

  /**
   * Record error by phase
   */
  private recordError(phase: string): void {
    const current = this.coordinationStats.errorsByPhase.get(phase) || 0;
    this.coordinationStats.errorsByPhase.set(phase, current + 1);
  }

  /**
   * Update response time statistics
   */
  private updateResponseTime(responseTime: number): void {
    this.totalResponseTime += responseTime;
    this.coordinationStats.averageResponseTime =
      this.totalResponseTime / this.coordinationStats.successfulResponses;
  }

  /**
   * Get coordination statistics
   */
  getCoordinationStats(): any {
    return {
      ...this.coordinationStats,
      successRate:
        this.coordinationStats.totalRequests > 0
          ? (this.coordinationStats.successfulResponses /
              this.coordinationStats.totalRequests) *
            100
          : 100,
      fallbackRate:
        this.coordinationStats.totalRequests > 0
          ? (this.coordinationStats.fallbacksUsed /
              this.coordinationStats.totalRequests) *
            100
          : 0,
      errorsByPhase: Object.fromEntries(this.coordinationStats.errorsByPhase),
    };
  }

  /**
   * Test AI coordination with a simple prompt
   */
  async testCoordination(personality: AIPersonality): Promise<boolean> {
    try {
      const testPrompt = `You are ${personality.name}. Respond with JSON: {"message": "test successful"}`;

      // Create a minimal request object for the 4th parameter
      const request = {
        type: "discussion" as const,
        context: {} as any, // Minimal context for test
        personality,
        constraints: {
          maxLength: 50,
          timeLimit: 10000,
        },
      };

      const response = await aiResponseGenerator.generateResponse(
        testPrompt,
        personality.model,
        {
          maxTokens: 50,
          temperature: 0.5,
          requiresJSON: true,
          gameContext: {
            phase: "test",
            round: 1,
            playerId: "test",
            personality: personality.name,
          },
        },
        request // FIX: Add the missing request parameter
      );

      const parsed = responseParser.parseResponse(
        response.content,
        "discussion",
        []
      );
      return parsed.isValid;
    } catch (error) {
      console.error(
        `❌ AI coordination test failed for ${personality.name}:`,
        error
      );
      return false;
    }
  }

  /**
   * Get debug information
   */
  getDebugInfo(): any {
    return {
      stats: this.getCoordinationStats(),
      isOperational: this.coordinationStats.totalRequests > 0,
      avgResponseTime: this.coordinationStats.averageResponseTime,
      lastActivity: new Date().toISOString(),
    };
  }
}

// Export singleton instance
export const aiCoordinator = new AICoordinator();
