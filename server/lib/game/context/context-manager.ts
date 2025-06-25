// server/lib/game/context/context-manager.ts - Revolutionary Context System
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
}

export class ContextManager implements ContextManagerInterface {
  private activeContexts: Map<PlayerId, ActiveContext> = new Map();
  private persistentContexts: Map<PlayerId, PlayerPersistentContext> =
    new Map();
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
    console.log(
      "🧠 ContextManager initialized - trigger/update/push system ready"
    );
  }

  /**
   * 🔥 TRIGGER: Temporary context for specific AI (your turn to speak)
   * Returns promise that resolves when AI responds
   */
  async trigger(
    playerId: PlayerId,
    context: TemporaryContextData
  ): Promise<AIResponse> {
    console.log(`🎯 TRIGGER: ${playerId} → ${context.type}`);

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
      // Create response promise (stub for now)
      const responsePromise = this.generateAIResponse(playerId, context);
      activeContext.responsePromise = responsePromise;

      const response = await responsePromise;

      // Calculate response time
      const responseTime = Date.now() - startTime.getTime();
      this.updateResponseTimeStats(responseTime);

      // Clear context after successful response
      this.clearActiveContext(playerId);

      console.log(
        `✅ TRIGGER completed: ${playerId} responded in ${responseTime}ms`
      );
      return response;
    } catch (error) {
      console.error(`❌ TRIGGER failed for ${playerId}:`, error);
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
   * Stores information that persists across turns
   */
  update(playerId: PlayerId, context: PersistentContextData): void {
    console.log(`🔄 UPDATE: ${playerId} → ${context.type}`);

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

    console.log(
      `✅ UPDATE completed: ${playerId} context ${context.type} updated`
    );
  }

  /**
   * 📢 PUSH: Broadcast to ALL AIs simultaneously
   * Sends the same context to all players
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

    console.log(
      `✅ PUSH completed: ${context.type} sent to ${targetPlayers.length} players`
    );
  }

  /**
   * Build comprehensive context for a player
   */
  buildPlayerContext(playerId: PlayerId): AIDecisionContext {
    const persistentContext = this.persistentContexts.get(playerId);

    // Build basic context structure (stub implementation)
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

    return context;
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
    console.log(`🧹 Cleared all context for player ${playerId}`);
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
   * Get detailed debug information
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
        })
      ),
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
    console.warn(`⏰ Context timeout for player ${playerId}`);
    this.clearActiveContext(playerId);
    this.stats.totalErrors++;
  }

  /**
   * Generate AI response (stub implementation for now)
   */
  private async generateAIResponse(
    playerId: PlayerId,
    context: TemporaryContextData
  ): Promise<AIResponse> {
    // For now, return a stub response
    // In later commits, this will integrate with the real AI system

    await new Promise((resolve) =>
      setTimeout(resolve, 1000 + Math.random() * 2000)
    );

    const responses = {
      discussion_turn: [
        "I think we need to analyze everyone's behavior carefully.",
        "Something about the voting patterns seems suspicious to me.",
        "I'm not ready to make accusations yet, but I'm watching.",
        "Let me consider what everyone has said so far.",
      ],
      voting_turn: [
        "I'm voting based on my analysis of the discussion.",
        "My vote goes to the player who seemed most suspicious.",
        "This is a difficult decision, but I have to choose.",
      ],
      night_action: [
        "Making my strategic decision for tonight.",
        "Considering all the information from today's discussion.",
      ],
    };

    const messagePool = responses[context.type] || responses.discussion_turn;
    const message = messagePool[Math.floor(Math.random() * messagePool.length)];

    return {
      content: message,
      confidence: 0.7,
      metadata: {
        model: "stub" as any,
        tokensUsed: 50,
        responseTime: 1500,
        cost: 0.001,
        timestamp: new Date(),
      },
    };
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
   * Cleanup old contexts (maintenance function)
   */
  cleanup(): void {
    // Clear all active contexts
    for (const [playerId] of this.activeContexts.entries()) {
      this.clearActiveContext(playerId);
    }

    // Clear all persistent contexts
    this.persistentContexts.clear();

    console.log("🧹 ContextManager cleanup completed");
  }
}

// Export singleton instance
export const contextManager = new ContextManager();
