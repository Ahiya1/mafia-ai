// server/lib/game/orchestrator.ts - Enhanced with Full Phase Manager Integration
import { EventEmitter } from "events";
import {
  GameState,
  Player,
  PlayerId,
  PlayerRole,
  GamePhase,
  GameConfig,
  GameOrchestratorInterface,
  PlayerType,
  Vote,
  NightAction,
} from "../types/game";
import { nameRegistry } from "./context/name-registry";
import { contextManager } from "./context/context-manager";
import { aiContextBuilder } from "./context/ai-context-builder";
import { responseParser } from "./context/response-parser";

// 🆕 COMMIT 2: Import the revolutionary phase managers
import { DiscussionManager } from "./phases/discussion-manager";
import { VotingManager } from "./phases/voting-manager";
import { NightManager } from "./phases/night-manager";
import { RoleManager } from "./phases/role-manager";

export class GameOrchestrator
  extends EventEmitter
  implements GameOrchestratorInterface
{
  private gameState: GameState;
  private gameId: string;

  // 🔥 COMMIT 2: Revolutionary phase managers - now fully implemented!
  private discussionManager: DiscussionManager;
  private votingManager: VotingManager;
  private nightManager: NightManager;
  private roleManager: RoleManager;

  // Phase timing
  private phaseTimer?: NodeJS.Timeout;
  private autoStartTimer?: NodeJS.Timeout;

  constructor(roomId: string, config: GameConfig) {
    super();

    this.gameId = `game_${Date.now()}_${Math.random()
      .toString(36)
      .substr(2, 9)}`;

    // Initialize game state
    this.gameState = this.initializeGameState(roomId, config);

    // 🆕 COMMIT 2: Initialize all phase managers
    this.discussionManager = new DiscussionManager(this.gameId);
    this.votingManager = new VotingManager(this.gameId);
    this.nightManager = new NightManager(this.gameId);
    this.roleManager = new RoleManager(this.gameId);

    // Setup the revolutionary name registry for this game
    nameRegistry.createGameMapping(this.gameId);

    // 🔥 COMMIT 2: Setup phase manager event handlers
    this.setupPhaseManagerHandlers();

    console.log(
      `🎮 GameOrchestrator initialized with phase managers: ${this.gameId}`
    );
    console.log(`🏗️ Revolutionary architecture: All systems online`);
    console.log(`🎭 Phase managers: Discussion, Voting, Night, Role`);
    console.log(`🏷️ Name registry: Perfect anonymity enabled`);
    console.log(`🔍 Response parser: Bulletproof JSON validation`);
  }

  /**
   * 🔥 COMMIT 2: Setup comprehensive phase manager event handlers
   */
  private setupPhaseManagerHandlers(): void {
    // Discussion Manager Events
    this.discussionManager.on("discussion_started", (data) => {
      console.log(
        `💬 Discussion started: ${data.speakingOrder.length} players`
      );
      this.emit("discussion_started", data);
    });

    this.discussionManager.on("message_received", (data) => {
      // Add message to game state
      const message = {
        id: `msg_${Date.now()}`,
        playerId: data.playerId,
        content: data.content,
        timestamp: data.timestamp,
        phase: this.gameState.phase,
        messageType: "discussion" as const,
      };
      this.gameState.messages.push(message);

      this.emit("message_received", data);
    });

    this.discussionManager.on("discussion_ended", (data) => {
      console.log(`💬 Discussion ended: ${data.reason}`);
      this.emit("discussion_ended", data);

      // Transition to voting phase
      setTimeout(() => {
        this.changePhase(GamePhase.VOTING);
      }, 2000);
    });

    // Voting Manager Events
    this.votingManager.on("voting_started", (data) => {
      console.log(`🗳️ Voting started: ${data.alivePlayers.length} players`);
      this.emit("voting_started", data);
    });

    this.votingManager.on("vote_cast", (data) => {
      // Add vote to game state
      this.gameState.votes.push(data.vote);
      this.emit("vote_cast", data);
    });

    this.votingManager.on("voting_ended", (data) => {
      console.log(`🗳️ Voting ended: ${data.reason}`);
      this.emit("voting_ended", data);

      // Process elimination
      if (data.eliminationResult.eliminated) {
        this.eliminatePlayer(data.eliminationResult.eliminated.id, "voted_out");
      }

      // Check win condition
      const winCondition = this.checkWinCondition();
      if (winCondition.isGameOver) {
        this.endGame(winCondition.winner!, winCondition.reason);
        return;
      }

      // Transition to night phase
      setTimeout(() => {
        this.changePhase(GamePhase.NIGHT);
      }, 3000);
    });

    // Night Manager Events
    this.nightManager.on("night_started", (data) => {
      console.log(
        `🌙 Night ${data.round} started: ${data.alivePlayers.length} players`
      );
      this.emit("night_started", data);
    });

    this.nightManager.on("night_action_submitted", (data) => {
      // Add night action to game state
      const nightAction: NightAction = {
        playerId: data.playerId,
        action: data.action,
        targetId: data.targetId,
        timestamp: data.timestamp,
      };

      // Remove existing action from this player and add new one
      this.gameState.nightActions = this.gameState.nightActions.filter(
        (a) => a.playerId !== data.playerId
      );
      this.gameState.nightActions.push(nightAction);

      this.emit("night_action_submitted", data);
    });

    this.nightManager.on("mafia_chat", (data) => {
      this.emit("mafia_chat", data);
    });

    this.nightManager.on("night_ended", (data) => {
      console.log(`🌙 Night ${data.round} ended: ${data.reason}`);
      this.emit("night_ended", data);

      // Process night result
      if (data.nightResult.eliminated) {
        this.eliminatePlayer(data.nightResult.eliminated.id, "mafia_kill");
      }

      // Check win condition
      const winCondition = this.checkWinCondition();
      if (winCondition.isGameOver) {
        this.endGame(winCondition.winner!, winCondition.reason);
        return;
      }

      // Transition to discussion phase
      setTimeout(() => {
        this.changePhase(GamePhase.DISCUSSION);
      }, 5000);
    });

    // Role Manager Events
    this.roleManager.on("roles_assigned", (data) => {
      console.log(`🎭 Roles assigned: ${data.assignments.length} players`);
      this.emit("roles_assigned", data);
    });
  }

  /**
   * Add player with enhanced name registration
   */
  addPlayer(player: Player): boolean {
    try {
      if (this.gameState.players.size >= this.gameState.gameConfig.maxPlayers) {
        console.log(`❌ Cannot add player ${player.name}: room full`);
        return false;
      }

      if (this.gameState.phase !== GamePhase.WAITING) {
        console.log(
          `❌ Cannot add player ${player.name}: game already started`
        );
        return false;
      }

      // 🆕 REVOLUTIONARY: Register player with anonymous name
      const anonymousName = nameRegistry.generateRandomName();
      nameRegistry.registerPlayer(anonymousName, player.id, this.gameId);
      nameRegistry.setPlayerType(player.id, this.gameId, player.type);

      // Create player with anonymous name for the game
      const gamePlayer: Player = {
        ...player,
        name: anonymousName, // This is the key to perfect anonymity!
      };

      // Add to game state
      this.gameState.players.set(player.id, gamePlayer);

      // 🆕 Initialize AI context if AI player
      if (player.type === PlayerType.AI) {
        this.initializeAIPlayer(player.id);
      }

      console.log(
        `✅ Player added: ${player.name} → ${anonymousName} (${player.type})`
      );

      this.emit("player_joined", { player: gamePlayer });

      // Check for auto-start
      this.checkAutoStart();

      return true;
    } catch (error) {
      console.error(`❌ Failed to add player ${player.name}:`, error);
      return false;
    }
  }

  /**
   * Remove player with cleanup
   */
  removePlayer(playerId: PlayerId): boolean {
    try {
      const player = this.gameState.players.get(playerId);
      if (!player) {
        console.log(`❌ Player ${playerId} not found for removal`);
        return false;
      }

      // Remove from game state
      this.gameState.players.delete(playerId);

      // 🆕 Clean up context system
      contextManager.clearPlayerContext(playerId);

      console.log(`✅ Player removed: ${player.name}`);

      this.emit("player_left", { playerId, player });

      // Check win condition if game is active
      if (
        this.gameState.phase !== GamePhase.WAITING &&
        this.gameState.phase !== GamePhase.GAME_OVER
      ) {
        const winCondition = this.checkWinCondition();
        if (winCondition.isGameOver) {
          this.endGame(winCondition.winner!, winCondition.reason);
        }
      }

      return true;
    } catch (error) {
      console.error(`❌ Failed to remove player ${playerId}:`, error);
      return false;
    }
  }

  /**
   * 🔥 COMMIT 2: Enhanced start game with role manager
   */
  startGame(): boolean {
    try {
      if (this.gameState.phase !== GamePhase.WAITING) {
        console.log(`❌ Cannot start game: already in progress`);
        return false;
      }

      if (
        this.gameState.players.size !== this.gameState.gameConfig.maxPlayers
      ) {
        console.log(
          `❌ Cannot start game: need ${this.gameState.gameConfig.maxPlayers} players, have ${this.gameState.players.size}`
        );
        return false;
      }

      // 🔥 COMMIT 2: Use role manager for assignment
      const updatedPlayers = this.roleManager.assignRoles(
        this.gameState.players
      );
      this.gameState.players = updatedPlayers;

      // 🆕 Update all player contexts with role assignments
      for (const [playerId, player] of this.gameState.players.entries()) {
        contextManager.update(playerId, {
          type: "role_assignment",
          data: {
            your_role: player.role,
            your_name: player.name, // Anonymous name
            game_phase: GamePhase.ROLE_ASSIGNMENT,
          },
        });

        // Update AI context builder with player state
        aiContextBuilder.updatePlayerState(playerId, {
          playerId,
          role: player.role!,
          isAlive: true,
          suspicionLevel: 5, // Neutral starting suspicion
          trustLevel: 5, // Neutral starting trust
        });
      }

      // Change to role assignment phase
      this.changePhase(GamePhase.ROLE_ASSIGNMENT);

      // Auto-progress to night after 5 seconds
      this.autoStartTimer = setTimeout(() => {
        this.changePhase(GamePhase.NIGHT);
      }, 5000);

      console.log(
        `🚀 Game started: ${this.gameState.players.size} players with revolutionary architecture`
      );

      this.emit("game_started", { gameState: this.getSerializableGameState() });
      return true;
    } catch (error) {
      console.error(`❌ Failed to start game:`, error);
      return false;
    }
  }

  /**
   * 🔥 COMMIT 2: Enhanced send message with discussion manager
   */
  sendMessage(playerId: PlayerId, content: string): boolean {
    try {
      const player = this.gameState.players.get(playerId);
      if (!player || !player.isAlive) {
        console.log(
          `❌ Cannot send message: player ${playerId} not found or dead`
        );
        return false;
      }

      if (this.gameState.phase !== GamePhase.DISCUSSION) {
        console.log(`❌ Cannot send message: not in discussion phase`);
        return false;
      }

      // 🔥 COMMIT 2: Use discussion manager
      return this.discussionManager.handleMessage(playerId, content);
    } catch (error) {
      console.error(`❌ Failed to send message:`, error);
      return false;
    }
  }

  /**
   * 🔥 COMMIT 2: Enhanced cast vote with voting manager
   */
  castVote(playerId: PlayerId, targetId: PlayerId, reasoning: string): boolean {
    try {
      const voter = this.gameState.players.get(playerId);
      const target = this.gameState.players.get(targetId);

      if (!voter || !target || !voter.isAlive || !target.isAlive) {
        console.log(`❌ Invalid vote: player validation failed`);
        return false;
      }

      if (this.gameState.phase !== GamePhase.VOTING) {
        console.log(`❌ Invalid vote: not in voting phase`);
        return false;
      }

      // 🔥 COMMIT 2: Use voting manager
      return this.votingManager.castVote(playerId, targetId, reasoning);
    } catch (error) {
      console.error(`❌ Failed to cast vote:`, error);
      return false;
    }
  }

  /**
   * 🔥 COMMIT 2: Enhanced night action with night manager
   */
  nightAction(
    playerId: PlayerId,
    action: "kill" | "heal",
    targetId?: PlayerId
  ): boolean {
    try {
      const player = this.gameState.players.get(playerId);
      if (!player || !player.isAlive) {
        console.log(`❌ Invalid night action: player not found or dead`);
        return false;
      }

      if (this.gameState.phase !== GamePhase.NIGHT) {
        console.log(`❌ Invalid night action: not in night phase`);
        return false;
      }

      // 🔥 COMMIT 2: Use night manager
      return this.nightManager.submitNightAction(playerId, action, targetId);
    } catch (error) {
      console.error(`❌ Failed to perform night action:`, error);
      return false;
    }
  }

  /**
   * Get current game state
   */
  getGameState(): GameState {
    return { ...this.gameState };
  }

  /**
   * 🔥 COMMIT 2: Enhanced serializable game state with phase manager data
   */
  getSerializableGameState(): any {
    return {
      id: this.gameState.id,
      roomId: this.gameState.roomId,
      phase: this.gameState.phase,
      currentRound: this.gameState.currentRound,
      players: Array.from(this.gameState.players.values()),
      votes: this.gameState.votes,
      messages: this.gameState.messages,
      nightActions: this.gameState.nightActions,
      eliminatedPlayers: this.gameState.eliminatedPlayers,
      winner: this.gameState.winner,
      phaseStartTime: this.gameState.phaseStartTime.toISOString(),
      phaseEndTime: this.gameState.phaseEndTime.toISOString(),
      gameConfig: this.gameState.gameConfig,

      // 🆕 Enhanced with revolutionary architecture data
      contextStats: contextManager.getContextStats(),
      nameRegistryStats: nameRegistry.getRegistryStats(),
      parsingStats: responseParser.getParsingStats(),
      contextBuildingStats: aiContextBuilder.getContextBuildingStats(),

      // 🔥 COMMIT 2: Phase manager status
      phaseManagerStatus: {
        discussion: this.discussionManager.getDiscussionStatus(),
        voting: this.votingManager.getVotingStatus(),
        night: this.nightManager.getNightStatus(),
        roles: this.roleManager.getAssignmentStats(),
      },
    };
  }

  /**
   * Get player role
   */
  getPlayerRole(playerId: PlayerId): PlayerRole | undefined {
    return this.gameState.players.get(playerId)?.role;
  }

  /**
   * Check if player is alive
   */
  isPlayerAlive(playerId: PlayerId): boolean {
    return this.gameState.players.get(playerId)?.isAlive || false;
  }

  /**
   * Get current phase
   */
  getCurrentPhase(): GamePhase {
    return this.gameState.phase;
  }

  /**
   * Get alive players
   */
  getAlivePlayers(): Player[] {
    return Array.from(this.gameState.players.values()).filter((p) => p.isAlive);
  }

  /**
   * Force phase change (admin control)
   */
  forcePhaseChange(phase: GamePhase): boolean {
    try {
      this.changePhase(phase);
      console.log(`🔧 Force phase change to: ${phase}`);
      return true;
    } catch (error) {
      console.error(`❌ Failed to force phase change:`, error);
      return false;
    }
  }

  /**
   * Set player ready status
   */
  setPlayerReady(playerId: PlayerId, ready: boolean): boolean {
    const player = this.gameState.players.get(playerId);
    if (!player) return false;

    player.isReady = ready;
    this.gameState.players.set(playerId, player);

    console.log(
      `${ready ? "✅" : "❌"} Player ready: ${player.name} = ${ready}`
    );

    this.emit("player_ready", { playerId, ready });

    // Check for auto-start
    if (ready) {
      this.checkAutoStart();
    }

    return true;
  }

  /**
   * 🔥 COMMIT 2: Enhanced cleanup with phase managers
   */
  cleanup(): void {
    try {
      // Clear timers
      if (this.phaseTimer) clearTimeout(this.phaseTimer);
      if (this.autoStartTimer) clearTimeout(this.autoStartTimer);

      // Clean up phase managers
      this.discussionManager.cleanup();
      this.votingManager.cleanup();
      this.nightManager.cleanup();
      this.roleManager.cleanup();

      // Clean up revolutionary architecture components
      nameRegistry.clearGameMapping(this.gameId);
      aiContextBuilder.clearAllContexts();

      // Clear game state
      this.gameState.players.clear();
      this.gameState.votes = [];
      this.gameState.messages = [];
      this.gameState.nightActions = [];

      console.log(`🧹 GameOrchestrator cleanup completed for ${this.gameId}`);

      this.removeAllListeners();
    } catch (error) {
      console.error(`❌ Cleanup failed:`, error);
    }
  }

  /**
   * Initialize game state
   */
  private initializeGameState(roomId: string, config: GameConfig): GameState {
    return {
      id: this.gameId,
      roomId,
      phase: GamePhase.WAITING,
      currentRound: 0,
      players: new Map(),
      votes: [],
      messages: [],
      nightActions: [],
      eliminatedPlayers: [],
      phaseStartTime: new Date(),
      phaseEndTime: new Date(Date.now() + 300000), // 5 minutes for waiting
      gameConfig: config,
      gameHistory: [],
    };
  }

  /**
   * Initialize AI player in context system
   */
  private initializeAIPlayer(playerId: PlayerId): void {
    // Set up initial context for AI player
    contextManager.update(playerId, {
      type: "player_status",
      data: {
        isAlive: true,
        isReady: false,
        joinedAt: new Date(),
      },
    });

    console.log(`🤖 AI player context initialized: ${playerId.slice(-6)}`);
  }

  /**
   * 🔥 COMMIT 2: Enhanced change phase with phase managers
   */
  private changePhase(newPhase: GamePhase): void {
    const oldPhase = this.gameState.phase;
    this.gameState.phase = newPhase;
    this.gameState.phaseStartTime = new Date();

    // Clear existing phase timer
    if (this.phaseTimer) {
      clearTimeout(this.phaseTimer);
    }

    // 🆕 REVOLUTIONARY: Broadcast phase change to all players
    contextManager.push({
      type: "phase_change",
      data: {
        oldPhase,
        newPhase,
        round: this.gameState.currentRound,
        timestamp: new Date(),
      },
    });

    // Update AI context builder
    aiContextBuilder.updateGameState({
      phase: newPhase,
      round: this.gameState.currentRound,
      livingPlayers: this.getAlivePlayers().map((p) => p.id),
      eliminatedPlayers: this.gameState.eliminatedPlayers,
      gameHistory: this.gameState.messages.map(
        (m) => `${this.gameState.players.get(m.playerId)?.name}: ${m.content}`
      ),
      timeRemaining: 30000, // Will be calculated properly by phase managers
    });

    console.log(`🔄 Phase changed: ${oldPhase} → ${newPhase}`);

    // 🔥 COMMIT 2: Start appropriate phase manager
    this.startPhaseManager(newPhase);

    this.emit("phase_changed", {
      oldPhase,
      newPhase,
      round: this.gameState.currentRound,
    });
  }

  /**
   * 🔥 COMMIT 2: Start appropriate phase manager
   */
  private startPhaseManager(phase: GamePhase): void {
    const alivePlayers = this.getAlivePlayers();

    switch (phase) {
      case GamePhase.DISCUSSION:
        this.gameState.currentRound++;
        this.discussionManager.startDiscussion(
          this.gameState.players,
          this.gameState.gameConfig.speakingTimePerPlayer
        );
        break;

      case GamePhase.VOTING:
        const discussionHistory = this.gameState.messages
          .filter((m) => m.phase === GamePhase.DISCUSSION)
          .map(
            (m) =>
              `${this.gameState.players.get(m.playerId)?.name}: ${m.content}`
          );

        this.votingManager.startVoting(
          this.gameState.players,
          discussionHistory,
          this.gameState.gameConfig.votingPhaseDuration
        );
        break;

      case GamePhase.NIGHT:
        this.nightManager.startNight(
          this.gameState.players,
          this.gameState.currentRound,
          this.gameState.gameConfig.nightPhaseDuration
        );
        break;

      case GamePhase.ROLE_ASSIGNMENT:
        // Role assignment happens in startGame
        break;

      case GamePhase.GAME_OVER:
        // Game over is handled in endGame
        break;
    }
  }

  /**
   * Check for auto-start conditions
   */
  private checkAutoStart(): void {
    if (this.gameState.phase !== GamePhase.WAITING) return;

    const allPlayers = Array.from(this.gameState.players.values());
    const readyPlayers = allPlayers.filter((p) => p.isReady);

    // Auto-start if all players are ready and we have the right number
    if (
      readyPlayers.length === allPlayers.length &&
      allPlayers.length === this.gameState.gameConfig.maxPlayers
    ) {
      console.log(
        `🚀 Auto-starting game: all ${allPlayers.length} players ready`
      );
      setTimeout(() => this.startGame(), 2000);
    }
  }

  /**
   * Eliminate player with enhanced processing
   */
  private eliminatePlayer(
    playerId: PlayerId,
    cause: "voted_out" | "mafia_kill"
  ): void {
    const player = this.gameState.players.get(playerId);
    if (!player) {
      console.error(`❌ Cannot eliminate player ${playerId}: not found`);
      return;
    }

    // Update player state
    player.isAlive = false;
    this.gameState.players.set(playerId, player);
    this.gameState.eliminatedPlayers.push(playerId);

    console.log(`💀 ${player.name} (${player.role}) eliminated by ${cause}`);

    this.emit("player_eliminated", {
      playerId,
      playerName: player.name,
      playerRole: player.role,
      cause,
      round: this.gameState.currentRound,
    });
  }

  /**
   * Check win condition
   */
  private checkWinCondition(): {
    winner?: "citizens" | "mafia";
    reason: string;
    isGameOver: boolean;
  } {
    const alivePlayers = this.getAlivePlayers();
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
   * End game with enhanced cleanup
   */
  private endGame(winner: "citizens" | "mafia", reason: string): void {
    this.gameState.phase = GamePhase.GAME_OVER;
    this.gameState.winner = winner;

    // Clear all timers
    if (this.phaseTimer) clearTimeout(this.phaseTimer);
    if (this.autoStartTimer) clearTimeout(this.autoStartTimer);

    console.log(`🏁 Game ended: ${winner} wins - ${reason}`);

    this.emit("game_ended", {
      winner,
      reason,
      finalState: this.getSerializableGameState(),
      stats: this.calculateGameStats(),
    });
  }

  /**
   * Calculate enhanced game statistics
   */
  private calculateGameStats(): any {
    const alivePlayers = this.getAlivePlayers();
    const eliminatedPlayers = this.gameState.eliminatedPlayers;

    return {
      duration: Date.now() - this.gameState.phaseStartTime.getTime(),
      rounds: this.gameState.currentRound,
      totalMessages: this.gameState.messages.length,
      totalVotes: this.gameState.votes.length,
      totalNightActions: this.gameState.nightActions.length,
      playersEliminated: eliminatedPlayers.length,
      revolutionaryArchitecture: {
        contextOperations: contextManager.getContextStats().totalTriggers,
        nameMappings: nameRegistry.getRegistryStats().totalMappings,
        parsingSuccessRate: responseParser.getParsingStats().successRate,
      },
      phaseManagerStats: {
        discussion: this.discussionManager.getDiscussionStatus(),
        voting: this.votingManager.getVotingStatus(),
        night: this.nightManager.getNightStatus(),
      },
    };
  }

  /**
   * Get enhanced debug information
   */
  getDebugInfo(): any {
    return {
      gameId: this.gameId,
      gameState: {
        phase: this.gameState.phase,
        round: this.gameState.currentRound,
        playersCount: this.gameState.players.size,
        messagesCount: this.gameState.messages.length,
        votesCount: this.gameState.votes.length,
      },
      revolutionaryArchitecture: {
        nameRegistry: nameRegistry.getDebugInfo(),
        contextManager: contextManager.getDebugInfo(),
        aiContextBuilder: aiContextBuilder.getDebugInfo(),
        responseParser: responseParser.getParsingStats(),
      },
      phaseManagers: {
        discussion: this.discussionManager.getDebugInfo(),
        voting: this.votingManager.getDebugInfo(),
        night: this.nightManager.getDebugInfo(),
        roles: this.roleManager.getDebugInfo(),
      },
    };
  }
}

// Export for use in game server
export { GameOrchestrator as MafiaGameEngine };
