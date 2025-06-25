// server/lib/game/orchestrator.ts - Main Game Coordinator Shell
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
} from "../types/game";
import { nameRegistry } from "./context/name-registry";
import { contextManager } from "./context/context-manager";
import { aiContextBuilder } from "./context/ai-context-builder";
import { responseParser } from "./context/response-parser";

export class GameOrchestrator
  extends EventEmitter
  implements GameOrchestratorInterface
{
  private gameState: GameState;
  private gameId: string;

  // 🆕 NEW: Specialized managers for each aspect
  // These will be enhanced in later commits with full implementations
  private discussionManager: any = null; // Will be created in Commit 2
  private votingManager: any = null; // Will be created in Commit 2
  private nightManager: any = null; // Will be created in Commit 2

  constructor(roomId: string, config: GameConfig) {
    super();

    this.gameId = `game_${Date.now()}_${Math.random()
      .toString(36)
      .substr(2, 9)}`;

    // Initialize game state
    this.gameState = this.initializeGameState(roomId, config);

    // Setup the revolutionary name registry for this game
    nameRegistry.createGameMapping(this.gameId);

    console.log(`🎮 GameOrchestrator initialized: ${this.gameId}`);
    console.log(`🏗️ Revolutionary architecture: Context system ready`);
    console.log(`🏷️ Name registry: Perfect anonymity enabled`);
    console.log(`🔍 Response parser: Bulletproof JSON validation`);
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
      return true;
    } catch (error) {
      console.error(`❌ Failed to remove player ${playerId}:`, error);
      return false;
    }
  }

  /**
   * Start game with enhanced setup
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

      // Assign roles
      this.assignRoles();

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
   * Send message with context coordination
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

      // For now, just add to game state (full implementation in later commits)
      const message = {
        id: `msg_${Date.now()}`,
        playerId,
        content,
        timestamp: new Date(),
        phase: this.gameState.phase,
        messageType: "discussion" as const,
      };

      this.gameState.messages.push(message);

      // 🆕 Add to context builder history
      aiContextBuilder.addGameHistoryMessage(`${player.name}: ${content}`);

      console.log(`💬 Message sent: ${player.name}: "${content}"`);

      this.emit("message_received", { message });
      return true;
    } catch (error) {
      console.error(`❌ Failed to send message:`, error);
      return false;
    }
  }

  /**
   * Cast vote with enhanced validation (stub for now)
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

      // For now, simple implementation (full coordination in later commits)
      const vote = {
        voterId: playerId,
        targetId,
        reasoning,
        timestamp: new Date(),
      };

      this.gameState.votes.push(vote);

      console.log(`🗳️ Vote cast: ${voter.name} → ${target.name}`);

      this.emit("vote_cast", { vote });
      return true;
    } catch (error) {
      console.error(`❌ Failed to cast vote:`, error);
      return false;
    }
  }

  /**
   * Night action with context management (stub for now)
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

      // For now, simple implementation (full coordination in later commits)
      const nightAction = {
        playerId,
        action,
        targetId,
        timestamp: new Date(),
      };

      this.gameState.nightActions.push(nightAction);

      console.log(
        `🌙 Night action: ${player.name} ${action} ${
          targetId ? this.gameState.players.get(targetId)?.name : "nobody"
        }`
      );

      this.emit("night_action", { action: nightAction });
      return true;
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
   * Get serializable game state with enhanced data
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
    return true;
  }

  /**
   * Cleanup all resources
   */
  cleanup(): void {
    try {
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
   * Assign roles to players
   */
  private assignRoles(): void {
    const players = Array.from(this.gameState.players.values());
    const shuffled = [...players].sort(() => Math.random() - 0.5);

    // Standard 10-player setup: 2 Mafia, 1 Healer, 7 Citizens
    shuffled[0].role = PlayerRole.MAFIA_LEADER;
    shuffled[1].role = PlayerRole.MAFIA_MEMBER;
    shuffled[2].role = PlayerRole.HEALER;

    for (let i = 3; i < shuffled.length; i++) {
      shuffled[i].role = PlayerRole.CITIZEN;
    }

    // Update game state
    shuffled.forEach((player) => {
      this.gameState.players.set(player.id, player);
    });

    console.log(`🎭 Roles assigned: 2 Mafia, 1 Healer, 7 Citizens`);
  }

  /**
   * Change game phase with context broadcasting
   */
  private changePhase(newPhase: GamePhase): void {
    const oldPhase = this.gameState.phase;
    this.gameState.phase = newPhase;
    this.gameState.phaseStartTime = new Date();

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
      timeRemaining: 30000, // Will be calculated properly in later commits
    });

    console.log(`🔄 Phase changed: ${oldPhase} → ${newPhase}`);

    this.emit("phase_changed", {
      oldPhase,
      newPhase,
      round: this.gameState.currentRound,
    });
  }

  /**
   * Get debug information about the revolutionary architecture
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
      nameRegistry: nameRegistry.getDebugInfo(),
      contextManager: contextManager.getDebugInfo(),
      aiContextBuilder: aiContextBuilder.getDebugInfo(),
      responseParser: responseParser.getParsingStats(),
    };
  }
}

// Export for use in game server
export { GameOrchestrator as MafiaGameEngine };
