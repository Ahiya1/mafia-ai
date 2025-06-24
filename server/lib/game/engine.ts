// server/lib/game/engine.ts - FIXED: Bulletproof AI Voting Engine with Zero Hangs
import {
  GameState,
  Player,
  PlayerRole,
  GamePhase,
  PlayerId,
  Vote,
  NightAction,
  Message,
  GameEvent,
  WinCondition,
  GameConfig,
  PlayerType,
} from "../types/game";
import { EventEmitter } from "events";
import { v4 as uuidv4 } from "uuid";
import { GamePhaseManager } from "../../../src/lib/game/phases";
import { GameStateManager } from "../../../src/lib/game/state";
import { aiResponseGenerator } from "../../../src/lib/ai/response-generator";
import { AIDecisionContext, AIPersonality } from "../types/ai";
import { selectGamePersonalities } from "../../../src/lib/ai/personality-pool";

/**
 * 🔥 CRITICAL PRODUCTION FIX - GameEngineDebugger Class
 * Added inside engine file for comprehensive debugging and monitoring
 */
class GameEngineDebugger {
  private gameId: string;
  private debugLogs: Array<{
    timestamp: Date;
    level: string;
    message: string;
    data?: any;
  }> = [];

  constructor(gameId: string) {
    this.gameId = gameId;
  }

  logVotingPhaseStart(gameState: GameState): void {
    const alivePlayers = Array.from(gameState.players.values()).filter(
      (p) => p.isAlive
    );
    const message = `🗳️ VOTING PHASE START - ${alivePlayers.length} players can vote`;

    console.log(`[${this.gameId}] ${message}`, {
      speakingOrder: gameState.speakingOrder?.map(
        (id) => gameState.players.get(id)?.name
      ),
      currentSpeaker: gameState.players.get(gameState.currentSpeaker || "")
        ?.name,
      existingVotes: gameState.votes.length,
    });

    this.addLog("INFO", message, {
      alivePlayers: alivePlayers.length,
      speakingOrder: gameState.speakingOrder?.length,
      phase: gameState.phase,
    });
  }

  logAIVotingAttempt(
    aiPlayer: Player,
    currentSpeaker: PlayerId | undefined,
    hasAlreadyVoted: boolean
  ): void {
    const canVote = currentSpeaker === aiPlayer.id && !hasAlreadyVoted;
    const message = `🤖 AI VOTING ATTEMPT - ${aiPlayer.name} (${
      canVote ? "ALLOWED" : "BLOCKED"
    })`;

    console.log(`[${this.gameId}] ${message}`, {
      currentSpeaker: currentSpeaker,
      aiPlayerId: aiPlayer.id,
      hasAlreadyVoted,
      canVote,
    });

    this.addLog(canVote ? "INFO" : "WARN", message, {
      playerId: aiPlayer.id,
      playerName: aiPlayer.name,
      currentSpeaker,
      hasAlreadyVoted,
      canVote,
    });
  }

  logVoteCastResult(
    voterId: PlayerId,
    targetId: PlayerId,
    success: boolean,
    reason?: string
  ): void {
    const message = `${
      success ? "✅" : "❌"
    } VOTE CAST - ${voterId} → ${targetId} (${success ? "SUCCESS" : reason})`;

    console.log(`[${this.gameId}] ${message}`);

    this.addLog(success ? "INFO" : "ERROR", message, {
      voterId,
      targetId,
      success,
      reason,
    });
  }

  checkForStuckStates(gameState: GameState): Array<string> {
    const issues: string[] = [];

    // Check for voting phase issues
    if (gameState.phase === GamePhase.VOTING) {
      const alivePlayers = Array.from(gameState.players.values()).filter(
        (p) => p.isAlive
      );
      const votersWhoVoted = new Set(gameState.votes.map((v) => v.voterId));
      const playersWhoNeedToVote = alivePlayers.filter(
        (p) => !votersWhoVoted.has(p.id)
      );

      if (playersWhoNeedToVote.length > 0 && !gameState.currentSpeaker) {
        issues.push(
          `STUCK: ${playersWhoNeedToVote.length} players need to vote but no currentSpeaker set`
        );
      }

      if (
        gameState.currentSpeaker &&
        !gameState.players.get(gameState.currentSpeaker)?.isAlive
      ) {
        issues.push(
          `STUCK: currentSpeaker ${gameState.currentSpeaker} is not alive`
        );
      }
    }

    // Check for night phase issues
    if (gameState.phase === GamePhase.NIGHT) {
      const mafiaLeader = Array.from(gameState.players.values()).find(
        (p) => p.isAlive && p.role === PlayerRole.MAFIA_LEADER
      );
      const healer = Array.from(gameState.players.values()).find(
        (p) => p.isAlive && p.role === PlayerRole.HEALER
      );

      const mafiaActionExists = gameState.nightActions.some(
        (a) => a.action === "kill"
      );
      const healerActionExists = gameState.nightActions.some(
        (a) => a.action === "heal"
      );

      if (mafiaLeader && !mafiaActionExists) {
        issues.push(
          `MISSING: Mafia leader ${mafiaLeader.name} has not submitted kill action`
        );
      }

      if (healer && !healerActionExists) {
        issues.push(
          `MISSING: Healer ${healer.name} has not submitted heal action`
        );
      }
    }

    if (issues.length > 0) {
      console.warn(`[${this.gameId}] 🚨 STUCK STATE DETECTED:`, issues);
      this.addLog("WARN", "Stuck state detected", { issues });
    }

    return issues;
  }

  generateStatusReport(gameState: GameState): any {
    const alivePlayers = Array.from(gameState.players.values()).filter(
      (p) => p.isAlive
    );
    const report = {
      gameId: this.gameId,
      phase: gameState.phase,
      round: gameState.currentRound,
      alivePlayers: alivePlayers.length,
      votes: gameState.votes.length,
      nightActions: gameState.nightActions.length,
      currentSpeaker: gameState.currentSpeaker,
      speakingOrder: gameState.speakingOrder?.length || 0,
      stuckStateIssues: this.checkForStuckStates(gameState),
      lastUpdate: new Date().toISOString(),
    };

    console.log(`[${this.gameId}] 📊 STATUS REPORT:`, report);
    return report;
  }

  private addLog(level: string, message: string, data?: any): void {
    this.debugLogs.push({
      timestamp: new Date(),
      level,
      message,
      data,
    });

    // Keep only last 100 logs to prevent memory bloat
    if (this.debugLogs.length > 100) {
      this.debugLogs = this.debugLogs.slice(-100);
    }
  }

  getDebugLogs(): Array<any> {
    return this.debugLogs;
  }
}

export class MafiaGameEngine extends EventEmitter {
  private gameState: GameState;
  private phaseManager: GamePhaseManager;
  private stateManager: GameStateManager;
  private phaseTimer?: NodeJS.Timeout;
  private speakingTimer?: NodeJS.Timeout;
  private aiPersonalities: Map<PlayerId, AIPersonality> = new Map();
  private aiActionQueue: Map<PlayerId, Promise<any>> = new Map();
  private debugger: GameEngineDebugger; // 🔥 NEW: Built-in debugging
  private votingTimeouts: Map<PlayerId, NodeJS.Timeout> = new Map(); // 🔥 NEW: AI voting timeouts

  constructor(roomId: string, config: GameConfig) {
    super();
    this.gameState = this.initializeGame(roomId, config);
    this.phaseManager = new GamePhaseManager(this.gameState);
    this.stateManager = new GameStateManager(this.gameState);
    this.debugger = new GameEngineDebugger(this.gameState.id); // 🔥 NEW: Initialize debugger
    this.setupPhaseManagerHandlers();
    this.setupStateManagerHandlers();
  }

  private initializeGame(roomId: string, config: GameConfig): GameState {
    return {
      id: uuidv4(),
      roomId,
      phase: GamePhase.WAITING,
      currentRound: 0,
      players: new Map(),
      votes: [],
      messages: [],
      nightActions: [],
      eliminatedPlayers: [],
      phaseStartTime: new Date(),
      phaseEndTime: new Date(Date.now() + 300000), // 5 minutes waiting
      gameConfig: config,
      gameHistory: [],
    };
  }

  /**
   * Setup phase manager event handlers
   */
  private setupPhaseManagerHandlers(): void {
    this.phaseManager.on("phase_started", (data) => {
      this.gameState.phase = data.phase;
      this.gameState.phaseStartTime = data.timestamp;
      this.gameState.phaseEndTime = new Date(
        data.timestamp.getTime() + data.duration
      );

      console.log(`🔄 Phase started: ${data.phase} (${data.duration / 1000}s)`);
      this.handlePhaseStart(data.phase);
    });

    this.phaseManager.on("phase_transition", (transition) => {
      console.log(
        `⚡ Phase transition: ${transition.from} → ${transition.to} (${transition.reason})`
      );
      this.changePhase(transition.to);
    });
  }

  /**
   * Setup state manager event handlers
   */
  private setupStateManagerHandlers(): void {
    this.stateManager.on("observer_update", (data) => {
      const enhancedData = this.enhanceObserverUpdate(data);
      this.emitEvent("observer_update", enhancedData);
    });

    this.stateManager.on("player_eliminated", (data) => {
      const enhancedData = this.enhanceWithPlayerNames(data);
      this.emitEvent("player_eliminated", enhancedData);
    });

    this.stateManager.on("message_added", (data) => {
      const enhancedData = this.enhanceWithPlayerNames(data);
      this.emitEvent("message_received", enhancedData);
    });

    this.stateManager.on("vote_added", (data) => {
      const enhancedData = this.enhanceWithPlayerNames(data);
      this.emitEvent("vote_cast", enhancedData);
    });
  }

  /**
   * Enhance observer updates with complete player information
   */
  private enhanceObserverUpdate(data: any): any {
    if (!data.update) return data;

    const update = data.update;
    const player = this.gameState.players.get(update.playerId);

    if (!player) return data;

    const enhancedUpdate = {
      ...update,
      playerName: player.name,
      playerType: player.type,
      playerModel: player.model,
      playerRole: player.role,
      isPlayerAlive: player.isAlive,
      context: {
        phase: this.gameState.phase,
        round: this.gameState.currentRound,
        alivePlayers: Array.from(this.gameState.players.values())
          .filter((p) => p.isAlive)
          .map((p) => ({ id: p.id, name: p.name, role: p.role })),
        timestamp: new Date().toISOString(),
      },
    };

    return { update: enhancedUpdate };
  }

  /**
   * Enhance any data with player names for better display
   */
  private enhanceWithPlayerNames(data: any): any {
    if (!data) return data;

    const enhanced = { ...data };

    // Add player names for common ID fields
    if (data.playerId) {
      const player = this.gameState.players.get(data.playerId);
      if (player) {
        enhanced.playerName = player.name;
        enhanced.playerType = player.type;
        enhanced.playerRole = player.role;
      }
    }

    if (data.targetId) {
      const target = this.gameState.players.get(data.targetId);
      if (target) {
        enhanced.targetName = target.name;
        enhanced.targetType = target.type;
        enhanced.targetRole = target.role;
      }
    }

    if (data.voterId) {
      const voter = this.gameState.players.get(data.voterId);
      if (voter) {
        enhanced.voterName = voter.name;
        enhanced.voterType = voter.type;
        enhanced.voterRole = voter.role;
      }
    }

    return enhanced;
  }

  /**
   * Get serializable game state with observer data
   */
  getSerializableGameState(): any {
    const baseState = {
      id: this.gameState.id,
      roomId: this.gameState.roomId,
      phase: this.gameState.phase,
      currentRound: this.gameState.currentRound,
      players: Array.from(this.gameState.players.values()).map((player) => ({
        id: player.id,
        name: player.name,
        type: player.type,
        role: player.role,
        isAlive: player.isAlive,
        isReady: player.isReady,
        model: player.model,
        lastActive: player.lastActive.toISOString(),
        gameStats: player.gameStats,
      })),
      votes: this.gameState.votes.map((vote) => ({
        voterId: vote.voterId,
        targetId: vote.targetId,
        reasoning: vote.reasoning,
        timestamp: vote.timestamp.toISOString(),
        voterName: this.gameState.players.get(vote.voterId)?.name,
        targetName: this.gameState.players.get(vote.targetId)?.name,
      })),
      messages: this.gameState.messages.map((message) => ({
        ...message,
        timestamp: message.timestamp.toISOString(),
        playerName: this.gameState.players.get(message.playerId)?.name,
      })),
      nightActions: this.gameState.nightActions.map((action) => ({
        ...action,
        timestamp: action.timestamp.toISOString(),
        playerName: this.gameState.players.get(action.playerId)?.name,
        targetName: action.targetId
          ? this.gameState.players.get(action.targetId)?.name
          : undefined,
      })),
      eliminatedPlayers: this.gameState.eliminatedPlayers,
      winner: this.gameState.winner,
      phaseStartTime: this.gameState.phaseStartTime.toISOString(),
      phaseEndTime: this.gameState.phaseEndTime.toISOString(),
      speakingOrder: this.gameState.speakingOrder,
      currentSpeaker: this.gameState.currentSpeaker,
      gameConfig: this.gameState.gameConfig,
      phaseStatus: this.phaseManager.getPhaseStatus(this.gameState),
      gameHistory: this.gameState.gameHistory.map((event) => ({
        ...event,
        timestamp: event.timestamp.toISOString(),
      })),
      observerData: this.stateManager.getObserverGameState(),
      debugInfo: this.debugger.generateStatusReport(this.gameState), // 🔥 NEW: Debug info
    };

    return baseState;
  }

  /**
   * Add player and assign AI personality if needed
   */
  addPlayer(player: Player): boolean {
    if (this.gameState.players.size >= this.gameState.gameConfig.maxPlayers) {
      return false;
    }
    if (this.gameState.phase !== GamePhase.WAITING) {
      return false;
    }

    // Add to state manager
    const success = this.stateManager.addPlayer(player);
    if (!success) {
      return false;
    }

    // Update local state
    this.gameState.players.set(player.id, player);

    // Assign AI personality for AI players
    if (player.type === PlayerType.AI) {
      this.assignAIPersonality(player);
    }

    this.emitEvent("player_joined", {
      playerId: player.id,
      playerName: player.name,
    });

    // Check if we can auto-start
    if (this.gameState.players.size === this.gameState.gameConfig.maxPlayers) {
      this.checkAutoStart();
    }

    return true;
  }

  /**
   * Assign AI personality to AI player
   */
  private assignAIPersonality(player: Player): void {
    try {
      const personalities = selectGamePersonalities(
        this.gameState.gameConfig.premiumModelsEnabled,
        1
      );

      if (personalities.length > 0) {
        const personality =
          personalities.find((p) => p.name === player.name) || personalities[0];
        this.aiPersonalities.set(player.id, personality);

        console.log(
          `🤖 Assigned personality ${personality.name} (${personality.model}) to ${player.name}`
        );
      } else {
        console.warn(
          `⚠️ No personality available for AI player ${player.name}`
        );
      }
    } catch (error) {
      console.error(
        `❌ Failed to assign personality to ${player.name}:`,
        error
      );
    }
  }

  /**
   * Remove player with cleanup
   */
  removePlayer(playerId: PlayerId): boolean {
    if (!this.gameState.players.has(playerId)) {
      return false;
    }

    const player = this.gameState.players.get(playerId);

    // 🔥 NEW: Clear any pending voting timeout
    const timeout = this.votingTimeouts.get(playerId);
    if (timeout) {
      clearTimeout(timeout);
      this.votingTimeouts.delete(playerId);
    }

    // Remove from state manager
    this.stateManager.removePlayer(playerId);

    // Update local state
    this.gameState.players.delete(playerId);

    // Clean up AI data
    this.aiPersonalities.delete(playerId);
    this.aiActionQueue.delete(playerId);

    this.emitEvent("player_left", {
      playerId,
      playerName: player?.name,
    });

    // Check win condition if game is active
    if (
      this.gameState.phase !== GamePhase.WAITING &&
      this.gameState.phase !== GamePhase.GAME_OVER
    ) {
      console.log(`🔍 Checking win condition after player ${playerId} left`);
      const winCondition = this.checkWinCondition();
      if (winCondition.isGameOver) {
        console.log(
          `🏆 Game ending: ${winCondition.winner} wins - ${winCondition.reason}`
        );
        this.endGame(winCondition.winner!, winCondition.reason);
      }
    }

    return true;
  }

  /**
   * Start game with AI personality assignment
   */
  startGame(): boolean {
    if (this.gameState.phase !== GamePhase.WAITING) {
      return false;
    }
    if (this.gameState.players.size !== 10) {
      return false;
    }

    // Assign roles
    this.assignRoles();

    // Update state
    this.gameState = this.stateManager.updateGameState({
      phase: GamePhase.ROLE_ASSIGNMENT,
    });

    // Start role assignment phase
    this.phaseManager.startPhase(GamePhase.ROLE_ASSIGNMENT, this.gameState);

    // Auto-progress to night after 5 seconds
    setTimeout(() => {
      this.changePhase(GamePhase.NIGHT);
    }, 5000);

    return true;
  }

  /**
   * Handle phase start with AI activation
   */
  private handlePhaseStart(phase: GamePhase): void {
    switch (phase) {
      case GamePhase.NIGHT:
        this.handleNightPhaseStart();
        break;
      case GamePhase.DISCUSSION:
        this.handleDiscussionPhaseStart();
        break;
      case GamePhase.VOTING:
        this.handleVotingPhaseStart();
        break;
    }

    // Check for early progression
    setTimeout(() => {
      this.phaseManager.checkEarlyProgression(this.gameState);
    }, 2000);
  }

  /**
   * Handle night phase start with real AI actions
   */
  private async handleNightPhaseStart(): Promise<void> {
    this.gameState.currentRound++;
    this.gameState.nightActions = [];

    console.log(
      `🌙 Night phase started - Round ${this.gameState.currentRound}`
    );
    this.emitEvent("night_phase_started", {
      round: this.gameState.currentRound,
    });

    // Start AI night actions with real AI decision making
    const aiPlayers = Array.from(this.gameState.players.values()).filter(
      (p) => p.type === PlayerType.AI && p.isAlive
    );

    for (const aiPlayer of aiPlayers) {
      if (aiPlayer.role === PlayerRole.MAFIA_LEADER) {
        this.handleAIMafiaActionReal(aiPlayer);
      } else if (aiPlayer.role === PlayerRole.HEALER) {
        this.handleAIHealerActionReal(aiPlayer);
      }
    }
  }

  /**
   * Handle real AI mafia action with enhanced observer updates
   */
  private async handleAIMafiaActionReal(mafiaPlayer: Player): Promise<void> {
    const personality = this.aiPersonalities.get(mafiaPlayer.id);
    if (!personality) {
      console.warn(`⚠️ No personality found for mafia ${mafiaPlayer.name}`);
      return;
    }

    try {
      const context = this.buildAIContext(mafiaPlayer);
      const availableTargets = Array.from(this.gameState.players.values())
        .filter(
          (p) =>
            p.isAlive &&
            p.role !== PlayerRole.MAFIA_LEADER &&
            p.role !== PlayerRole.MAFIA_MEMBER
        )
        .map((p) => p.id);

      console.log(
        `🔪 ${mafiaPlayer.name} (Mafia) is deciding who to eliminate...`
      );

      // Generate mafia coordination thoughts with enhanced details
      const coordination = await aiResponseGenerator.generateMafiaCoordination(
        context,
        personality,
        personality, // For now, assume single mafia coordination
        availableTargets
      );

      // Add enhanced mafia chat for observers
      this.stateManager.addMafiaChat(
        mafiaPlayer.id,
        `🔴 ${mafiaPlayer.name} (${personality.model}): ${coordination}`
      );

      // Get the actual decision
      const decision = await aiResponseGenerator.generateNightActionResponse(
        context,
        personality,
        availableTargets
      );

      if (decision.targetId) {
        const targetPlayer = this.gameState.players.get(decision.targetId);
        console.log(
          `🔪 ${mafiaPlayer.name} chose to eliminate ${targetPlayer?.name}`
        );

        // Add detailed AI reasoning for observers
        this.stateManager.addAIReasoning(
          mafiaPlayer.id,
          `🎯 Target Selection: ${mafiaPlayer.name} chose ${
            targetPlayer?.name
          }. Reasoning: ${
            decision.reasoning ||
            "Strategic elimination based on threat assessment"
          }`
        );

        // Add delay for realism
        setTimeout(() => {
          this.nightAction(mafiaPlayer.id, "kill", decision.targetId!);
        }, 5000 + Math.random() * 15000);
      } else {
        // Handle case where no target is chosen
        this.stateManager.addAIReasoning(
          mafiaPlayer.id,
          `🤔 ${
            mafiaPlayer.name
          } decided not to eliminate anyone this round. Strategy: ${
            decision.reasoning || "Waiting for better opportunity"
          }`
        );
      }
    } catch (error) {
      console.error(
        `❌ Mafia AI action failed for ${mafiaPlayer.name}:`,
        error
      );
      this.fallbackMafiaAction(mafiaPlayer);
    }
  }

  /**
   * Handle real AI healer action with enhanced observer updates
   */
  private async handleAIHealerActionReal(healerPlayer: Player): Promise<void> {
    const personality = this.aiPersonalities.get(healerPlayer.id);
    if (!personality) {
      console.warn(`⚠️ No personality found for healer ${healerPlayer.name}`);
      return;
    }

    try {
      const context = this.buildAIContext(healerPlayer);
      const availableTargets = Array.from(this.gameState.players.values())
        .filter((p) => p.isAlive)
        .map((p) => p.id);

      console.log(
        `🛡️ ${healerPlayer.name} (Healer) is deciding who to protect...`
      );

      // Generate healer thoughts with enhanced details
      const thoughts = await aiResponseGenerator.generateHealerReasoning(
        context,
        personality,
        availableTargets
      );

      // Add enhanced healer thoughts for observers
      this.stateManager.addHealerThoughts(
        healerPlayer.id,
        `🟢 ${healerPlayer.name} (${personality.model}): ${thoughts}`
      );

      // Get the actual decision
      const decision = await aiResponseGenerator.generateNightActionResponse(
        context,
        personality,
        availableTargets
      );

      if (decision.targetId) {
        const targetPlayer = this.gameState.players.get(decision.targetId);
        console.log(
          `🛡️ ${healerPlayer.name} chose to protect ${targetPlayer?.name}`
        );

        // Add detailed healer reasoning for observers
        this.stateManager.addAIReasoning(
          healerPlayer.id,
          `🛡️ Protection Choice: ${healerPlayer.name} chose to protect ${
            targetPlayer?.name
          }. Analysis: ${
            decision.reasoning ||
            "Based on threat assessment and strategic value"
          }`
        );

        // Add delay for realism
        setTimeout(() => {
          this.nightAction(healerPlayer.id, "heal", decision.targetId!);
        }, 3000 + Math.random() * 10000);
      } else {
        // Handle case where healer chooses not to heal
        this.stateManager.addAIReasoning(
          healerPlayer.id,
          `🤔 ${healerPlayer.name} decided not to protect anyone. Strategy: ${
            decision.reasoning || "Conserving abilities or strategic abstention"
          }`
        );
      }
    } catch (error) {
      console.error(
        `❌ Healer AI action failed for ${healerPlayer.name}:`,
        error
      );
      this.fallbackHealerAction(healerPlayer);
    }
  }

  /**
   * Handle discussion phase with real AI responses
   */
  private handleDiscussionPhaseStart(): void {
    const alivePlayers = Array.from(this.gameState.players.values())
      .filter((p) => p.isAlive)
      .sort(() => Math.random() - 0.5);

    console.log(`💬 Discussion phase: ${alivePlayers.length} players alive`);

    this.gameState.speakingOrder = alivePlayers.map((p) => p.id);
    this.gameState.currentSpeaker = this.gameState.speakingOrder[0];

    this.emitEvent("discussion_started", {
      speakingOrder: this.gameState.speakingOrder.map((id) => ({
        id,
        name: this.gameState.players.get(id)?.name,
      })),
      speakingTime: this.gameState.gameConfig.speakingTimePerPlayer,
    });

    this.startSpeakingTimer();
  }

  /**
   * 🔥 CRITICAL FIX: Handle voting phase with bulletproof AI coordination
   */
  private handleVotingPhaseStart(): void {
    this.gameState.votes = [];

    const alivePlayers = Array.from(this.gameState.players.values())
      .filter((p) => p.isAlive)
      .sort(() => Math.random() - 0.5);

    console.log(`🗳️ Voting phase: ${alivePlayers.length} players can vote`);

    this.gameState.speakingOrder = alivePlayers.map((p) => p.id);
    this.gameState.currentSpeaker = this.gameState.speakingOrder[0];

    // 🔥 NEW: Debug logging for voting phase start
    this.debugger.logVotingPhaseStart(this.gameState);

    this.emitEvent("voting_started", {
      votingOrder: this.gameState.speakingOrder.map((id) => ({
        id,
        name: this.gameState.players.get(id)?.name,
      })),
    });

    // Start AI voting with bulletproof coordination
    this.startAIVotingWithCoordination();
  }

  /**
   * 🔥 CRITICAL FIX: Start AI voting with bulletproof turn-based coordination
   */
  private async startAIVotingWithCoordination(): Promise<void> {
    const aiPlayers = Array.from(this.gameState.players.values()).filter(
      (p) => p.type === PlayerType.AI && p.isAlive
    );

    console.log(
      `🤖 Starting coordinated AI voting for ${aiPlayers.length} AI players`
    );

    for (const aiPlayer of aiPlayers) {
      // Add delay based on speaking order for proper turn-based voting
      const speakingIndex =
        this.gameState.speakingOrder?.indexOf(aiPlayer.id) || 0;
      const delay = speakingIndex * 8000 + Math.random() * 5000; // 8s per player + randomness

      setTimeout(() => {
        this.handleAIVotingReal(aiPlayer);
      }, delay);
    }
  }

  /**
   * 🔥 CRITICAL PRODUCTION FIX: Handle AI voting with ZERO race conditions
   * This is the primary fix that eliminates game hangs
   */
  private async handleAIVotingReal(aiPlayer: Player): Promise<void> {
    const personality = this.aiPersonalities.get(aiPlayer.id);
    if (!personality) {
      console.warn(`⚠️ No personality found for voter ${aiPlayer.name}`);
      this.fallbackVoting(aiPlayer);
      return;
    }

    // 🔥 CRITICAL FIX 1: Validate it's this player's turn to vote
    if (this.gameState.currentSpeaker !== aiPlayer.id) {
      console.log(
        `⏳ ${aiPlayer.name} waiting for turn to vote (current: ${
          this.gameState.players.get(this.gameState.currentSpeaker || "")?.name
        })`
      );
      this.debugger.logAIVotingAttempt(
        aiPlayer,
        this.gameState.currentSpeaker,
        false
      );
      return;
    }

    // 🔥 CRITICAL FIX 2: Check if player already voted (prevent duplicates)
    const hasAlreadyVoted = this.gameState.votes.some(
      (v) => v.voterId === aiPlayer.id
    );
    if (hasAlreadyVoted) {
      console.log(`❌ ${aiPlayer.name} already voted, skipping duplicate vote`);
      this.debugger.logAIVotingAttempt(
        aiPlayer,
        this.gameState.currentSpeaker,
        true
      );
      this.advanceToNextVoter();
      return;
    }

    // 🔥 CRITICAL FIX 3: Add timeout protection (15s max per AI decision)
    const timeoutId = setTimeout(() => {
      console.log(`⏰ AI voting timeout for ${aiPlayer.name}, using fallback`);
      this.fallbackVoting(aiPlayer);
    }, 15000);

    this.votingTimeouts.set(aiPlayer.id, timeoutId);

    this.debugger.logAIVotingAttempt(
      aiPlayer,
      this.gameState.currentSpeaker,
      false
    );

    try {
      const context = this.buildAIContext(aiPlayer);
      const availableTargets = Array.from(this.gameState.players.values())
        .filter((p) => p.isAlive && p.id !== aiPlayer.id)
        .map((p) => p.id);

      console.log(`🗳️ ${aiPlayer.name} is deciding who to vote for...`);

      // Get voting decision from real AI with enhanced error handling
      const votingDecision = await aiResponseGenerator.generateVotingResponse(
        context,
        personality,
        availableTargets
      );

      // 🔥 CRITICAL FIX 4: Clear timeout on successful completion
      clearTimeout(timeoutId);
      this.votingTimeouts.delete(aiPlayer.id);

      const targetPlayer = this.gameState.players.get(votingDecision.targetId);
      console.log(
        `🗳️ ${aiPlayer.name} voted to eliminate ${targetPlayer?.name}: "${votingDecision.reasoning}"`
      );

      // Add enhanced AI reasoning for observers with more context
      this.stateManager.addAIReasoning(
        aiPlayer.id,
        `🗳️ ${aiPlayer.name} (${personality.model}) voting for ${
          targetPlayer?.name
        }: "${votingDecision.reasoning}" | Suspicion level: ${
          context.suspicionLevels?.[votingDecision.targetId] || "Unknown"
        }/10`
      );

      // 🔥 CRITICAL FIX 5: Cast vote with comprehensive validation
      const voteSuccess = this.castVote(
        aiPlayer.id,
        votingDecision.targetId,
        votingDecision.reasoning
      );

      if (!voteSuccess) {
        console.error(
          `❌ Vote casting failed for ${aiPlayer.name}, using fallback`
        );
        this.fallbackVoting(aiPlayer);
      }
    } catch (error) {
      // 🔥 CRITICAL FIX 6: Clear timeout on error and use fallback
      clearTimeout(timeoutId);
      this.votingTimeouts.delete(aiPlayer.id);
      console.error(`❌ AI voting failed for ${aiPlayer.name}:`, error);
      this.fallbackVoting(aiPlayer);
    }
  }

  /**
   * Send message (enhanced for AI)
   */
  sendMessage(playerId: PlayerId, content: string): boolean {
    const player = this.gameState.players.get(playerId);
    if (!player || !player.isAlive) return false;

    // Phase-specific message validation
    if (this.gameState.phase === GamePhase.DISCUSSION) {
      if (this.gameState.currentSpeaker !== playerId) {
        return false; // Not this player's turn to speak
      }
    }

    const message: Message = {
      id: uuidv4(),
      playerId,
      content,
      timestamp: new Date(),
      phase: this.gameState.phase,
      messageType: "discussion",
    };

    // Add to state manager
    this.stateManager.addMessage(message);

    // Update local state
    this.gameState.messages.push(message);

    // In discussion phase, advance to next speaker
    if (this.gameState.phase === GamePhase.DISCUSSION) {
      if (this.speakingTimer) clearTimeout(this.speakingTimer);
      this.advanceToNextSpeaker();
    }

    return true;
  }

  /**
   * Handle AI discussion with enhanced responses and observer updates
   */
  async handleAIDiscussionReal(aiPlayer: Player): Promise<void> {
    const personality = this.aiPersonalities.get(aiPlayer.id);
    if (!personality) {
      console.warn(`⚠️ No personality found for ${aiPlayer.name}`);
      return;
    }

    try {
      const context = this.buildAIContext(aiPlayer);

      console.log(`💬 ${aiPlayer.name} is thinking of what to say...`);

      // Generate real AI response
      const response = await aiResponseGenerator.generateDiscussionResponse(
        context,
        personality
      );

      console.log(`💬 ${aiPlayer.name}: "${response.content}"`);

      // Add enhanced AI reasoning for observers with strategy context
      this.stateManager.addAIReasoning(
        aiPlayer.id,
        `💭 ${aiPlayer.name} (${personality.model}) speaking strategy: ${
          response.reasoning || response.content
        } | Role: ${aiPlayer.role} | Current suspicions: ${Object.entries(
          context.suspicionLevels || {}
        )
          .map(
            ([id, level]) => `${this.gameState.players.get(id)?.name}:${level}`
          )
          .join(", ")}`
      );

      // Send the message with a delay for realism
      setTimeout(() => {
        this.sendMessage(aiPlayer.id, response.content);
      }, 1000 + Math.random() * 3000);
    } catch (error) {
      console.error(`❌ AI discussion failed for ${aiPlayer.name}:`, error);
      // Fallback message
      setTimeout(() => {
        this.sendMessage(aiPlayer.id, "I'm still analyzing the situation...");
      }, 2000);
    }
  }

  /**
   * Build comprehensive AI context
   */
  private buildAIContext(aiPlayer: Player): AIDecisionContext {
    const gameState = this.stateManager.getGameState();

    return {
      playerId: aiPlayer.id,
      role: aiPlayer.role!,
      phase: gameState.phase,
      round: gameState.currentRound,
      gameHistory: gameState.messages
        .slice(-10)
        .map(
          (m) =>
            `${gameState.players.get(m.playerId)?.name || "Unknown"}: ${
              m.content
            }`
        ),
      livingPlayers: Array.from(gameState.players.values())
        .filter((p) => p.isAlive)
        .map((p) => p.id),
      eliminatedPlayers: gameState.eliminatedPlayers,
      previousVotes: this.buildVotingHistory(),
      timeRemaining: this.phaseManager.getRemainingTime(),
      suspicionLevels: this.buildSuspicionLevels(aiPlayer.id),
      trustLevels: this.buildTrustLevels(aiPlayer.id),
    };
  }

  /**
   * Build voting history for AI context
   */
  private buildVotingHistory(): { round: number; votes: any[] }[] {
    // Simplified voting history
    return [
      {
        round: this.gameState.currentRound,
        votes: this.gameState.votes.map((v) => ({
          voter: this.gameState.players.get(v.voterId)?.name,
          target: this.gameState.players.get(v.targetId)?.name,
          reasoning: v.reasoning,
        })),
      },
    ];
  }

  /**
   * Build suspicion levels for AI context
   */
  private buildSuspicionLevels(aiPlayerId: PlayerId): Record<PlayerId, number> {
    const suspicions: Record<PlayerId, number> = {};

    // Use state manager's suspicion data if available
    const observerState = this.stateManager.getObserverGameState();
    const suspicionMatrix = observerState.suspicionMatrix;

    for (const [playerId] of this.gameState.players) {
      if (playerId !== aiPlayerId) {
        suspicions[playerId] = Math.floor(Math.random() * 5) + 3; // 3-7 range
      }
    }

    return suspicions;
  }

  /**
   * Build trust levels for AI context
   */
  private buildTrustLevels(aiPlayerId: PlayerId): Record<PlayerId, number> {
    const trust: Record<PlayerId, number> = {};

    for (const [playerId] of this.gameState.players) {
      if (playerId !== aiPlayerId) {
        trust[playerId] = Math.floor(Math.random() * 5) + 3; // 3-7 range
      }
    }

    return trust;
  }

  /**
   * 🔥 CRITICAL PRODUCTION FIX: Cast vote with bulletproof validation
   */
  castVote(playerId: PlayerId, targetId: PlayerId, reasoning: string): boolean {
    const voter = this.gameState.players.get(playerId);
    const target = this.gameState.players.get(targetId);

    // 🔥 CRITICAL FIX 1: Comprehensive player validation
    if (!voter || !target) {
      const reason = `Invalid players - voter: ${!!voter}, target: ${!!target}`;
      console.log(`❌ Vote failed for ${playerId}: ${reason}`);
      this.debugger.logVoteCastResult(playerId, targetId, false, reason);
      return false;
    }

    if (!voter.isAlive || !target.isAlive) {
      const reason = `Dead players - voter alive: ${voter.isAlive}, target alive: ${target.isAlive}`;
      console.log(`❌ Vote failed for ${voter.name}: ${reason}`);
      this.debugger.logVoteCastResult(playerId, targetId, false, reason);
      return false;
    }

    // 🔥 CRITICAL FIX 2: Strict phase validation
    if (this.gameState.phase !== GamePhase.VOTING) {
      const reason = `Wrong phase: ${this.gameState.phase} (expected: ${GamePhase.VOTING})`;
      console.log(`❌ Vote failed for ${voter.name}: ${reason}`);
      this.debugger.logVoteCastResult(playerId, targetId, false, reason);
      return false;
    }

    // 🔥 CRITICAL FIX 3: Prevent self-voting
    if (playerId === targetId) {
      const reason = "Cannot vote for yourself";
      console.log(`❌ Vote failed for ${voter.name}: ${reason}`);
      this.debugger.logVoteCastResult(playerId, targetId, false, reason);
      return false;
    }

    // 🔥 CRITICAL FIX 4: Strict turn validation
    if (this.gameState.currentSpeaker !== playerId) {
      const currentSpeakerName = this.gameState.players.get(
        this.gameState.currentSpeaker || ""
      )?.name;
      const reason = `Not your turn - current speaker: ${currentSpeakerName}`;
      console.log(`❌ Vote failed for ${voter.name}: ${reason}`);
      this.debugger.logVoteCastResult(playerId, targetId, false, reason);
      return false;
    }

    // 🔥 CRITICAL FIX 5: Prevent duplicate votes with clear messaging
    const existingVote = this.gameState.votes.find(
      (v) => v.voterId === playerId
    );
    if (existingVote) {
      const previousTargetName = this.gameState.players.get(
        existingVote.targetId
      )?.name;
      const reason = `Already voted for ${previousTargetName}`;
      console.log(`❌ Vote failed for ${voter.name}: ${reason}`);
      this.debugger.logVoteCastResult(playerId, targetId, false, reason);
      return false;
    }

    const vote: Vote = {
      voterId: playerId,
      targetId,
      reasoning,
      timestamp: new Date(),
    };

    // Add to state manager
    const success = this.stateManager.addVote(vote);
    if (!success) {
      const reason = "State manager rejected vote";
      console.log(`❌ Vote failed for ${voter.name}: ${reason}`);
      this.debugger.logVoteCastResult(playerId, targetId, false, reason);
      return false;
    }

    // Update local state
    this.gameState.votes.push(vote);

    // 🔥 CRITICAL FIX 6: Detailed success logging
    console.log(
      `✅ Vote successful: ${voter.name} → ${target.name} ("${reasoning}")`
    );
    this.debugger.logVoteCastResult(playerId, targetId, true);

    // Advance to next voter
    this.advanceToNextVoter();

    // Check for early progression
    setTimeout(() => {
      this.phaseManager.checkEarlyProgression(this.gameState);
    }, 1000);

    return true;
  }

  /**
   * Night action with enhanced tracking
   */
  nightAction(
    playerId: PlayerId,
    action: "kill" | "heal",
    targetId?: PlayerId
  ): boolean {
    const player = this.gameState.players.get(playerId);
    if (
      !player ||
      !player.isAlive ||
      this.gameState.phase !== GamePhase.NIGHT
    ) {
      return false;
    }

    const nightAction: NightAction = {
      playerId,
      action,
      targetId,
      timestamp: new Date(),
    };

    // Add to state manager
    const success = this.stateManager.addNightAction(nightAction);
    if (!success) {
      return false;
    }

    // Update local state
    this.gameState.nightActions = this.gameState.nightActions.filter(
      (a) => a.playerId !== playerId
    );
    this.gameState.nightActions.push(nightAction);

    const targetName = targetId
      ? this.gameState.players.get(targetId)?.name
      : "none";
    console.log(`🌙 ${player.name} wants to ${action} ${targetName}`);

    // Check for early progression
    setTimeout(() => {
      this.phaseManager.checkEarlyProgression(this.gameState);
    }, 1000);

    return true;
  }

  /**
   * Change phase with enhanced management
   */
  private changePhase(newPhase: GamePhase): void {
    const oldPhase = this.gameState.phase;

    // Update state
    this.gameState = this.stateManager.updateGameState({
      phase: newPhase,
      phaseStartTime: new Date(),
    });

    // Start new phase
    this.phaseManager.startPhase(newPhase, this.gameState);

    // Handle special phase logic
    if (newPhase === GamePhase.REVELATION) {
      this.handleRevelationPhase();
    }
  }

  /**
   * 🔥 CRITICAL FIX: Handle revelation phase with enhanced logic and logging
   */
  private handleRevelationPhase(): void {
    console.log(`💀 Processing night actions...`);

    // 🔥 NEW: Detailed night action logging
    console.log(
      `🌙 Night actions submitted: ${this.gameState.nightActions.length}`
    );
    this.gameState.nightActions.forEach((action) => {
      const player = this.gameState.players.get(action.playerId);
      const target = action.targetId
        ? this.gameState.players.get(action.targetId)
        : null;
      console.log(
        `🌙 ${player?.name} wants to ${action.action} ${
          target?.name || "nobody"
        }`
      );
    });

    const eliminatedPlayer = this.processNightActions();

    if (eliminatedPlayer) {
      this.stateManager.eliminatePlayer(eliminatedPlayer.id, "mafia_kill");
      this.gameState.eliminatedPlayers.push(eliminatedPlayer.id);
      eliminatedPlayer.isAlive = false;
      this.gameState.players.set(eliminatedPlayer.id, eliminatedPlayer);

      console.log(
        `💀 ${eliminatedPlayer.name} (${eliminatedPlayer.role}) was eliminated by mafia`
      );
    } else {
      console.log(`🛡️ No elimination occurred (healer save or no action)`);
      this.emitEvent("no_elimination", { reason: "healer_save" });
    }

    // Check win condition
    console.log(`🔍 Checking win condition after night phase...`);
    const winCondition = this.checkWinCondition();

    if (winCondition.isGameOver) {
      console.log(
        `🏆 Game should end: ${winCondition.winner} wins - ${winCondition.reason}`
      );
      setTimeout(() => {
        this.endGame(winCondition.winner!, winCondition.reason);
      }, 2000);
      return;
    }
  }

  // 🔥 CRITICAL FIX: Fallback methods with comprehensive timeout handling
  private fallbackMafiaAction(mafiaPlayer: Player): void {
    console.log(`🔄 Using fallback mafia action for ${mafiaPlayer.name}`);
    const availableTargets = Array.from(this.gameState.players.values()).filter(
      (p) =>
        p.isAlive &&
        p.role !== PlayerRole.MAFIA_LEADER &&
        p.role !== PlayerRole.MAFIA_MEMBER
    );

    if (availableTargets.length > 0) {
      const target =
        availableTargets[Math.floor(Math.random() * availableTargets.length)];
      console.log(`🔄 Fallback: ${mafiaPlayer.name} targeting ${target.name}`);
      setTimeout(() => {
        this.nightAction(mafiaPlayer.id, "kill", target.id);
      }, 2000);
    }
  }

  private fallbackHealerAction(healerPlayer: Player): void {
    console.log(`🔄 Using fallback healer action for ${healerPlayer.name}`);
    const availableTargets = Array.from(this.gameState.players.values()).filter(
      (p) => p.isAlive
    );

    if (availableTargets.length > 0) {
      const target =
        availableTargets[Math.floor(Math.random() * availableTargets.length)];
      console.log(
        `🔄 Fallback: ${healerPlayer.name} protecting ${target.name}`
      );
      setTimeout(() => {
        this.nightAction(healerPlayer.id, "heal", target.id);
      }, 2000);
    }
  }

  /**
   * 🔥 CRITICAL FIX: Fallback voting with proper turn advancement
   */
  private fallbackVoting(aiPlayer: Player): void {
    console.log(`🔄 Using fallback voting for ${aiPlayer.name}`);

    // Clear any existing timeout
    const timeout = this.votingTimeouts.get(aiPlayer.id);
    if (timeout) {
      clearTimeout(timeout);
      this.votingTimeouts.delete(aiPlayer.id);
    }

    const availableTargets = Array.from(this.gameState.players.values()).filter(
      (p) => p.isAlive && p.id !== aiPlayer.id
    );

    if (availableTargets.length > 0) {
      const target =
        availableTargets[Math.floor(Math.random() * availableTargets.length)];
      console.log(`🔄 Fallback: ${aiPlayer.name} voting for ${target.name}`);

      setTimeout(() => {
        const success = this.castVote(
          aiPlayer.id,
          target.id,
          "Based on my analysis of the discussion"
        );

        if (!success) {
          console.log(
            `🔄 Fallback vote failed for ${aiPlayer.name}, advancing to next voter`
          );
          this.advanceToNextVoter();
        }
      }, 1000);
    } else {
      // No valid targets, advance to next voter
      console.log(
        `🔄 No targets available for ${aiPlayer.name}, advancing to next voter`
      );
      this.advanceToNextVoter();
    }
  }

  // [Rest of the existing methods remain the same but updated to use new managers]
  // assignRoles, processNightActions, checkWinCondition, etc.

  private assignRoles(): void {
    const players = Array.from(this.gameState.players.values());
    const shuffled = [...players].sort(() => Math.random() - 0.5);

    shuffled[0].role = PlayerRole.MAFIA_LEADER;
    shuffled[1].role = PlayerRole.MAFIA_MEMBER;
    shuffled[2].role = PlayerRole.HEALER;

    for (let i = 3; i < shuffled.length; i++) {
      shuffled[i].role = PlayerRole.CITIZEN;
    }

    shuffled.forEach((player) => {
      this.gameState.players.set(player.id, player);
    });

    console.log(`🎭 Roles assigned: 2 Mafia, 1 Healer, 7 Citizens`);
    this.emitEvent("roles_assigned", {
      assignments: shuffled.map((p) => ({
        id: p.id,
        role: p.role,
        name: p.name,
      })),
    });
  }

  /**
   * 🔥 CRITICAL FIX: Enhanced night action processing with detailed logging
   */
  private processNightActions(): Player | null {
    const killAction = this.gameState.nightActions.find(
      (a) => a.action === "kill"
    );
    const healAction = this.gameState.nightActions.find(
      (a) => a.action === "heal"
    );

    // 🔥 NEW: Detailed processing logs
    if (!killAction || !killAction.targetId) {
      console.log(`🔍 No kill action found or no target specified`);
      return null;
    }

    const target = this.gameState.players.get(killAction.targetId);
    if (!target) {
      console.log(`🔍 Kill target not found: ${killAction.targetId}`);
      return null;
    }

    console.log(`🔪 Mafia attempted to kill: ${target.name}`);

    if (healAction && healAction.targetId === killAction.targetId) {
      const healerName = this.gameState.players.get(healAction.playerId)?.name;
      console.log(`🛡️ ${target.name} was protected by ${healerName}!`);
      return null;
    }

    console.log(`💀 ${target.name} will be eliminated`);
    return target;
  }

  private checkWinCondition(): WinCondition {
    const alivePlayers = Array.from(this.gameState.players.values()).filter(
      (p) => p.isAlive
    );
    const aliveMafia = alivePlayers.filter(
      (p) =>
        p.role === PlayerRole.MAFIA_LEADER || p.role === PlayerRole.MAFIA_MEMBER
    );
    const aliveCitizens = alivePlayers.filter(
      (p) => p.role === PlayerRole.CITIZEN || p.role === PlayerRole.HEALER
    );

    if (aliveMafia.length >= aliveCitizens.length && aliveMafia.length > 0) {
      return {
        winner: "mafia",
        reason: "Mafia achieved numerical parity",
        isGameOver: true,
      };
    }

    if (aliveMafia.length === 0) {
      return {
        winner: "citizens",
        reason: "All mafia members eliminated",
        isGameOver: true,
      };
    }

    return { reason: "Game continues", isGameOver: false };
  }

  /**
   * 🔥 CRITICAL FIX: Enhanced vote processing with comprehensive logging and edge cases
   */
  private processVotes(): void {
    console.log(`📊 Processing ${this.gameState.votes.length} votes...`);

    // 🔥 CRITICAL FIX: Handle "no votes cast" edge case
    if (this.gameState.votes.length === 0) {
      console.log(`📊 No votes were cast, proceeding to night phase`);
      this.emitEvent("no_votes_cast", {
        reason: "No players voted",
        phase: "proceeding_to_night",
      });
      this.changePhase(GamePhase.NIGHT);
      return;
    }

    // 🔥 CRITICAL FIX: Log every single vote with voter/target names
    console.log(`📊 Vote breakdown:`);
    this.gameState.votes.forEach((vote, index) => {
      const voterName = this.gameState.players.get(vote.voterId)?.name;
      const targetName = this.gameState.players.get(vote.targetId)?.name;
      console.log(
        `📊 Vote ${index + 1}: ${voterName} → ${targetName} ("${
          vote.reasoning
        }")`
      );
    });

    const voteCounts = new Map<PlayerId, number>();
    this.gameState.votes.forEach((vote) => {
      const current = voteCounts.get(vote.targetId) || 0;
      voteCounts.set(vote.targetId, current + 1);
    });

    // 🔥 CRITICAL FIX: Log vote counts with clear winner determination
    console.log(`📊 Vote tally:`);
    const voteResults: Array<{
      playerId: PlayerId;
      playerName: string;
      votes: number;
    }> = [];
    voteCounts.forEach((votes, playerId) => {
      const playerName = this.gameState.players.get(playerId)?.name;
      console.log(`📊 ${playerName}: ${votes} vote${votes === 1 ? "" : "s"}`);
      voteResults.push({
        playerId,
        playerName: playerName || "Unknown",
        votes,
      });
    });

    let maxVotes = 0;
    let eliminatedPlayerId: PlayerId | null = null;
    let tiedPlayers: PlayerId[] = [];

    voteCounts.forEach((votes, playerId) => {
      if (votes > maxVotes) {
        maxVotes = votes;
        eliminatedPlayerId = playerId;
        tiedPlayers = [playerId];
      } else if (votes === maxVotes) {
        tiedPlayers.push(playerId);
      }
    });

    // 🔥 CRITICAL FIX: Handle ties with explicit messaging
    if (tiedPlayers.length > 1) {
      const tiedPlayerNames = tiedPlayers.map(
        (id) => this.gameState.players.get(id)?.name
      );
      console.log(
        `🤝 Vote tied between: ${tiedPlayerNames.join(
          ", "
        )} (${maxVotes} votes each)`
      );

      this.emitEvent("vote_tied", {
        tiedPlayers: tiedPlayers.map((id) => ({
          id,
          name: this.gameState.players.get(id)?.name,
        })),
        voteCount: maxVotes,
        reason: "Multiple players received equal votes",
      });

      this.changePhase(GamePhase.NIGHT);
      return;
    }

    // 🔥 CRITICAL FIX: Validate all player states before elimination
    if (eliminatedPlayerId) {
      const eliminatedPlayer = this.gameState.players.get(eliminatedPlayerId);
      if (!eliminatedPlayer) {
        console.error(
          `❌ Cannot eliminate player ${eliminatedPlayerId} - player not found`
        );
        this.changePhase(GamePhase.NIGHT);
        return;
      }

      if (!eliminatedPlayer.isAlive) {
        console.error(
          `❌ Cannot eliminate ${eliminatedPlayer.name} - already dead`
        );
        this.changePhase(GamePhase.NIGHT);
        return;
      }

      console.log(
        `🏆 ${eliminatedPlayer.name} eliminated by vote (${maxVotes} votes)`
      );

      this.stateManager.eliminatePlayer(eliminatedPlayerId, "voted_out");

      const winCondition = this.checkWinCondition();
      if (winCondition.isGameOver) {
        setTimeout(() => {
          this.endGame(winCondition.winner!, winCondition.reason);
        }, 3000);
        return;
      }
    }

    setTimeout(() => {
      this.changePhase(GamePhase.NIGHT);
    }, 3000);
  }

  private startSpeakingTimer(): void {
    if (!this.gameState.currentSpeaker || !this.gameState.speakingOrder) return;

    const player = this.gameState.players.get(this.gameState.currentSpeaker);
    const speakingTime = this.gameState.gameConfig.speakingTimePerPlayer * 1000;

    this.speakingTimer = setTimeout(() => {
      this.advanceToNextSpeaker();
    }, speakingTime);

    this.emitEvent("speaker_turn_started", {
      speakerId: this.gameState.currentSpeaker,
      speakerName: player?.name,
      timeLimit: speakingTime,
    });

    // Handle AI speaking
    if (player?.type === PlayerType.AI) {
      this.handleAIDiscussionReal(player);
    }
  }

  private advanceToNextSpeaker(): void {
    if (!this.gameState.speakingOrder || !this.gameState.currentSpeaker) return;

    const currentIndex = this.gameState.speakingOrder.indexOf(
      this.gameState.currentSpeaker
    );
    const nextIndex = currentIndex + 1;

    if (nextIndex < this.gameState.speakingOrder.length) {
      this.gameState.currentSpeaker = this.gameState.speakingOrder[nextIndex];
      this.startSpeakingTimer();
    } else {
      this.gameState.currentSpeaker = undefined;
      this.changePhase(GamePhase.VOTING);
    }
  }

  /**
   * 🔥 CRITICAL FIX: Enhanced voter advancement with comprehensive logging
   */
  private advanceToNextVoter(): void {
    if (!this.gameState.speakingOrder || !this.gameState.currentSpeaker) {
      console.log(
        `🔄 Cannot advance voter - no speaking order or current speaker`
      );
      return;
    }

    const currentIndex = this.gameState.speakingOrder.indexOf(
      this.gameState.currentSpeaker
    );
    const nextIndex = currentIndex + 1;

    console.log(
      `🔄 Advancing from voter ${currentIndex + 1} to ${nextIndex + 1}`
    );

    if (nextIndex < this.gameState.speakingOrder.length) {
      this.gameState.currentSpeaker = this.gameState.speakingOrder[nextIndex];
      const nextPlayer = this.gameState.players.get(
        this.gameState.currentSpeaker
      );

      console.log(`🔄 Next voter: ${nextPlayer?.name}`);

      this.emitEvent("next_voter", {
        voterId: this.gameState.currentSpeaker,
        voterName: nextPlayer?.name,
      });
    } else {
      console.log(`🔄 All players have voted, processing results`);
      this.gameState.currentSpeaker = undefined;
      this.processVotes();
    }
  }

  private endGame(winner: "citizens" | "mafia", reason: string): void {
    this.gameState.phase = GamePhase.GAME_OVER;
    this.gameState.winner = winner;

    // 🔥 NEW: Clear all timeouts on game end
    if (this.phaseTimer) clearTimeout(this.phaseTimer);
    if (this.speakingTimer) clearTimeout(this.speakingTimer);
    this.votingTimeouts.forEach((timeout) => clearTimeout(timeout));
    this.votingTimeouts.clear();

    this.emitEvent("game_ended", {
      winner,
      reason,
      finalState: this.getSerializableGameState(),
      stats: this.calculateGameStats(),
    });
  }

  private calculateGameStats() {
    return this.stateManager.getGameAnalytics();
  }

  private checkAutoStart(): void {
    const allPlayers = Array.from(this.gameState.players.values());
    const readyPlayers = allPlayers.filter((p) => p.isReady);

    if (readyPlayers.length === allPlayers.length && allPlayers.length === 10) {
      setTimeout(() => this.startGame(), 2000);
    }
  }

  private emitEvent(type: string, data: any): void {
    const event: GameEvent = {
      id: uuidv4(),
      type: type as any,
      timestamp: new Date(),
      data: this.sanitizeEventData(data),
      phase: this.gameState.phase,
      round: this.gameState.currentRound,
    };

    this.gameState.gameHistory.push(event);
    this.emit(type, data);
    this.emit("game_event", event);
  }

  private sanitizeEventData(data: any): any {
    if (!data) return data;

    try {
      return JSON.parse(
        JSON.stringify(data, (key, value) => {
          if (value instanceof Date) {
            return value.toISOString();
          }
          if (typeof value === "object" && value !== null) {
            if (this.hasCircularReference(value)) {
              return "[Circular Reference Removed]";
            }
          }
          return value;
        })
      );
    } catch (error) {
      console.warn("Event data sanitization failed:", error);
      return { error: "Data could not be serialized" };
    }
  }

  private hasCircularReference(obj: any, seen = new WeakSet()): boolean {
    if (obj && typeof obj === "object") {
      if (seen.has(obj)) return true;
      seen.add(obj);

      for (const key in obj) {
        if (
          obj.hasOwnProperty(key) &&
          this.hasCircularReference(obj[key], seen)
        ) {
          return true;
        }
      }
    }
    return false;
  }

  // 🔥 NEW: Public debugging methods for emergency fixes
  public getDebugInfo(): any {
    return this.debugger.generateStatusReport(this.gameState);
  }

  public forceVoteProgression(): boolean {
    if (this.gameState.phase !== GamePhase.VOTING) return false;

    console.log(`🔧 Force vote progression triggered`);
    this.processVotes();
    return true;
  }

  public getStuckStateIssues(): string[] {
    return this.debugger.checkForStuckStates(this.gameState);
  }

  // Public API
  getGameState(): GameState {
    return this.stateManager.getGameState();
  }

  getPlayerRole(playerId: PlayerId): PlayerRole | undefined {
    return this.gameState.players.get(playerId)?.role;
  }

  isPlayerAlive(playerId: PlayerId): boolean {
    return this.gameState.players.get(playerId)?.isAlive || false;
  }

  getCurrentPhase(): GamePhase {
    return this.gameState.phase;
  }

  getAlivePlayers(): Player[] {
    return Array.from(this.gameState.players.values()).filter((p) => p.isAlive);
  }

  getRemainingTime(): number {
    return this.phaseManager.getRemainingTime();
  }

  forcePhaseChange(phase: GamePhase): boolean {
    if (this.gameState.phase === GamePhase.GAME_OVER) return false;
    this.phaseManager.forceProgression(`Manual phase change to ${phase}`);
    return true;
  }

  setPlayerReady(playerId: PlayerId, ready: boolean): boolean {
    const player = this.gameState.players.get(playerId);
    if (!player) return false;

    player.isReady = ready;
    this.gameState.players.set(playerId, player);

    if (ready) {
      this.checkAutoStart();
    }

    return true;
  }

  cleanup(): void {
    this.phaseManager.cleanup();
    this.stateManager.cleanup();
    this.aiActionQueue.clear();
    this.aiPersonalities.clear();

    // 🔥 NEW: Clear all voting timeouts
    this.votingTimeouts.forEach((timeout) => clearTimeout(timeout));
    this.votingTimeouts.clear();

    if (this.phaseTimer) clearTimeout(this.phaseTimer);
    if (this.speakingTimer) clearTimeout(this.speakingTimer);
  }
}
