// src/lib/game/state.ts - FIXED: Enhanced Observer Data Persistence
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
  // FIXED: Added enhanced fields for better observer experience
  playerName?: string;
  playerType?: string;
  playerModel?: string;
  playerRole?: string;
  round?: number;
  context?: any;
}

// FIXED: Enhanced serializable observer data structure
export interface SerializableObserverData {
  observerUpdates: Array<{
    type: string;
    content: string;
    playerId: string;
    timestamp: string;
    phase: string;
    playerName?: string;
    playerType?: string;
    playerModel?: string;
    playerRole?: string;
    round?: number;
    context?: any;
  }>;
  suspicionMatrix: Record<string, Record<string, number>>;
  gameAnalytics: any;
  phaseHistory: Array<{
    phase: string;
    timestamp: string;
    round: number;
    duration?: number;
    actions?: number;
  }>;
}

export class GameStateManager extends EventEmitter {
  private gameState: GameState;
  private snapshots: GameStateSnapshot[] = [];
  private actionLog: PlayerActionLog[] = [];
  private observerUpdates: ObserverUpdate[] = [];
  private playerSuspicionMatrix: Map<PlayerId, Map<PlayerId, number>> =
    new Map();
  private phaseActionCounts: Map<GamePhase, number> = new Map();
  // FIXED: Added phase history tracking for observer persistence
  private phaseHistory: Array<{
    phase: GamePhase;
    timestamp: Date;
    round: number;
    duration?: number;
    actions?: number;
  }> = [];

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
      playerModel: player.model,
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

    // FIXED: Add enhanced observer update for spectators
    this.addObserverUpdate({
      type: action.action === "kill" ? "private_action" : "private_action",
      content: this.formatNightActionForObservers(action, player),
      playerId: action.playerId,
      timestamp: new Date(),
      phase: this.gameState.phase,
      playerName: player.name,
      playerType: player.type,
      playerModel: player.model,
      playerRole: player.role,
      round: this.gameState.currentRound,
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
      playerName: player.name,
    });

    // FIXED: Add observer update for elimination
    this.addObserverUpdate({
      type: "private_action",
      content: `💀 ${player.name} (${player.role}) was eliminated by ${
        cause === "voted_out" ? "voting" : "mafia"
      }`,
      playerId: playerId,
      timestamp: new Date(),
      phase: this.gameState.phase,
      playerName: player.name,
      playerType: player.type,
      playerRole: player.role,
      round: this.gameState.currentRound,
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
        model: p.model,
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
   * FIXED: Enhanced observer state with complete serializable data
   */
  getObserverGameState(): SerializableObserverData {
    const state = this.getGameState();

    return {
      observerUpdates: this.observerUpdates.map((update) => ({
        type: update.type,
        content: update.content,
        playerId: update.playerId,
        timestamp: update.timestamp.toISOString(),
        phase: update.phase,
        playerName: update.playerName,
        playerType: update.playerType,
        playerModel: update.playerModel,
        playerRole: update.playerRole,
        round: update.round,
        context: update.context,
      })),
      suspicionMatrix: this.getSuspicionMatrixForObservers(),
      gameAnalytics: this.getGameAnalytics(),
      phaseHistory: this.phaseHistory.map((phase) => ({
        phase: phase.phase,
        timestamp: phase.timestamp.toISOString(),
        round: phase.round,
        duration: phase.duration,
        actions: phase.actions,
      })),
    };
  }

  /**
   * FIXED: Enhanced observer update with complete player context
   */
  addObserverUpdate(update: ObserverUpdate): void {
    // Ensure player information is included
    const player = this.gameState.players.get(update.playerId);
    const enhancedUpdate: ObserverUpdate = {
      ...update,
      playerName: player?.name || update.playerName,
      playerType: player?.type || update.playerType,
      playerModel: player?.model || update.playerModel,
      playerRole: player?.role || update.playerRole,
      round: this.gameState.currentRound,
      context: {
        phase: this.gameState.phase,
        round: this.gameState.currentRound,
        alivePlayers: Array.from(this.gameState.players.values()).filter(
          (p) => p.isAlive
        ).length,
        totalPlayers: this.gameState.players.size,
        ...update.context,
      },
    };

    this.observerUpdates.push(enhancedUpdate);

    // Keep only recent updates (last 100 for performance)
    if (this.observerUpdates.length > 100) {
      this.observerUpdates = this.observerUpdates.slice(-100);
    }

    this.emit("observer_update", { update: enhancedUpdate });
  }

  /**
   * FIXED: Add mafia coordination message with enhanced context
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
   * FIXED: Add healer reasoning with enhanced context
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
   * FIXED: Add AI reasoning with enhanced context
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
   * FIXED: Serialize observer data for persistence
   */
  serializeObserverData(): string {
    try {
      const data = this.getObserverGameState();
      return JSON.stringify(data);
    } catch (error) {
      console.error("Failed to serialize observer data:", error);
      return JSON.stringify({
        observerUpdates: [],
        suspicionMatrix: {},
        gameAnalytics: {},
        phaseHistory: [],
      });
    }
  }

  /**
   * FIXED: Deserialize observer data from persistence
   */
  deserializeObserverData(serializedData: string): boolean {
    try {
      const data: SerializableObserverData = JSON.parse(serializedData);

      // Restore observer updates
      this.observerUpdates = data.observerUpdates.map((update) => ({
        type: update.type as any,
        content: update.content,
        playerId: update.playerId,
        timestamp: new Date(update.timestamp),
        phase: update.phase as GamePhase,
        playerName: update.playerName,
        playerType: update.playerType,
        playerModel: update.playerModel,
        playerRole: update.playerRole,
        round: update.round,
        context: update.context,
      }));

      // Restore phase history
      this.phaseHistory = data.phaseHistory.map((phase) => ({
        phase: phase.phase as GamePhase,
        timestamp: new Date(phase.timestamp),
        round: phase.round,
        duration: phase.duration,
        actions: phase.actions,
      }));

      console.log(
        `✅ Restored ${this.observerUpdates.length} observer updates and ${this.phaseHistory.length} phase history entries`
      );
      return true;
    } catch (error) {
      console.error("Failed to deserialize observer data:", error);
      return false;
    }
  }

  /**
   * FIXED: Merge observer data from external source (for observer rejoin)
   */
  mergeObserverData(externalData: SerializableObserverData): void {
    try {
      // Merge observer updates (avoid duplicates by timestamp)
      const existingTimestamps = new Set(
        this.observerUpdates.map((u) => u.timestamp.toISOString())
      );

      const newUpdates = externalData.observerUpdates
        .filter((update) => !existingTimestamps.has(update.timestamp))
        .map((update) => ({
          type: update.type as any,
          content: update.content,
          playerId: update.playerId,
          timestamp: new Date(update.timestamp),
          phase: update.phase as GamePhase,
          playerName: update.playerName,
          playerType: update.playerType,
          playerModel: update.playerModel,
          playerRole: update.playerRole,
          round: update.round,
          context: update.context,
        }));

      this.observerUpdates.push(...newUpdates);
      this.observerUpdates.sort(
        (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
      );

      // Keep reasonable limit
      if (this.observerUpdates.length > 100) {
        this.observerUpdates = this.observerUpdates.slice(-100);
      }

      console.log(`✅ Merged ${newUpdates.length} new observer updates`);
    } catch (error) {
      console.error("Failed to merge observer data:", error);
    }
  }

  /**
   * Get action log for analytics
   */
  getActionLog(): PlayerActionLog[] {
    return [...this.actionLog];
  }

  /**
   * Get observer updates (with optional filtering)
   */
  getObserverUpdates(type?: string, limit?: number): ObserverUpdate[] {
    let updates = [...this.observerUpdates];

    if (type) {
      updates = updates.filter((update) => update.type === type);
    }

    if (limit) {
      updates = updates.slice(-limit);
    }

    return updates;
  }

  /**
   * FIXED: Enhanced game analytics with more detailed insights
   */
  getGameAnalytics(): any {
    const players = Array.from(this.gameState.players.values());
    const aiPlayers = players.filter((p) => p.type === PlayerType.AI);
    const humanPlayers = players.filter((p) => p.type === PlayerType.HUMAN);

    const currentPhase = this.phaseHistory[this.phaseHistory.length - 1];
    const phaseDuration = currentPhase
      ? Date.now() - currentPhase.timestamp.getTime()
      : 0;

    return {
      gameId: this.gameState.id,
      duration: this.gameState.phaseStartTime
        ? Date.now() - this.gameState.phaseStartTime.getTime()
        : 0,
      currentPhaseDuration: phaseDuration,
      rounds: this.gameState.currentRound,
      currentPhase: this.gameState.phase,
      totalMessages: this.gameState.messages.length,
      totalVotes: this.gameState.votes.length,
      totalNightActions: this.gameState.nightActions.length,
      eliminations: this.gameState.eliminatedPlayers.length,
      observerUpdates: this.observerUpdates.length,
      playerStats: {
        total: players.length,
        ai: aiPlayers.length,
        human: humanPlayers.length,
        alive: players.filter((p) => p.isAlive).length,
        eliminated: players.filter((p) => !p.isAlive).length,
      },
      aiModelDistribution: this.getAIModelDistribution(aiPlayers),
      phaseStats: this.getPhaseStatistics(),
      playerActivity: this.getPlayerActivityStats(),
      suspicionAnalytics: this.getSuspicionAnalytics(),
      roleDistribution: this.getRoleDistribution(players),
    };
  }

  /**
   * Initialize tracking data for the game
   */
  private initializeTrackingData(): void {
    this.snapshots = [];
    this.actionLog = [];
    this.observerUpdates = [];
    this.phaseHistory = [];
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

    // Increment phase action count
    const currentCount = this.phaseActionCounts.get(this.gameState.phase) || 0;
    this.phaseActionCounts.set(this.gameState.phase, currentCount + 1);

    // Keep action log manageable
    if (this.actionLog.length > 1000) {
      this.actionLog = this.actionLog.slice(-500);
    }
  }

  /**
   * FIXED: Enhanced phase change handling with history tracking
   */
  private onPhaseChange(oldPhase: GamePhase, newPhase: GamePhase): void {
    const actionCount = this.phaseActionCounts.get(oldPhase) || 0;
    console.log(`📊 Phase analytics: ${oldPhase} had ${actionCount} actions`);

    // Record phase in history
    if (this.phaseHistory.length > 0) {
      const lastPhase = this.phaseHistory[this.phaseHistory.length - 1];
      lastPhase.duration = Date.now() - lastPhase.timestamp.getTime();
      lastPhase.actions = actionCount;
    }

    // Add new phase to history
    this.phaseHistory.push({
      phase: newPhase,
      timestamp: new Date(),
      round: this.gameState.currentRound,
    });

    // Initialize action count for new phase
    this.phaseActionCounts.set(newPhase, 0);

    // Add phase change observer update
    this.addObserverUpdate({
      type: "private_action",
      content: `🔄 Phase changed from ${oldPhase} to ${newPhase} (Round ${this.gameState.currentRound})`,
      playerId: "system",
      timestamp: new Date(),
      phase: newPhase,
      playerName: "System",
      playerType: "system",
    });
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
      return `🔪 ${player.name} (Mafia) is planning to eliminate ${targetName}`;
    } else if (action.action === "heal") {
      return `🛡️ ${player.name} (Healer) is planning to protect ${targetName}`;
    }

    return `🌙 ${player.name} is taking a night action`;
  }

  /**
   * Get suspicion matrix for observers
   */
  private getSuspicionMatrixForObservers(): Record<
    string,
    Record<string, number>
  > {
    const matrix: Record<string, Record<string, number>> = {};

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
  /**
   * Get phase statistics - FIXED: Proper object handling
   */
  private getPhaseStatistics(): Record<string, any> {
    const phaseStats: Record<string, any> = {};

    // Initialize all phases as objects first
    for (const [phase, count] of this.phaseActionCounts.entries()) {
      phaseStats[phase] = {
        actionCount: count,
        duration: 0,
        actions: 0,
      };
    }

    // Add phase duration statistics
    for (const phaseEntry of this.phaseHistory) {
      const phaseKey = phaseEntry.phase;
      if (!phaseStats[phaseKey]) {
        phaseStats[phaseKey] = {
          actionCount: 0,
          duration: 0,
          actions: 0,
        };
      }
      // Now these will work because phaseStats[phaseKey] is an object
      phaseStats[phaseKey].duration = phaseEntry.duration;
      phaseStats[phaseKey].actions = phaseEntry.actions;
    }

    return phaseStats;
  }

  /**
   * Get player activity statistics
   */
  private getPlayerActivityStats(): Record<string, any> {
    const stats: Record<string, any> = {};

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
        suspicionLevel: this.getPlayerSuspicionLevel(playerId),
        trustLevel: this.getPlayerTrustLevel(playerId),
      };
    }

    return stats;
  }

  /**
   * FIXED: New method to get AI model distribution
   */
  private getAIModelDistribution(aiPlayers: Player[]): Record<string, number> {
    const distribution: Record<string, number> = {};

    for (const player of aiPlayers) {
      if (player.model) {
        distribution[player.model] = (distribution[player.model] || 0) + 1;
      }
    }

    return distribution;
  }

  /**
   * FIXED: New method to get suspicion analytics
   */
  private getSuspicionAnalytics(): any {
    const suspicionLevels: Record<string, number> = {};
    const trustLevels: Record<string, number> = {};

    for (const [playerId, player] of this.gameState.players.entries()) {
      suspicionLevels[player.name] = this.getPlayerSuspicionLevel(playerId);
      trustLevels[player.name] = this.getPlayerTrustLevel(playerId);
    }

    return {
      suspicionLevels,
      trustLevels,
      averageSuspicion:
        Object.values(suspicionLevels).reduce((a, b) => a + b, 0) /
          Object.values(suspicionLevels).length || 0,
      averageTrust:
        Object.values(trustLevels).reduce((a, b) => a + b, 0) /
          Object.values(trustLevels).length || 0,
    };
  }

  /**
   * FIXED: New method to get role distribution
   */
  private getRoleDistribution(players: Player[]): Record<string, number> {
    const distribution: Record<string, number> = {};

    for (const player of players) {
      if (player.role) {
        distribution[player.role] = (distribution[player.role] || 0) + 1;
      }
    }

    return distribution;
  }

  /**
   * Clean up state manager
   */
  cleanup(): void {
    this.removeAllListeners();
    this.snapshots = [];
    this.actionLog = [];
    this.observerUpdates = [];
    this.phaseHistory = [];
    this.playerSuspicionMatrix.clear();
    this.phaseActionCounts.clear();
  }
}
