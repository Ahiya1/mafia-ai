// server/socket/room-manager.ts - Fixed Room Management
import { v4 as uuidv4 } from "uuid";
import {
  GameConfig,
  Player,
  PlayerType,
  PlayerId,
  RoomId,
} from "../lib/types/game";

export interface GameRoom {
  id: RoomId;
  code: string;
  hostId: PlayerId;
  players: Map<PlayerId, Player>;
  config: GameConfig;
  createdAt: Date;
  gameEngine: any | null;
  observerSockets: Set<any>;
  isAIOnly: boolean;
}

export class RoomManager {
  private rooms: Map<RoomId, GameRoom> = new Map();
  private roomCodes: Map<string, RoomId> = new Map();

  createRoom(
    hostId: PlayerId,
    hostName: string,
    roomSettings: any = {}
  ): { room: GameRoom; roomCode: string } {
    const roomId = uuidv4();
    const roomCode = this.generateRoomCode();

    // Default configuration - CRITICAL: maxPlayers must be 10, not 1
    const gameConfig: GameConfig = {
      maxPlayers: 10, // This is key - always 10 for proper AI filling
      aiCount: roomSettings.aiCount || 9,
      humanCount: roomSettings.humanCount || 1,
      nightPhaseDuration: roomSettings.nightPhaseDuration || 90,
      discussionPhaseDuration: roomSettings.discussionPhaseDuration || 300,
      votingPhaseDuration: roomSettings.votingPhaseDuration || 120,
      revelationPhaseDuration: roomSettings.revelationPhaseDuration || 10,
      speakingTimePerPlayer: roomSettings.speakingTimePerPlayer || 35,
      allowSpectators: roomSettings.allowSpectators || true,
      premiumModelsEnabled: roomSettings.premiumModelsEnabled || false,
    };

    const hostPlayer: Player = {
      id: hostId,
      name: hostName,
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

    const room: GameRoom = {
      id: roomId,
      code: roomCode,
      hostId,
      players: new Map([[hostId, hostPlayer]]),
      config: gameConfig,
      createdAt: new Date(),
      gameEngine: null,
      observerSockets: new Set(),
      isAIOnly: false,
    };

    this.rooms.set(roomId, room);
    this.roomCodes.set(roomCode, roomId);

    console.log(
      `✅ Room created: ${roomCode} with maxPlayers: ${gameConfig.maxPlayers}`
    );
    return { room, roomCode };
  }

  createAIOnlyRoom(config: any = {}): { room: GameRoom; roomCode: string } {
    const roomId = uuidv4();
    const roomCode = this.generateRoomCode();

    const gameConfig: GameConfig = {
      maxPlayers: 10,
      aiCount: 10,
      humanCount: 0,
      nightPhaseDuration: config.nightPhaseDuration || 60,
      discussionPhaseDuration: config.discussionPhaseDuration || 180,
      votingPhaseDuration: config.votingPhaseDuration || 90,
      revelationPhaseDuration: config.revelationPhaseDuration || 8,
      speakingTimePerPlayer: config.speakingTimePerPlayer || 20,
      allowSpectators: true,
      premiumModelsEnabled: true,
    };

    const room: GameRoom = {
      id: roomId,
      code: roomCode,
      hostId: "ai_game_creator",
      players: new Map(),
      config: gameConfig,
      createdAt: new Date(),
      gameEngine: null,
      observerSockets: new Set(),
      isAIOnly: true,
    };

    this.rooms.set(roomId, room);
    this.roomCodes.set(roomCode, roomId);

    console.log(`🤖 AI-only room created: ${roomCode}`);
    return { room, roomCode };
  }

  findRoomByCode(code: string): GameRoom | undefined {
    const roomId = this.roomCodes.get(code);
    return roomId ? this.rooms.get(roomId) : undefined;
  }

  getRoomById(id: RoomId): GameRoom | undefined {
    return this.rooms.get(id);
  }

  // FIXED: Better capacity checking logic
  canJoinRoom(
    room: GameRoom,
    isObserver: boolean = false
  ): {
    canJoin: boolean;
    reason?: string;
  } {
    // Observers can always join if spectators are allowed
    if (isObserver) {
      if (!room.config.allowSpectators) {
        return { canJoin: false, reason: "Spectators not allowed" };
      }
      return { canJoin: true };
    }

    // For AI-only games, only allow observers
    if (room.isAIOnly) {
      return { canJoin: false, reason: "AI-only game - join as observer" };
    }

    // Count human players only for capacity check
    const humanPlayerCount = Array.from(room.players.values()).filter(
      (p) => p.type === PlayerType.HUMAN
    ).length;

    // Check if there's room for more human players
    if (humanPlayerCount >= room.config.humanCount) {
      return { canJoin: false, reason: "Room is full" };
    }

    return { canJoin: true };
  }

  addPlayer(roomId: RoomId, player: Player): boolean {
    const room = this.rooms.get(roomId);
    if (!room) return false;

    room.players.set(player.id, player);

    // Update human count
    const humanCount = Array.from(room.players.values()).filter(
      (p) => p.type === PlayerType.HUMAN
    ).length;

    room.config.humanCount = humanCount;
    room.config.aiCount = room.config.maxPlayers - humanCount;

    console.log(
      `✅ Player added to room ${room.code}: ${player.name} (${humanCount} humans, ${room.config.aiCount} AI needed)`
    );
    return true;
  }

  removePlayer(roomId: RoomId, playerId: PlayerId): boolean {
    const room = this.rooms.get(roomId);
    if (!room) return false;

    const removed = room.players.delete(playerId);

    if (removed) {
      // Update counts
      const humanCount = Array.from(room.players.values()).filter(
        (p) => p.type === PlayerType.HUMAN
      ).length;

      room.config.humanCount = humanCount;

      // If no human players left, room can be cleaned up
      if (humanCount === 0 && !room.isAIOnly) {
        this.deleteRoom(roomId);
      }
    }

    return removed;
  }

  addObserver(roomId: RoomId, socket: any): boolean {
    const room = this.rooms.get(roomId);
    if (!room) return false;

    room.observerSockets.add(socket);
    console.log(`👁️ Observer added to room ${room.code}`);
    return true;
  }

  removeObserver(roomId: RoomId, socket: any): boolean {
    const room = this.rooms.get(roomId);
    if (!room) return false;

    return room.observerSockets.delete(socket);
  }

  deleteRoom(roomId: RoomId): boolean {
    const room = this.rooms.get(roomId);
    if (!room) return false;

    // Clean up game engine
    if (room.gameEngine) {
      room.gameEngine.cleanup?.();
    }

    // Remove from maps
    this.roomCodes.delete(room.code);
    this.rooms.delete(roomId);

    console.log(`🗑️ Room deleted: ${room.code}`);
    return true;
  }

  getAllRooms(): GameRoom[] {
    return Array.from(this.rooms.values());
  }

  getActiveRooms(): GameRoom[] {
    return Array.from(this.rooms.values()).filter((room) => room.gameEngine);
  }

  getRoomStats() {
    const rooms = Array.from(this.rooms.values());

    return {
      totalRooms: rooms.length,
      activeRooms: rooms.filter((r) => r.gameEngine).length,
      totalPlayers: rooms.reduce((sum, r) => sum + r.players.size, 0),
      aiOnlyRooms: rooms.filter((r) => r.isAIOnly).length,
      roomList: rooms.map((room) => ({
        id: room.id,
        code: room.code,
        playerCount: room.players.size,
        maxPlayers: room.config.maxPlayers,
        humanCount: room.config.humanCount,
        aiCount: room.config.aiCount,
        gameInProgress: !!room.gameEngine,
        createdAt: room.createdAt.toISOString(),
        isAIOnly: room.isAIOnly,
        premiumModelsEnabled: room.config.premiumModelsEnabled,
      })),
    };
  }

  private generateRoomCode(): string {
    let code: string;
    do {
      code = Math.floor(100000 + Math.random() * 900000).toString();
    } while (this.roomCodes.has(code));
    return code;
  }

  cleanupOldRooms(): number {
    const now = Date.now();
    const ONE_HOUR = 60 * 60 * 1000;
    let cleaned = 0;

    for (const [roomId, room] of this.rooms.entries()) {
      const roomAge = now - room.createdAt.getTime();

      // Clean up empty rooms older than 1 hour
      if (room.players.size === 0 && roomAge > ONE_HOUR) {
        this.deleteRoom(roomId);
        cleaned++;
      }
    }

    return cleaned;
  }
}
