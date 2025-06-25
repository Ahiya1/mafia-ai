// server/lib/ai/models.ts - Enhanced for JSON-Only Responses (COMMIT 3)
// This file shows the key enhancements needed for the existing models.ts

// 🔥 COMMIT 3: Enhanced AI model configuration for JSON-only responses
export interface EnhancedAIRequestOptions {
  maxTokens: number;
  temperature: number;
  requiresJSON: boolean; // 🔥 NEW: Force JSON responses
  gameContext?: {
    phase: string;
    round: number;
    playerId: string;
    personality: string;
    role?: string;
    availableTargets?: string[];
  };
  fallbackBehavior?: "retry" | "emergency" | "skip";
  timeoutMs?: number;
}

// 🔥 COMMIT 3: Enhanced response validation
export interface EnhancedAIResponse {
  content: string;
  isValidJSON: boolean; // 🔥 NEW: JSON validation flag
  parsedContent?: any; // 🔥 NEW: Pre-parsed JSON if valid
  metadata: {
    model: string;
    tokensUsed: number;
    responseTime: number;
    cost: number;
    timestamp: Date;
    jsonParsingAttempts?: number; // 🔥 NEW: Track parsing attempts
    fallbackUsed?: boolean; // 🔥 NEW: Track if fallback was used
  };
}

// 🔥 COMMIT 3: JSON-focused prompt templates
export const JSON_PROMPT_TEMPLATES = {
  discussion: {
    systemPrompt: `You are an AI playing Mafia. You must respond with ONLY valid JSON in this exact format:
    {"message": "your discussion message here"}
    
    No other text before or after the JSON. No explanations. Only the JSON object.`,
    responseFormat: "json_object",
  },

  voting: {
    systemPrompt: `You are an AI playing Mafia. You must respond with ONLY valid JSON in this exact format:
    {"message": "brief explanation", "vote_target": "exact_player_name"}
    
    No other text before or after the JSON. No explanations. Only the JSON object.`,
    responseFormat: "json_object",
  },

  night_action: {
    systemPrompt: `You are an AI playing Mafia. You must respond with ONLY valid JSON in this exact format:
    {"action": "kill_or_heal", "target": "player_name_or_nobody", "reasoning": "brief_explanation"}
    
    No other text before or after the JSON. No explanations. Only the JSON object.`,
    responseFormat: "json_object",
  },
};

// 🔥 COMMIT 3: Enhanced model calling with JSON enforcement
export class EnhancedAIModelCaller {
  /**
   * Call AI model with JSON enforcement
   */
  async callModelWithJSONEnforcement(
    prompt: string,
    model: string,
    options: EnhancedAIRequestOptions
  ): Promise<EnhancedAIResponse> {
    const startTime = Date.now();

    try {
      // Determine prompt template based on game context
      let systemPrompt = "";
      if (options.gameContext?.phase) {
        const template =
          JSON_PROMPT_TEMPLATES[
            options.gameContext.phase as keyof typeof JSON_PROMPT_TEMPLATES
          ];
        if (template) {
          systemPrompt = template.systemPrompt;
        }
      }

      // Enhance prompt with JSON requirement
      const enhancedPrompt = options.requiresJSON
        ? `${systemPrompt}\n\n${prompt}\n\nRemember: Respond with ONLY valid JSON, no other text.`
        : prompt;

      // Call the existing AI response generator
      const response = await this.callExistingAISystem(
        enhancedPrompt,
        model,
        options
      );

      // Validate JSON response
      const jsonValidation = this.validateJSONResponse(response.content);

      return {
        content: response.content,
        isValidJSON: jsonValidation.isValid,
        parsedContent: jsonValidation.parsed,
        metadata: {
          ...response.metadata,
          jsonParsingAttempts: jsonValidation.attempts,
          fallbackUsed: !jsonValidation.isValid,
        },
      };
    } catch (error) {
      console.error(`❌ Enhanced AI model call failed:`, error);

      // Return error response
      return {
        content: '{"message": "AI response failed"}',
        isValidJSON: true,
        parsedContent: { message: "AI response failed" },
        metadata: {
          model,
          tokensUsed: 0,
          responseTime: Date.now() - startTime,
          cost: 0,
          timestamp: new Date(),
          jsonParsingAttempts: 0,
          fallbackUsed: true,
        },
      };
    }
  }

  /**
   * Validate JSON response with multiple attempts
   */
  private validateJSONResponse(content: string): {
    isValid: boolean;
    parsed?: any;
    attempts: number;
  } {
    let attempts = 0;

    // Attempt 1: Direct parsing
    attempts++;
    try {
      const parsed = JSON.parse(content);
      return { isValid: true, parsed, attempts };
    } catch (error) {
      // Attempt failed
    }

    // Attempt 2: Extract JSON from content
    attempts++;
    try {
      const jsonMatch = content.match(/\{[^}]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return { isValid: true, parsed, attempts };
      }
    } catch (error) {
      // Attempt failed
    }

    // Attempt 3: Clean and parse
    attempts++;
    try {
      let cleaned = content.replace(/```json|```/g, "").trim();
      cleaned = cleaned.replace(/,\s*}/g, "}"); // Remove trailing commas
      const parsed = JSON.parse(cleaned);
      return { isValid: true, parsed, attempts };
    } catch (error) {
      // All attempts failed
    }

    return { isValid: false, attempts };
  }

  /**
   * Call existing AI system (integrates with current implementation)
   */
  private async callExistingAISystem(
    prompt: string,
    model: string,
    options: EnhancedAIRequestOptions
  ): Promise<any> {
    // This would integrate with the existing aiResponseGenerator
    // For this example, showing the interface

    const aiResponseGenerator =
      require("../../../../src/lib/ai/response-generator").aiResponseGenerator;

    return await aiResponseGenerator.generateResponse(prompt, model, {
      maxTokens: options.maxTokens,
      temperature: options.temperature,
      // Pass through game context for analytics
      gameContext: options.gameContext,
    });
  }
}

// 🔥 COMMIT 3: Export enhanced model caller
export const enhancedModelCaller = new EnhancedAIModelCaller();

// 🔥 COMMIT 3: JSON validation utilities
export class JSONResponseValidator {
  /**
   * Validate discussion response JSON
   */
  static validateDiscussionJSON(content: string): {
    isValid: boolean;
    data?: any;
    errors: string[];
  } {
    try {
      const parsed = JSON.parse(content);
      const errors: string[] = [];

      if (!parsed.message || typeof parsed.message !== "string") {
        errors.push("Missing or invalid message field");
      }

      if (parsed.message && parsed.message.length > 200) {
        errors.push("Message too long (max 200 characters)");
      }

      return {
        isValid: errors.length === 0,
        data: errors.length === 0 ? parsed : undefined,
        errors,
      };
    } catch (error) {
      return {
        isValid: false,
        errors: ["Invalid JSON format"],
      };
    }
  }

  /**
   * Validate voting response JSON
   */
  static validateVotingJSON(
    content: string,
    availableTargets: string[]
  ): { isValid: boolean; data?: any; errors: string[] } {
    try {
      const parsed = JSON.parse(content);
      const errors: string[] = [];

      if (!parsed.message || typeof parsed.message !== "string") {
        errors.push("Missing or invalid message field");
      }

      if (!parsed.vote_target || typeof parsed.vote_target !== "string") {
        errors.push("Missing or invalid vote_target field");
      }

      if (
        parsed.vote_target &&
        !availableTargets.includes(parsed.vote_target)
      ) {
        errors.push(`Invalid vote target: ${parsed.vote_target}`);
      }

      return {
        isValid: errors.length === 0,
        data: errors.length === 0 ? parsed : undefined,
        errors,
      };
    } catch (error) {
      return {
        isValid: false,
        errors: ["Invalid JSON format"],
      };
    }
  }

  /**
   * Validate night action response JSON
   */
  static validateNightActionJSON(
    content: string,
    availableTargets: string[]
  ): { isValid: boolean; data?: any; errors: string[] } {
    try {
      const parsed = JSON.parse(content);
      const errors: string[] = [];

      if (!parsed.action || !["kill", "heal"].includes(parsed.action)) {
        errors.push(
          'Missing or invalid action field (must be "kill" or "heal")'
        );
      }

      if (!parsed.target || typeof parsed.target !== "string") {
        errors.push("Missing or invalid target field");
      }

      if (
        parsed.target &&
        parsed.target !== "nobody" &&
        !availableTargets.includes(parsed.target)
      ) {
        errors.push(`Invalid target: ${parsed.target}`);
      }

      if (!parsed.reasoning || typeof parsed.reasoning !== "string") {
        errors.push("Missing or invalid reasoning field");
      }

      return {
        isValid: errors.length === 0,
        data: errors.length === 0 ? parsed : undefined,
        errors,
      };
    } catch (error) {
      return {
        isValid: false,
        errors: ["Invalid JSON format"],
      };
    }
  }
}

// Example of how the existing aiResponseGenerator would be enhanced:
//
// export class EnhancedAIResponseGenerator {
//   async generateResponse(prompt: string, model: string, options: EnhancedAIRequestOptions) {
//     // Use enhancedModelCaller for JSON-only responses
//     return await enhancedModelCaller.callModelWithJSONEnforcement(prompt, model, options);
//   }
// }
