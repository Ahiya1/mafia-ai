// server/lib/game/context/ai-context-builder.ts - Builds AI Contexts
import { PlayerId, PlayerRole, GamePhase } from "../../types/game";
import {
  AIContextBuilderInterface,
  AIDecisionContext,
  ValidationResult,
} from "../../types/ai";

export interface ContextBuildingStats {
  totalContextsBuilt: number;
  averageBuildTime: number;
  enhancementUsage: Record<string, number>;
  validationErrors: number;
}

interface GameStateData {
  phase: GamePhase;
  round: number;
  livingPlayers: PlayerId[];
  eliminatedPlayers: PlayerId[];
  gameHistory: string[];
  timeRemaining: number;
}

interface PlayerStateData {
  playerId: PlayerId;
  role: PlayerRole;
  isAlive: boolean;
  suspicionLevel: number;
  trustLevel: number;
}

export class AIContextBuilder implements AIContextBuilderInterface {
  private gameStateData: GameStateData | null = null;
  private playerStates: Map<PlayerId, PlayerStateData> = new Map();
  private suspicionMatrix: Map<PlayerId, Map<PlayerId, number>> = new Map();
  private gameHistoryBuffer: string[] = [];

  private stats: ContextBuildingStats = {
    totalContextsBuilt: 0,
    averageBuildTime: 0,
    enhancementUsage: {},
    validationErrors: 0,
  };
  private totalBuildTime: number = 0;

  constructor() {
    console.log("🏗️ AIContextBuilder initialized");
  }

  /**
   * Build context for discussion phase
   */
  buildDiscussionContext(playerId: PlayerId): AIDecisionContext {
    const startTime = Date.now();

    const baseContext = this.buildBaseContext(playerId);
    const enhancedContext = this.enhanceWithGameHistory(baseContext);

    // Add discussion-specific enhancements
    enhancedContext.gameHistory = this.getRecentMessages(10);

    this.recordBuildTime(Date.now() - startTime);
    this.incrementEnhancementUsage("discussion");

    console.log(`💬 Built discussion context for ${playerId.slice(-6)}`);
    return enhancedContext;
  }

  /**
   * Build context for voting phase
   */
  buildVotingContext(playerId: PlayerId): AIDecisionContext {
    const startTime = Date.now();

    const baseContext = this.buildBaseContext(playerId);
    let enhancedContext = this.enhanceWithGameHistory(baseContext);
    enhancedContext = this.enhanceWithSuspicionData(enhancedContext);

    // Add voting-specific data
    enhancedContext.previousVotes = this.getPreviousVotingRounds();

    this.recordBuildTime(Date.now() - startTime);
    this.incrementEnhancementUsage("voting");

    console.log(`🗳️ Built voting context for ${playerId.slice(-6)}`);
    return enhancedContext;
  }

  /**
   * Build context for night action phase
   */
  buildNightActionContext(playerId: PlayerId): AIDecisionContext {
    const startTime = Date.now();

    const baseContext = this.buildBaseContext(playerId);
    let enhancedContext = this.enhanceWithPlayerStatus(baseContext);
    enhancedContext = this.enhanceWithSuspicionData(enhancedContext);

    // Add night-specific data
    enhancedContext.gameHistory = this.getStrategicHistory();

    this.recordBuildTime(Date.now() - startTime);
    this.incrementEnhancementUsage("night_action");

    console.log(`🌙 Built night action context for ${playerId.slice(-6)}`);
    return enhancedContext;
  }

  /**
   * Enhance context with game history
   */
  enhanceWithGameHistory(context: AIDecisionContext): AIDecisionContext {
    const enhanced = { ...context };

    // Get phase-appropriate history
    enhanced.gameHistory = this.gameHistoryBuffer.slice(-8);

    // Add conversation flow analysis
    enhanced.eliminationHistory = this.buildEliminationHistory();

    this.incrementEnhancementUsage("game_history");
    return enhanced;
  }

  /**
   * Enhance context with suspicion data
   */
  enhanceWithSuspicionData(context: AIDecisionContext): AIDecisionContext {
    const enhanced = { ...context };

    // Build suspicion levels for this player
    const playerSuspicions = this.suspicionMatrix.get(context.playerId);
    enhanced.suspicionLevels = {};
    enhanced.trustLevels = {};

    for (const targetId of context.livingPlayers) {
      if (targetId !== context.playerId) {
        enhanced.suspicionLevels[targetId] =
          playerSuspicions?.get(targetId) || 5;
        enhanced.trustLevels[targetId] =
          10 - enhanced.suspicionLevels[targetId];
      }
    }

    this.incrementEnhancementUsage("suspicion_data");
    return enhanced;
  }

  /**
   * Enhance context with player status information
   */
  enhanceWithPlayerStatus(context: AIDecisionContext): AIDecisionContext {
    const enhanced = { ...context };

    // Add detailed player status
    enhanced.playerStatus = {};
    for (const playerId of context.livingPlayers) {
      const playerState = this.playerStates.get(playerId);
      if (playerState) {
        enhanced.playerStatus[playerId] = {
          isAlive: playerState.isAlive,
          suspicionLevel: playerState.suspicionLevel,
          trustLevel: playerState.trustLevel,
        };
      }
    }

    this.incrementEnhancementUsage("player_status");
    return enhanced;
  }

  /**
   * Validate context completeness and correctness
   */
  validateContext(context: AIDecisionContext): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Required fields validation
    if (!context.playerId) errors.push("Missing playerId");
    if (!context.role) errors.push("Missing role");
    if (!context.phase) errors.push("Missing phase");
    if (context.round < 0) errors.push("Invalid round number");

    // Data consistency validation
    if (context.livingPlayers.includes(context.playerId) === false) {
      errors.push("Player not in living players list");
    }

    if (context.eliminatedPlayers.includes(context.playerId)) {
      errors.push("Player is in eliminated players list");
    }

    // Phase-specific validation
    if (context.phase === GamePhase.VOTING && !context.previousVotes) {
      warnings.push("No previous votes data for voting phase");
    }

    if (context.phase === GamePhase.NIGHT && !context.suspicionLevels) {
      warnings.push("No suspicion data for night phase");
    }

    if (errors.length > 0) {
      this.stats.validationErrors++;
    }

    const isValid = errors.length === 0;
    console.log(
      `✅ Context validation: ${
        isValid ? "PASSED" : "FAILED"
      } for ${context.playerId.slice(-6)}`
    );

    return { isValid, errors, warnings };
  }

  /**
   * Get context building statistics
   */
  getContextBuildingStats(): ContextBuildingStats {
    return {
      ...this.stats,
      averageBuildTime:
        this.stats.totalContextsBuilt > 0
          ? this.totalBuildTime / this.stats.totalContextsBuilt
          : 0,
    };
  }

  /**
   * Update game state data (called by orchestrator)
   */
  updateGameState(gameState: GameStateData): void {
    this.gameStateData = gameState;
    console.log(
      `🔄 Updated game state: ${gameState.phase} round ${gameState.round}`
    );
  }

  /**
   * Update player state (called by orchestrator)
   */
  updatePlayerState(playerId: PlayerId, playerState: PlayerStateData): void {
    this.playerStates.set(playerId, playerState);
  }

  /**
   * Add message to game history
   */
  addGameHistoryMessage(message: string): void {
    this.gameHistoryBuffer.push(message);

    // Keep buffer manageable
    if (this.gameHistoryBuffer.length > 50) {
      this.gameHistoryBuffer = this.gameHistoryBuffer.slice(-30);
    }
  }

  /**
   * Update suspicion matrix
   */
  updateSuspicionLevel(
    suspectorId: PlayerId,
    suspectedId: PlayerId,
    level: number
  ): void {
    if (!this.suspicionMatrix.has(suspectorId)) {
      this.suspicionMatrix.set(suspectorId, new Map());
    }

    this.suspicionMatrix.get(suspectorId)!.set(suspectedId, level);
  }

  /**
   * Clear all context data (cleanup)
   */
  clearAllContexts(): void {
    this.gameStateData = null;
    this.playerStates.clear();
    this.suspicionMatrix.clear();
    this.gameHistoryBuffer = [];

    console.log("🧹 AIContextBuilder cleared all contexts");
  }

  /**
   * Build base context structure
   */
  private buildBaseContext(playerId: PlayerId): AIDecisionContext {
    const playerState = this.playerStates.get(playerId);
    const gameState = this.gameStateData;

    if (!playerState || !gameState) {
      throw new Error(`Missing data for player ${playerId}`);
    }

    return {
      playerId,
      role: playerState.role,
      phase: gameState.phase,
      round: gameState.round,
      gameHistory: [],
      livingPlayers: gameState.livingPlayers,
      eliminatedPlayers: gameState.eliminatedPlayers,
      previousVotes: [],
      timeRemaining: gameState.timeRemaining,
      suspicionLevels: {},
      trustLevels: {},
    };
  }

  /**
   * Get recent messages for context
   */
  private getRecentMessages(count: number): string[] {
    return this.gameHistoryBuffer.slice(-count);
  }

  /**
   * Get strategic history (eliminations, major events)
   */
  private getStrategicHistory(): string[] {
    return this.gameHistoryBuffer
      .filter(
        (message) =>
          message.includes("eliminated") ||
          message.includes("voted") ||
          message.includes("suspicious")
      )
      .slice(-5);
  }

  /**
   * Build elimination history for context
   */
  private buildEliminationHistory(): any[] {
    const gameState = this.gameStateData;
    if (!gameState) return [];

    return gameState.eliminatedPlayers.map((playerId, index) => ({
      round: index + 1,
      playerId,
      method: index % 2 === 0 ? "voted_out" : "mafia_kill",
    }));
  }

  /**
   * Get previous voting rounds data
   */
  private getPreviousVotingRounds(): { round: number; votes: any[] }[] {
    // Stub implementation - in real system would get from game state
    return [
      {
        round: this.gameStateData?.round || 1,
        votes: [], // Would contain actual vote data
      },
    ];
  }

  /**
   * Record build time for statistics
   */
  private recordBuildTime(buildTime: number): void {
    this.stats.totalContextsBuilt++;
    this.totalBuildTime += buildTime;
  }

  /**
   * Increment enhancement usage counter
   */
  private incrementEnhancementUsage(enhancement: string): void {
    this.stats.enhancementUsage[enhancement] =
      (this.stats.enhancementUsage[enhancement] || 0) + 1;
  }

  /**
   * Get debug information
   */
  getDebugInfo(): any {
    return {
      stats: this.getContextBuildingStats(),
      gameState: this.gameStateData,
      playerStatesCount: this.playerStates.size,
      suspicionMatrixSize: this.suspicionMatrix.size,
      gameHistoryLength: this.gameHistoryBuffer.length,
      recentHistory: this.gameHistoryBuffer.slice(-5),
    };
  }
}

// Export singleton instance
export const aiContextBuilder = new AIContextBuilder();
