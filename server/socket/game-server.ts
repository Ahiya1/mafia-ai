// WebSocket Game Server for AI Mafia - Real-time Multiplayer Coordination
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
import { v4 as uuidv4 } from "uuid";

export class GameSocketServer {
  private io: SocketIOServer;
  private rooms: Map<RoomId, GameRoom> = new Map();
  private players: Map<PlayerId, PlayerConnection> = new Map();
  private aiManager: AIModelManager;

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
  }

  private setupSocketHandlers(): void {
    this.io.on("connection", (socket: Socket) => {
      console.log(`Player connected: ${socket.id}`);

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

      socket.on("disconnect", () => {
        this.handleDisconnect(socket);
      });

      socket.on("heartbeat", () => {
        socket.emit("heartbeat_ack");
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

    // Add player to room and tracking
    room.players.set(playerId, player);
    this.players.set(playerId, connection);
    socket.join(room.id);

    // Add player to game engine if game exists
    if (room.gameEngine) {
      room.gameEngine.addPlayer(player);
    }

    // Fill remaining slots with AI players if needed
    this.fillWithAIPlayers(room);

    socket.emit("room_joined", {
      roomId: room.id,
      playerId,
      roomInfo: this.getRoomInfo(room),
      players: Array.from(room.players.values()),
    });

    this.broadcastToRoom(room.id, "player_joined", { player });

    console.log(`Player ${data.playerName} joined room ${data.roomCode}`);
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
      aiCount: 9, // Will be adjusted based on human players
      humanCount: 1,
      nightPhaseDuration: 90,
      discussionPhaseDuration: 300, // 5 minutes
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

    // Fill with AI players
    this.fillWithAIPlayers(room);

    socket.emit("room_created", {
      roomId,
      roomCode,
      playerId,
      roomInfo: this.getRoomInfo(room),
    });

    console.log(`Room created: ${roomCode} by ${data.playerName}`);
  }

  private fillWithAIPlayers(room: GameRoom): void {
    const currentPlayerCount = room.players.size;
    const humanPlayers = Array.from(room.players.values()).filter(
      (p) => p.type === PlayerType.HUMAN
    );
    const aiPlayersNeeded = room.config.maxPlayers - currentPlayerCount;

    if (aiPlayersNeeded <= 0) return;

    const availableModels = room.config.premiumModelsEnabled
      ? Object.values(AIModel)
      : [AIModel.CLAUDE_HAIKU, AIModel.GPT_4O_MINI, AIModel.GEMINI_2_5_FLASH];

    // Get personality pool to ensure variety
    const personalityPool = this.getPersonalityPool();
    const usedNames = Array.from(room.players.values()).map((p) => p.name);
    const availablePersonalities = personalityPool.filter(
      (p) => !usedNames.includes(p.name)
    );

    for (
      let i = 0;
      i < aiPlayersNeeded && i < availablePersonalities.length;
      i++
    ) {
      const personality = availablePersonalities[i];

      const aiPlayer: Player = {
        id: uuidv4(),
        name: personality.name,
        type: PlayerType.AI,
        model: personality.model,
        isAlive: true,
        isReady: true, // AI players are always ready
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

    // Update room config
    room.config.humanCount = humanPlayers.length;
    room.config.aiCount = room.players.size - humanPlayers.length;

    this.broadcastToRoom(room.id, "room_updated", {
      players: Array.from(room.players.values()),
      config: room.config,
    });
  }

  private handleGameAction(socket: Socket, action: GameAction): void {
    const connection = Array.from(this.players.values()).find(
      (p) => p.socket.id === socket.id
    );
    if (!connection) return;

    const room = this.rooms.get(connection.roomId);
    if (!room || !room.gameEngine) return;

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
      return; // Only host can start game
    }

    if (!room.gameEngine) {
      room.gameEngine = new MafiaGameEngine(room.id, room.config);
      this.setupGameEngineHandlers(room);

      // Add all players to game engine
      Array.from(room.players.values()).forEach((player) => {
        room.gameEngine!.addPlayer(player);
      });
    }

    const success = room.gameEngine.startGame();
    if (success) {
      this.broadcastToRoom(room.id, "game_started", {
        gameState: room.gameEngine.getGameState(),
      });

      // Start AI player automation
      this.startAIAutomation(room);
    }
  }

  private setupGameEngineHandlers(room: GameRoom): void {
    const engine = room.gameEngine!;

    engine.on("game_event", (event: any) => {
      this.broadcastToRoom(room.id, "game_event", event);
    });

    engine.on("phase_changed", (data: { newPhase: string }) => {
      this.broadcastToRoom(room.id, "phase_changed", data);

      // Trigger AI actions for new phase
      this.handleAIPhaseTransition(room, data.newPhase);
    });

    engine.on("player_eliminated", (data: any) => {
      this.broadcastToRoom(room.id, "player_eliminated", data);
    });

    engine.on("game_ended", (data: any) => {
      this.broadcastToRoom(room.id, "game_ended", data);
      this.cleanupGame(room);
    });

    engine.on("speaker_turn_started", (data: { speakerId: any }) => {
      this.broadcastToRoom(room.id, "speaker_turn_started", data);

      // If it's an AI player's turn, generate their response
      const player = room.players.get(data.speakerId);
      if (player?.type === PlayerType.AI) {
        this.handleAIDiscussion(room, player);
      }
    });

    engine.on("next_voter", (data: { voterId: any }) => {
      this.broadcastToRoom(room.id, "next_voter", data);

      // If it's an AI player's turn to vote
      const player = room.players.get(data.voterId);
      if (player?.type === PlayerType.AI) {
        this.handleAIVoting(room, player);
      }
    });
  }

  private async startAIAutomation(room: GameRoom): Promise<void> {
    // AI players will automatically respond to game events
    console.log(`AI automation started for room ${room.code}`);
  }

  private async handleAIPhaseTransition(
    room: GameRoom,
    newPhase: string
  ): Promise<void> {
    if (newPhase === "night") {
      // Handle AI night actions
      const aiPlayers = Array.from(room.players.values()).filter(
        (p) => p.type === PlayerType.AI && p.isAlive
      );

      for (const aiPlayer of aiPlayers) {
        if (aiPlayer.role === PlayerRole.MAFIA_LEADER) {
          setTimeout(() => this.handleAIMafiaAction(room, aiPlayer), 2000);
        } else if (aiPlayer.role === PlayerRole.HEALER) {
          setTimeout(() => this.handleAIHealerAction(room, aiPlayer), 1500);
        }
      }
    }
  }

  private async handleAIDiscussion(
    room: GameRoom,
    aiPlayer: Player
  ): Promise<void> {
    try {
      const context = this.buildAIContext(room, aiPlayer);
      const request = {
        type: "discussion" as const,
        context,
        personality: AI_PERSONALITIES[aiPlayer.model!],
        constraints: { maxLength: 200, timeLimit: 30000 },
      };

      const response = await this.aiManager.generateResponse(request);

      // Add realistic delay
      const delay = 2000 + Math.random() * 3000; // 2-5 seconds
      setTimeout(() => {
        room.gameEngine?.sendMessage(aiPlayer.id, response.content);
      }, delay);
    } catch (error) {
      console.error(`AI discussion error for ${aiPlayer.name}:`, error);
      // Fallback message
      setTimeout(() => {
        room.gameEngine?.sendMessage(
          aiPlayer.id,
          "I'm still thinking about this..."
        );
      }, 3000);
    }
  }

  private async handleAIVoting(
    room: GameRoom,
    aiPlayer: Player
  ): Promise<void> {
    try {
      const context = this.buildAIContext(room, aiPlayer);
      const alivePlayers = Array.from(room.players.values()).filter(
        (p) => p.isAlive && p.id !== aiPlayer.id
      );

      const request = {
        type: "vote" as const,
        context,
        personality: AI_PERSONALITIES[aiPlayer.model!],
        constraints: {
          availableTargets: alivePlayers.map((p) => p.id),
          mustVote: true,
        },
      };

      const response = await this.aiManager.generateResponse(request);

      // Extract vote target from response
      const targetId = this.extractVoteTarget(response.content, alivePlayers);
      const reasoning = response.content;

      // Add realistic delay
      const delay = 3000 + Math.random() * 4000; // 3-7 seconds
      setTimeout(() => {
        if (targetId) {
          room.gameEngine?.castVote(aiPlayer.id, targetId, reasoning);
        }
      }, delay);
    } catch (error) {
      console.error(`AI voting error for ${aiPlayer.name}:`, error);
      // Random fallback vote
      const alivePlayers = Array.from(room.players.values()).filter(
        (p) => p.isAlive && p.id !== aiPlayer.id
      );
      if (alivePlayers.length > 0) {
        const randomTarget =
          alivePlayers[Math.floor(Math.random() * alivePlayers.length)];
        setTimeout(() => {
          room.gameEngine?.castVote(
            aiPlayer.id,
            randomTarget.id,
            "My gut feeling says this is the right choice."
          );
        }, 5000);
      }
    }
  }

  private async handleAIMafiaAction(
    room: GameRoom,
    mafiaPlayer: Player
  ): Promise<void> {
    try {
      const context = this.buildAIContext(room, mafiaPlayer);
      const alivePlayers = Array.from(room.players.values()).filter(
        (p) =>
          p.isAlive &&
          p.role !== PlayerRole.MAFIA_LEADER &&
          p.role !== PlayerRole.MAFIA_MEMBER
      );

      const request = {
        type: "night_action" as const,
        context,
        personality: AI_PERSONALITIES[mafiaPlayer.model!],
        constraints: {
          availableTargets: alivePlayers.map((p) => p.id),
        },
      };

      const response = await this.aiManager.generateResponse(request);
      const targetId = this.extractActionTarget(response.content, alivePlayers);

      if (targetId) {
        // Add realistic delay for decision making
        setTimeout(() => {
          room.gameEngine?.nightAction(mafiaPlayer.id, "kill", targetId);
        }, 10000 + Math.random() * 20000); // 10-30 seconds
      }
    } catch (error) {
      console.error(`AI mafia action error for ${mafiaPlayer.name}:`, error);
    }
  }

  private async handleAIHealerAction(
    room: GameRoom,
    healerPlayer: Player
  ): Promise<void> {
    try {
      const context = this.buildAIContext(room, healerPlayer);
      const alivePlayers = Array.from(room.players.values()).filter(
        (p) => p.isAlive
      );

      const request = {
        type: "night_action" as const,
        context,
        personality: AI_PERSONALITIES[healerPlayer.model!],
        constraints: {
          availableTargets: alivePlayers.map((p) => p.id),
        },
      };

      const response = await this.aiManager.generateResponse(request);
      const targetId = this.extractActionTarget(response.content, alivePlayers);

      if (targetId) {
        setTimeout(() => {
          room.gameEngine?.nightAction(healerPlayer.id, "heal", targetId);
        }, 5000 + Math.random() * 15000); // 5-20 seconds
      }
    } catch (error) {
      console.error(`AI healer action error for ${healerPlayer.name}:`, error);
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
      previousVotes: [], // Would be populated with voting history
      timeRemaining: room.gameEngine?.getRemainingTime() || 0,
      suspicionLevels: {},
      trustLevels: {},
    };
  }

  private extractVoteTarget(
    response: string,
    availablePlayers: Player[]
  ): PlayerId | null {
    // Simple extraction - look for player names in the response
    for (const player of availablePlayers) {
      if (response.toLowerCase().includes(player.name.toLowerCase())) {
        return player.id;
      }
    }

    // Fallback to random if no clear target found
    if (availablePlayers.length > 0) {
      return availablePlayers[
        Math.floor(Math.random() * availablePlayers.length)
      ].id;
    }

    return null;
  }

  private extractActionTarget(
    response: string,
    availablePlayers: Player[]
  ): PlayerId | null {
    // Similar to vote extraction
    for (const player of availablePlayers) {
      if (response.toLowerCase().includes(player.name.toLowerCase())) {
        return player.id;
      }
    }

    return availablePlayers.length > 0
      ? availablePlayers[Math.floor(Math.random() * availablePlayers.length)].id
      : null;
  }

  private handleMessage(
    room: GameRoom,
    playerId: PlayerId,
    content: string
  ): void {
    room.gameEngine?.sendMessage(playerId, content);
  }

  private handleVote(
    room: GameRoom,
    playerId: PlayerId,
    targetId: PlayerId,
    reasoning: string
  ): void {
    room.gameEngine?.castVote(playerId, targetId, reasoning);
  }

  private handleNightAction(
    room: GameRoom,
    playerId: PlayerId,
    action: "kill" | "heal",
    targetId?: PlayerId
  ): void {
    room.gameEngine?.nightAction(playerId, action, targetId);
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
    }
  }

  private handleDisconnect(socket: Socket): void {
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

      // Clean up empty rooms
      if (room.players.size === 0) {
        this.rooms.delete(room.id);
      }
    }

    this.players.delete(connection.playerId);
    console.log(`Player disconnected: ${socket.id}`);
  }

  private cleanupGame(room: GameRoom): void {
    // Reset room for new game
    room.gameEngine = null;

    // Reset player states
    room.players.forEach((player) => {
      player.isReady = false;
      player.isAlive = true;
      player.role = undefined;
      player.votedFor = undefined;
    });
  }

  private broadcastToRoom(roomId: RoomId, event: string, data: any): void {
    this.io.to(roomId).emit(event, data);
  }

  private findRoomByCode(code: string): GameRoom | undefined {
    return Array.from(this.rooms.values()).find((room) => room.code === code);
  }

  private generateRoomCode(): string {
    // Generate 6-digit room code
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

  // Personality Pool Management
  private getPersonalityPool(): Array<{ name: string; model: AIModel }> {
    // Extended personality pool with 25+ human names
    const personalityPool = [
      // Premium Models
      { name: "Detective Chen", model: AIModel.CLAUDE_SONNET_4 },
      { name: "Riley the Storyteller", model: AIModel.GPT_4O },
      { name: "Alex Sharp", model: AIModel.GEMINI_2_5_PRO },

      // Free Models
      { name: "Sam Logic", model: AIModel.CLAUDE_HAIKU },
      { name: "Jordan Quick", model: AIModel.GPT_4O_MINI },
      { name: "Casey Direct", model: AIModel.GEMINI_2_5_FLASH },

      // Additional personalities for variety
      { name: "Morgan Wells", model: AIModel.CLAUDE_SONNET_4 },
      { name: "Taylor Cross", model: AIModel.GPT_4O },
      { name: "Jamie Fox", model: AIModel.GEMINI_2_5_PRO },
      { name: "Blake Rivers", model: AIModel.CLAUDE_HAIKU },
      { name: "Avery Stone", model: AIModel.GPT_4O_MINI },
      { name: "Drew Harper", model: AIModel.GEMINI_2_5_FLASH },
      { name: "Sage Miller", model: AIModel.CLAUDE_SONNET_4 },
      { name: "Quinn Adams", model: AIModel.GPT_4O },
      { name: "Rowan Clarke", model: AIModel.GEMINI_2_5_PRO },
      { name: "Phoenix Gray", model: AIModel.CLAUDE_HAIKU },
      { name: "River Chen", model: AIModel.GPT_4O_MINI },
      { name: "Lane Foster", model: AIModel.GEMINI_2_5_FLASH },
      { name: "Dakota Mills", model: AIModel.CLAUDE_SONNET_4 },
      { name: "Emery Brooks", model: AIModel.GPT_4O },
      { name: "Sky Martinez", model: AIModel.GEMINI_2_5_PRO },
      { name: "Sage Thompson", model: AIModel.CLAUDE_HAIKU },
      { name: "Nova Reed", model: AIModel.GPT_4O_MINI },
      { name: "Cedar Walsh", model: AIModel.GEMINI_2_5_FLASH },
      { name: "Storm Knight", model: AIModel.CLAUDE_SONNET_4 },
    ];

    // Shuffle for variety
    return personalityPool.sort(() => Math.random() - 0.5);
  }

  // Public API Methods
  getRoomStats(): any {
    return {
      totalRooms: this.rooms.size,
      activeRooms: Array.from(this.rooms.values()).filter((r) => r.gameEngine)
        .length,
      totalPlayers: this.players.size,
      roomList: Array.from(this.rooms.values()).map((room) =>
        this.getRoomInfo(room)
      ),
    };
  }

  getAIUsageStats(): any {
    return this.aiManager.getUsageStats();
  }

  getPersonalityPoolInfo(): any {
    const personalityPool = this.getPersonalityPool();
    return {
      totalPersonalities: personalityPool.length,
      personalities: personalityPool.map((p) => ({
        name: p.name,
        model: p.model,
        archetype: AI_PERSONALITIES[p.model].archetype,
        description: AI_PERSONALITIES[p.model].description,
      })),
      modelDistribution: Object.values(AIModel).map((model) => ({
        model,
        count: personalityPool.filter((p) => p.model === model).length,
      })),
    };
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
      premiumModelsEnabled: true, // Creator gets premium
      ...gameConfig,
    };

    const room: GameRoom = {
      id: roomId,
      code: roomCode,
      hostId: "creator", // Special creator host
      players: new Map(),
      config,
      createdAt: new Date(),
      gameEngine: null,
    };

    this.rooms.set(roomId, room);

    // Fill with AI players only
    this.fillWithAIPlayers(room);

    // Auto-start the game
    setTimeout(() => {
      room.gameEngine = new MafiaGameEngine(room.id, room.config);
      this.setupGameEngineHandlers(room);

      Array.from(room.players.values()).forEach((player) => {
        room.gameEngine!.addPlayer(player);
      });

      room.gameEngine.startGame();
      this.startAIAutomation(room);
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
