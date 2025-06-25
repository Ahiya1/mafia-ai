// server/lib/game/context/context-manager.ts - Enhanced with Real AI Integration
import { PlayerId } from "../../types/game";
import {
  ContextManagerInterface,
  TemporaryContextData,
  PersistentContextData,
  BroadcastContextData,
  AIDecisionContext,
  AIResponse,
  ContextStats,
} from "../../types/ai";
import { aiCoordinator } from "../ai/ai-coordinator";
import { aiContextBuilder } from "./ai-context-builder";
import { nameRegistry } from "./name-registry";
import { selectGamePersonalities } from "../../../../src/lib/ai/personality-pool";

interface ActiveContext {
  playerId: PlayerId;
  contextData: TemporaryContextData;
  startTime: Date;
  responsePromise?: Promise<AIResponse>;
  timeoutId?: NodeJS.Timeout;
}

interface PlayerPersistentContext {
  playerId: PlayerId;
  data: Map<string, any>;
  lastUpdated: Date;
  personality?: any; // AI personality for this player
}

export class ContextManager implements ContextManagerInterface {
  private activeContexts: Map<PlayerId, ActiveContext> = new Map();
  private persistentContexts: Map<PlayerId, PlayerPersistentContext> =
    new Map();
  private playerPersonalities: Map<PlayerId, any> = new Map(); // 🔥 NEW: Store AI personalities
  private stats: ContextStats = {
    totalTriggers: 0,
    totalUpdates: 0,
    totalPushes: 0,
    averageResponseTime: 0,
    activeContexts: 0,
    errorRate: 0,
    totalErrors: 0,
  };
  private totalResponseTime: number = 0;
  private totalErrors: number = 0;

  constructor() {
    console.log("🧠 ContextManager initialized - Real AI Integration Ready");
  }

  /**
   * 🔥 ENHANCED: TRIGGER with real AI responses
   */
  async trigger(
    playerId: PlayerId,
    context: TemporaryContextData
  ): Promise<AIResponse> {
    console.log(`🎯 TRIGGER: ${playerId.slice(-6)} → ${context.type}`);

    this.stats.totalTriggers++;
    this.updateActiveContextsCount();

    // Clear any existing context for this player
    this.clearActiveContext(playerId);

    const startTime = new Date();

    const activeContext: ActiveContext = {
      playerId,
      contextData: context,
      startTime,
    };

    // Set up timeout if specified
    if (context.timeoutMs) {
      activeContext.timeoutId = setTimeout(() => {
        this.handleContextTimeout(playerId);
      }, context.timeoutMs);
    }

    // Store active context
    this.activeContexts.set(playerId, activeContext);

    try {
      // 🔥 REAL AI: Generate actual AI response
      const responsePromise = this.generateRealAIResponse(playerId, context);
      activeContext.responsePromise = responsePromise;

      const response = await responsePromise;

      // Calculate response time
      const responseTime = Date.now() - startTime.getTime();
      this.updateResponseTimeStats(responseTime);

      // Clear context after successful response
      this.clearActiveContext(playerId);

      console.log(
        `✅ TRIGGER completed: ${playerId.slice(
          -6
        )} responded in ${responseTime}ms`
      );
      return response;
    } catch (error) {
      console.error(`❌ TRIGGER failed for ${playerId.slice(-6)}:`, error);
      this.stats.totalErrors++;
      this.clearActiveContext(playerId);

      // Return fallback response
      return {
        content: "I need a moment to think about this...",
        confidence: 0.3,
        metadata: {
          model: "fallback" as any,
          tokensUsed: 0,
          responseTime: Date.now() - startTime.getTime(),
          cost: 0,
          timestamp: new Date(),
        },
      };
    }
  }

  /**
   * 🔄 UPDATE: Persistent context for specific AI
   */
  update(playerId: PlayerId, context: PersistentContextData): void {
    console.log(`🔄 UPDATE: ${playerId.slice(-6)} → ${context.type}`);

    this.stats.totalUpdates++;

    // Get or create persistent context for player
    let playerContext = this.persistentContexts.get(playerId);
    if (!playerContext) {
      playerContext = {
        playerId,
        data: new Map(),
        lastUpdated: new Date(),
      };
      this.persistentContexts.set(playerId, playerContext);
    }

    // Update the specific context type
    playerContext.data.set(context.type, context.data);
    playerContext.lastUpdated = new Date();

    // 🔥 NEW: Update AI context builder with this data
    if (context.type === "role_assignment") {
      aiContextBuilder.updatePlayerState(playerId, {
        playerId,
        role: context.data.your_role,
        isAlive: true,
        suspicionLevel: 5,
        trustLevel: 5,
      });
    }

    console.log(
      `✅ UPDATE completed: ${playerId.slice(-6)} context ${
        context.type
      } updated`
    );
  }

  /**
   * 📢 PUSH: Broadcast to ALL AIs simultaneously
   */
  push(context: BroadcastContextData): void {
    console.log(
      `📢 PUSH: ${context.type} → ${
        context.targetedPlayers ? context.targetedPlayers.length : "ALL"
      } players`
    );

    this.stats.totalPushes++;

    // Determine target players
    const targetPlayers =
      context.targetedPlayers || Array.from(this.persistentContexts.keys());

    // Update all targeted players with broadcast data
    for (const playerId of targetPlayers) {
      this.update(playerId, {
        type: "game_state" as any,
        data: {
          broadcast: context.type,
          broadcastData: context.data,
          timestamp: new Date(),
        },
      });
    }

    // 🔥 NEW: Update AI context builder with game state changes
    if (context.type === "phase_change") {
      aiContextBuilder.updateGameState({
        phase: context.data.newPhase,
        round: context.data.round,
        livingPlayers: [], // Will be updated by orchestrator
        eliminatedPlayers: [],
        gameHistory: [],
        timeRemaining: 30000,
      });
    }

    console.log(
      `✅ PUSH completed: ${context.type} sent to ${targetPlayers.length} players`
    );
  }

  /**
   * 🔥 NEW: Generate real AI response using AI coordinator
   */
  private async generateRealAIResponse(
    playerId: PlayerId,
    context: TemporaryContextData
  ): Promise<AIResponse> {
    // Get AI personality for this player
    const personality = this.getPlayerPersonality(playerId);
    if (!personality) {
      throw new Error(`No AI personality found for player ${playerId}`);
    }

    // Build comprehensive AI context
    const aiContext = this.buildPlayerContext(playerId);

    // Generate response based on context type
    switch (context.type) {
      case "discussion_turn":
        return await aiCoordinator.generateDiscussionResponse(
          playerId,
          aiContext,
          personality,
          context
        );

      case "voting_turn":
        return await aiCoordinator.generateVotingResponse(
          playerId,
          aiContext,
          personality,
          context
        );

      case "night_action":
        return await aiCoordinator.generateNightActionResponse(
          playerId,
          aiContext,
          personality,
          context
        );

      default:
        throw new Error(`Unknown context type: ${context.type}`);
    }
  }

  /**
   * 🔥 NEW: Get or assign AI personality for player
   */
  private getPlayerPersonality(playerId: PlayerId): any {
    // Check if we already have a personality for this player
    if (this.playerPersonalities.has(playerId)) {
      return this.playerPersonalities.get(playerId);
    }

    // Try to get personality based on player name or type
    try {
      // For now, select a random personality
      // In full implementation, this would be coordinated with the orchestrator
      const personalities = selectGamePersonalities(true, 1); // Enable premium models
      if (personalities.length > 0) {
        const personality = personalities[0];
        this.playerPersonalities.set(playerId, personality);
        console.log(
          `🎭 Assigned personality ${personality.name} to ${playerId.slice(-6)}`
        );
        return personality;
      }
    } catch (error) {
      console.error(`❌ Failed to assign personality to ${playerId}:`, error);
    }

    // Fallback personality
    const fallbackPersonality = {
      name: "Analytical Detective",
      model: "claude-haiku" as any,
      archetype: "analytical_detective" as any,
      communicationStyle: {
        averageMessageLength: "medium" as any,
        formalityLevel: "mixed" as any,
        emotionalExpression: "medium" as any,
        questionFrequency: "medium" as any,
        storytellingTendency: "low" as any,
        logicalReasoning: "high" as any,
      },
      strategicApproach: {
        votesTiming: "middle" as any,
        allianceBuilding: "cautious" as any,
        informationSharing: "selective" as any,
        riskTolerance: "moderate" as any,
      },
      suspicionLevel: 5,
      trustLevel: 5,
      aggressiveness: 5,
    };

    this.playerPersonalities.set(playerId, fallbackPersonality);
    return fallbackPersonality;
  }

  /**
   * 🔥 ENHANCED: Build comprehensive context for a player
   */
  buildPlayerContext(playerId: PlayerId): AIDecisionContext {
    const persistentContext = this.persistentContexts.get(playerId);

    // Build enhanced context structure
    const context: AIDecisionContext = {
      playerId,
      role:
        persistentContext?.data.get("role_assignment")?.your_role || "citizen",
      phase: persistentContext?.data.get("game_state")?.phase || "waiting",
      round: persistentContext?.data.get("game_state")?.round || 0,
      gameHistory: persistentContext?.data.get("game_state")?.gameHistory || [],
      livingPlayers:
        persistentContext?.data.get("game_state")?.livingPlayers || [],
      eliminatedPlayers:
        persistentContext?.data.get("game_state")?.eliminatedPlayers || [],
      previousVotes:
        persistentContext?.data.get("game_state")?.previousVotes || [],
      timeRemaining:
        persistentContext?.data.get("game_state")?.timeRemaining || 30000,
      suspicionLevels:
        persistentContext?.data.get("game_state")?.suspicionLevels || {},
      trustLevels: persistentContext?.data.get("game_state")?.trustLevels || {},
    };

    // Enhance with AI context builder
    return aiContextBuilder.enhanceWithGameHistory(context);
  }

  /**
   * Set AI personality for a player (called by orchestrator)
   */
  setPlayerPersonality(playerId: PlayerId, personality: any): void {
    this.playerPersonalities.set(playerId, personality);
    console.log(
      `🎭 Set personality ${personality.name} for ${playerId.slice(-6)}`
    );
  }

  /**
   * Check if player has active context
   */
  isPlayerContextReady(playerId: PlayerId): boolean {
    return this.persistentContexts.has(playerId);
  }

  /**
   * Clear all context for a player (when they leave)
   */
  clearPlayerContext(playerId: PlayerId): void {
    this.clearActiveContext(playerId);
    this.persistentContexts.delete(playerId);
    this.playerPersonalities.delete(playerId); // 🔥 NEW: Clear personality too
    console.log(`🧹 Cleared all context for player ${playerId.slice(-6)}`);
  }

  /**
   * Get context manager statistics
   */
  getContextStats(): ContextStats {
    return {
      ...this.stats,
      activeContexts: this.activeContexts.size,
      errorRate:
        this.stats.totalTriggers > 0
          ? (this.totalErrors / this.stats.totalTriggers) * 100
          : 0,
    };
  }

  /**
   * Get enhanced debug information
   */
  getDebugInfo(): any {
    return {
      stats: this.getContextStats(),
      activeContexts: Array.from(this.activeContexts.entries()).map(
        ([playerId, context]) => ({
          playerId: playerId.slice(-6),
          contextType: context.contextData.type,
          startTime: context.startTime.toISOString(),
          hasTimeout: !!context.timeoutId,
          hasPromise: !!context.responsePromise,
        })
      ),
      persistentContexts: Array.from(this.persistentContexts.entries()).map(
        ([playerId, context]) => ({
          playerId: playerId.slice(-6),
          dataKeys: Array.from(context.data.keys()),
          lastUpdated: context.lastUpdated.toISOString(),
          hasPersonality: this.playerPersonalities.has(playerId),
        })
      ),
      // 🔥 NEW: AI coordination stats
      aiCoordination: aiCoordinator.getDebugInfo(),
      personalitiesAssigned: this.playerPersonalities.size,
    };
  }

  /**
   * Clear active context for a player
   */
  private clearActiveContext(playerId: PlayerId): void {
    const activeContext = this.activeContexts.get(playerId);
    if (activeContext) {
      // Clear timeout if it exists
      if (activeContext.timeoutId) {
        clearTimeout(activeContext.timeoutId);
      }

      this.activeContexts.delete(playerId);
      this.updateActiveContextsCount();
    }
  }

  /**
   * Handle context timeout
   */
  private handleContextTimeout(playerId: PlayerId): void {
    console.warn(`⏰ Context timeout for player ${playerId.slice(-6)}`);
    this.clearActiveContext(playerId);
    this.stats.totalErrors++;
  }

  /**
   * Update response time statistics
   */
  private updateResponseTimeStats(responseTime: number): void {
    this.totalResponseTime += responseTime;
    const totalResponses = this.stats.totalTriggers - this.totalErrors;
    this.stats.averageResponseTime =
      totalResponses > 0 ? this.totalResponseTime / totalResponses : 0;
  }

  /**
   * Update active contexts count
   */
  private updateActiveContextsCount(): void {
    this.stats.activeContexts = this.activeContexts.size;
  }

  /**
   * 🔥 NEW: Test AI integration for a player
   */
  async testAIIntegration(playerId: PlayerId): Promise<boolean> {
    try {
      const personality = this.getPlayerPersonality(playerId);
      return await aiCoordinator.testCoordination(personality);
    } catch (error) {
      console.error(`❌ AI integration test failed for ${playerId}:`, error);
      return false;
    }
  }

  /**
   * 🔥 NEW: Bulk test AI integration for all players
   */
  async testAllAIIntegrations(): Promise<{
    tested: number;
    passed: number;
    failed: number;
  }> {
    const results = { tested: 0, passed: 0, failed: 0 };

    for (const playerId of this.persistentContexts.keys()) {
      results.tested++;
      const success = await this.testAIIntegration(playerId);
      if (success) {
        results.passed++;
      } else {
        results.failed++;
      }
    }

    console.log(`🧪 AI integration test results:`, results);
    return results;
  }

  /**
   * Cleanup old contexts (maintenance function)
   */
  cleanup(): void {
    // Clear all active contexts
    for (const [playerId] of this.activeContexts.entries()) {
      this.clearActiveContext(playerId);
    }

    // Clear all persistent contexts
    this.persistentContexts.clear();
    this.playerPersonalities.clear(); // 🔥 NEW: Clear personalities

    console.log("🧹 ContextManager cleanup completed with AI integration");
  }
}

// Export singleton instance
export const contextManager = new ContextManager();
