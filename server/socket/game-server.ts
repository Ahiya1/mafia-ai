// Fixed WebSocket Game Server for AI Mafia - Dashboard Event Broadcasting Fix
import { Server as SocketIOServer, Socket } from "socket.io";
import { Server as HTTPServer } from "http";
import { MafiaGameEngine } from "../lib/game/engine";
import { AIModelManager } from "../lib/ai/models";
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
import { AI_PERSONALITIES, AIModel } from "../lib/types/ai";
import { selectGamePersonalities } from "../../src/lib/ai/personality-pool";
import { v4 as uuidv4 } from "uuid";

export class GameSocketServer {
  private io: SocketIOServer;
  private rooms: Map<RoomId, GameRoom> = new Map();
  private players: Map<PlayerId, PlayerConnection> = new Map();
  private aiManager: AIModelManager;
  private dashboardSockets: Set<Socket> = new Set(); // Track dashboard connections
  private aiActionTimeouts: Map<string, NodeJS.Timeout> = new Map(); // Track AI timeouts to prevent recursion

  constructor(httpServer: HTTPServer) {
    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: process.env.FRONTEND_URL || "http://localhost:3000",
        methods: ["GET", "POST"],
      },
      pingTimeout: 60000,
      pingInterval: 25000,
    });

    this.aiManager = new AIModelManager();
    this.setupSocketHandlers();

    // Clean up AI timeouts every 5 minutes to prevent memory leaks
    setInterval(() => {
      this.cleanupOldTimeouts();
    }, 300000);

    // 🔧 FIXED: Broadcast stats to dashboard every 2 seconds
    setInterval(() => {
      this.broadcastStatsToDashboards();
    }, 2000);
  }

  private setupSocketHandlers(): void {
    this.io.on("connection", (socket: Socket) => {
      console.log(`🔌 Player connected: ${socket.id}`);

      // 🔧 FIXED: Better dashboard detection using query parameters or custom header
      const isDashboard =
        socket.handshake.query.dashboard === "true" ||
        socket.handshake.headers.referer?.includes("/dashboard") ||
        socket.handshake.query.clientType === "dashboard" ||
        socket.handshake.headers["user-agent"]?.includes("Dashboard");

      if (isDashboard) {
        this.dashboardSockets.add(socket);
        console.log(`📊 Dashboard connected: ${socket.id}`);

        // Send current stats to new dashboard immediately
        this.sendStatsToSocket(socket);

        // Send welcome message to dashboard
        socket.emit("dashboard_connected", {
          message: "Dashboard connected successfully",
          timestamp: new Date(),
          totalRooms: this.rooms.size,
          totalPlayers: this.players.size,
        });
      }

      socket.on(
        "join_room",
        (data: {
          roomCode: string;
          playerName: string;
          playerId?: PlayerId;
        }) => {
          this.handleJoinRoom(socket, data);
        }
      );

      socket.on(
        "create_room",
        (data: { playerName: string; roomSettings: any }) => {
          this.handleCreateRoom(socket, data);
        }
      );

      socket.on("game_action", (action: GameAction) => {
        this.handleGameAction(socket, action);
      });

      socket.on("ready_up", (data: { playerId: PlayerId }) => {
        this.handlePlayerReady(socket, data.playerId);
      });

      socket.on("heartbeat", () => {
        socket.emit("heartbeat_ack");
        // 🔧 FIXED: Also broadcast heartbeat to dashboards for monitoring
        this.broadcastToDashboards("heartbeat_received", {
          socketId: socket.id,
          timestamp: new Date(),
          isDashboard: this.dashboardSockets.has(socket),
        });
      });

      socket.on("disconnect", () => {
        this.handleDisconnect(socket);
      });
    });
  }

  private handleJoinRoom(
    socket: Socket,
    data: { roomCode: string; playerName: string; playerId?: PlayerId }
  ): void {
    const room = this.findRoomByCode(data.roomCode);

    if (!room) {
      socket.emit("error", {
        message: "Room not found",
        code: "ROOM_NOT_FOUND",
      });

      // 🔧 FIXED: Broadcast error to dashboards for debugging
      this.broadcastToDashboards("join_room_error", {
        roomCode: data.roomCode,
        playerName: data.playerName,
        error: "Room not found",
        timestamp: new Date(),
      });
      return;
    }

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

    socket.emit("room_joined", {
      roomId: room.id,
      playerId,
      roomCode: data.roomCode, // 🔧 FIXED: Include room code in response
      roomInfo: this.getRoomInfo(room),
      players: Array.from(room.players.values()),
    });

    // 🔧 FIXED: Enhanced broadcasting to both room AND dashboards
    this.broadcastToRoom(room.id, "player_joined", { player });
    this.broadcastToDashboards("player_joined", {
      player,
      roomCode: data.roomCode,
      roomId: room.id,
      timestamp: new Date(),
    });

    console.log(`✅ Player ${data.playerName} joined room ${data.roomCode}`);
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

    this.fillWithAIPlayers(room);

    socket.emit("room_created", {
      roomId,
      roomCode,
      playerId,
      roomInfo: this.getRoomInfo(room),
    });

    // 🔧 FIXED: Enhanced dashboard broadcasting with more details
    this.broadcastToDashboards("room_created", {
      roomCode,
      roomId,
      playerId,
      playerName: data.playerName,
      playerCount: room.players.size,
      maxPlayers: room.config.maxPlayers,
      timestamp: new Date(),
    });

    console.log(`🏠 Room created: ${roomCode} by ${data.playerName}`);
  }

  private fillWithAIPlayers(room: GameRoom): void {
    const currentPlayerCount = room.players.size;
    const aiPlayersNeeded = room.config.maxPlayers - currentPlayerCount;

    if (aiPlayersNeeded <= 0) return;

    try {
      const personalities = selectGamePersonalities(
        room.config.premiumModelsEnabled,
        aiPlayersNeeded
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
      }

      room.config.humanCount = Array.from(room.players.values()).filter(
        (p) => p.type === PlayerType.HUMAN
      ).length;
      room.config.aiCount = room.players.size - room.config.humanCount;

      this.broadcastToRoom(room.id, "room_updated", {
        players: Array.from(room.players.values()),
        config: room.config,
      });

      // 🔧 FIXED: Broadcast AI player addition to dashboards
      this.broadcastToDashboards("ai_players_added", {
        roomCode: room.code,
        aiCount: room.config.aiCount,
        totalPlayers: room.players.size,
        personalities: personalities.map((p) => ({
          name: p.name,
          model: p.model,
        })),
        timestamp: new Date(),
      });
    } catch (error) {
      console.error("❌ Error filling room with AI players:", error);
    }
  }

  private handleGameAction(socket: Socket, action: GameAction): void {
    const connection = Array.from(this.players.values()).find(
      (p) => p.socket.id === socket.id
    );
    if (!connection) return;

    const room = this.rooms.get(connection.roomId);
    if (!room || !room.gameEngine) return;

    // 🔧 FIXED: Broadcast all game actions to dashboards
    this.broadcastToDashboards("game_action_received", {
      action: action.type,
      playerId: action.playerId || connection.playerId,
      roomCode: room.code,
      timestamp: new Date(),
    });

    switch (action.type) {
      case "START_GAME":
        this.startGame(room, action.playerId);
        break;
      case "SEND_MESSAGE":
        this.handleMessage(room, action.playerId, action.content);
        break;
      case "CAST_VOTE":
        this.handleVote(
          room,
          action.playerId,
          action.targetId,
          action.reasoning
        );
        break;
      case "NIGHT_ACTION":
        this.handleNightAction(
          room,
          action.playerId,
          action.action,
          action.targetId
        );
        break;
    }
  }

  private startGame(room: GameRoom, playerId: PlayerId): void {
    if (room.players.get(playerId)?.id !== room.hostId) {
      return;
    }

    if (!room.gameEngine) {
      room.gameEngine = new MafiaGameEngine(room.id, room.config);
      this.setupGameEngineHandlers(room);

      Array.from(room.players.values()).forEach((player) => {
        room.gameEngine!.addPlayer(player);
      });
    }

    const success = room.gameEngine.startGame();
    if (success) {
      this.broadcastToRoom(room.id, "game_started", {
        gameState: room.gameEngine.getGameState(),
      });

      // 🔧 FIXED: Enhanced dashboard broadcasting
      this.broadcastToDashboards("game_started", {
        roomCode: room.code,
        roomId: room.id,
        hostId: playerId,
        playerCount: room.players.size,
        aiCount: room.config.aiCount,
        timestamp: new Date(),
      });

      // 🔧 FIXED: Start AI automation safely without recursion
      this.startAIAutomationSafely(room);
    }
  }

  private setupGameEngineHandlers(room: GameRoom): void {
    const engine = room.gameEngine!;

    engine.on("game_event", (event: any) => {
      this.broadcastToRoom(room.id, "game_event", event);

      // 🔧 FIXED: Enhanced dashboard broadcasting for game events
      this.broadcastToDashboards("game_event", {
        ...event,
        roomCode: room.code,
        roomId: room.id,
        playerCount: room.players.size,
        timestamp: new Date(),
      });
    });

    engine.on(
      "phase_changed",
      (data: { newPhase: string; oldPhase: string; round: number }) => {
        this.broadcastToRoom(room.id, "phase_changed", data);

        // 🔧 FIXED: Enhanced phase change broadcasting
        this.broadcastToDashboards("phase_changed", {
          ...data,
          roomCode: room.code,
          roomId: room.id,
          playerCount: room.players.size,
          timestamp: new Date(),
        });

        // 🔧 FIXED: Safe AI phase transition without recursion
        this.handleAIPhaseTransitionSafely(room, data.newPhase);
      }
    );

    engine.on("player_eliminated", (data: any) => {
      this.broadcastToRoom(room.id, "player_eliminated", data);

      // 🔧 FIXED: Enhanced elimination broadcasting
      this.broadcastToDashboards("player_eliminated", {
        ...data,
        roomCode: room.code,
        roomId: room.id,
        remainingPlayers: Array.from(room.players.values()).filter(
          (p) => p.isAlive
        ).length,
        timestamp: new Date(),
      });
    });

    engine.on("game_ended", (data: any) => {
      this.broadcastToRoom(room.id, "game_ended", data);

      // 🔧 FIXED: Enhanced game end broadcasting
      this.broadcastToDashboards("game_ended", {
        ...data,
        roomCode: room.code,
        roomId: room.id,
        duration: data.stats?.gameDuration || 0,
        totalRounds: data.stats?.totalRounds || 0,
        timestamp: new Date(),
      });

      this.cleanupGame(room);
    });

    engine.on("speaker_turn_started", (data: { speakerId: any }) => {
      this.broadcastToRoom(room.id, "speaker_turn_started", data);

      const player = room.players.get(data.speakerId);
      if (player?.type === PlayerType.AI) {
        // 🔧 FIXED: Use safe AI handling
        this.handleAIDiscussionSafely(room, player);
      }
    });

    engine.on("next_voter", (data: { voterId: any }) => {
      this.broadcastToRoom(room.id, "next_voter", data);

      const player = room.players.get(data.voterId);
      if (player?.type === PlayerType.AI) {
        // 🔧 FIXED: Use safe AI handling
        this.handleAIVotingSafely(room, player);
      }
    });
  }

  // 🔧 FIXED: Enhanced dashboard broadcasting methods
  private broadcastToDashboards(event: string, data: any): void {
    const dashboardCount = this.dashboardSockets.size;

    if (dashboardCount > 0) {
      console.log(`📊 Broadcasting ${event} to ${dashboardCount} dashboards`);

      this.dashboardSockets.forEach((socket) => {
        if (socket.connected) {
          socket.emit(event, data);
        } else {
          // Remove disconnected sockets
          this.dashboardSockets.delete(socket);
        }
      });
    }
  }

  private broadcastStatsToDashboards(): void {
    if (this.dashboardSockets.size > 0) {
      const stats = this.getRoomStats();
      const aiStats = this.getAIUsageStats();

      const statsData = {
        rooms: stats,
        ai: Array.from(aiStats.entries()),
        server: {
          uptime: process.uptime(),
          memoryUsage: process.memoryUsage(),
          timestamp: new Date().toISOString(),
          dashboardConnections: this.dashboardSockets.size,
          activeConnections: this.players.size,
        },
      };

      this.broadcastToDashboards("stats_update", statsData);
    }
  }

  private sendStatsToSocket(socket: Socket): void {
    const stats = this.getRoomStats();
    const aiStats = this.getAIUsageStats();

    const statsData = {
      rooms: stats,
      ai: Array.from(aiStats.entries()),
      server: {
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage(),
        timestamp: new Date().toISOString(),
        dashboardConnections: this.dashboardSockets.size,
        activeConnections: this.players.size,
      },
    };

    socket.emit("stats_update", statsData);
  }

  // 🔧 FIXED: Safe AI automation that prevents recursion
  private startAIAutomationSafely(room: GameRoom): void {
    console.log(`🤖 AI automation started for room ${room.code}`);

    // Broadcast AI automation start to dashboards
    this.broadcastToDashboards("ai_automation_started", {
      roomCode: room.code,
      aiCount: room.config.aiCount,
      timestamp: new Date(),
    });
  }

  // 🔧 FIXED: Safe phase transition handling
  private handleAIPhaseTransitionSafely(
    room: GameRoom,
    newPhase: string
  ): void {
    // Create unique timeout keys to prevent duplicate actions
    const timeoutKey = `${room.id}_${newPhase}_${Date.now()}`;

    if (newPhase === "night") {
      const aiPlayers = Array.from(room.players.values()).filter(
        (p) => p.type === PlayerType.AI && p.isAlive
      );

      for (const aiPlayer of aiPlayers) {
        if (aiPlayer.role === PlayerRole.MAFIA_LEADER) {
          const mafiaTimeoutKey = `${timeoutKey}_mafia_${aiPlayer.id}`;
          const timeout = setTimeout(() => {
            this.handleAIMafiaActionSafely(room, aiPlayer);
            this.aiActionTimeouts.delete(mafiaTimeoutKey);
          }, 2000 + Math.random() * 3000); // Add randomness

          this.aiActionTimeouts.set(mafiaTimeoutKey, timeout);
        } else if (aiPlayer.role === PlayerRole.HEALER) {
          const healerTimeoutKey = `${timeoutKey}_healer_${aiPlayer.id}`;
          const timeout = setTimeout(() => {
            this.handleAIHealerActionSafely(room, aiPlayer);
            this.aiActionTimeouts.delete(healerTimeoutKey);
          }, 1500 + Math.random() * 2000); // Add randomness

          this.aiActionTimeouts.set(healerTimeoutKey, timeout);
        }
      }
    }
  }

  // 🔧 FIXED: Safe AI discussion handling
  private async handleAIDiscussionSafely(
    room: GameRoom,
    aiPlayer: Player
  ): Promise<void> {
    const actionKey = `discussion_${room.id}_${aiPlayer.id}_${Date.now()}`;

    // Prevent duplicate actions
    if (this.aiActionTimeouts.has(actionKey)) {
      return;
    }

    try {
      const context = this.buildAIContext(room, aiPlayer);
      const personality = AI_PERSONALITIES[aiPlayer.model!];

      if (!personality) {
        console.warn(`⚠️ No personality found for model ${aiPlayer.model}`);
        return;
      }

      const request = {
        type: "discussion" as const,
        context,
        personality,
        constraints: { maxLength: 200, timeLimit: 30000 },
      };

      const response = await this.aiManager.generateResponse(request);

      const delay = 2000 + Math.random() * 3000;
      const timeout = setTimeout(() => {
        if (room.gameEngine && room.players.has(aiPlayer.id)) {
          room.gameEngine.sendMessage(aiPlayer.id, response.content);
        }
        this.aiActionTimeouts.delete(actionKey);
      }, delay);

      this.aiActionTimeouts.set(actionKey, timeout);
    } catch (error) {
      console.error(`❌ AI discussion error for ${aiPlayer.name}:`, error);

      // Fallback message
      const timeout = setTimeout(() => {
        if (room.gameEngine && room.players.has(aiPlayer.id)) {
          room.gameEngine.sendMessage(
            aiPlayer.id,
            "I'm still thinking about this..."
          );
        }
        this.aiActionTimeouts.delete(actionKey);
      }, 3000);

      this.aiActionTimeouts.set(actionKey, timeout);
    }
  }

  // 🔧 FIXED: Safe AI voting handling
  private async handleAIVotingSafely(
    room: GameRoom,
    aiPlayer: Player
  ): Promise<void> {
    const actionKey = `voting_${room.id}_${aiPlayer.id}_${Date.now()}`;

    if (this.aiActionTimeouts.has(actionKey)) {
      return;
    }

    try {
      const alivePlayers = Array.from(room.players.values()).filter(
        (p) => p.isAlive && p.id !== aiPlayer.id
      );

      if (alivePlayers.length === 0) {
        return;
      }

      const targetId =
        alivePlayers[Math.floor(Math.random() * alivePlayers.length)].id;
      const reasoning = "Based on my analysis of the discussion";

      const delay = 3000 + Math.random() * 4000;
      const timeout = setTimeout(() => {
        if (room.gameEngine && room.players.has(aiPlayer.id)) {
          room.gameEngine.castVote(aiPlayer.id, targetId, reasoning);
        }
        this.aiActionTimeouts.delete(actionKey);
      }, delay);

      this.aiActionTimeouts.set(actionKey, timeout);
    } catch (error) {
      console.error(`❌ AI voting error for ${aiPlayer.name}:`, error);
      this.aiActionTimeouts.delete(actionKey);
    }
  }

  // 🔧 FIXED: Safe AI mafia action handling
  private async handleAIMafiaActionSafely(
    room: GameRoom,
    mafiaPlayer: Player
  ): Promise<void> {
    const actionKey = `mafia_${room.id}_${mafiaPlayer.id}_${Date.now()}`;

    if (this.aiActionTimeouts.has(actionKey)) {
      return;
    }

    try {
      const alivePlayers = Array.from(room.players.values()).filter(
        (p) =>
          p.isAlive &&
          p.role !== PlayerRole.MAFIA_LEADER &&
          p.role !== PlayerRole.MAFIA_MEMBER
      );

      if (alivePlayers.length === 0) {
        return;
      }

      const targetId =
        alivePlayers[Math.floor(Math.random() * alivePlayers.length)].id;

      const delay = 10000 + Math.random() * 20000;
      const timeout = setTimeout(() => {
        if (room.gameEngine && room.players.has(mafiaPlayer.id)) {
          room.gameEngine.nightAction(mafiaPlayer.id, "kill", targetId);
        }
        this.aiActionTimeouts.delete(actionKey);
      }, delay);

      this.aiActionTimeouts.set(actionKey, timeout);
    } catch (error) {
      console.error(`❌ AI mafia action error for ${mafiaPlayer.name}:`, error);
      this.aiActionTimeouts.delete(actionKey);
    }
  }

  // 🔧 FIXED: Safe AI healer action handling
  private async handleAIHealerActionSafely(
    room: GameRoom,
    healerPlayer: Player
  ): Promise<void> {
    const actionKey = `healer_${room.id}_${healerPlayer.id}_${Date.now()}`;

    if (this.aiActionTimeouts.has(actionKey)) {
      return;
    }

    try {
      const alivePlayers = Array.from(room.players.values()).filter(
        (p) => p.isAlive
      );

      if (alivePlayers.length === 0) {
        return;
      }

      const targetId =
        alivePlayers[Math.floor(Math.random() * alivePlayers.length)].id;

      const delay = 5000 + Math.random() * 15000;
      const timeout = setTimeout(() => {
        if (room.gameEngine && room.players.has(healerPlayer.id)) {
          room.gameEngine.nightAction(healerPlayer.id, "heal", targetId);
        }
        this.aiActionTimeouts.delete(actionKey);
      }, delay);

      this.aiActionTimeouts.set(actionKey, timeout);
    } catch (error) {
      console.error(
        `❌ AI healer action error for ${healerPlayer.name}:`,
        error
      );
      this.aiActionTimeouts.delete(actionKey);
    }
  }

  private buildAIContext(room: GameRoom, aiPlayer: Player): any {
    const gameState = room.gameEngine?.getGameState();
    if (!gameState) return {};

    return {
      playerId: aiPlayer.id,
      role: aiPlayer.role!,
      phase: gameState.phase,
      round: gameState.currentRound,
      gameHistory: gameState.messages
        .slice(-10)
        .map(
          (m: { playerId: any; content: any }) =>
            `${room.players.get(m.playerId)?.name}: ${m.content}`
        ),
      livingPlayers: Array.from(room.players.values())
        .filter((p) => p.isAlive)
        .map((p) => p.id),
      eliminatedPlayers: gameState.eliminatedPlayers,
      previousVotes: [],
      timeRemaining: room.gameEngine?.getRemainingTime() || 0,
      suspicionLevels: {},
      trustLevels: {},
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
        timestamp: new Date(),
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
        timestamp: new Date(),
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
        timestamp: new Date(),
      });
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

      // 🔧 FIXED: Broadcast ready status to dashboards
      this.broadcastToDashboards("player_ready", {
        playerId,
        playerName: player.name,
        roomCode: room.code,
        timestamp: new Date(),
      });
    }
  }

  private handleDisconnect(socket: Socket): void {
    // Remove from dashboard sockets if applicable
    const wasDashboard = this.dashboardSockets.has(socket);
    this.dashboardSockets.delete(socket);

    if (wasDashboard) {
      console.log(`📊 Dashboard disconnected: ${socket.id}`);
      // Broadcast dashboard disconnect to remaining dashboards
      this.broadcastToDashboards("dashboard_disconnected", {
        socketId: socket.id,
        remainingDashboards: this.dashboardSockets.size,
        timestamp: new Date(),
      });
      return;
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

      this.broadcastToDashboards("player_left", {
        playerId: connection.playerId,
        roomCode: room.code,
        remainingPlayers: room.players.size,
        timestamp: new Date(),
      });

      if (room.players.size === 0) {
        this.rooms.delete(room.id);
        this.broadcastToDashboards("room_deleted", {
          roomCode: room.code,
          reason: "No players remaining",
          timestamp: new Date(),
        });
      }
    }

    this.players.delete(connection.playerId);
    console.log(`👋 Player disconnected: ${socket.id}`);
  }

  private cleanupGame(room: GameRoom): void {
    // Clean up AI timeouts for this room
    for (const [key, timeout] of this.aiActionTimeouts.entries()) {
      if (key.includes(room.id)) {
        clearTimeout(timeout);
        this.aiActionTimeouts.delete(key);
      }
    }

    room.gameEngine = null;
    room.players.forEach((player) => {
      player.isReady = false;
      player.isAlive = true;
      player.role = undefined;
      player.votedFor = undefined;
    });
  }

  private cleanupOldTimeouts(): void {
    // Remove timeouts older than 10 minutes
    const tenMinutesAgo = Date.now() - 10 * 60 * 1000;

    for (const [key, timeout] of this.aiActionTimeouts.entries()) {
      const timestamp = parseInt(key.split("_").pop() || "0");
      if (timestamp < tenMinutesAgo) {
        clearTimeout(timeout);
        this.aiActionTimeouts.delete(key);
      }
    }
  }

  // 🔧 FIXED: Separate broadcast methods
  private broadcastToRoom(roomId: RoomId, event: string, data: any): void {
    this.io.to(roomId).emit(event, data);
  }

  private findRoomByCode(code: string): GameRoom | undefined {
    return Array.from(this.rooms.values()).find((room) => room.code === code);
  }

  private generateRoomCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  private getRoomInfo(room: GameRoom): any {
    return {
      id: room.id,
      code: room.code,
      playerCount: room.players.size,
      maxPlayers: room.config.maxPlayers,
      gameInProgress: !!room.gameEngine,
      createdAt: room.createdAt,
    };
  }

  // Public API Methods
  getRoomStats(): any {
    const roomList = Array.from(this.rooms.values()).map((room) => ({
      ...this.getRoomInfo(room),
      aiCount: room.config.aiCount,
      humanCount: room.config.humanCount,
    }));

    return {
      totalRooms: this.rooms.size,
      activeRooms: Array.from(this.rooms.values()).filter((r) => r.gameEngine)
        .length,
      totalPlayers: this.players.size,
      roomList,
    };
  }

  getAIUsageStats(): any {
    return this.aiManager.getUsageStats();
  }

  getPersonalityPoolInfo(): any {
    return this.aiManager.getPersonalityPoolInfo();
  }

  createAIOnlyGame(gameConfig?: any): any {
    const roomId = uuidv4();
    const roomCode = this.generateRoomCode();

    const config: GameConfig = {
      maxPlayers: 10,
      aiCount: 10,
      humanCount: 0,
      nightPhaseDuration: 90,
      discussionPhaseDuration: 300,
      votingPhaseDuration: 120,
      revelationPhaseDuration: 10,
      speakingTimePerPlayer: 35,
      allowSpectators: true,
      premiumModelsEnabled: true,
      ...gameConfig,
    };

    const room: GameRoom = {
      id: roomId,
      code: roomCode,
      hostId: "creator",
      players: new Map(),
      config,
      createdAt: new Date(),
      gameEngine: null,
    };

    this.rooms.set(roomId, room);
    this.fillWithAIPlayers(room);

    // Auto-start the game
    setTimeout(() => {
      room.gameEngine = new MafiaGameEngine(room.id, room.config);
      this.setupGameEngineHandlers(room);

      Array.from(room.players.values()).forEach((player) => {
        room.gameEngine!.addPlayer(player);
      });

      room.gameEngine.startGame();
      this.startAIAutomationSafely(room);

      // 🔧 FIXED: Enhanced AI-only game broadcasting
      this.broadcastToDashboards("ai_only_game_created", {
        roomCode,
        roomId,
        aiCount: room.config.aiCount,
        personalities: Array.from(room.players.values()).map((p) => ({
          name: p.name,
          model: p.model,
        })),
        timestamp: new Date(),
      });
    }, 2000);

    return this.getRoomInfo(room);
  }
}

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
