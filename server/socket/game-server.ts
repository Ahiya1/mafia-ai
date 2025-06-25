// server/socket/game-server.ts - Basic Integration Enhancement for COMMIT 2
// This file shows the key changes needed to integrate the new phase managers

import { Server as SocketIOServer, Socket } from "socket.io";
import { GameOrchestrator as MafiaGameEngine } from "../lib/game/orchestrator";
// ... other existing imports

export class GameSocketServer {
  // ... existing properties

  /**
   * 🔥 ENHANCED: Setup game engine handlers with phase manager support
   */
  private setupGameEngineHandlers(room: any): void {
    const engine = room.gameEngine!;

    // 🔥 NEW: Enhanced phase manager event handling
    engine.on("discussion_started", (data: any) => {
      console.log(`💬 Discussion started in room ${room.code}`);
      this.broadcastToRoom(room.id, "discussion_started", data);
      this.playerManager.broadcastToObservers(
        room.id,
        "discussion_started",
        data
      );

      this.broadcastToDashboards("discussion_started", {
        ...data,
        roomCode: room.code,
        timestamp: new Date().toISOString(),
      });
    });

    engine.on("discussion_ended", (data: any) => {
      console.log(`💬 Discussion ended in room ${room.code}`);
      this.broadcastToRoom(room.id, "discussion_ended", data);
      this.playerManager.broadcastToObservers(
        room.id,
        "discussion_ended",
        data
      );
    });

    engine.on("voting_started", (data: any) => {
      console.log(`🗳️ Voting started in room ${room.code}`);
      this.broadcastToRoom(room.id, "voting_started", data);
      this.playerManager.broadcastToObservers(room.id, "voting_started", data);

      this.broadcastToDashboards("voting_started", {
        ...data,
        roomCode: room.code,
        timestamp: new Date().toISOString(),
      });
    });

    engine.on("voting_completed", (data: any) => {
      console.log(`🗳️ Voting completed in room ${room.code}`);
      this.broadcastToRoom(room.id, "voting_completed", data);
      this.playerManager.broadcastToObservers(
        room.id,
        "voting_completed",
        data
      );
    });

    engine.on("night_started", (data: any) => {
      console.log(`🌙 Night started in room ${room.code}`);
      this.broadcastToRoom(room.id, "night_started", data);
      this.playerManager.broadcastToObservers(room.id, "night_started", data);

      this.broadcastToDashboards("night_started", {
        ...data,
        roomCode: room.code,
        timestamp: new Date().toISOString(),
      });
    });

    engine.on("night_ended", (data: any) => {
      console.log(`🌙 Night ended in room ${room.code}`);
      this.broadcastToRoom(room.id, "night_ended", data);
      this.playerManager.broadcastToObservers(room.id, "night_ended", data);
    });

    // 🔥 NEW: Mafia chat coordination
    engine.on("mafia_chat_message", (data: any) => {
      console.log(`🔴 Mafia chat in room ${room.code}: ${data.playerName}`);

      // Send to observers only (mafia chat is secret from regular players)
      this.playerManager.broadcastToObservers(
        room.id,
        "mafia_chat_message",
        data
      );

      this.broadcastToDashboards("mafia_chat_message", {
        ...data,
        roomCode: room.code,
        timestamp: new Date().toISOString(),
      });
    });

    // 🔥 NEW: Enhanced player elimination with context
    engine.on("player_eliminated", (data: any) => {
      const enhancedData = {
        ...data,
        roomCode: room.code,
        timestamp: new Date().toISOString(),
        remainingPlayers: Array.from(room.players.values()).filter(
          (p: any) => p.isAlive
        ).length,
      };

      console.log(
        `💀 Player eliminated in room ${room.code}: ${data.playerName} (${data.cause})`
      );

      this.broadcastToRoom(room.id, "player_eliminated", enhancedData);
      this.playerManager.broadcastToObservers(
        room.id,
        "player_eliminated",
        enhancedData
      );
      this.broadcastToDashboards("player_eliminated", enhancedData);
    });

    // 🔥 NEW: Enhanced game ending with phase manager stats
    engine.on("game_ended", (data: any) => {
      const enhancedData = {
        ...data,
        roomCode: room.code,
        timestamp: new Date().toISOString(),
        phaseManagerStats: {
          totalPhases: data.stats?.totalRounds * 3 || 0, // Approximate
          gameEfficiency: data.stats?.gameDuration
            ? data.stats.gameDuration / (data.stats.totalRounds * 300000)
            : 0, // vs expected 5min/round
        },
      };

      console.log(`🏁 Game ended in room ${room.code}: ${data.winner} wins`);

      this.broadcastToRoom(room.id, "game_ended", enhancedData);
      this.playerManager.broadcastToObservers(
        room.id,
        "game_ended",
        enhancedData
      );
      this.broadcastToDashboards("game_ended", enhancedData);

      // Clean up with enhanced phase manager cleanup
      this.cleanupGameWithPhaseManagers(room);
    });

    // Enhanced observer updates with phase context
    engine.on("observer_update", (data: any) => {
      const enhancedData = {
        ...data,
        roomCode: room.code,
        currentPhase: engine.getCurrentPhase(),
        timestamp: new Date().toISOString(),
      };

      this.playerManager.broadcastToObservers(
        room.id,
        "observer_update",
        enhancedData
      );
      this.broadcastToDashboards("observer_update", enhancedData);
    });

    // 🔥 NEW: Phase transition events
    engine.on("phase_changed", (data: any) => {
      const enhancedData = {
        ...data,
        roomCode: room.code,
        timestamp: new Date().toISOString(),
      };

      console.log(
        `🔄 Phase transition in room ${room.code}: ${data.oldPhase} → ${data.newPhase}`
      );

      this.broadcastToRoom(room.id, "phase_changed", enhancedData);
      this.playerManager.broadcastToObservers(
        room.id,
        "phase_changed",
        enhancedData
      );
      this.broadcastToDashboards("phase_changed", enhancedData);

      // Update game state for all connected clients
      const gameState = engine.getSerializableGameState();
      this.broadcastToRoom(room.id, "game_state_update", gameState);
      this.playerManager.broadcastToObservers(
        room.id,
        "game_state_update",
        gameState
      );
    });

    // 🔥 NEW: Vote coordination events
    engine.on("vote_cast", (data: any) => {
      const enhancedData = {
        ...data,
        roomCode: room.code,
        timestamp: new Date().toISOString(),
      };

      this.broadcastToRoom(room.id, "vote_cast", enhancedData);
      this.playerManager.broadcastToObservers(
        room.id,
        "vote_cast",
        enhancedData
      );
      this.broadcastToDashboards("vote_cast", enhancedData);
    });

    // ... existing event handlers remain the same
  }

  /**
   * 🔥 NEW: Enhanced game cleanup with phase managers
   */
  private cleanupGameWithPhaseManagers(room: any): void {
    if (room.gameEngine) {
      // Get final statistics before cleanup
      const finalStats = room.gameEngine.getDebugInfo();

      console.log(`🧹 Enhanced cleanup for room ${room.code}:`, {
        phaseManagers: finalStats.phaseManagers,
        revolutionaryArchitecture: {
          nameRegistry: finalStats.nameRegistry?.totalMappings || 0,
          contextOperations:
            finalStats.contextManager?.stats?.totalTriggers || 0,
          parsingSuccessRate: finalStats.responseParser?.successRate || 0,
        },
      });

      // Cleanup with enhanced phase manager support
      room.gameEngine.cleanup();
      room.gameEngine = null;
    }

    // Reset players for next game
    room.players.forEach((player: any) => {
      player.isReady = false;
      player.isAlive = true;
      player.role = undefined;
      player.votedFor = undefined;
    });

    console.log(`🧹 Enhanced cleanup completed for room ${room.code}`);
  }

  /**
   * 🔥 NEW: Get enhanced room statistics with phase manager data
   */
  getRoomStatsEnhanced(): any {
    const baseStats = this.getRoomStats();
    const rooms = this.roomManager.getAllRooms();

    // Add phase manager statistics
    const phaseManagerStats = {
      activeDiscussions: 0,
      activeVotingSessions: 0,
      activeNightPhases: 0,
      totalPhaseTransitions: 0,
    };

    for (const room of rooms) {
      if (room.gameEngine) {
        try {
          const debugInfo = room.gameEngine.getDebugInfo();
          if (debugInfo.phaseManagers) {
            if (debugInfo.phaseManagers.discussion?.isActive)
              phaseManagerStats.activeDiscussions++;
            if (debugInfo.phaseManagers.voting?.isActive)
              phaseManagerStats.activeVotingSessions++;
            if (debugInfo.phaseManagers.night?.isActive)
              phaseManagerStats.activeNightPhases++;
          }
        } catch (error) {
          console.warn(
            `Failed to get debug info for room ${room.code}:`,
            error
          );
        }
      }
    }

    return {
      ...baseStats,
      phaseManagerStats,
      revolutionaryArchitecture: {
        enabled: true,
        components: [
          "NameRegistry",
          "ContextManager",
          "AIContextBuilder",
          "ResponseParser",
          "DiscussionManager",
          "VotingManager",
          "NightManager",
          "RoleManager",
        ],
      },
    };
  }

  /**
   * 🔥 NEW: Create AI-only game with enhanced phase managers
   */
  createAIOnlyGameEnhanced(gameConfig?: any): any {
    const result = this.createAIOnlyGame(gameConfig);

    console.log(`🤖 AI-only game created with revolutionary architecture:`, {
      roomCode: result.code,
      phaseManagers: "All enabled",
      revolutionaryFeatures: [
        "Perfect anonymity",
        "Bulletproof voting coordination",
        "Turn-based discussion",
        "Parallel voting system",
        "Mafia chat coordination",
      ],
    });

    return result;
  }

  // ... rest of existing methods remain the same
}

// Export note: The existing GameSocketServer class should be enhanced with these methods
// This file shows the integration points for COMMIT 2
