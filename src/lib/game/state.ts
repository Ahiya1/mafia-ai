// src/lib/game/state.ts - Enhanced State Management for AI Mafia
import { EventEmitter } from "events";
import {
  GameState,
  Player,
  PlayerId,
  PlayerRole,
  GamePhase,
  Vote,
  Message,
  NightAction,
  GameEvent,
  PlayerType,
} from "../../types/game";

export interface GameStateSnapshot {
  timestamp: Date;
  round: number;
  phase: GamePhase;
  playerCount: number;
  eliminationCount: number;
  actionsSinceSnapshot: number;
}

export interface PlayerActionLog {
  playerId: PlayerId;
  action: string;
  timestamp: Date;
  phase: GamePhase;
  round: number;
  details?: any;
}

export interface ObserverUpdate {
  type: "mafia_chat" | "healer_thoughts" | "private_action" | "ai_reasoning";
  content: string;
  playerId: PlayerId;
  timestamp: Date;
  phase: GamePhase;
}

export class GameStateManager extends EventEmitter {
  private gameState: GameState;
  private snapshots: GameStateSnapshot[] = [];
  private actionLog: PlayerActionLog[] = [];
  private observerUpdates: ObserverUpdate[] = [];
  private playerSuspicionMatrix: Map<PlayerId, Map<PlayerId, number>> =
    new Map();
  private phaseActionCounts: Map<GamePhase, number> = new Map();

  constructor(gameState: GameState) {
    super();
    this.gameState = { ...gameState };
    this.initializeTrackingData();
  }

  /**
   * Update game state and track changes
   */
  updateGameState(newState: Partial<GameState>): GameState {
    const oldPhase = this.gameState.phase;
    const oldRound = this.gameState.currentRound;

    // Merge state updates
    this.gameState = {
      ...this.gameState,
      ...newState,
      players: newState.players || this.gameState.players,
    };

    // Track significant state changes
    if (newState.phase && newState.phase !== oldPhase) {
      this.onPhaseChange(oldPhase, newState.phase);
    }

    if (newState.currentRound && newState.currentRound !== oldRound) {
      this.onRoundChange(oldRound, newState.currentRound);
    }

    // Create snapshot if significant changes occurred
    if (this.shouldCreateSnapshot(newState)) {
      this.createSnapshot();
    }

    this.emit("state_updated", {
      changes: newState,
      oldPhase,
      oldRound,
      timestamp: new Date(),
    });

    return this.getGameState();
  }

  /**
   * Add player to game with enhanced tracking
   */
  addPlayer(player: Player): boolean {
    if (this.gameState.players.has(player.id)) {
      return false;
    }

    // Add player to state
    this.gameState.players.set(player.id, { ...player });

    // Initialize tracking for this player
    this.initializePlayerTracking(player);

    this.logAction(player.id, "player_joined", {
      playerType: player.type,
      playerName: player.name,
    });

    this.emit("player_added", { player });
    return true;
  }

  /**
   * Remove player with cleanup
   */
  removePlayer(playerId: PlayerId): boolean {
    const player = this.gameState.players.get(playerId);
    if (!player) {
      return false;
    }

    // Remove from state
    this.gameState.players.delete(playerId);

    // Clean up tracking data
    this.cleanupPlayerTracking(playerId);

    this.logAction(playerId, "player_left", {
      playerName: player.name,
      wasAlive: player.isAlive,
    });

    this.emit("player_removed", { playerId, player });
    return true;
  }

  /**
   * Add message with enhanced tracking
   */
  addMessage(message: Message): void {
    this.gameState.messages.push({ ...message });

    // Track message for AI analysis
    this.logAction(message.playerId, "message_sent", {
      content: message.content,
      phase: message.phase,
      messageType: message.messageType,
      contentLength: message.content.length,
    });

    // Update suspicion patterns based on message content
    this.analyzeSuspicionInMessage(message);

    this.emit("message_added", { message });
  }

  /**
   * Add vote with validation and tracking
   */
  addVote(vote: Vote): boolean {
    const voter = this.gameState.players.get(vote.voterId);
    const target = this.gameState.players.get(vote.targetId);

    if (!voter || !target || !voter.isAlive || !target.isAlive) {
      return false;
    }

    // Remove any existing vote from this player
    this.gameState.votes = this.gameState.votes.filter(
      (v) => v.voterId !== vote.voterId
    );

    // Add new vote
    this.gameState.votes.push({ ...vote });

    this.logAction(vote.voterId, "vote_cast", {
      targetId: vote.targetId,
      targetName: target.name,
      reasoning: vote.reasoning,
      voteCount: this.gameState.votes.length,
    });

    // Update suspicion matrix
    this.updateSuspicionMatrix(vote.voterId, vote.targetId, 8); // High suspicion for voting

    this.emit("vote_added", { vote });
    return true;
  }

  /**
   * Add night action with enhanced logging
   */
  addNightAction(action: NightAction): boolean {
    const player = this.gameState.players.get(action.playerId);
    if (!player || !player.isAlive) {
      return false;
    }

    // Validate action based on role
    if (action.action === "kill" && player.role !== PlayerRole.MAFIA_LEADER) {
      return false;
    }
    if (action.action === "heal" && player.role !== PlayerRole.HEALER) {
      return false;
    }

    // Remove existing action from this player
    this.gameState.nightActions = this.gameState.nightActions.filter(
      (a) => a.playerId !== action.playerId
    );

    // Add new action
    this.gameState.nightActions.push({ ...action });

    this.logAction(action.playerId, "night_action", {
      action: action.action,
      targetId: action.targetId,
      targetName: action.targetId
        ? this.gameState.players.get(action.targetId)?.name
        : undefined,
    });

    // Add observer update for spectators
    this.addObserverUpdate({
      type: action.action === "kill" ? "private_action" : "private_action",
      content: this.formatNightActionForObservers(action, player),
      playerId: action.playerId,
      timestamp: new Date(),
      phase: this.gameState.phase,
    });

    this.emit("night_action_added", { action });
    return true;
  }

  /**
   * Eliminate player with comprehensive tracking
   */
  eliminatePlayer(
    playerId: PlayerId,
    cause: "voted_out" | "mafia_kill"
  ): boolean {
    const player = this.gameState.players.get(playerId);
    if (!player || !player.isAlive) {
      return false;
    }

    // Update player state
    player.isAlive = false;
    this.gameState.players.set(playerId, player);
    this.gameState.eliminatedPlayers.push(playerId);

    this.logAction(playerId, "player_eliminated", {
      cause,
      role: player.role,
      round: this.gameState.currentRound,
      phase: this.gameState.phase,
    });

    // Update suspicion patterns based on elimination
    this.onPlayerElimination(playerId, cause);

    this.emit("player_eliminated", { playerId, player, cause });
    return true;
  }

  /**
   * Get comprehensive game state for different audiences
   */
  getGameState(): GameState {
    return {
      ...this.gameState,
      players: new Map(this.gameState.players),
      votes: [...this.gameState.votes],
      messages: [...this.gameState.messages],
      nightActions: [...this.gameState.nightActions],
      eliminatedPlayers: [...this.gameState.eliminatedPlayers],
      gameHistory: [...this.gameState.gameHistory],
    };
  }

  /**
   * Get sanitized state for specific player (hiding secret information)
   */
  getPlayerGameState(playerId: PlayerId): any {
    const player = this.gameState.players.get(playerId);
    if (!player) {
      return null;
    }

    const sanitized = {
      ...this.gameState,
      players: Array.from(this.gameState.players.values()).map((p) => ({
        id: p.id,
        name: p.name,
        type: p.type,
        isAlive: p.isAlive,
        isReady: p.isReady,
        lastActive: p.lastActive,
        // Only show role for the requesting player or if game is over
        role:
          p.id === playerId || this.gameState.phase === GamePhase.GAME_OVER
            ? p.role
            : undefined,
      })),
      // Filter night actions to only show player's own actions
      nightActions: this.gameState.nightActions.filter(
        (a) =>
          a.playerId === playerId ||
          this.gameState.phase === GamePhase.GAME_OVER
      ),
    };

    return sanitized;
  }

  /**
   * Get observer state (shows everything for spectators)
   */
  getObserverGameState(): any {
    const state = this.getGameState();

    return {
      ...state,
      players: Array.from(state.players.values()).map((p) => ({
        ...p,
        suspicionLevel: this.getPlayerSuspicionLevel(p.id),
        trustLevel: this.getPlayerTrustLevel(p.id),
        actionCount: this.getPlayerActionCount(p.id),
      })),
      observerUpdates: [...this.observerUpdates],
      suspicionMatrix: this.getSuspicionMatrixForObservers(),
      gameAnalytics: this.getGameAnalytics(),
    };
  }

  /**
   * Add private update for observers (mafia chat, healer thoughts, etc.)
   */
  addObserverUpdate(update: ObserverUpdate): void {
    this.observerUpdates.push({ ...update });

    // Keep only recent updates (last 50)
    if (this.observerUpdates.length > 50) {
      this.observerUpdates = this.observerUpdates.slice(-50);
    }

    this.emit("observer_update", { update });
  }

  /**
   * Add mafia coordination message for observers
   */
  addMafiaChat(mafiaPlayerId: PlayerId, content: string): void {
    this.addObserverUpdate({
      type: "mafia_chat",
      content,
      playerId: mafiaPlayerId,
      timestamp: new Date(),
      phase: this.gameState.phase,
    });
  }

  /**
   * Add healer reasoning for observers
   */
  addHealerThoughts(healerPlayerId: PlayerId, content: string): void {
    this.addObserverUpdate({
      type: "healer_thoughts",
      content,
      playerId: healerPlayerId,
      timestamp: new Date(),
      phase: this.gameState.phase,
    });
  }

  /**
   * Add AI reasoning for observers
   */
  addAIReasoning(aiPlayerId: PlayerId, reasoning: string): void {
    this.addObserverUpdate({
      type: "ai_reasoning",
      content: reasoning,
      playerId: aiPlayerId,
      timestamp: new Date(),
      phase: this.gameState.phase,
    });
  }

  /**
   * Get action log for analytics
   */
  getActionLog(): PlayerActionLog[] {
    return [...this.actionLog];
  }

  /**
   * Get observer updates
   */
  getObserverUpdates(): ObserverUpdate[] {
    return [...this.observerUpdates];
  }

  /**
   * Get game analytics for observers
   */
  getGameAnalytics(): any {
    const players = Array.from(this.gameState.players.values());
    const aiPlayers = players.filter((p) => p.type === PlayerType.AI);
    const humanPlayers = players.filter((p) => p.type === PlayerType.HUMAN);

    return {
      duration: Date.now() - this.gameState.phaseStartTime.getTime(),
      rounds: this.gameState.currentRound,
      totalMessages: this.gameState.messages.length,
      totalVotes: this.gameState.votes.length,
      totalNightActions: this.gameState.nightActions.length,
      eliminations: this.gameState.eliminatedPlayers.length,
      playerStats: {
        total: players.length,
        ai: aiPlayers.length,
        human: humanPlayers.length,
        alive: players.filter((p) => p.isAlive).length,
      },
      phaseStats: this.getPhaseStatistics(),
      playerActivity: this.getPlayerActivityStats(),
    };
  }

  /**
   * Initialize tracking data for the game
   */
  private initializeTrackingData(): void {
    this.snapshots = [];
    this.actionLog = [];
    this.observerUpdates = [];
    this.playerSuspicionMatrix.clear();
    this.phaseActionCounts.clear();
  }

  /**
   * Initialize tracking for a specific player
   */
  private initializePlayerTracking(player: Player): void {
    // Initialize suspicion matrix for this player
    this.playerSuspicionMatrix.set(player.id, new Map());

    // Initialize suspicions for other players
    for (const otherPlayerId of this.gameState.players.keys()) {
      if (otherPlayerId !== player.id) {
        this.updateSuspicionMatrix(player.id, otherPlayerId, 5); // Neutral starting suspicion
        this.updateSuspicionMatrix(otherPlayerId, player.id, 5);
      }
    }
  }

  /**
   * Clean up tracking data for removed player
   */
  private cleanupPlayerTracking(playerId: PlayerId): void {
    this.playerSuspicionMatrix.delete(playerId);

    // Remove from other players' suspicion matrices
    for (const matrix of this.playerSuspicionMatrix.values()) {
      matrix.delete(playerId);
    }
  }

  /**
   * Log player action for analytics
   */
  private logAction(playerId: PlayerId, action: string, details?: any): void {
    this.actionLog.push({
      playerId,
      action,
      timestamp: new Date(),
      phase: this.gameState.phase,
      round: this.gameState.currentRound,
      details,
    });

    // Keep action log manageable
    if (this.actionLog.length > 1000) {
      this.actionLog = this.actionLog.slice(-500);
    }
  }

  /**
   * Handle phase change
   */
  private onPhaseChange(oldPhase: GamePhase, newPhase: GamePhase): void {
    console.log(
      `📊 Phase analytics: ${oldPhase} had ${
        this.phaseActionCounts.get(oldPhase) || 0
      } actions`
    );
    this.phaseActionCounts.set(newPhase, 0);
  }

  /**
   * Handle round change
   */
  private onRoundChange(oldRound: number, newRound: number): void {
    this.createSnapshot();
    console.log(`📊 Round ${oldRound} complete, entering round ${newRound}`);
  }

  /**
   * Determine if a snapshot should be created
   */
  private shouldCreateSnapshot(changes: Partial<GameState>): boolean {
    return !!(
      changes.phase ||
      changes.currentRound ||
      changes.eliminatedPlayers?.length !==
        this.gameState.eliminatedPlayers.length
    );
  }

  /**
   * Create game state snapshot
   */
  private createSnapshot(): void {
    const snapshot: GameStateSnapshot = {
      timestamp: new Date(),
      round: this.gameState.currentRound,
      phase: this.gameState.phase,
      playerCount: this.gameState.players.size,
      eliminationCount: this.gameState.eliminatedPlayers.length,
      actionsSinceSnapshot: 0,
    };

    this.snapshots.push(snapshot);

    // Keep only recent snapshots
    if (this.snapshots.length > 20) {
      this.snapshots = this.snapshots.slice(-10);
    }
  }

  /**
   * Analyze suspicion patterns in messages
   */
  private analyzeSuspicionInMessage(message: Message): void {
    const suspiciousWords = [
      "suspicious",
      "suspect",
      "doubt",
      "mafia",
      "eliminate",
      "vote",
      "trust",
      "innocent",
      "believe",
      "think",
    ];

    const content = message.content.toLowerCase();
    const hasSuspiciousContent = suspiciousWords.some((word) =>
      content.includes(word)
    );

    if (hasSuspiciousContent) {
      // Try to extract mentioned players and update suspicion
      const players = Array.from(this.gameState.players.values());
      for (const player of players) {
        if (
          player.id !== message.playerId &&
          content.includes(player.name.toLowerCase())
        ) {
          const suspicionChange =
            content.includes("trust") || content.includes("innocent") ? -1 : 1;
          this.updateSuspicionMatrix(
            message.playerId,
            player.id,
            5 + suspicionChange
          );
        }
      }
    }
  }

  /**
   * Update suspicion matrix between players
   */
  private updateSuspicionMatrix(
    suspectorId: PlayerId,
    suspectedId: PlayerId,
    level: number
  ): void {
    if (!this.playerSuspicionMatrix.has(suspectorId)) {
      this.playerSuspicionMatrix.set(suspectorId, new Map());
    }

    const matrix = this.playerSuspicionMatrix.get(suspectorId)!;
    matrix.set(suspectedId, Math.max(1, Math.min(10, level)));
  }

  /**
   * Handle player elimination effects on suspicion
   */
  private onPlayerElimination(
    playerId: PlayerId,
    cause: "voted_out" | "mafia_kill"
  ): void {
    if (cause === "voted_out") {
      // Players who voted for the eliminated player might be less suspicious of each other
      const eliminationVotes = this.gameState.votes.filter(
        (v) => v.targetId === playerId
      );
      for (const vote of eliminationVotes) {
        for (const otherVote of eliminationVotes) {
          if (vote.voterId !== otherVote.voterId) {
            this.updateSuspicionMatrix(vote.voterId, otherVote.voterId, 4); // Slightly less suspicious
          }
        }
      }
    }
  }

  /**
   * Format night action for observer display
   */
  private formatNightActionForObservers(
    action: NightAction,
    player: Player
  ): string {
    const targetName = action.targetId
      ? this.gameState.players.get(action.targetId)?.name || "Unknown"
      : "No one";

    if (action.action === "kill") {
      return `${player.name} (Mafia) is planning to eliminate ${targetName}`;
    } else if (action.action === "heal") {
      return `${player.name} (Healer) is planning to protect ${targetName}`;
    }

    return `${player.name} is taking a night action`;
  }

  /**
   * Get suspicion matrix for observers
   */
  private getSuspicionMatrixForObservers(): any {
    const matrix: any = {};

    for (const [
      suspectorId,
      suspicions,
    ] of this.playerSuspicionMatrix.entries()) {
      const suspectorName =
        this.gameState.players.get(suspectorId)?.name || suspectorId;
      matrix[suspectorName] = {};

      for (const [suspectedId, level] of suspicions.entries()) {
        const suspectedName =
          this.gameState.players.get(suspectedId)?.name || suspectedId;
        matrix[suspectorName][suspectedName] = level;
      }
    }

    return matrix;
  }

  /**
   * Get player suspicion level (average of how suspicious others are of them)
   */
  private getPlayerSuspicionLevel(playerId: PlayerId): number {
    let totalSuspicion = 0;
    let count = 0;

    for (const [
      suspectorId,
      suspicions,
    ] of this.playerSuspicionMatrix.entries()) {
      if (suspectorId !== playerId && suspicions.has(playerId)) {
        totalSuspicion += suspicions.get(playerId)!;
        count++;
      }
    }

    return count > 0 ? totalSuspicion / count : 5;
  }

  /**
   * Get player trust level (inverse of suspicion)
   */
  private getPlayerTrustLevel(playerId: PlayerId): number {
    return 10 - this.getPlayerSuspicionLevel(playerId);
  }

  /**
   * Get player action count
   */
  private getPlayerActionCount(playerId: PlayerId): number {
    return this.actionLog.filter((log) => log.playerId === playerId).length;
  }

  /**
   * Get phase statistics
   */
  private getPhaseStatistics(): any {
    const phaseStats: any = {};

    for (const [phase, count] of this.phaseActionCounts.entries()) {
      phaseStats[phase] = count;
    }

    return phaseStats;
  }

  /**
   * Get player activity statistics
   */
  private getPlayerActivityStats(): any {
    const stats: any = {};

    for (const [playerId, player] of this.gameState.players.entries()) {
      const playerActions = this.actionLog.filter(
        (log) => log.playerId === playerId
      );
      stats[player.name] = {
        totalActions: playerActions.length,
        messages: playerActions.filter((a) => a.action === "message_sent")
          .length,
        votes: playerActions.filter((a) => a.action === "vote_cast").length,
        nightActions: playerActions.filter((a) => a.action === "night_action")
          .length,
      };
    }

    return stats;
  }

  /**
   * Clean up state manager
   */
  cleanup(): void {
    this.removeAllListeners();
    this.snapshots = [];
    this.actionLog = [];
    this.observerUpdates = [];
    this.playerSuspicionMatrix.clear();
    this.phaseActionCounts.clear();
  }
}
