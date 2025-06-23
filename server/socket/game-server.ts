// server/socket/game-server.ts - UPDATED: Real AI Integration
import { Server as SocketIOServer, Socket } from "socket.io";
import { Server as HTTPServer } from "http";
import { MafiaGameEngine } from "../lib/game/engine";
import { aiResponseGenerator } from "../../src/lib/ai/response-generator"; // Use real AI
import {
  GameAction,
  GameResponse,
  Player,
  PlayerType,
  Room,
  RoomId,
  PlayerId,
  GameConfig,
  PlayerRole,
} from "../lib/types/game";
import { selectGamePersonalities } from "../../src/lib/ai/personality-pool";
import { v4 as uuidv4 } from "uuid";

interface GameRoom {
  id: RoomId;
  code: string;
  hostId: PlayerId;
  players: Map<PlayerId, Player>;
  config: GameConfig;
  createdAt: Date;
  gameEngine: MafiaGameEngine | null;
}

interface PlayerConnection {
  playerId: PlayerId;
  socket: Socket;
  roomId: RoomId;
  isActive: boolean;
  joinedAt: Date;
}

export class GameSocketServer {
  private io: SocketIOServer;
  private rooms: Map<RoomId, GameRoom> = new Map();
  private players: Map<PlayerId, PlayerConnection> = new Map();
  private dashboardSockets: Set<Socket> = new Set();
  private observerSockets: Map<RoomId, Set<Socket>> = new Map();
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

    this.setupSocketHandlers();

    // Cleanup interval
    setInterval(() => {
      this.cleanupOldSessions();
    }, 300000);

    // Stats broadcast interval
    setInterval(() => {
      this.broadcastStatsToDashboards();
    }, 2000);

    console.log("🚀 Game Socket Server initialized with real AI integration");
  }

  private setupSocketHandlers(): void {
    this.io.on("connection", (socket: Socket) => {
      console.log(`🔌 Player connected: ${socket.id}`);

      const isDashboard =
        socket.handshake.query.dashboard === "true" ||
        socket.handshake.query.clientType === "dashboard";

      if (isDashboard) {
        this.handleDashboardConnection(socket);
        return;
      }

      // Enhanced join_room handler with observer support
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
      totalRooms: this.rooms.size,
      totalPlayers: this.players.size,
    });
  }

  private handleJoinRoom(
    socket: Socket,
    data: {
      roomCode: string;
      playerName: string;
      playerId?: PlayerId;
      observerMode?: boolean;
    }
  ): void {
    const room = this.findRoomByCode(data.roomCode);

    if (!room) {
      socket.emit("error", {
        message: "Room not found",
        code: "ROOM_NOT_FOUND",
      });
      return;
    }

    // Handle observer mode (for creators watching AI games)
    if (data.observerMode) {
      this.handleObserverJoin(socket, room, data.playerName);
      return;
    }

    // Regular player join
    if (room.players.size >= room.config.maxPlayers) {
      socket.emit("error", { message: "Room is full", code: "ROOM_FULL" });
      return;
    }

    const playerId = data.playerId || uuidv4();
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

    const connection: PlayerConnection = {
      playerId,
      socket,
      roomId: room.id,
      isActive: true,
      joinedAt: new Date(),
    };

    room.players.set(playerId, player);
    this.players.set(playerId, connection);
    socket.join(room.id);

    if (room.gameEngine) {
      room.gameEngine.addPlayer(player);
    }

    this.fillWithAIPlayers(room);

    // Send comprehensive room joined response
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

    console.log(`✅ Player ${data.playerName} joined room ${data.roomCode}`);
  }

  private handleObserverJoin(
    socket: Socket,
    room: GameRoom,
    observerName: string
  ): void {
    // Add to observers
    if (!this.observerSockets.has(room.id)) {
      this.observerSockets.set(room.id, new Set());
    }
    this.observerSockets.get(room.id)!.add(socket);
    socket.join(room.id + "_observers");

    socket.emit("observer_joined", {
      roomCode: room.code,
      roomId: room.id,
      observerName,
      players: Array.from(room.players.values()).map((p) => ({
        id: p.id,
        name: p.name,
        type: p.type,
        isAlive: p.isAlive,
        role: p.role, // Observers can see all roles
      })),
      gameState: room.gameEngine?.getSerializableGameState(),
    });

    console.log(`👁️ Observer ${observerName} joined room ${room.code}`);
  }

  private handleCreateRoom(
    socket: Socket,
    data: { playerName: string; roomSettings: any }
  ): void {
    const roomId = uuidv4();
    const roomCode = this.generateRoomCode();
    const playerId = uuidv4();

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

    const gameConfig: GameConfig = {
      maxPlayers: 10,
      aiCount: 9,
      humanCount: 1,
      nightPhaseDuration: 90,
      discussionPhaseDuration: 300,
      votingPhaseDuration: 120,
      revelationPhaseDuration: 10,
      speakingTimePerPlayer: 35,
      allowSpectators: data.roomSettings.allowSpectators || false,
      premiumModelsEnabled: data.roomSettings.premiumModelsEnabled || false,
    };

    const room: GameRoom = {
      id: roomId,
      code: roomCode,
      hostId: playerId,
      players: new Map([[playerId, player]]),
      config: gameConfig,
      createdAt: new Date(),
      gameEngine: null,
    };

    const connection: PlayerConnection = {
      playerId,
      socket,
      roomId,
      isActive: true,
      joinedAt: new Date(),
    };

    this.rooms.set(roomId, room);
    this.players.set(playerId, connection);
    socket.join(roomId);
    this.totalGamesCreated++;

    this.fillWithAIPlayers(room);

    socket.emit("room_created", {
      roomId,
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
        roomId,
        playerId,
        playerName: data.playerName,
        playerCount: room.players.size,
        maxPlayers: room.config.maxPlayers,
        timestamp: new Date().toISOString(),
      })
    );

    console.log(`🏠 Room created: ${roomCode} by ${data.playerName}`);
  }

  /**
   * Fill room with AI players using real AI personalities
   */
  private fillWithAIPlayers(room: GameRoom): void {
    const currentPlayerCount = room.players.size;
    const aiPlayersNeeded = room.config.maxPlayers - currentPlayerCount;

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

      room.config.humanCount = Array.from(room.players.values()).filter(
        (p) => p.type === PlayerType.HUMAN
      ).length;
      room.config.aiCount = room.players.size - room.config.humanCount;

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
          aiCount: room.config.aiCount,
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
        `🤖 Added ${aiPlayersNeeded} AI players with real personalities to room ${room.code}`
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error("❌ Error filling room with AI players:", errorMessage);
    }
  }

  private handleGameAction(socket: Socket, action: GameAction): void {
    const connection = Array.from(this.players.values()).find(
      (p) => p.socket.id === socket.id
    );
    if (!connection) return;

    const room = this.rooms.get(connection.roomId);
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
      // Create new game engine with real AI integration
      room.gameEngine = new MafiaGameEngine(room.id, room.config);
      this.setupGameEngineHandlers(room);

      Array.from(room.players.values()).forEach((player) => {
        room.gameEngine!.addPlayer(player);
      });
    }

    const success = room.gameEngine.startGame();
    if (success) {
      console.log(`🚀 Game started in room ${room.code} with real AI players`);

      // Broadcast to all players and observers
      const gameState = room.gameEngine.getSerializableGameState();
      this.broadcastToRoom(room.id, "game_started", { gameState });
      this.broadcastToObservers(room.id, "game_started", { gameState });

      this.broadcastToDashboards(
        "game_started",
        this.sanitizeForBroadcast({
          roomCode: room.code,
          roomId: room.id,
          hostId: playerId,
          playerCount: room.players.size,
          aiCount: room.config.aiCount,
          premiumModelsEnabled: room.config.premiumModelsEnabled,
          timestamp: new Date().toISOString(),
        })
      );

      console.log(`🤖 Real AI automation active for room ${room.code}`);
    } else {
      console.log(`❌ Failed to start game in room ${room.code}`);
    }
  }

  /**
   * Setup enhanced game engine handlers with observer support
   */
  private setupGameEngineHandlers(room: GameRoom): void {
    const engine = room.gameEngine!;

    engine.on("game_event", (event: any) => {
      const sanitizedEvent = this.sanitizeForBroadcast(event);
      this.broadcastToRoom(room.id, "game_event", sanitizedEvent);
      this.broadcastToObservers(room.id, "game_event", sanitizedEvent);
    });

    // Observer updates for private actions
    engine.on("observer_update", (data: any) => {
      this.broadcastToObservers(room.id, "observer_update", data);
      this.broadcastToDashboards("ai_private_action", {
        ...data,
        roomCode: room.code,
        timestamp: new Date().toISOString(),
      });
    });

    engine.on(
      "phase_changed",
      (data: { newPhase: string; oldPhase: string; round: number }) => {
        const sanitizedData = this.sanitizeForBroadcast(data);
        this.broadcastToRoom(room.id, "phase_changed", sanitizedData);
        this.broadcastToObservers(room.id, "phase_changed", sanitizedData);

        // Send updated game state with observer data
        const gameState = engine.getSerializableGameState();
        this.broadcastToRoom(room.id, "game_state_update", gameState);
        this.broadcastToObservers(room.id, "game_state_update", gameState);

        this.broadcastToDashboards(
          "phase_changed",
          this.sanitizeForBroadcast({
            ...sanitizedData,
            roomCode: room.code,
            roomId: room.id,
            playerCount: room.players.size,
            aiCount: room.config.aiCount,
            timestamp: new Date().toISOString(),
          })
        );

        console.log(
          `🔄 Phase change in ${room.code}: ${data.oldPhase} → ${data.newPhase} (Round ${data.round})`
        );
      }
    );

    engine.on("player_eliminated", (data: any) => {
      const sanitizedData = this.sanitizeForBroadcast(data);
      this.broadcastToRoom(room.id, "player_eliminated", sanitizedData);
      this.broadcastToObservers(room.id, "player_eliminated", sanitizedData);

      // Send updated game state
      const gameState = engine.getSerializableGameState();
      this.broadcastToRoom(room.id, "game_state_update", gameState);
      this.broadcastToObservers(room.id, "game_state_update", gameState);

      this.broadcastToDashboards("player_eliminated", {
        ...sanitizedData,
        roomCode: room.code,
        timestamp: new Date().toISOString(),
      });
    });

    engine.on("game_ended", (data: any) => {
      const sanitizedData = this.sanitizeForBroadcast(data);
      this.broadcastToRoom(room.id, "game_ended", sanitizedData);
      this.broadcastToObservers(room.id, "game_ended", sanitizedData);

      this.broadcastToDashboards(
        "game_ended",
        this.sanitizeForBroadcast({
          ...sanitizedData,
          roomCode: room.code,
          roomId: room.id,
          duration: data.stats?.duration || 0,
          totalRounds: data.stats?.rounds || 0,
          aiCost: this.calculateGameAICost(),
          timestamp: new Date().toISOString(),
        })
      );

      this.cleanupGame(room);
    });

    engine.on("message_received", (data: any) => {
      const sanitizedData = this.sanitizeForBroadcast(data);
      this.broadcastToRoom(room.id, "message_received", sanitizedData);
      this.broadcastToObservers(room.id, "message_received", sanitizedData);

      // Track AI messages for analytics
      const player = room.players.get(data.message.playerId);
      if (player?.type === PlayerType.AI) {
        this.broadcastToDashboards("ai_message", {
          playerName: player.name,
          model: player.model,
          content: data.message.content,
          roomCode: room.code,
          timestamp: new Date().toISOString(),
        });
      }
    });

    engine.on("vote_cast", (data: any) => {
      const sanitizedData = this.sanitizeForBroadcast(data);
      this.broadcastToRoom(room.id, "vote_cast", sanitizedData);
      this.broadcastToObservers(room.id, "vote_cast", sanitizedData);

      // Track AI votes for analytics
      const voter = room.players.get(data.vote.voterId);
      const target = room.players.get(data.vote.targetId);
      if (voter?.type === PlayerType.AI) {
        this.broadcastToDashboards("ai_vote", {
          voterName: voter.name,
          voterModel: voter.model,
          targetName: target?.name,
          reasoning: data.vote.reasoning,
          roomCode: room.code,
          timestamp: new Date().toISOString(),
        });
      }
    });

    engine.on("night_action_received", (data: any) => {
      const sanitizedData = this.sanitizeForBroadcast(data);
      this.broadcastToObservers(
        room.id,
        "night_action_received",
        sanitizedData
      );

      // Track AI night actions for analytics
      const actor = room.players.get(data.action.playerId);
      if (actor?.type === PlayerType.AI) {
        this.broadcastToDashboards("ai_night_action", {
          actorName: actor.name,
          actorModel: actor.model,
          action: data.action.action,
          targetId: data.action.targetId,
          roomCode: room.code,
          timestamp: new Date().toISOString(),
        });
      }
    });

    // No elimination event (healer save)
    engine.on("no_elimination", (data: any) => {
      const sanitizedData = this.sanitizeForBroadcast(data);
      this.broadcastToRoom(room.id, "no_elimination", sanitizedData);
      this.broadcastToObservers(room.id, "no_elimination", sanitizedData);
    });

    // Vote tied event
    engine.on("vote_tied", (data: any) => {
      const sanitizedData = this.sanitizeForBroadcast(data);
      this.broadcastToRoom(room.id, "vote_tied", sanitizedData);
      this.broadcastToObservers(room.id, "vote_tied", sanitizedData);
    });
  }

  private handleMessage(
    room: GameRoom,
    playerId: PlayerId,
    content: string
  ): void {
    if (room.gameEngine?.sendMessage(playerId, content)) {
      this.broadcastToDashboards(
        "message_received",
        this.sanitizeForBroadcast({
          playerId,
          playerName: room.players.get(playerId)?.name,
          content,
          roomCode: room.code,
          timestamp: new Date().toISOString(),
        })
      );
    }
  }

  private handleVote(
    room: GameRoom,
    playerId: PlayerId,
    targetId: PlayerId,
    reasoning: string
  ): void {
    if (room.gameEngine?.castVote(playerId, targetId, reasoning)) {
      this.broadcastToDashboards(
        "vote_cast",
        this.sanitizeForBroadcast({
          voterId: playerId,
          voterName: room.players.get(playerId)?.name,
          targetId,
          targetName: room.players.get(targetId)?.name,
          reasoning,
          roomCode: room.code,
          timestamp: new Date().toISOString(),
        })
      );
    }
  }

  private handleNightAction(
    room: GameRoom,
    playerId: PlayerId,
    action: "kill" | "heal",
    targetId?: PlayerId
  ): void {
    if (room.gameEngine?.nightAction(playerId, action, targetId)) {
      this.broadcastToDashboards(
        "night_action",
        this.sanitizeForBroadcast({
          playerId,
          playerName: room.players.get(playerId)?.name,
          action,
          targetId,
          targetName: targetId ? room.players.get(targetId)?.name : undefined,
          roomCode: room.code,
          timestamp: new Date().toISOString(),
        })
      );
    }
  }

  private handlePlayerReady(socket: Socket, playerId: PlayerId): void {
    const connection = this.players.get(playerId);
    if (!connection) return;

    const room = this.rooms.get(connection.roomId);
    if (!room) return;

    const player = room.players.get(playerId);
    if (player) {
      player.isReady = true;
      room.players.set(playerId, player);

      if (room.gameEngine) {
        room.gameEngine.setPlayerReady(playerId, true);
      }

      this.broadcastToRoom(room.id, "player_ready", { playerId });
      this.broadcastToDashboards(
        "player_ready",
        this.sanitizeForBroadcast({
          playerId,
          playerName: player.name,
          roomCode: room.code,
          timestamp: new Date().toISOString(),
        })
      );
    }
  }

  private handleDisconnect(socket: Socket): void {
    const wasDashboard = this.dashboardSockets.has(socket);
    this.dashboardSockets.delete(socket);

    if (wasDashboard) {
      console.log(`📊 Dashboard disconnected: ${socket.id}`);
      return;
    }

    // Remove from observers
    for (const [roomId, observers] of this.observerSockets.entries()) {
      if (observers.has(socket)) {
        observers.delete(socket);
        console.log(`👁️ Observer disconnected from room ${roomId}`);
        if (observers.size === 0) {
          this.observerSockets.delete(roomId);
        }
        return;
      }
    }

    const connection = Array.from(this.players.values()).find(
      (p) => p.socket.id === socket.id
    );
    if (!connection) return;

    const room = this.rooms.get(connection.roomId);
    if (room) {
      room.gameEngine?.removePlayer(connection.playerId);
      room.players.delete(connection.playerId);

      this.broadcastToRoom(room.id, "player_left", {
        playerId: connection.playerId,
      });

      this.broadcastToDashboards(
        "player_left",
        this.sanitizeForBroadcast({
          playerId: connection.playerId,
          roomCode: room.code,
          remainingPlayers: room.players.size,
          timestamp: new Date().toISOString(),
        })
      );

      if (room.players.size === 0) {
        this.rooms.delete(room.id);
        this.observerSockets.delete(room.id);
        this.broadcastToDashboards(
          "room_deleted",
          this.sanitizeForBroadcast({
            roomCode: room.code,
            reason: "No players remaining",
            timestamp: new Date().toISOString(),
          })
        );
      }
    }

    this.players.delete(connection.playerId);
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

  /**
   * Calculate AI cost for a completed game
   */
  private calculateGameAICost(): number {
    try {
      const stats = aiResponseGenerator.getUsageStats();
      let totalCost = 0;

      for (const [model, usage] of stats.entries()) {
        totalCost += usage.totalCost || 0;
      }

      return totalCost;
    } catch (error) {
      console.warn("Failed to calculate AI cost:", error);
      return 0;
    }
  }

  private broadcastToRoom(roomId: RoomId, event: string, data: any): void {
    try {
      const sanitizedData = this.sanitizeForBroadcast(data);
      this.io.to(roomId).emit(event, sanitizedData);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.warn(`⚠️ Failed to broadcast to room ${roomId}:`, errorMessage);
    }
  }

  private broadcastToObservers(roomId: RoomId, event: string, data: any): void {
    try {
      const sanitizedData = this.sanitizeForBroadcast(data);
      this.io.to(roomId + "_observers").emit(event, sanitizedData);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.warn(
        `⚠️ Failed to broadcast to observers ${roomId}:`,
        errorMessage
      );
    }
  }

  private broadcastToDashboards(event: string, data: any): void {
    const dashboardCount = this.dashboardSockets.size;

    if (dashboardCount > 0) {
      const sanitizedData = this.sanitizeForBroadcast(data);

      this.dashboardSockets.forEach((socket) => {
        if (socket.connected) {
          try {
            socket.emit(event, sanitizedData);
          } catch (error) {
            const errorMessage =
              error instanceof Error ? error.message : String(error);
            console.warn(
              `⚠️ Failed to emit ${event} to dashboard:`,
              errorMessage
            );
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
          activeConnections: this.players.size,
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
        activeConnections: this.players.size,
      },
    });

    try {
      socket.emit("stats_update", statsData);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.warn("⚠️ Failed to send stats to socket:", errorMessage);
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
          if (typeof value === "object" && value !== null) {
            try {
              JSON.stringify(value);
            } catch (e) {
              if (e instanceof Error && e.message.includes("circular")) {
                return "[Circular Reference Removed]";
              }
            }
          }
          return value;
        })
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.warn("⚠️ Data sanitization failed:", errorMessage);
      return {
        error: "Data could not be serialized",
        originalType: typeof data,
        timestamp: new Date().toISOString(),
      };
    }
  }

  private findRoomByCode(code: string): GameRoom | undefined {
    return Array.from(this.rooms.values()).find((room) => room.code === code);
  }

  private generateRoomCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  private getRoomInfo(room: GameRoom): any {
    return this.sanitizeForBroadcast({
      id: room.id,
      code: room.code,
      playerCount: room.players.size,
      maxPlayers: room.config.maxPlayers,
      gameInProgress: !!room.gameEngine,
      createdAt: room.createdAt.toISOString(),
    });
  }

  /**
   * Get AI usage statistics from the response generator
   */
  getAIUsageStats(): Map<string, any> {
    try {
      return aiResponseGenerator.getUsageStats();
    } catch (error) {
      console.warn("Failed to get AI usage stats:", error);
      return new Map();
    }
  }

  getRoomStats(): any {
    const roomList = Array.from(this.rooms.values()).map((room) => ({
      ...this.getRoomInfo(room),
      aiCount: room.config.aiCount,
      humanCount: room.config.humanCount,
      hostId: room.hostId,
      premiumModelsEnabled: room.config.premiumModelsEnabled,
    }));

    return {
      totalRooms: this.rooms.size,
      activeRooms: Array.from(this.rooms.values()).filter((r) => r.gameEngine)
        .length,
      totalPlayers: this.players.size,
      roomList,
    };
  }

  /**
   * Create AI-only game for testing and demonstration
   */
  createAIOnlyGame(gameConfig?: any): any {
    const roomId = uuidv4();
    const roomCode = this.generateRoomCode();

    const config: GameConfig = {
      maxPlayers: 10,
      aiCount: 10,
      humanCount: 0,
      nightPhaseDuration: 60, // Shorter for AI-only games
      discussionPhaseDuration: 180, // 3 minutes
      votingPhaseDuration: 90, // 1.5 minutes
      revelationPhaseDuration: 8,
      speakingTimePerPlayer: 20, // Faster pace
      allowSpectators: true,
      premiumModelsEnabled: true,
      ...gameConfig,
    };

    const room: GameRoom = {
      id: roomId,
      code: roomCode,
      hostId: "ai_game_creator",
      players: new Map(),
      config,
      createdAt: new Date(),
      gameEngine: null,
    };

    this.rooms.set(roomId, room);
    this.totalGamesCreated++;
    this.fillWithAIPlayers(room);

    setTimeout(() => {
      room.gameEngine = new MafiaGameEngine(room.id, room.config);
      this.setupGameEngineHandlers(room);

      Array.from(room.players.values()).forEach((player) => {
        room.gameEngine!.addPlayer(player);
      });

      room.gameEngine.startGame();

      this.broadcastToDashboards(
        "ai_only_game_created",
        this.sanitizeForBroadcast({
          roomCode,
          roomId,
          aiCount: room.config.aiCount,
          personalities: Array.from(room.players.values()).map((p) => ({
            name: p.name,
            model: p.model,
          })),
          timestamp: new Date().toISOString(),
        })
      );

      console.log(
        `🤖 AI-only game started: ${roomCode} with real AI personalities`
      );
    }, 2000);

    return this.getRoomInfo(room);
  }

  public cleanupOldSessions(): void {
    console.log("🧹 Starting cleanup of old sessions...");

    const now = Date.now();
    const ONE_HOUR = 60 * 60 * 1000;

    // Clean up AI response cache
    try {
      aiResponseGenerator.cleanupCache();
    } catch (error) {
      console.warn("Failed to cleanup AI cache:", error);
    }

    let roomsCleaned = 0;
    for (const [roomId, room] of this.rooms.entries()) {
      if (room.players.size === 0) {
        const roomAge = now - room.createdAt.getTime();
        if (roomAge > ONE_HOUR) {
          if (room.gameEngine) {
            room.gameEngine.cleanup();
          }
          this.rooms.delete(roomId);
          this.observerSockets.delete(roomId);
          roomsCleaned++;
        }
      }
    }

    let dashboardsCleaned = 0;
    for (const socket of this.dashboardSockets) {
      if (!socket.connected) {
        this.dashboardSockets.delete(socket);
        dashboardsCleaned++;
      }
    }

    let playersCleaned = 0;
    for (const [playerId, connection] of this.players.entries()) {
      if (!connection.socket.connected) {
        const connectionAge = now - connection.joinedAt.getTime();
        if (connectionAge > ONE_HOUR) {
          this.players.delete(playerId);
          playersCleaned++;
        }
      }
    }

    console.log(`🧹 Cleanup completed:`, {
      roomsCleaned,
      dashboardsCleaned,
      playersCleaned,
      activeRooms: this.rooms.size,
      activePlayers: this.players.size,
      activeDashboards: this.dashboardSockets.size,
    });

    this.broadcastToDashboards("cleanup_completed", {
      roomsCleaned,
      dashboardsCleaned,
      playersCleaned,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Terminate room with enhanced cleanup
   */
  public terminateRoom(roomId: RoomId, reason: string = "Terminated"): any {
    const room = this.rooms.get(roomId);
    if (!room) {
      return { success: false, message: "Room not found" };
    }

    const preTerminationInfo = {
      playerCount: room.players.size,
      gameInProgress: !!room.gameEngine,
      createdAt: room.createdAt,
    };

    // Clean up game engine
    if (room.gameEngine) {
      room.gameEngine.cleanup();
    }

    // Remove all player connections for this room
    for (const [playerId, connection] of this.players.entries()) {
      if (connection.roomId === roomId) {
        try {
          connection.socket.leave(roomId);
          connection.socket.emit("room_terminated", {
            message: reason,
            roomId,
            timestamp: new Date().toISOString(),
          });
        } catch (error) {
          console.warn(`Failed to notify player ${playerId}:`, error);
        }
        this.players.delete(playerId);
      }
    }

    // Remove observer sockets for this room
    const observers = this.observerSockets.get(roomId);
    if (observers) {
      for (const socket of observers) {
        try {
          socket.leave(roomId + "_observers");
          socket.emit("room_terminated", {
            message: reason,
            roomId,
            timestamp: new Date().toISOString(),
          });
        } catch (error) {
          console.warn("Failed to notify observer:", error);
        }
      }
      this.observerSockets.delete(roomId);
    }

    // Remove the room itself
    this.rooms.delete(roomId);

    // Broadcast to dashboards
    this.broadcastToDashboards(
      "room_terminated",
      this.sanitizeForBroadcast({
        roomCode: room.code,
        roomId: room.id,
        reason,
        preTerminationInfo,
        timestamp: new Date().toISOString(),
      })
    );

    console.log(`🔥 Room ${room.code} terminated: ${reason}`);

    return {
      success: true,
      preTerminationInfo,
      playersNotified: preTerminationInfo.playerCount,
    };
  }
}
