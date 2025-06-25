// server/lib/game/orchestrator.ts - COMMIT 4: Complete Analytics Integration
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
import { analyticsManager } from "../analytics/analytics-manager"; // 🔥 COMMIT 4: Analytics integration

// Import the revolutionary phase managers
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
  private gameSessionId: string; // 🔥 COMMIT 4: For analytics tracking

  // Revolutionary phase managers
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

    // 🔥 COMMIT 4: Create game session ID for analytics
    this.gameSessionId = `session_${Date.now()}_${Math.random()
      .toString(36)
      .substr(2, 9)}`;

    // Initialize game state
    this.gameState = this.initializeGameState(roomId, config);

    // Initialize all phase managers
    this.discussionManager = new DiscussionManager(this.gameId);
    this.votingManager = new VotingManager(this.gameId);
    this.nightManager = new NightManager(this.gameId);
    this.roleManager = new RoleManager(this.gameId);

    // Setup the revolutionary name registry for this game
    nameRegistry.createGameMapping(this.gameId);

    // Setup phase manager event handlers
    this.setupPhaseManagerHandlers();

    // 🔥 COMMIT 4: Track game session creation
    this.trackAnalyticsEvent({
      eventType: "game_created",
      eventData: {
        gameId: this.gameId,
        roomId,
        config,
        maxPlayers: config.maxPlayers,
        premiumModelsEnabled: config.premiumModelsEnabled || false,
      },
      gamePhase: GamePhase.WAITING,
      roundNumber: 0,
    });

    console.log(
      `🎮 GameOrchestrator initialized with full analytics: ${this.gameId}`
    );
    console.log(`📊 Analytics session: ${this.gameSessionId}`);
    console.log(`🏗️ Revolutionary architecture: All systems online`);
  }

  /**
   * 🔥 COMMIT 4: Analytics event tracking helper
   */
  private async trackAnalyticsEvent(event: {
    eventType: string;
    eventData: any;
    gamePhase: GamePhase;
    roundNumber: number;
    playerId?: PlayerId;
    aiModel?: string;
    aiCost?: number;
    aiTokensUsed?: number;
    aiResponseTimeMs?: number;
  }): Promise<void> {
    try {
      await analyticsManager.trackGameEvent({
        gameSessionId: this.gameSessionId,
        eventType: event.eventType as any,
        eventData: event.eventData,
        gamePhase: event.gamePhase,
        roundNumber: event.roundNumber,
        playerId: event.playerId,
        aiModel: event.aiModel as any,
        aiCost: event.aiCost,
        aiTokensUsed: event.aiTokensUsed,
        aiResponseTimeMs: event.aiResponseTimeMs,
      });
    } catch (error) {
      console.error(`❌ Analytics tracking failed:`, error);
    }
  }

  /**
   * Setup comprehensive phase manager event handlers with analytics
   */
  private setupPhaseManagerHandlers(): void {
    // Discussion Manager Events
    this.discussionManager.on("discussion_started", (data) => {
      console.log(
        `💬 Discussion started: ${data.speakingOrder.length} players`
      );

      // 🔥 COMMIT 4: Track discussion started
      this.trackAnalyticsEvent({
        eventType: "phase_change",
        eventData: {
          phase: "discussion",
          speakingOrder: data.speakingOrder.length,
          timePerPlayer: data.timePerPlayer,
        },
        gamePhase: GamePhase.DISCUSSION,
        roundNumber: this.gameState.currentRound,
      });

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

      // 🔥 COMMIT 4: Track message with analytics
      const player = this.gameState.players.get(data.playerId);
      this.trackAnalyticsEvent({
        eventType: "message",
        eventData: {
          playerId: data.playerId,
          playerName: data.playerName,
          playerType: player?.type,
          messageLength: data.content.length,
          phase: "discussion",
        },
        gamePhase: this.gameState.phase,
        roundNumber: this.gameState.currentRound,
        playerId: data.playerId,
        aiModel: player?.type === PlayerType.AI ? player.model : undefined,
      });

      this.emit("message_received", data);
    });

    this.discussionManager.on("discussion_ended", (data) => {
      console.log(`💬 Discussion ended: ${data.reason}`);

      // 🔥 COMMIT 4: Track discussion ended
      this.trackAnalyticsEvent({
        eventType: "phase_change",
        eventData: {
          phase: "discussion_ended",
          reason: data.reason,
          hasSpoken: data.hasSpoken?.length || 0,
          totalSpeakers: data.speakingOrder?.length || 0,
        },
        gamePhase: GamePhase.DISCUSSION,
        roundNumber: this.gameState.currentRound,
      });

      this.emit("discussion_ended", data);

      // Transition to voting phase
      setTimeout(() => {
        this.changePhase(GamePhase.VOTING);
      }, 2000);
    });

    // Voting Manager Events
    this.votingManager.on("voting_started", (data) => {
      console.log(`🗳️ Voting started: ${data.alivePlayers.length} players`);

      // 🔥 COMMIT 4: Track voting started
      this.trackAnalyticsEvent({
        eventType: "phase_change",
        eventData: {
          phase: "voting",
          alivePlayersCount: data.alivePlayers.length,
          votingDuration: data.votingDuration,
        },
        gamePhase: GamePhase.VOTING,
        roundNumber: this.gameState.currentRound,
      });

      this.emit("voting_started", data);
    });

    this.votingManager.on("vote_cast", (data) => {
      // Add vote to game state
      this.gameState.votes.push(data.vote);

      // 🔥 COMMIT 4: Track vote with enhanced analytics
      const voter = this.gameState.players.get(data.vote.voterId);
      const target = this.gameState.players.get(data.vote.targetId);

      this.trackAnalyticsEvent({
        eventType: "vote",
        eventData: {
          voterId: data.vote.voterId,
          voterName: data.voterName,
          voterType: voter?.type,
          voterRole: voter?.role,
          targetId: data.vote.targetId,
          targetName: data.targetName,
          targetRole: target?.role,
          reasoning: data.vote.reasoning,
          votesRemaining: data.votesRemaining,
        },
        gamePhase: this.gameState.phase,
        roundNumber: this.gameState.currentRound,
        playerId: data.vote.voterId,
        aiModel: voter?.type === PlayerType.AI ? voter.model : undefined,
      });

      this.emit("vote_cast", data);
    });

    this.votingManager.on("voting_ended", (data) => {
      console.log(`🗳️ Voting ended: ${data.reason}`);

      // 🔥 COMMIT 4: Track voting results
      this.trackAnalyticsEvent({
        eventType: "phase_change",
        eventData: {
          phase: "voting_ended",
          reason: data.reason,
          votesCollected: data.votesCollected,
          totalVoters: data.totalVoters,
          eliminationResult: data.eliminationResult,
        },
        gamePhase: GamePhase.VOTING,
        roundNumber: this.gameState.currentRound,
      });

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

      // 🔥 COMMIT 4: Track night started
      this.trackAnalyticsEvent({
        eventType: "phase_change",
        eventData: {
          phase: "night",
          round: data.round,
          alivePlayersCount: data.alivePlayers.length,
          duration: data.duration,
        },
        gamePhase: GamePhase.NIGHT,
        roundNumber: this.gameState.currentRound,
      });

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

      // 🔥 COMMIT 4: Track night action
      const player = this.gameState.players.get(data.playerId);
      const target = data.targetId
        ? this.gameState.players.get(data.targetId)
        : null;

      this.trackAnalyticsEvent({
        eventType: "night_action",
        eventData: {
          playerId: data.playerId,
          playerName: data.playerName,
          playerType: player?.type,
          playerRole: player?.role,
          action: data.action,
          targetId: data.targetId,
          targetName: data.targetName,
          targetRole: target?.role,
        },
        gamePhase: this.gameState.phase,
        roundNumber: this.gameState.currentRound,
        playerId: data.playerId,
        aiModel: player?.type === PlayerType.AI ? player.model : undefined,
      });

      this.emit("night_action_submitted", data);
    });

    this.nightManager.on("mafia_chat", (data) => {
      // 🔥 COMMIT 4: Track mafia chat
      const player = this.gameState.players.get(data.playerId);
      this.trackAnalyticsEvent({
        eventType: "mafia_chat",
        eventData: {
          playerId: data.playerId,
          playerName: data.playerName,
          playerType: player?.type,
          message: data.message,
          messageLength: data.message.length,
        },
        gamePhase: this.gameState.phase,
        roundNumber: this.gameState.currentRound,
        playerId: data.playerId,
        aiModel: player?.type === PlayerType.AI ? player.model : undefined,
      });

      this.emit("mafia_chat", data);
    });

    this.nightManager.on("night_ended", (data) => {
      console.log(`🌙 Night ${data.round} ended: ${data.reason}`);

      // 🔥 COMMIT 4: Track night ended
      this.trackAnalyticsEvent({
        eventType: "phase_change",
        eventData: {
          phase: "night_ended",
          round: data.round,
          reason: data.reason,
          nightResult: data.nightResult,
          actionsSubmitted: data.nightActions?.length || 0,
        },
        gamePhase: GamePhase.NIGHT,
        roundNumber: this.gameState.currentRound,
      });

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

      // 🔥 COMMIT 4: Track role assignments
      this.trackAnalyticsEvent({
        eventType: "roles_assigned",
        eventData: {
          assignments: data.assignments.map(
            (a: { playerName: any; role: any }) => ({
              playerName: a.playerName,
              role: a.role,
            })
          ),
          distribution: data.distribution,
        },
        gamePhase: GamePhase.ROLE_ASSIGNMENT,
        roundNumber: this.gameState.currentRound,
      });

      this.emit("roles_assigned", data);
    });
  }

  /**
   * Add player with enhanced name registration and analytics
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

      // REVOLUTIONARY: Register player with anonymous name
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

      // Initialize AI context if AI player
      if (player.type === PlayerType.AI) {
        this.initializeAIPlayer(player.id);
      }

      // 🔥 COMMIT 4: Track player joined
      this.trackAnalyticsEvent({
        eventType: "player_joined",
        eventData: {
          playerId: player.id,
          playerType: player.type,
          originalName: player.name,
          anonymousName: anonymousName,
          aiModel: player.model,
          totalPlayers: this.gameState.players.size,
        },
        gamePhase: this.gameState.phase,
        roundNumber: this.gameState.currentRound,
        playerId: player.id,
        aiModel: player.type === PlayerType.AI ? player.model : undefined,
      });

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
   * Remove player with cleanup and analytics
   */
  removePlayer(playerId: PlayerId): boolean {
    try {
      const player = this.gameState.players.get(playerId);
      if (!player) {
        console.log(`❌ Player ${playerId} not found for removal`);
        return false;
      }

      // 🔥 COMMIT 4: Track player left
      this.trackAnalyticsEvent({
        eventType: "player_left",
        eventData: {
          playerId,
          playerName: player.name,
          playerType: player.type,
          wasAlive: player.isAlive,
          phase: this.gameState.phase,
          round: this.gameState.currentRound,
        },
        gamePhase: this.gameState.phase,
        roundNumber: this.gameState.currentRound,
        playerId,
      });

      // Remove from game state
      this.gameState.players.delete(playerId);

      // Clean up context system
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
   * Enhanced start game with role manager and analytics
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

      // Use role manager for assignment
      const updatedPlayers = this.roleManager.assignRoles(
        this.gameState.players
      );
      this.gameState.players = updatedPlayers;

      // Update all player contexts with role assignments
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

      // 🔥 COMMIT 4: Track game started with full analytics
      const humanCount = Array.from(this.gameState.players.values()).filter(
        (p) => p.type === PlayerType.HUMAN
      ).length;
      const aiCount = Array.from(this.gameState.players.values()).filter(
        (p) => p.type === PlayerType.AI
      ).length;

      this.trackAnalyticsEvent({
        eventType: "game_started",
        eventData: {
          gameId: this.gameId,
          totalPlayers: this.gameState.players.size,
          humanPlayers: humanCount,
          aiPlayers: aiCount,
          premiumModelsEnabled: this.gameState.gameConfig.premiumModelsEnabled,
          gameConfig: this.gameState.gameConfig,
          roleDistribution: this.roleManager.getTeamComposition(),
        },
        gamePhase: GamePhase.ROLE_ASSIGNMENT,
        roundNumber: this.gameState.currentRound,
      });

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
   * Enhanced send message with discussion manager and analytics
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

      // Use discussion manager
      return this.discussionManager.handleMessage(playerId, content);
    } catch (error) {
      console.error(`❌ Failed to send message:`, error);
      return false;
    }
  }

  /**
   * Enhanced cast vote with voting manager and analytics
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

      // Use voting manager
      return this.votingManager.castVote(playerId, targetId, reasoning);
    } catch (error) {
      console.error(`❌ Failed to cast vote:`, error);
      return false;
    }
  }

  /**
   * Enhanced night action with night manager and analytics
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

      // Use night manager
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
   * Enhanced serializable game state with phase manager data and analytics
   */
  getSerializableGameState(): any {
    return {
      id: this.gameState.id,
      sessionId: this.gameSessionId, // 🔥 COMMIT 4: Include session ID
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

      // Enhanced with revolutionary architecture data
      contextStats: contextManager.getContextStats(),
      nameRegistryStats: nameRegistry.getRegistryStats(),
      parsingStats: responseParser.getParsingStats(),
      contextBuildingStats: aiContextBuilder.getContextBuildingStats(),

      // Phase manager status
      phaseManagerStatus: {
        discussion: this.discussionManager.getDiscussionStatus(),
        voting: this.votingManager.getVotingStatus(),
        night: this.nightManager.getNightStatus(),
        roles: this.roleManager.getAssignmentStats(),
      },

      // 🔥 COMMIT 4: Analytics integration status
      analyticsIntegration: {
        sessionId: this.gameSessionId,
        eventsTracked: true,
        realTimeAnalytics: true,
      },
    };
  }

  /**
   * Eliminate player with enhanced processing and analytics
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

    // 🔥 COMMIT 4: Track elimination with comprehensive analytics
    this.trackAnalyticsEvent({
      eventType: "elimination",
      eventData: {
        playerId,
        playerName: player.name,
        playerType: player.type,
        playerRole: player.role,
        cause,
        round: this.gameState.currentRound,
        survivedRounds: this.gameState.currentRound,
        totalPlayersRemaining: this.getAlivePlayers().length,
        mafiaRemaining: this.getAlivePlayers().filter(
          (p) =>
            p.role === PlayerRole.MAFIA_LEADER ||
            p.role === PlayerRole.MAFIA_MEMBER
        ).length,
        citizensRemaining: this.getAlivePlayers().filter(
          (p) => p.role === PlayerRole.CITIZEN || p.role === PlayerRole.HEALER
        ).length,
      },
      gamePhase: this.gameState.phase,
      roundNumber: this.gameState.currentRound,
      playerId,
      aiModel: player.type === PlayerType.AI ? player.model : undefined,
    });

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
   * End game with enhanced cleanup and analytics
   */
  private endGame(winner: "citizens" | "mafia", reason: string): void {
    this.gameState.phase = GamePhase.GAME_OVER;
    this.gameState.winner = winner;

    // Clear all timers
    if (this.phaseTimer) clearTimeout(this.phaseTimer);
    if (this.autoStartTimer) clearTimeout(this.autoStartTimer);

    const finalStats = this.calculateGameStats();

    // 🔥 COMMIT 4: Track game ended with comprehensive analytics
    this.trackAnalyticsEvent({
      eventType: "game_ended",
      eventData: {
        winner,
        reason,
        finalStats,
        duration: finalStats.duration,
        rounds: finalStats.rounds,
        totalMessages: finalStats.totalMessages,
        totalVotes: finalStats.totalVotes,
        totalNightActions: finalStats.totalNightActions,
        playersEliminated: finalStats.playersEliminated,
        revolutionaryArchitecture: finalStats.revolutionaryArchitecture,
      },
      gamePhase: this.gameState.phase,
      roundNumber: this.gameState.currentRound,
    });

    console.log(`🏁 Game ended: ${winner} wins - ${reason}`);

    this.emit("game_ended", {
      winner,
      reason,
      finalState: this.getSerializableGameState(),
      stats: finalStats,
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
      analyticsIntegration: {
        sessionId: this.gameSessionId,
        eventsTracked: true,
      },
    };
  }

  /**
   * Enhanced change phase with AI context updates and analytics
   */
  private changePhase(newPhase: GamePhase): void {
    const oldPhase = this.gameState.phase;
    this.gameState.phase = newPhase;
    this.gameState.phaseStartTime = new Date();

    // Clear existing phase timer
    if (this.phaseTimer) {
      clearTimeout(this.phaseTimer);
    }

    // 🔥 COMMIT 4: Track phase change
    this.trackAnalyticsEvent({
      eventType: "phase_change",
      eventData: {
        oldPhase,
        newPhase,
        round: this.gameState.currentRound,
        timeRemaining: this.getPhaseTimeRemaining(newPhase),
      },
      gamePhase: newPhase,
      roundNumber: this.gameState.currentRound,
    });

    // REVOLUTIONARY: Broadcast phase change to all players
    contextManager.push({
      type: "phase_change",
      data: {
        oldPhase,
        newPhase,
        round: this.gameState.currentRound,
        timestamp: new Date(),
      },
    });

    // Enhanced AI context builder update with living player names
    const livingPlayers = this.getAlivePlayers().map((p) => p.id);
    const livingPlayerNames = livingPlayers.map(
      (id) => nameRegistry.getName(id, this.gameId) || "Unknown"
    );

    aiContextBuilder.updateGameState({
      phase: newPhase,
      round: this.gameState.currentRound,
      livingPlayers: livingPlayers,
      eliminatedPlayers: this.gameState.eliminatedPlayers,
      gameHistory: this.gameState.messages.map(
        (m) =>
          `${nameRegistry.getName(m.playerId, this.gameId) || "Unknown"}: ${
            m.content
          }`
      ),
      timeRemaining: this.getPhaseTimeRemaining(newPhase),
    });

    // Update all AI players with enhanced context
    for (const [playerId, player] of this.gameState.players.entries()) {
      if (player.type === PlayerType.AI) {
        contextManager.update(playerId, {
          type: "game_state",
          data: {
            phase: newPhase,
            round: this.gameState.currentRound,
            livingPlayers: livingPlayerNames,
            eliminatedPlayers: this.gameState.eliminatedPlayers.map(
              (id) => nameRegistry.getName(id, this.gameId) || "Unknown"
            ),
            gameHistory: this.gameState.messages
              .slice(-10)
              .map(
                (m) =>
                  `${
                    nameRegistry.getName(m.playerId, this.gameId) || "Unknown"
                  }: ${m.content}`
              ),
            timeRemaining: this.getPhaseTimeRemaining(newPhase),
          },
        });
      }
    }

    console.log(
      `🔄 Phase changed with AI integration: ${oldPhase} → ${newPhase}`
    );

    // Start appropriate phase manager
    this.startPhaseManager(newPhase);

    this.emit("phase_changed", {
      oldPhase,
      newPhase,
      round: this.gameState.currentRound,
    });
  }

  /**
   * Start appropriate phase manager
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
   * Enhanced cleanup with phase managers and analytics
   */
  cleanup(): void {
    try {
      // 🔥 COMMIT 4: Track cleanup for analytics
      this.trackAnalyticsEvent({
        eventType: "game_cleanup",
        eventData: {
          gameId: this.gameId,
          phase: this.gameState.phase,
          round: this.gameState.currentRound,
          playersCount: this.gameState.players.size,
        },
        gamePhase: this.gameState.phase,
        roundNumber: this.gameState.currentRound,
      });

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
   * Enhanced AI player initialization with real personality
   */
  private initializeAIPlayer(playerId: PlayerId): void {
    try {
      // Get AI personalities from the personality pool
      const personalities =
        require("../../../src/lib/ai/personality-pool").selectGamePersonalities(
          this.gameState.gameConfig.premiumModelsEnabled,
          1
        );

      if (personalities.length > 0) {
        const personality = personalities[0];

        // Set personality in context manager
        contextManager.setPlayerPersonality(playerId, personality);

        // Set up initial context for AI player
        contextManager.update(playerId, {
          type: "player_status",
          data: {
            isAlive: true,
            isReady: false,
            joinedAt: new Date(),
            personality: personality.name,
            model: personality.model,
            archetype: personality.archetype,
          },
        });

        console.log(
          `🤖 AI player initialized: ${playerId.slice(-6)} → ${
            personality.name
          } (${personality.model})`
        );
      } else {
        console.warn(`⚠️ No personality available for AI player ${playerId}`);

        // Fallback initialization
        contextManager.update(playerId, {
          type: "player_status",
          data: {
            isAlive: true,
            isReady: false,
            joinedAt: new Date(),
          },
        });
      }
    } catch (error) {
      console.error(`❌ Failed to initialize AI player ${playerId}:`, error);

      // Emergency fallback
      contextManager.update(playerId, {
        type: "player_status",
        data: {
          isAlive: true,
          isReady: false,
          joinedAt: new Date(),
        },
      });
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
   * Get phase time remaining
   */
  private getPhaseTimeRemaining(phase: GamePhase): number {
    const config = this.gameState.gameConfig;

    switch (phase) {
      case GamePhase.DISCUSSION:
        return config.discussionPhaseDuration;
      case GamePhase.VOTING:
        return config.votingPhaseDuration;
      case GamePhase.NIGHT:
        return config.nightPhaseDuration;
      case GamePhase.ROLE_ASSIGNMENT:
        return 5000; // 5 seconds
      default:
        return 30000; // 30 seconds default
    }
  }

  /**
   * Test AI integration for all AI players
   */
  async testAIIntegration(): Promise<any> {
    const aiPlayers = Array.from(this.gameState.players.values()).filter(
      (p) => p.type === PlayerType.AI
    );

    console.log(
      `🧪 Testing AI integration for ${aiPlayers.length} AI players...`
    );

    const results = await contextManager.testAllAIIntegrations();

    console.log(`✅ AI integration test completed:`, results);

    return {
      ...results,
      aiPlayersCount: aiPlayers.length,
      integrationReady: results.passed === results.tested,
    };
  }

  /**
   * Get AI coordination statistics
   */
  getAICoordinationStats(): any {
    return {
      contextManager: contextManager.getContextStats(),
      aiCoordination:
        require("../ai/ai-coordinator").aiCoordinator.getCoordinationStats(),
      personalitiesAssigned: Array.from(this.gameState.players.values()).filter(
        (p) => p.type === PlayerType.AI
      ).length,
    };
  }

  /**
   * 🔥 COMMIT 4: Get analytics session ID
   */
  getAnalyticsSessionId(): string {
    return this.gameSessionId;
  }

  /**
   * Enhanced debug information with AI integration and analytics
   */
  getDebugInfo(): any {
    return {
      gameId: this.gameId,
      sessionId: this.gameSessionId, // 🔥 COMMIT 4: Include session ID
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
      // AI integration statistics
      aiIntegration: this.getAICoordinationStats(),
      realAIActive: true,
      jsonOnlyResponses: true,
      // 🔥 COMMIT 4: Analytics integration
      analyticsIntegration: {
        sessionId: this.gameSessionId,
        trackingActive: true,
        eventsTracked: true,
      },
    };
  }
}

// Export for use in game server
export { GameOrchestrator as MafiaGameEngine };
