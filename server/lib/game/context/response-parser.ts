// server/lib/game/context/response-parser.ts - Bulletproof JSON Validation
import {
  ResponseParserInterface,
  ParsedAIResponse,
  ValidationResult,
  DiscussionResponseData,
  VotingResponseData,
  NightActionResponseData,
  AIPersonality,
} from "../../types/ai";

interface ParsingStrategy {
  name: string;
  priority: number;
  parse: (response: string, availableTargets: string[]) => any;
}

export class ResponseParser implements ResponseParserInterface {
  private parsingStats = {
    totalParsed: 0,
    successfulJSON: 0,
    fallbackUsed: 0,
    emergencyUsed: 0,
    methodBreakdown: new Map<string, number>(),
  };

  constructor() {
    console.log("🔍 ResponseParser initialized with bulletproof validation");
  }

  /**
   * 🔥 CRITICAL: Parse AI response with multiple extraction strategies
   */
  parseResponse(
    response: string,
    expectedType: "discussion" | "voting" | "night_action",
    availableTargets: string[]
  ): ParsedAIResponse {
    this.parsingStats.totalParsed++;

    console.log(
      `🔍 Parsing ${expectedType} response: "${response.substring(0, 100)}..."`
    );

    try {
      // Strategy 1: Direct JSON parsing
      const jsonResult = this.tryDirectJSONParsing(
        response,
        expectedType,
        availableTargets
      );
      if (jsonResult.isValid) {
        this.recordParsingMethod("json");
        return jsonResult;
      }

      // Strategy 2: Clean and parse JSON
      const cleanedResult = this.tryCleanedJSONParsing(
        response,
        expectedType,
        availableTargets
      );
      if (cleanedResult.isValid) {
        this.recordParsingMethod("cleaned_json");
        return cleanedResult;
      }

      // Strategy 3: Pattern-based extraction
      const patternResult = this.tryPatternExtraction(
        response,
        expectedType,
        availableTargets
      );
      if (patternResult.isValid) {
        this.recordParsingMethod("pattern");
        return patternResult;
      }

      // Strategy 4: Intelligent content analysis
      const analysisResult = this.tryContentAnalysis(
        response,
        expectedType,
        availableTargets
      );
      if (analysisResult.isValid) {
        this.recordParsingMethod("analysis");
        return analysisResult;
      }

      // Strategy 5: Fallback generation
      console.warn(
        `⚠️ All parsing strategies failed, using fallback for ${expectedType}`
      );
      this.parsingStats.fallbackUsed++;
      return this.generateIntelligentFallback(
        expectedType,
        availableTargets,
        response
      );
    } catch (error) {
      console.error(`❌ Critical parsing error:`, error);
      this.parsingStats.emergencyUsed++;
      return this.generateEmergencyFallback(expectedType, availableTargets);
    }
  }

  /**
   * Validate discussion response format
   */
  validateDiscussionResponse(response: any): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!response || typeof response !== "object") {
      errors.push("Response must be an object");
      return { isValid: false, errors, warnings };
    }

    if (!response.message || typeof response.message !== "string") {
      errors.push("Missing or invalid 'message' field");
    } else {
      if (response.message.trim().length === 0) {
        errors.push("Message cannot be empty");
      }
      if (response.message.length > 500) {
        warnings.push("Message is quite long");
      }
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  /**
   * Validate voting response format
   */
  validateVotingResponse(
    response: any,
    availableTargets: string[]
  ): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!response || typeof response !== "object") {
      errors.push("Response must be an object");
      return { isValid: false, errors, warnings };
    }

    if (!response.message || typeof response.message !== "string") {
      errors.push("Missing or invalid 'message' field");
    }

    if (!response.vote_target || typeof response.vote_target !== "string") {
      errors.push("Missing or invalid 'vote_target' field");
    } else {
      if (!availableTargets.includes(response.vote_target)) {
        errors.push(`Invalid vote target: ${response.vote_target}`);
      }
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  /**
   * Validate night action response format
   */
  validateNightActionResponse(
    response: any,
    availableTargets: string[]
  ): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!response || typeof response !== "object") {
      errors.push("Response must be an object");
      return { isValid: false, errors, warnings };
    }

    if (!response.action || !["kill", "heal"].includes(response.action)) {
      errors.push(
        "Missing or invalid 'action' field (must be 'kill' or 'heal')"
      );
    }

    if (!response.target || typeof response.target !== "string") {
      errors.push("Missing or invalid 'target' field");
    } else {
      if (!availableTargets.includes(response.target)) {
        errors.push(`Invalid target: ${response.target}`);
      }
    }

    if (!response.reasoning || typeof response.reasoning !== "string") {
      warnings.push("Missing reasoning field");
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  /**
   * Generate fallback response with personality consideration
   */
  generateFallbackResponse(
    type: "discussion" | "voting" | "night_action",
    personality: AIPersonality,
    availableTargets: string[]
  ): ParsedAIResponse {
    return this.generateIntelligentFallback(
      type,
      availableTargets,
      "",
      personality
    );
  }

  /**
   * Strategy 1: Direct JSON parsing
   */
  private tryDirectJSONParsing(
    response: string,
    expectedType: string,
    availableTargets: string[]
  ): ParsedAIResponse {
    try {
      const parsed = JSON.parse(response);
      const validation = this.validateByType(
        parsed,
        expectedType,
        availableTargets
      );

      if (validation.isValid) {
        this.parsingStats.successfulJSON++;
        return {
          isValid: true,
          responseType: expectedType as any,
          data: parsed,
          errors: [],
          parsingMethod: "json",
          confidence: 0.9,
        };
      }

      return {
        isValid: false,
        responseType: expectedType as any,
        data: {} as any,
        errors: validation.errors,
        parsingMethod: "json",
        confidence: 0,
      };
    } catch (error) {
      return {
        isValid: false,
        responseType: expectedType as any,
        data: {} as any,
        errors: ["JSON parsing failed"],
        parsingMethod: "json",
        confidence: 0,
      };
    }
  }

  /**
   * Strategy 2: Clean and parse JSON
   */
  private tryCleanedJSONParsing(
    response: string,
    expectedType: string,
    availableTargets: string[]
  ): ParsedAIResponse {
    try {
      // Extract JSON from response
      const jsonMatch = response.match(/\{[^}]*\}/);
      if (!jsonMatch) {
        return {
          isValid: false,
          responseType: expectedType as any,
          data: {} as any,
          errors: ["No JSON found"],
          parsingMethod: "cleaned_json",
          confidence: 0,
        };
      }

      let jsonString = jsonMatch[0];

      // Clean common issues
      jsonString = jsonString.replace(/,\s*}/g, "}"); // Remove trailing commas
      jsonString = jsonString.replace(/([{,]\s*)(\w+):/g, '$1"$2":'); // Quote unquoted keys

      const parsed = JSON.parse(jsonString);
      const validation = this.validateByType(
        parsed,
        expectedType,
        availableTargets
      );

      if (validation.isValid) {
        return {
          isValid: true,
          responseType: expectedType as any,
          data: parsed,
          errors: [],
          parsingMethod: "cleaned_json",
          confidence: 0.8,
        };
      }

      return {
        isValid: false,
        responseType: expectedType as any,
        data: {} as any,
        errors: validation.errors,
        parsingMethod: "cleaned_json",
        confidence: 0,
      };
    } catch (error) {
      return {
        isValid: false,
        responseType: expectedType as any,
        data: {} as any,
        errors: ["Cleaned JSON parsing failed"],
        parsingMethod: "cleaned_json",
        confidence: 0,
      };
    }
  }

  /**
   * Strategy 3: Pattern-based extraction
   */
  private tryPatternExtraction(
    response: string,
    expectedType: string,
    availableTargets: string[]
  ): ParsedAIResponse {
    const patterns = this.getExtractionPatterns(expectedType);

    for (const pattern of patterns) {
      const result = pattern.parse(response, availableTargets);
      if (result) {
        const validation = this.validateByType(
          result,
          expectedType,
          availableTargets
        );
        if (validation.isValid) {
          return {
            isValid: true,
            responseType: expectedType as any,
            data: result,
            errors: [],
            parsingMethod: `pattern_${pattern.name}`,
            confidence: 0.6,
          };
        }
      }
    }

    return {
      isValid: false,
      responseType: expectedType as any,
      data: {} as any,
      errors: ["Pattern extraction failed"],
      parsingMethod: "pattern",
      confidence: 0,
    };
  }

  /**
   * Strategy 4: Content analysis
   */
  private tryContentAnalysis(
    response: string,
    expectedType: string,
    availableTargets: string[]
  ): ParsedAIResponse {
    const content = response.toLowerCase().trim();

    if (expectedType === "discussion") {
      return {
        isValid: true,
        responseType: "discussion",
        data: { message: response.trim() },
        errors: [],
        parsingMethod: "content_analysis",
        confidence: 0.5,
      };
    }

    if (expectedType === "voting") {
      // Try to extract vote target from content
      for (const target of availableTargets) {
        if (content.includes(target.toLowerCase())) {
          return {
            isValid: true,
            responseType: "voting",
            data: {
              message: response.trim(),
              vote_target: target,
            },
            errors: [],
            parsingMethod: "content_analysis",
            confidence: 0.5,
          };
        }
      }
    }

    if (expectedType === "night_action") {
      const action = content.includes("kill") ? "kill" : "heal";

      // Try to find target
      for (const target of availableTargets) {
        if (content.includes(target.toLowerCase())) {
          return {
            isValid: true,
            responseType: "night_action",
            data: {
              action,
              target,
              reasoning: response.trim(),
            },
            errors: [],
            parsingMethod: "content_analysis",
            confidence: 0.4,
          };
        }
      }
    }

    return {
      isValid: false,
      responseType: expectedType as any,
      data: {} as any,
      errors: ["Content analysis failed"],
      parsingMethod: "content_analysis",
      confidence: 0,
    };
  }

  /**
   * Strategy 5: Intelligent fallback
   */
  private generateIntelligentFallback(
    type: string,
    availableTargets: string[],
    originalResponse: string = "",
    personality?: AIPersonality
  ): ParsedAIResponse {
    console.log(`🔄 Generating intelligent fallback for ${type}`);

    if (type === "discussion") {
      const message =
        originalResponse.trim() || this.generateDiscussionFallback(personality);
      return {
        isValid: true,
        responseType: "discussion",
        data: { message },
        errors: ["Used fallback content"],
        parsingMethod: "fallback",
        confidence: 0.3,
      };
    }

    if (type === "voting") {
      const target = this.selectFallbackTarget(availableTargets, personality);
      return {
        isValid: true,
        responseType: "voting",
        data: {
          message: `I vote to eliminate ${target} based on my analysis.`,
          vote_target: target,
        },
        errors: ["Used fallback target selection"],
        parsingMethod: "fallback",
        confidence: 0.3,
      };
    }

    if (type === "night_action") {
      const action = "kill"; // Default action
      const target = this.selectFallbackTarget(availableTargets, personality);
      return {
        isValid: true,
        responseType: "night_action",
        data: {
          action,
          target,
          reasoning: "Strategic decision based on game analysis",
        },
        errors: ["Used fallback action"],
        parsingMethod: "fallback",
        confidence: 0.3,
      };
    }

    return this.generateEmergencyFallback(type, availableTargets);
  }

  /**
   * Emergency fallback when all else fails
   */
  private generateEmergencyFallback(
    type: string,
    availableTargets: string[]
  ): ParsedAIResponse {
    console.error(`🚨 Emergency fallback for ${type}`);

    const emergency = {
      discussion: { message: "I need to think about this more carefully." },
      voting: {
        message: "Making this decision based on available information.",
        vote_target: availableTargets[0] || "unknown",
      },
      night_action: {
        action: "kill" as const,
        target: availableTargets[0] || "unknown",
        reasoning: "Emergency decision protocol",
      },
    };

    return {
      isValid: true,
      responseType: type as any,
      data: emergency[type as keyof typeof emergency],
      errors: ["Emergency fallback used"],
      parsingMethod: "emergency",
      confidence: 0.1,
    };
  }

  /**
   * Validate response by type
   */
  private validateByType(
    response: any,
    type: string,
    availableTargets: string[]
  ): ValidationResult {
    switch (type) {
      case "discussion":
        return this.validateDiscussionResponse(response);
      case "voting":
        return this.validateVotingResponse(response, availableTargets);
      case "night_action":
        return this.validateNightActionResponse(response, availableTargets);
      default:
        return {
          isValid: false,
          errors: ["Unknown response type"],
          warnings: [],
        };
    }
  }

  /**
   * Get extraction patterns for different response types
   */
  private getExtractionPatterns(type: string): ParsingStrategy[] {
    const patterns: Record<string, ParsingStrategy[]> = {
      voting: [
        {
          name: "vote_pattern",
          priority: 1,
          parse: (response: string, targets: string[]) => {
            const match = response.match(/vote.*?for.*?(\w+)/i);
            if (match && targets.includes(match[1])) {
              return { message: response, vote_target: match[1] };
            }
            return null;
          },
        },
        {
          name: "eliminate_pattern",
          priority: 2,
          parse: (response: string, targets: string[]) => {
            const match = response.match(/eliminate.*?(\w+)/i);
            if (match && targets.includes(match[1])) {
              return { message: response, vote_target: match[1] };
            }
            return null;
          },
        },
      ],
      night_action: [
        {
          name: "action_pattern",
          priority: 1,
          parse: (response: string, targets: string[]) => {
            const actionMatch = response.match(/(kill|heal)/i);
            const targetMatch = response.match(/target.*?(\w+)/i);

            if (
              actionMatch &&
              targetMatch &&
              targets.includes(targetMatch[1])
            ) {
              return {
                action: actionMatch[1].toLowerCase(),
                target: targetMatch[1],
                reasoning: response,
              };
            }
            return null;
          },
        },
      ],
    };

    return patterns[type] || [];
  }

  /**
   * Generate discussion fallback based on personality
   */
  private generateDiscussionFallback(personality?: AIPersonality): string {
    const fallbacks = [
      "I'm still analyzing the situation.",
      "Something seems off, but I need more information.",
      "Let me think about what everyone has said.",
      "I'm watching for suspicious behavior patterns.",
    ];

    return fallbacks[Math.floor(Math.random() * fallbacks.length)];
  }

  /**
   * Select fallback target based on personality and available options
   */
  private selectFallbackTarget(
    targets: string[],
    personality?: AIPersonality
  ): string {
    if (targets.length === 0) return "unknown";
    if (targets.length === 1) return targets[0];

    // Random selection for now, could be enhanced with personality logic
    return targets[Math.floor(Math.random() * targets.length)];
  }

  /**
   * Record parsing method for statistics
   */
  private recordParsingMethod(method: string): void {
    const current = this.parsingStats.methodBreakdown.get(method) || 0;
    this.parsingStats.methodBreakdown.set(method, current + 1);
  }

  /**
   * Get parsing statistics
   */
  getParsingStats(): any {
    return {
      ...this.parsingStats,
      successRate:
        this.parsingStats.totalParsed > 0
          ? ((this.parsingStats.totalParsed - this.parsingStats.emergencyUsed) /
              this.parsingStats.totalParsed) *
            100
          : 100,
      methodBreakdown: Object.fromEntries(this.parsingStats.methodBreakdown),
    };
  }
}

// Export singleton instance
export const responseParser = new ResponseParser();
