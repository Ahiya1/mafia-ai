// server/socket/game-server.ts - FIXED: Enhanced Observer Support with Complete History
import { Server as SocketIOServer, Socket } from "socket.io";
import { Server as HTTPServer } from "http";
import { MafiaGameEngine } from "../lib/game/engine";
import { aiResponseGenerator } from "../../src/lib/ai/response-generator";
import {
  GameAction,
  Player,
  PlayerType,
  PlayerId,
  GameConfig,
} from "../lib/types/game";
import { selectGamePersonalities } from "../../src/lib/ai/personality-pool";
import { v4 as uuidv4 } from "uuid";
import { RoomManager, GameRoom } from "./room-manager";
import { PlayerManager } from "./player-manager";

export class GameSocketServer {
  private io: SocketIOServer;
  private roomManager: RoomManager;
  private playerManager: PlayerManager;
  private dashboardSockets: Set<Socket> = new Set();
  private serverStartTime: Date = new Date();
  private totalGamesCreated: number = 0;
  private totalPlayersServed: number = 0;

  constructor(httpServer: HTTPServer) {
    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: process.env.FRONTEND_URL || "http://localhost:3000",
        methods: ["GET", "POST"],
      },
      pingTimeout: 60000,
      pingInterval: 25000,
    });

    this.roomManager = new RoomManager();
    this.playerManager = new PlayerManager();

    this.setupSocketHandlers();

    // Cleanup interval
    setInterval(() => {
      this.cleanupOldSessions();
    }, 300000);

    // Stats broadcast interval
    setInterval(() => {
      this.broadcastStatsToDashboards();
    }, 2000);

    console.log(
      "🚀 Game Socket Server initialized with enhanced observer persistence"
    );
  }

  private setupSocketHandlers(): void {
    this.io.on("connection", (socket: Socket) => {
      console.log(`🔌 Socket connected: ${socket.id}`);

      const isDashboard =
        socket.handshake.query.dashboard === "true" ||
        socket.handshake.query.clientType === "dashboard";

      if (isDashboard) {
        this.handleDashboardConnection(socket);
        return;
      }

      // FIXED: Enhanced join_room handler with proper observer support
      socket.on(
        "join_room",
        (data: {
          roomCode: string;
          playerName: string;
          playerId?: PlayerId;
          observerMode?: boolean;
        }) => {
          console.log(`🔌 Join room request:`, data);
          this.handleJoinRoom(socket, data);
        }
      );

      socket.on(
        "create_room",
        (data: { playerName: string; roomSettings: any }) => {
          console.log(`🏠 Create room request:`, data);
          this.handleCreateRoom(socket, data);
        }
      );

      socket.on("game_action", (action: GameAction) => {
        console.log(`🎮 Game action:`, action);
        this.handleGameAction(socket, action);
      });

      socket.on("ready_up", (data: { playerId: PlayerId }) => {
        this.handlePlayerReady(socket, data.playerId);
      });

      socket.on("disconnect", () => {
        this.handleDisconnect(socket);
      });
    });
  }

  private handleDashboardConnection(socket: Socket): void {
    this.dashboardSockets.add(socket);
    console.log(`📊 Dashboard connected: ${socket.id}`);
    this.sendStatsToSocket(socket);
    socket.emit("dashboard_connected", {
      message: "Dashboard connected successfully",
      timestamp: new Date().toISOString(),
      totalRooms: this.roomManager.getAllRooms().length,
      totalPlayers: this.playerManager.getAllConnections().length,
    });
  }

  // FIXED: Proper room joining logic with observer support
  private handleJoinRoom(
    socket: Socket,
    data: {
      roomCode: string;
      playerName: string;
      playerId?: PlayerId;
      observerMode?: boolean;
    }
  ): void {
    const room = this.roomManager.findRoomByCode(data.roomCode);

    if (!room) {
      socket.emit("error", {
        message: "Room not found",
        code: "ROOM_NOT_FOUND",
      });
      return;
    }

    const isObserver = data.observerMode || false;
    const playerId = data.playerId || uuidv4();

    console.log(
      `🔍 Join attempt - Room: ${data.roomCode}, Observer: ${isObserver}, Player: ${data.playerName}`
    );

    // FIXED: Use proper capacity checking
    const canJoin = this.roomManager.canJoinRoom(room, isObserver);
    if (!canJoin.canJoin) {
      console.log(`❌ Cannot join room: ${canJoin.reason}`);
      socket.emit("error", {
        message: canJoin.reason || "Cannot join room",
        code: "ROOM_FULL",
      });
      return;
    }

    // Handle observer mode
    if (isObserver) {
      this.handleObserverJoin(socket, room, data.playerName, playerId);
      return;
    }

    // Create player for regular join
    const player: Player = {
      id: playerId,
      name: data.playerName,
      type: PlayerType.HUMAN,
      isAlive: true,
      isReady: false,
      lastActive: new Date(),
      gameStats: {
        gamesPlayed: 0,
        wins: 0,
        accurateVotes: 0,
        aiDetectionRate: 0,
      },
    };

    // Add player to room
    this.roomManager.addPlayer(room.id, player);

    // Create player connection
    this.playerManager.createConnection(playerId, socket, room.id, false);

    // Join socket room
    socket.join(room.id);

    // Add player to game engine if exists
    if (room.gameEngine) {
      room.gameEngine.addPlayer(player);
    }

    // FIXED: Fill with AI players AFTER human player is added
    this.fillWithAIPlayers(room);

    // Send success response
    socket.emit("room_joined", {
      roomId: room.id,
      playerId,
      roomCode: data.roomCode,
      player,
      roomInfo: this.getRoomInfo(room),
      players: Array.from(room.players.values()).map((p) => ({
        id: p.id,
        name: p.name,
        type: p.type,
        isAlive: p.isAlive,
        isReady: p.isReady,
        role: p.role,
      })),
    });

    // Broadcast to room and dashboards
    this.broadcastToRoom(room.id, "player_joined", { player });
    this.broadcastToDashboards(
      "player_joined",
      this.sanitizeForBroadcast({
        player,
        roomCode: data.roomCode,
        roomId: room.id,
        timestamp: new Date().toISOString(),
      })
    );

    // Send initial game state if game is in progress
    if (room.gameEngine) {
      socket.emit(
        "game_state_update",
        room.gameEngine.getSerializableGameState()
      );
    }

    console.log(
      `✅ Player ${data.playerName} joined room ${data.roomCode} successfully`
    );
  }

  // FIXED: Enhanced observer joining with complete accumulated history
  private handleObserverJoin(
    socket: Socket,
    room: GameRoom,
    observerName: string,
    playerId: string
  ): void {
    console.log(`👁️ Observer ${observerName} joining room ${room.code}...`);

    // Create observer connection
    this.playerManager.createConnection(playerId, socket, room.id, true);

    // Join observer socket room
    socket.join(room.id + "_observers");
    socket.join(room.id); // Also join main room for game events

    // FIXED: Get complete observer history from game engine
    const completeObserverData = this.getCompleteObserverHistory(room);

    // Send enhanced observer joined response with complete history
    socket.emit("observer_joined", {
      roomCode: room.code,
      roomId: room.id,
      observerName,
      playerId,
      players: Array.from(room.players.values()).map((p) => ({
        id: p.id,
        name: p.name,
        type: p.type,
        isAlive: p.isAlive,
        role: p.role, // Observers can see all roles
        model: p.model, // Show AI model for AI players
      })),
      gameState: room.gameEngine?.getSerializableGameState(),
      observerMode: true,
      // FIXED: Include complete accumulated observer data
      observerData: completeObserverData,
      joinTimestamp: new Date().toISOString(),
    });

    // FIXED: Send all accumulated observer updates individually for real-time display
    if (completeObserverData.observerUpdates.length > 0) {
      console.log(
        `📊 Sending ${completeObserverData.observerUpdates.length} accumulated observer updates`
      );

      // Send updates in batches to avoid overwhelming the socket
      const batchSize = 10;
      for (
        let i = 0;
        i < completeObserverData.observerUpdates.length;
        i += batchSize
      ) {
        const batch = completeObserverData.observerUpdates.slice(
          i,
          i + batchSize
        );
        setTimeout(() => {
          batch.forEach((update: any) => {
            socket.emit("observer_update", { update });
          });
        }, i * 50); // 50ms delay between batches
      }
    }

    console.log(
      `✅ Observer ${observerName} joined room ${room.code} with complete history`
    );

    // Broadcast to dashboards
    this.broadcastToDashboards(
      "observer_joined",
      this.sanitizeForBroadcast({
        observerName,
        roomCode: room.code,
        roomId: room.id,
        playerId,
        observerUpdates: completeObserverData.observerUpdates.length,
        timestamp: new Date().toISOString(),
      })
    );
  }

  // FIXED: New method to get complete observer history
  private getCompleteObserverHistory(room: GameRoom): any {
    if (!room.gameEngine) {
      return {
        observerUpdates: [],
        suspicionMatrix: {},
        gameAnalytics: {
          duration: 0,
          rounds: 0,
          totalMessages: 0,
          totalVotes: 0,
          totalNightActions: 0,
          eliminations: 0,
          playerStats: { total: 0, ai: 0, human: 0, alive: 0 },
          phaseStats: {},
          playerActivity: {},
        },
        phaseHistory: [],
      };
    }

    // Get complete observer state from game engine
    const gameState = room.gameEngine.getSerializableGameState();
    const observerData = gameState.observerData || {};

    console.log(`📊 Retrieved observer data:`, {
      observerUpdates: observerData.observerUpdates?.length || 0,
      hasAnalytics: !!observerData.gameAnalytics,
      hasSuspicionMatrix: !!observerData.suspicionMatrix,
    });

    return {
      observerUpdates: observerData.observerUpdates || [],
      suspicionMatrix: observerData.suspicionMatrix || {},
      gameAnalytics: observerData.gameAnalytics || {
        duration: gameState.phaseStartTime
          ? Date.now() - new Date(gameState.phaseStartTime).getTime()
          : 0,
        rounds: gameState.currentRound || 0,
        totalMessages: gameState.messages?.length || 0,
        totalVotes: gameState.votes?.length || 0,
        totalNightActions: gameState.nightActions?.length || 0,
        eliminations: gameState.eliminatedPlayers?.length || 0,
        playerStats: {
          total: room.players.size,
          ai: Array.from(room.players.values()).filter(
            (p) => p.type === PlayerType.AI
          ).length,
          human: Array.from(room.players.values()).filter(
            (p) => p.type === PlayerType.HUMAN
          ).length,
          alive: Array.from(room.players.values()).filter((p) => p.isAlive)
            .length,
        },
        phaseStats: {},
        playerActivity: {},
      },
      phaseHistory: this.buildPhaseHistory(room),
    };
  }

  // FIXED: New method to build phase history for observers
  private buildPhaseHistory(room: GameRoom): any[] {
    if (!room.gameEngine) return [];

    const gameState = room.gameEngine.getSerializableGameState();
    const history = gameState.gameHistory || [];

    return history
      .filter(
        (event: any) =>
          event.type === "phase_changed" ||
          event.type === "game_started" ||
          event.type === "player_eliminated"
      )
      .map((event: any) => ({
        type: event.type,
        timestamp: event.timestamp,
        phase: event.data?.newPhase || event.data?.phase,
        round: event.data?.round || event.round,
        details: event.data,
      }));
  }

  private handleCreateRoom(
    socket: Socket,
    data: { playerName: string; roomSettings: any }
  ): void {
    const playerId = uuidv4();

    // FIXED: Use room manager for creation
    const { room, roomCode } = this.roomManager.createRoom(
      playerId,
      data.playerName,
      data.roomSettings
    );

    // Create player connection
    this.playerManager.createConnection(playerId, socket, room.id, false);

    // Join socket room
    socket.join(room.id);
    this.totalGamesCreated++;

    // FIXED: Fill with AI players immediately after creation
    this.fillWithAIPlayers(room);

    const player = room.players.get(playerId)!;

    socket.emit("room_created", {
      roomId: room.id,
      roomCode,
      playerId,
      player,
      roomInfo: this.getRoomInfo(room),
      players: Array.from(room.players.values()),
    });

    this.broadcastToDashboards(
      "room_created",
      this.sanitizeForBroadcast({
        roomCode,
        roomId: room.id,
        playerId,
        playerName: data.playerName,
        playerCount: room.players.size,
        maxPlayers: room.config.maxPlayers,
        timestamp: new Date().toISOString(),
      })
    );

    console.log(
      `🏠 Room created: ${roomCode} by ${data.playerName} with ${room.players.size} total players`
    );
  }

  /**
   * FIXED: Enhanced AI player filling logic
   */
  private fillWithAIPlayers(room: GameRoom): void {
    const humanPlayerCount = Array.from(room.players.values()).filter(
      (p) => p.type === PlayerType.HUMAN
    ).length;

    const currentAICount = Array.from(room.players.values()).filter(
      (p) => p.type === PlayerType.AI
    ).length;

    const aiPlayersNeeded = room.config.aiCount - currentAICount;

    console.log(
      `🤖 Room ${room.code}: ${humanPlayerCount} humans, ${currentAICount} AI, need ${aiPlayersNeeded} more AI`
    );

    if (aiPlayersNeeded <= 0) return;

    try {
      const personalities = selectGamePersonalities(
        room.config.premiumModelsEnabled,
        aiPlayersNeeded
      );

      console.log(
        `🤖 Creating ${aiPlayersNeeded} AI players with real personalities...`
      );

      for (
        let i = 0;
        i < Math.min(aiPlayersNeeded, personalities.length);
        i++
      ) {
        const personality = personalities[i];

        const aiPlayer: Player = {
          id: uuidv4(),
          name: personality.name,
          type: PlayerType.AI,
          model: personality.model,
          isAlive: true,
          isReady: true,
          lastActive: new Date(),
          gameStats: {
            gamesPlayed: 0,
            wins: 0,
            accurateVotes: 0,
            aiDetectionRate: 0,
          },
        };

        room.players.set(aiPlayer.id, aiPlayer);

        if (room.gameEngine) {
          room.gameEngine.addPlayer(aiPlayer);
        }

        console.log(
          `🤖 Added AI player: ${aiPlayer.name} (${personality.model}, ${personality.archetype})`
        );
      }

      // Update room config
      const finalHumanCount = Array.from(room.players.values()).filter(
        (p) => p.type === PlayerType.HUMAN
      ).length;
      const finalAICount = room.players.size - finalHumanCount;

      room.config.humanCount = finalHumanCount;
      room.config.aiCount = finalAICount;

      this.totalPlayersServed += aiPlayersNeeded;

      // Broadcast room update with new players
      this.broadcastToRoom(room.id, "room_updated", {
        players: Array.from(room.players.values()),
        config: room.config,
      });

      this.broadcastToDashboards(
        "ai_players_added",
        this.sanitizeForBroadcast({
          roomCode: room.code,
          aiCount: finalAICount,
          humanCount: finalHumanCount,
          totalPlayers: room.players.size,
          personalities: personalities.map((p) => ({
            name: p.name,
            model: p.model,
            archetype: p.archetype,
          })),
          timestamp: new Date().toISOString(),
        })
      );

      console.log(
        `✅ Room ${room.code} now has ${room.players.size} players (${finalHumanCount} human, ${finalAICount} AI)`
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error("❌ Error filling room with AI players:", errorMessage);
    }
  }

  private handleGameAction(socket: Socket, action: GameAction): void {
    const connection = this.playerManager.getConnectionBySocket(socket.id);
    if (!connection || connection.isObserver) return;

    const room = this.roomManager.getRoomById(connection.roomId!);
    if (!room || !room.gameEngine) return;

    this.broadcastToDashboards(
      "game_action_received",
      this.sanitizeForBroadcast({
        action: action.type,
        playerId: action.playerId || connection.playerId,
        roomCode: room.code,
        timestamp: new Date().toISOString(),
      })
    );

    switch (action.type) {
      case "START_GAME":
        this.startGame(room, action.playerId || connection.playerId);
        break;
      case "SEND_MESSAGE":
        this.handleMessage(
          room,
          action.playerId || connection.playerId,
          action.content || ""
        );
        break;
      case "CAST_VOTE":
        this.handleVote(
          room,
          action.playerId || connection.playerId,
          action.targetId!,
          action.reasoning || ""
        );
        break;
      case "NIGHT_ACTION":
        this.handleNightAction(
          room,
          action.playerId || connection.playerId,
          action.action!,
          action.targetId
        );
        break;
    }
  }

  private startGame(room: GameRoom, playerId: PlayerId): void {
    const player = room.players.get(playerId);
    if (!player || player.id !== room.hostId) {
      console.log(`❌ Player ${playerId} cannot start game - not host`);
      return;
    }

    if (!room.gameEngine) {
      // Create new game engine
      room.gameEngine = new MafiaGameEngine(room.id, room.config);
      this.setupGameEngineHandlers(room);

      Array.from(room.players.values()).forEach((player) => {
        room.gameEngine!.addPlayer(player);
      });
    }

    const success = room.gameEngine.startGame();
    if (success) {
      console.log(
        `🚀 Game started in room ${room.code} with ${room.players.size} players`
      );

      // Broadcast to all players and observers
      const gameState = room.gameEngine.getSerializableGameState();
      this.broadcastToRoom(room.id, "game_started", { gameState });
      this.playerManager.broadcastToObservers(room.id, "game_started", {
        gameState,
      });

      this.broadcastToDashboards(
        "game_started",
        this.sanitizeForBroadcast({
          roomCode: room.code,
          roomId: room.id,
          hostId: playerId,
          playerCount: room.players.size,
          humanCount: room.config.humanCount,
          aiCount: room.config.aiCount,
          premiumModelsEnabled: room.config.premiumModelsEnabled,
          timestamp: new Date().toISOString(),
        })
      );
    } else {
      console.log(`❌ Failed to start game in room ${room.code}`);
    }
  }

  private setupGameEngineHandlers(room: GameRoom): void {
    const engine = room.gameEngine!;

    engine.on("game_event", (event: any) => {
      const sanitizedEvent = this.sanitizeForBroadcast(event);
      this.broadcastToRoom(room.id, "game_event", sanitizedEvent);
      this.playerManager.broadcastToObservers(
        room.id,
        "game_event",
        sanitizedEvent
      );
    });

    // FIXED: Enhanced observer update handling with player names
    engine.on("observer_update", (data: any) => {
      // Ensure player names are included in observer updates
      const enhancedData = this.enhanceObserverUpdateWithPlayerNames(
        data,
        room
      );

      this.playerManager.broadcastToObservers(room.id, "observer_update", {
        update: enhancedData,
      });

      this.broadcastToDashboards("ai_private_action", {
        ...enhancedData,
        roomCode: room.code,
        timestamp: new Date().toISOString(),
      });
    });

    engine.on(
      "phase_changed",
      (data: { newPhase: string; oldPhase: string; round: number }) => {
        const sanitizedData = this.sanitizeForBroadcast(data);

        // FIXED: Add phase separator message to chat for clear transitions
        const phaseMessage = {
          id: uuidv4(),
          content: `--- ${data.newPhase
            .toUpperCase()
            .replace("_", " ")} PHASE BEGINS ---`,
          timestamp: new Date().toISOString(),
          messageType: "phase_transition",
          phase: data.newPhase,
          round: data.round,
        };

        this.broadcastToRoom(room.id, "phase_changed", sanitizedData);
        this.broadcastToRoom(room.id, "phase_separator", phaseMessage);

        this.playerManager.broadcastToObservers(
          room.id,
          "phase_changed",
          sanitizedData
        );
        this.playerManager.broadcastToObservers(
          room.id,
          "phase_separator",
          phaseMessage
        );

        const gameState = engine.getSerializableGameState();
        this.broadcastToRoom(room.id, "game_state_update", gameState);
        this.playerManager.broadcastToObservers(
          room.id,
          "game_state_update",
          gameState
        );

        this.broadcastToDashboards("phase_changed", {
          ...sanitizedData,
          roomCode: room.code,
          roomId: room.id,
          playerCount: room.players.size,
          timestamp: new Date().toISOString(),
        });
      }
    );

    engine.on("game_ended", (data: any) => {
      const sanitizedData = this.sanitizeForBroadcast(data);
      this.broadcastToRoom(room.id, "game_ended", sanitizedData);
      this.playerManager.broadcastToObservers(
        room.id,
        "game_ended",
        sanitizedData
      );

      this.broadcastToDashboards("game_ended", {
        ...sanitizedData,
        roomCode: room.code,
        roomId: room.id,
        timestamp: new Date().toISOString(),
      });

      this.cleanupGame(room);
    });

    // Add other event handlers as needed...
  }

  // FIXED: New method to enhance observer updates with player names
  private enhanceObserverUpdateWithPlayerNames(data: any, room: GameRoom): any {
    if (!data.playerId) return data;

    const player = room.players.get(data.playerId);
    if (!player) return data;

    return {
      ...data,
      playerName: player.name,
      playerType: player.type,
      playerModel: player.model,
      playerRole: player.role,
    };
  }

  private handleMessage(
    room: GameRoom,
    playerId: PlayerId,
    content: string
  ): void {
    if (room.gameEngine?.sendMessage(playerId, content)) {
      this.broadcastToDashboards("message_received", {
        playerId,
        playerName: room.players.get(playerId)?.name,
        content,
        roomCode: room.code,
        timestamp: new Date().toISOString(),
      });
    }
  }

  private handleVote(
    room: GameRoom,
    playerId: PlayerId,
    targetId: PlayerId,
    reasoning: string
  ): void {
    if (room.gameEngine?.castVote(playerId, targetId, reasoning)) {
      this.broadcastToDashboards("vote_cast", {
        voterId: playerId,
        voterName: room.players.get(playerId)?.name,
        targetId,
        targetName: room.players.get(targetId)?.name,
        reasoning,
        roomCode: room.code,
        timestamp: new Date().toISOString(),
      });
    }
  }

  private handleNightAction(
    room: GameRoom,
    playerId: PlayerId,
    action: "kill" | "heal",
    targetId?: PlayerId
  ): void {
    if (room.gameEngine?.nightAction(playerId, action, targetId)) {
      this.broadcastToDashboards("night_action", {
        playerId,
        playerName: room.players.get(playerId)?.name,
        action,
        targetId,
        targetName: targetId ? room.players.get(targetId)?.name : undefined,
        roomCode: room.code,
        timestamp: new Date().toISOString(),
      });
    }
  }

  private handlePlayerReady(socket: Socket, playerId: PlayerId): void {
    const connection = this.playerManager.getConnection(playerId);
    if (!connection || connection.isObserver) return;

    const room = this.roomManager.getRoomById(connection.roomId!);
    if (!room) return;

    const player = room.players.get(playerId);
    if (player) {
      player.isReady = true;
      room.players.set(playerId, player);

      if (room.gameEngine) {
        room.gameEngine.setPlayerReady(playerId, true);
      }

      this.broadcastToRoom(room.id, "player_ready", { playerId });
    }
  }

  private handleDisconnect(socket: Socket): void {
    const wasDashboard = this.dashboardSockets.has(socket);
    this.dashboardSockets.delete(socket);

    if (wasDashboard) {
      console.log(`📊 Dashboard disconnected: ${socket.id}`);
      return;
    }

    const playerId = this.playerManager.removeConnectionBySocket(socket.id);
    if (!playerId) return;

    // Find and update room
    const rooms = this.roomManager.getAllRooms();
    for (const room of rooms) {
      if (room.players.has(playerId)) {
        room.gameEngine?.removePlayer(playerId);
        this.roomManager.removePlayer(room.id, playerId);

        this.broadcastToRoom(room.id, "player_left", { playerId });
        this.broadcastToDashboards("player_left", {
          playerId,
          roomCode: room.code,
          remainingPlayers: room.players.size,
          timestamp: new Date().toISOString(),
        });

        break;
      }
    }

    console.log(`👋 Player disconnected: ${socket.id}`);
  }

  private cleanupGame(room: GameRoom): void {
    if (room.gameEngine) {
      room.gameEngine.cleanup();
      room.gameEngine = null;
    }

    room.players.forEach((player) => {
      player.isReady = false;
      player.isAlive = true;
      player.role = undefined;
      player.votedFor = undefined;
    });

    console.log(`🧹 Cleaned up game in room ${room.code}`);
  }

  private broadcastToRoom(roomId: string, event: string, data: any): void {
    try {
      const sanitizedData = this.sanitizeForBroadcast(data);
      this.io.to(roomId).emit(event, sanitizedData);
    } catch (error) {
      console.warn(`⚠️ Failed to broadcast to room ${roomId}:`, error);
    }
  }

  private broadcastToDashboards(event: string, data: any): void {
    if (this.dashboardSockets.size > 0) {
      const sanitizedData = this.sanitizeForBroadcast(data);
      this.dashboardSockets.forEach((socket) => {
        if (socket.connected) {
          try {
            socket.emit(event, sanitizedData);
          } catch (error) {
            console.warn(`⚠️ Failed to emit ${event} to dashboard:`, error);
            this.dashboardSockets.delete(socket);
          }
        } else {
          this.dashboardSockets.delete(socket);
        }
      });
    }
  }

  private broadcastStatsToDashboards(): void {
    if (this.dashboardSockets.size > 0) {
      const stats = this.getRoomStats();
      const aiStats = this.getAIUsageStats();

      const statsData = this.sanitizeForBroadcast({
        rooms: stats,
        ai: Array.from(aiStats.entries()),
        server: {
          uptime: process.uptime(),
          memoryUsage: process.memoryUsage(),
          timestamp: new Date().toISOString(),
          dashboardConnections: this.dashboardSockets.size,
          activeConnections: this.playerManager.getAllConnections().length,
        },
      });

      this.broadcastToDashboards("stats_update", statsData);
    }
  }

  private sendStatsToSocket(socket: Socket): void {
    const stats = this.getRoomStats();
    const aiStats = this.getAIUsageStats();

    const statsData = this.sanitizeForBroadcast({
      rooms: stats,
      ai: Array.from(aiStats.entries()),
      server: {
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage(),
        timestamp: new Date().toISOString(),
        dashboardConnections: this.dashboardSockets.size,
        activeConnections: this.playerManager.getAllConnections().length,
      },
    });

    try {
      socket.emit("stats_update", statsData);
    } catch (error) {
      console.warn("⚠️ Failed to send stats to socket:", error);
    }
  }

  private sanitizeForBroadcast(data: any): any {
    if (!data) return data;

    try {
      return JSON.parse(
        JSON.stringify(data, (key, value) => {
          if (value instanceof Date) {
            return value.toISOString();
          }
          if (value instanceof Map) {
            return Object.fromEntries(value);
          }
          if (typeof value === "function" || value === undefined) {
            return null;
          }
          return value;
        })
      );
    } catch (error) {
      console.warn("⚠️ Data sanitization failed:", error);
      return {
        error: "Data could not be serialized",
        originalType: typeof data,
        timestamp: new Date().toISOString(),
      };
    }
  }

  private getRoomInfo(room: GameRoom): any {
    return this.sanitizeForBroadcast({
      id: room.id,
      code: room.code,
      playerCount: room.players.size,
      maxPlayers: room.config.maxPlayers,
      humanCount: room.config.humanCount,
      aiCount: room.config.aiCount,
      gameInProgress: !!room.gameEngine,
      createdAt: room.createdAt.toISOString(),
      isAIOnly: room.isAIOnly,
    });
  }

  getAIUsageStats(): Map<string, any> {
    try {
      return aiResponseGenerator.getUsageStats();
    } catch (error) {
      console.warn("Failed to get AI usage stats:", error);
      return new Map();
    }
  }

  getRoomStats(): any {
    return this.roomManager.getRoomStats();
  }

  createAIOnlyGame(gameConfig?: any): any {
    const { room, roomCode } = this.roomManager.createAIOnlyRoom(gameConfig);

    this.totalGamesCreated++;
    this.fillWithAIPlayers(room);

    setTimeout(() => {
      room.gameEngine = new MafiaGameEngine(room.id, room.config);
      this.setupGameEngineHandlers(room);

      Array.from(room.players.values()).forEach((player) => {
        room.gameEngine!.addPlayer(player);
      });

      room.gameEngine.startGame();

      this.broadcastToDashboards("ai_only_game_created", {
        roomCode,
        roomId: room.id,
        aiCount: room.config.aiCount,
        personalities: Array.from(room.players.values()).map((p) => ({
          name: p.name,
          model: p.model,
        })),
        timestamp: new Date().toISOString(),
      });

      console.log(`🤖 AI-only game started: ${roomCode}`);
    }, 2000);

    return this.getRoomInfo(room);
  }

  public cleanupOldSessions(): void {
    console.log("🧹 Starting cleanup of old sessions...");

    // Cleanup AI response cache
    try {
      aiResponseGenerator.cleanupCache();
    } catch (error) {
      console.warn("Failed to cleanup AI cache:", error);
    }

    // Cleanup inactive player connections
    const playerCleanup = this.playerManager.cleanupInactiveConnections();

    // Cleanup old rooms
    const roomsCleaned = this.roomManager.cleanupOldRooms();

    // Cleanup disconnected dashboards
    let dashboardsCleaned = 0;
    for (const socket of this.dashboardSockets) {
      if (!socket.connected) {
        this.dashboardSockets.delete(socket);
        dashboardsCleaned++;
      }
    }

    console.log(`🧹 Cleanup completed:`, {
      roomsCleaned,
      dashboardsCleaned,
      playersCleaned: playerCleanup.removed,
      activeRooms: this.roomManager.getAllRooms().length,
      activePlayers: this.playerManager.getActiveConnections().length,
      activeDashboards: this.dashboardSockets.size,
    });

    this.broadcastToDashboards("cleanup_completed", {
      roomsCleaned,
      dashboardsCleaned,
      playersCleaned: playerCleanup.removed,
      timestamp: new Date().toISOString(),
    });
  }

  public terminateRoom(roomId: string, reason: string = "Terminated"): any {
    const room = this.roomManager.getRoomById(roomId);
    if (!room) {
      return { success: false, message: "Room not found" };
    }

    const preTerminationInfo = {
      playerCount: room.players.size,
      gameInProgress: !!room.gameEngine,
      createdAt: room.createdAt,
    };

    // Notify all players and observers
    this.playerManager.broadcastToRoom(roomId, "room_terminated", {
      message: reason,
      roomId,
      timestamp: new Date().toISOString(),
    });

    // Remove all player connections for this room
    const connections = this.playerManager.getPlayersByRoom(roomId);
    connections.forEach((connection) => {
      this.playerManager.removeConnection(connection.playerId);
    });

    // Remove observer connections
    const observers = this.playerManager.getObserversByRoom(roomId);
    observers.forEach((observer) => {
      this.playerManager.removeConnection(observer.playerId);
    });

    // Delete the room
    this.roomManager.deleteRoom(roomId);

    this.broadcastToDashboards("room_terminated", {
      roomCode: room.code,
      roomId: room.id,
      reason,
      preTerminationInfo,
      timestamp: new Date().toISOString(),
    });

    console.log(`🔥 Room ${room.code} terminated: ${reason}`);

    return {
      success: true,
      preTerminationInfo,
      playersNotified: preTerminationInfo.playerCount,
    };
  }
}
