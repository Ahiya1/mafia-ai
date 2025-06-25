// server/socket/game-server.ts - Enhanced Integration with Revolutionary Architecture
import { Server as SocketIOServer, Socket } from "socket.io";
import { Server as HTTPServer } from "http";
import { GameOrchestrator as MafiaGameEngine } from "../lib/game/orchestrator"; // 🔥 COMMIT 2: Use orchestrator!
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
      "🚀 Game Socket Server initialized with Revolutionary Architecture"
    );
    console.log("🎭 Phase Managers: Discussion, Voting, Night, Role");
    console.log("🏷️ Perfect Anonymity: Name Registry System");
    console.log("🔍 Bulletproof Parsing: JSON Validation");
    console.log("🧠 Context Operations: trigger/update/push");
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

      // 🔥 NEW: Enhanced debug support with phase managers
      socket.on("debug_request", (data: { type: string; roomId?: string }) => {
        this.handleDebugRequest(socket, data);
      });

      socket.on("disconnect", () => {
        this.handleDisconnect(socket);
      });
    });
  }

  /**
   * 🔥 ENHANCED: Handle debug requests with phase manager data
   */
  private handleDebugRequest(
    socket: Socket,
    data: { type: string; roomId?: string }
  ): void {
    try {
      switch (data.type) {
        case "game_state":
          if (data.roomId) {
            const room = this.roomManager.getRoomById(data.roomId);
            if (room && room.gameEngine) {
              socket.emit("debug_response", {
                type: "game_state",
                data: room.gameEngine.getDebugInfo(),
                timestamp: new Date().toISOString(),
              });
            }
          }
          break;

        case "phase_managers":
          if (data.roomId) {
            const room = this.roomManager.getRoomById(data.roomId);
            if (room && room.gameEngine) {
              const debugInfo = room.gameEngine.getDebugInfo();
              socket.emit("debug_response", {
                type: "phase_managers",
                data: {
                  revolutionaryArchitecture:
                    debugInfo.revolutionaryArchitecture,
                  phaseManagers: debugInfo.phaseManagers,
                },
                timestamp: new Date().toISOString(),
              });
            }
          }
          break;

        case "server_health":
          socket.emit("debug_response", {
            type: "server_health",
            data: this.getEnhancedServerHealth(),
            timestamp: new Date().toISOString(),
          });
          break;
      }
    } catch (error) {
      socket.emit("debug_error", {
        error: "Debug request failed",
        message: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
      });
    }
  }

  private getEnhancedServerHealth(): any {
    const rooms = this.roomManager.getAllRooms();
    const stats = this.roomManager.getRoomStats();

    return {
      uptime: process.uptime(),
      totalRooms: rooms.length,
      activeGames: rooms.filter((r) => r.gameEngine).length,
      totalConnections: this.playerManager.getAllConnections().length,
      dashboardConnections: this.dashboardSockets.size,
      revolutionaryArchitecture: {
        enabled: true,
        phaseManagers: ["Discussion", "Voting", "Night", "Role"],
        contextOperations: "trigger/update/push active",
        nameRegistry: "Perfect anonymity enabled",
        responseParser: "Bulletproof JSON validation",
      },
      gameStats: stats,
    };
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
      architecture: "Revolutionary Phase Managers Active",
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

    // Use proper capacity checking
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

    // 🔥 COMMIT 2: Add player to orchestrator
    if (room.gameEngine) {
      room.gameEngine.addPlayer(player);
    }

    // Fill with AI players AFTER human player is added
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
      architecture: "Revolutionary Phase Managers Active",
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
        architecture: "phase_managers",
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
      `✅ Player ${data.playerName} joined room ${data.roomCode} with revolutionary architecture`
    );
  }

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
    socket.join(room.id);

    // 🔥 COMMIT 2: Get enhanced observer data with phase manager info
    const completeObserverData = this.getCompleteObserverHistory(room);

    // Send enhanced observer joined response
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
        role: p.role,
        model: p.model,
      })),
      gameState: room.gameEngine?.getSerializableGameState(),
      observerMode: true,
      observerData: completeObserverData,
      joinTimestamp: new Date().toISOString(),
      architecture: "Revolutionary Phase Managers with Full Observability",
    });

    console.log(
      `✅ Observer ${observerName} joined room ${room.code} with enhanced phase manager data`
    );
  }

  /**
   * 🔥 COMMIT 2: Enhanced observer history with phase manager data
   */
  private getCompleteObserverHistory(room: GameRoom): any {
    if (!room.gameEngine) {
      return {
        observerUpdates: [],
        suspicionMatrix: {},
        gameAnalytics: {},
        phaseHistory: [],
        phaseManagerStatus: {},
      };
    }

    const gameState = room.gameEngine.getSerializableGameState();

    return {
      observerUpdates: gameState.observerData?.observerUpdates || [],
      suspicionMatrix: gameState.observerData?.suspicionMatrix || {},
      gameAnalytics: gameState.observerData?.gameAnalytics || {},
      phaseHistory: this.buildEnhancedPhaseHistory(room),
      // 🔥 COMMIT 2: Phase manager status
      phaseManagerStatus: gameState.phaseManagerStatus || {},
      revolutionaryArchitecture: {
        contextStats: gameState.contextStats,
        nameRegistryStats: gameState.nameRegistryStats,
        parsingStats: gameState.parsingStats,
        contextBuildingStats: gameState.contextBuildingStats,
      },
    };
  }

  /**
   * 🔥 COMMIT 2: Build enhanced phase history
   */
  private buildEnhancedPhaseHistory(room: GameRoom): any[] {
    if (!room.gameEngine) return [];

    const gameState = room.gameEngine.getSerializableGameState();
    const history = gameState.gameHistory || [];

    return history
      .filter(
        (event: any) =>
          event.type === "phase_changed" ||
          event.type === "game_started" ||
          event.type === "player_eliminated" ||
          event.type === "discussion_started" ||
          event.type === "voting_started" ||
          event.type === "night_started"
      )
      .map((event: any) => ({
        type: event.type,
        timestamp: event.timestamp,
        phase: event.data?.newPhase || event.data?.phase,
        round: event.data?.round || event.round,
        details: event.data,
        phaseManager: this.getPhaseManagerForEvent(event.type),
      }));
  }

  private getPhaseManagerForEvent(eventType: string): string {
    switch (eventType) {
      case "discussion_started":
        return "DiscussionManager";
      case "voting_started":
        return "VotingManager";
      case "night_started":
        return "NightManager";
      case "roles_assigned":
        return "RoleManager";
      default:
        return "GameOrchestrator";
    }
  }

  private handleCreateRoom(
    socket: Socket,
    data: { playerName: string; roomSettings: any }
  ): void {
    const playerId = uuidv4();

    // Use room manager for creation
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

    // Fill with AI players immediately after creation
    this.fillWithAIPlayers(room);

    const player = room.players.get(playerId)!;

    socket.emit("room_created", {
      roomId: room.id,
      roomCode,
      playerId,
      player,
      roomInfo: this.getRoomInfo(room),
      players: Array.from(room.players.values()),
      architecture: "Revolutionary Phase Managers Ready",
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
        architecture: "phase_managers",
      })
    );

    console.log(
      `🏠 Room created with Revolutionary Architecture: ${roomCode} by ${data.playerName} (${room.players.size} players)`
    );
  }

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

        // 🔥 COMMIT 2: Add to orchestrator
        if (room.gameEngine) {
          room.gameEngine.addPlayer(aiPlayer);
        }

        console.log(
          `🤖 Added AI player: ${aiPlayer.name} (${personality.model}, ${personality.archetype})`
        );
      }

      const finalHumanCount = Array.from(room.players.values()).filter(
        (p) => p.type === PlayerType.HUMAN
      ).length;
      const finalAICount = room.players.size - finalHumanCount;

      room.config.humanCount = finalHumanCount;
      room.config.aiCount = finalAICount;

      this.totalPlayersServed += aiPlayersNeeded;

      // Broadcast room update
      this.broadcastToRoom(room.id, "room_updated", {
        players: Array.from(room.players.values()),
        config: room.config,
        architecture: "Revolutionary Phase Managers",
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
          architecture: "phase_managers",
        })
      );

      console.log(
        `✅ Room ${room.code} now has ${room.players.size} players (${finalHumanCount} human, ${finalAICount} AI) with Revolutionary Architecture`
      );
    } catch (error) {
      console.error("❌ Error filling room with AI players:", error);
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
        architecture: "phase_managers",
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
      // 🔥 COMMIT 2: Create orchestrator instead of old engine
      room.gameEngine = new MafiaGameEngine(room.id, room.config);
      this.setupEnhancedGameEngineHandlers(room);

      Array.from(room.players.values()).forEach((player) => {
        room.gameEngine!.addPlayer(player);
      });
    }

    const success = room.gameEngine.startGame();
    if (success) {
      console.log(
        `🚀 Game started with Revolutionary Architecture in room ${room.code} with ${room.players.size} players`
      );

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
          architecture: "Revolutionary Phase Managers",
        })
      );
    } else {
      console.log(`❌ Failed to start game in room ${room.code}`);
    }
  }

  /**
   * 🔥 COMMIT 2: Enhanced game engine handlers with phase manager events
   */
  private setupEnhancedGameEngineHandlers(room: GameRoom): void {
    const engine = room.gameEngine!;

    // Core game events
    engine.on("game_event", (event: any) => {
      const sanitizedEvent = this.sanitizeForBroadcast(event);
      this.broadcastToRoom(room.id, "game_event", sanitizedEvent);
      this.playerManager.broadcastToObservers(
        room.id,
        "game_event",
        sanitizedEvent
      );
    });

    // 🔥 COMMIT 2: Phase manager specific events
    engine.on("discussion_started", (data: any) => {
      console.log(`💬 Discussion started in room ${room.code}`);
      const enhancedData = {
        ...data,
        roomCode: room.code,
        timestamp: new Date().toISOString(),
      };

      this.broadcastToRoom(room.id, "discussion_started", enhancedData);
      this.playerManager.broadcastToObservers(
        room.id,
        "discussion_started",
        enhancedData
      );
      this.broadcastToDashboards("discussion_started", enhancedData);
    });

    engine.on("discussion_ended", (data: any) => {
      console.log(`💬 Discussion ended in room ${room.code}`);
      const enhancedData = {
        ...data,
        roomCode: room.code,
        timestamp: new Date().toISOString(),
      };

      this.broadcastToRoom(room.id, "discussion_ended", enhancedData);
      this.playerManager.broadcastToObservers(
        room.id,
        "discussion_ended",
        enhancedData
      );
    });

    engine.on("voting_started", (data: any) => {
      console.log(`🗳️ Voting started in room ${room.code}`);
      const enhancedData = {
        ...data,
        roomCode: room.code,
        timestamp: new Date().toISOString(),
      };

      this.broadcastToRoom(room.id, "voting_started", enhancedData);
      this.playerManager.broadcastToObservers(
        room.id,
        "voting_started",
        enhancedData
      );
      this.broadcastToDashboards("voting_started", enhancedData);
    });

    engine.on("voting_ended", (data: any) => {
      console.log(`🗳️ Voting ended in room ${room.code}`);
      const enhancedData = {
        ...data,
        roomCode: room.code,
        timestamp: new Date().toISOString(),
      };

      this.broadcastToRoom(room.id, "voting_ended", enhancedData);
      this.playerManager.broadcastToObservers(
        room.id,
        "voting_ended",
        enhancedData
      );
    });

    engine.on("night_started", (data: any) => {
      console.log(`🌙 Night started in room ${room.code}`);
      const enhancedData = {
        ...data,
        roomCode: room.code,
        timestamp: new Date().toISOString(),
      };

      this.broadcastToRoom(room.id, "night_started", enhancedData);
      this.playerManager.broadcastToObservers(
        room.id,
        "night_started",
        enhancedData
      );
      this.broadcastToDashboards("night_started", enhancedData);
    });

    engine.on("night_ended", (data: any) => {
      console.log(`🌙 Night ended in room ${room.code}`);
      const enhancedData = {
        ...data,
        roomCode: room.code,
        timestamp: new Date().toISOString(),
      };

      this.broadcastToRoom(room.id, "night_ended", enhancedData);
      this.playerManager.broadcastToObservers(
        room.id,
        "night_ended",
        enhancedData
      );
    });

    engine.on("mafia_chat", (data: any) => {
      console.log(`🔴 Mafia chat in room ${room.code}: ${data.playerName}`);
      const enhancedData = {
        ...data,
        roomCode: room.code,
        timestamp: new Date().toISOString(),
      };

      this.playerManager.broadcastToObservers(
        room.id,
        "mafia_chat",
        enhancedData
      );
      this.broadcastToDashboards("mafia_chat", enhancedData);
    });

    engine.on("roles_assigned", (data: any) => {
      console.log(`🎭 Roles assigned in room ${room.code}`);
      const enhancedData = {
        ...data,
        roomCode: room.code,
        timestamp: new Date().toISOString(),
      };

      this.broadcastToRoom(room.id, "roles_assigned", enhancedData);
      this.playerManager.broadcastToObservers(
        room.id,
        "roles_assigned",
        enhancedData
      );
      this.broadcastToDashboards("roles_assigned", enhancedData);
    });

    // Enhanced observer updates
    engine.on("observer_update", (data: any) => {
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

    // Phase changes with enhanced data
    engine.on("phase_changed", (data: any) => {
      const enhancedData = {
        ...data,
        roomCode: room.code,
        timestamp: new Date().toISOString(),
        phaseManager: this.getPhaseManagerForPhase(data.newPhase),
      };

      this.broadcastToRoom(room.id, "phase_changed", enhancedData);
      this.playerManager.broadcastToObservers(
        room.id,
        "phase_changed",
        enhancedData
      );

      const gameState = engine.getSerializableGameState();
      this.broadcastToRoom(room.id, "game_state_update", gameState);
      this.playerManager.broadcastToObservers(
        room.id,
        "game_state_update",
        gameState
      );

      this.broadcastToDashboards("phase_changed", enhancedData);
    });

    // Vote casting
    engine.on("vote_cast", (data: any) => {
      const enhancedData = {
        ...data,
        roomCode: room.code,
        timestamp: new Date().toISOString(),
        phaseManager: "VotingManager",
      };

      this.broadcastToRoom(room.id, "vote_cast", enhancedData);
      this.playerManager.broadcastToObservers(
        room.id,
        "vote_cast",
        enhancedData
      );
      this.broadcastToDashboards("vote_cast", enhancedData);
    });

    // Game ending
    engine.on("game_ended", (data: any) => {
      const enhancedData = {
        ...data,
        roomCode: room.code,
        timestamp: new Date().toISOString(),
        revolutionaryArchitecture: data.stats?.revolutionaryArchitecture,
        phaseManagerStats: data.stats?.phaseManagerStats,
      };

      this.broadcastToRoom(room.id, "game_ended", enhancedData);
      this.playerManager.broadcastToObservers(
        room.id,
        "game_ended",
        enhancedData
      );
      this.broadcastToDashboards("game_ended", enhancedData);

      this.cleanupGameWithPhaseManagers(room);
    });

    // Enhanced player elimination
    engine.on("player_eliminated", (data: any) => {
      const enhancedData = {
        ...data,
        roomCode: room.code,
        timestamp: new Date().toISOString(),
        remainingPlayers: Array.from(room.players.values()).filter(
          (p: any) => p.isAlive
        ).length,
      };

      this.broadcastToRoom(room.id, "player_eliminated", enhancedData);
      this.playerManager.broadcastToObservers(
        room.id,
        "player_eliminated",
        enhancedData
      );
      this.broadcastToDashboards("player_eliminated", enhancedData);
    });
  }

  private getPhaseManagerForPhase(phase: string): string {
    switch (phase) {
      case "discussion":
        return "DiscussionManager";
      case "voting":
        return "VotingManager";
      case "night":
        return "NightManager";
      case "role_assignment":
        return "RoleManager";
      default:
        return "GameOrchestrator";
    }
  }

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

  /**
   * 🔥 COMMIT 2: Enhanced cleanup with phase managers
   */
  private cleanupGameWithPhaseManagers(room: GameRoom): void {
    if (room.gameEngine) {
      const finalStats = room.gameEngine.getDebugInfo();

      console.log(`🧹 Enhanced cleanup for room ${room.code}:`, {
        revolutionaryArchitecture: finalStats.revolutionaryArchitecture,
        phaseManagers: finalStats.phaseManagers,
      });

      room.gameEngine.cleanup();
      room.gameEngine = null;
    }

    room.players.forEach((player: any) => {
      player.isReady = false;
      player.isAlive = true;
      player.role = undefined;
      player.votedFor = undefined;
    });

    console.log(
      `🧹 Enhanced cleanup completed for room ${room.code} with Revolutionary Architecture`
    );
  }

  private handleMessage(
    room: GameRoom,
    playerId: PlayerId,
    content: string
  ): void {
    // 🔥 COMMIT 2: Use orchestrator
    if (room.gameEngine?.sendMessage(playerId, content)) {
      this.broadcastToDashboards("message_received", {
        playerId,
        playerName: room.players.get(playerId)?.name,
        content,
        roomCode: room.code,
        timestamp: new Date().toISOString(),
        phaseManager: "DiscussionManager",
      });
    }
  }

  private handleVote(
    room: GameRoom,
    playerId: PlayerId,
    targetId: PlayerId,
    reasoning: string
  ): void {
    // 🔥 COMMIT 2: Use orchestrator
    if (room.gameEngine?.castVote(playerId, targetId, reasoning)) {
      this.broadcastToDashboards("vote_cast", {
        voterId: playerId,
        voterName: room.players.get(playerId)?.name,
        targetId,
        targetName: room.players.get(targetId)?.name,
        reasoning,
        roomCode: room.code,
        timestamp: new Date().toISOString(),
        phaseManager: "VotingManager",
      });
    }
  }

  private handleNightAction(
    room: GameRoom,
    playerId: PlayerId,
    action: "kill" | "heal",
    targetId?: PlayerId
  ): void {
    // 🔥 COMMIT 2: Use orchestrator
    if (room.gameEngine?.nightAction(playerId, action, targetId)) {
      this.broadcastToDashboards("night_action", {
        playerId,
        playerName: room.players.get(playerId)?.name,
        action,
        targetId,
        targetName: targetId ? room.players.get(targetId)?.name : undefined,
        roomCode: room.code,
        timestamp: new Date().toISOString(),
        phaseManager: "NightManager",
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

      // 🔥 COMMIT 2: Use orchestrator
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

    const rooms = this.roomManager.getAllRooms();
    for (const room of rooms) {
      if (room.players.has(playerId)) {
        // 🔥 COMMIT 2: Use orchestrator
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
      const stats = this.getEnhancedRoomStats();
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
          architecture: "Revolutionary Phase Managers",
        },
      });

      this.broadcastToDashboards("stats_update", statsData);
    }
  }

  private sendStatsToSocket(socket: Socket): void {
    const stats = this.getEnhancedRoomStats();
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
        architecture: "Revolutionary Phase Managers Active",
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
      architecture: "Revolutionary Phase Managers",
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

  /**
   * 🔥 COMMIT 2: Enhanced room stats with phase manager data
   */
  getEnhancedRoomStats(): any {
    const baseStats = this.roomManager.getRoomStats();
    const rooms = this.roomManager.getAllRooms();

    const phaseManagerStats = {
      activeDiscussions: 0,
      activeVotingSessions: 0,
      activeNightPhases: 0,
      totalPhaseTransitions: 0,
      revolutionaryArchitecture: true,
    };

    for (const room of rooms) {
      if (room.gameEngine) {
        try {
          const debugInfo = room.gameEngine.getDebugInfo();
          if (debugInfo.phaseManagers) {
            if (debugInfo.phaseManagers.discussion?.active)
              phaseManagerStats.activeDiscussions++;
            if (debugInfo.phaseManagers.voting?.active)
              phaseManagerStats.activeVotingSessions++;
            if (debugInfo.phaseManagers.night?.active)
              phaseManagerStats.activeNightPhases++;
          }
        } catch (error) {
          console.warn(
            `Failed to get phase manager stats for room ${room.code}:`,
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
        perfectAnonymity: true,
        bulletproofParsing: true,
        contextOperations: "trigger/update/push",
      },
    };
  }

  getRoomStats(): any {
    return this.getEnhancedRoomStats();
  }

  /**
   * 🔥 COMMIT 2: Enhanced AI-only game creation
   */
  createAIOnlyGame(gameConfig?: any): any {
    const enhancedConfig = {
      maxPlayers: 10,
      aiCount: 10,
      humanCount: 0,
      premiumModelsEnabled: true,
      allowSpectators: true,
      nightPhaseDuration: 60000,
      discussionPhaseDuration: 180000,
      votingPhaseDuration: 90000,
      speakingTimePerPlayer: 35000,
      ...gameConfig,
    };

    const { room, roomCode } =
      this.roomManager.createAIOnlyRoom(enhancedConfig);

    this.totalGamesCreated++;
    this.fillWithAIPlayers(room);

    setTimeout(() => {
      // 🔥 COMMIT 2: Use orchestrator
      room.gameEngine = new MafiaGameEngine(room.id, enhancedConfig);
      this.setupEnhancedGameEngineHandlers(room);

      Array.from(room.players.values()).forEach((player) => {
        room.gameEngine!.addPlayer(player);
      });

      room.gameEngine.startGame();

      this.broadcastToDashboards("ai_only_game_created", {
        roomCode,
        roomId: room.id,
        aiCount: enhancedConfig.aiCount,
        personalities: Array.from(room.players.values()).map((p) => ({
          name: p.name,
          model: p.model,
        })),
        timestamp: new Date().toISOString(),
        architecture: "Revolutionary Phase Managers",
      });

      console.log(
        `🤖 AI-only game started with Revolutionary Architecture: ${roomCode}`
      );
    }, 2000);

    return {
      ...this.getRoomInfo(room),
      code: roomCode,
      architecture: "Revolutionary Phase Managers Active",
    };
  }

  public cleanupOldSessions(): void {
    console.log("🧹 Starting cleanup with Revolutionary Architecture...");

    try {
      aiResponseGenerator.cleanupCache();
    } catch (error) {
      console.warn("Failed to cleanup AI cache:", error);
    }

    const playerCleanup = this.playerManager.cleanupInactiveConnections();
    const roomsCleaned = this.roomManager.cleanupOldRooms();

    let dashboardsCleaned = 0;
    for (const socket of this.dashboardSockets) {
      if (!socket.connected) {
        this.dashboardSockets.delete(socket);
        dashboardsCleaned++;
      }
    }

    console.log(`🧹 Revolutionary Architecture cleanup completed:`, {
      roomsCleaned,
      dashboardsCleaned,
      playersCleaned: playerCleanup.removed,
      activeRooms: this.roomManager.getAllRooms().length,
      activePlayers: this.playerManager.getActiveConnections().length,
      activeDashboards: this.dashboardSockets.size,
      phaseManagers: "All cleaned",
      contextSystems: "Reset",
    });

    this.broadcastToDashboards("cleanup_completed", {
      roomsCleaned,
      dashboardsCleaned,
      playersCleaned: playerCleanup.removed,
      timestamp: new Date().toISOString(),
      architecture: "Revolutionary Phase Managers",
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
      architecture: "Revolutionary Phase Managers",
    };

    this.playerManager.broadcastToRoom(roomId, "room_terminated", {
      message: reason,
      roomId,
      timestamp: new Date().toISOString(),
    });

    const connections = this.playerManager.getPlayersByRoom(roomId);
    connections.forEach((connection) => {
      this.playerManager.removeConnection(connection.playerId);
    });

    const observers = this.playerManager.getObserversByRoom(roomId);
    observers.forEach((observer) => {
      this.playerManager.removeConnection(observer.playerId);
    });

    this.roomManager.deleteRoom(roomId);

    this.broadcastToDashboards("room_terminated", {
      roomCode: room.code,
      roomId: room.id,
      reason,
      preTerminationInfo,
      timestamp: new Date().toISOString(),
      architecture: "Revolutionary Phase Managers",
    });

    console.log(
      `🔥 Room ${room.code} terminated with Revolutionary Architecture: ${reason}`
    );

    return {
      success: true,
      preTerminationInfo,
      playersNotified: preTerminationInfo.playerCount,
    };
  }
}
