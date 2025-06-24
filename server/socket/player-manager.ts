// server/socket/player-manager.ts - Enhanced Player Management
import { Socket } from "socket.io";
import { Player, PlayerId, RoomId } from "../lib/types/game";

export interface PlayerConnection {
  playerId: PlayerId;
  socket: Socket;
  roomId: RoomId | null;
  isActive: boolean;
  isObserver: boolean;
  joinedAt: Date;
  lastActivity: Date;
}

export class PlayerManager {
  private connections: Map<PlayerId, PlayerConnection> = new Map();
  private socketToPlayer: Map<string, PlayerId> = new Map();
  private observerSockets: Map<RoomId, Set<Socket>> = new Map();

  createConnection(
    playerId: PlayerId,
    socket: Socket,
    roomId: RoomId | null = null,
    isObserver: boolean = false
  ): PlayerConnection {
    const connection: PlayerConnection = {
      playerId,
      socket,
      roomId,
      isActive: true,
      isObserver,
      joinedAt: new Date(),
      lastActivity: new Date(),
    };

    // Store connections
    this.connections.set(playerId, connection);
    this.socketToPlayer.set(socket.id, playerId);

    // Handle observer connections separately
    if (isObserver && roomId) {
      this.addObserver(roomId, socket);
    }

    console.log(
      `🔌 Player connection created: ${playerId} (Observer: ${isObserver})`
    );
    return connection;
  }

  getConnection(playerId: PlayerId): PlayerConnection | undefined {
    return this.connections.get(playerId);
  }

  getConnectionBySocket(socketId: string): PlayerConnection | undefined {
    const playerId = this.socketToPlayer.get(socketId);
    return playerId ? this.connections.get(playerId) : undefined;
  }

  updateActivity(playerId: PlayerId): void {
    const connection = this.connections.get(playerId);
    if (connection) {
      connection.lastActivity = new Date();
    }
  }

  setPlayerRoom(playerId: PlayerId, roomId: RoomId | null): boolean {
    const connection = this.connections.get(playerId);
    if (!connection) return false;

    connection.roomId = roomId;
    return true;
  }

  addObserver(roomId: RoomId, socket: Socket): void {
    if (!this.observerSockets.has(roomId)) {
      this.observerSockets.set(roomId, new Set());
    }
    this.observerSockets.get(roomId)!.add(socket);

    console.log(`👁️ Observer added to room ${roomId}`);
  }

  removeObserver(roomId: RoomId, socket: Socket): boolean {
    const observers = this.observerSockets.get(roomId);
    if (!observers) return false;

    const removed = observers.delete(socket);

    // Clean up empty observer sets
    if (observers.size === 0) {
      this.observerSockets.delete(roomId);
    }

    return removed;
  }

  getObservers(roomId: RoomId): Set<Socket> {
    return this.observerSockets.get(roomId) || new Set();
  }

  broadcastToObservers(roomId: RoomId, event: string, data: any): void {
    const observers = this.observerSockets.get(roomId);
    if (!observers || observers.size === 0) return;

    observers.forEach((socket) => {
      if (socket.connected) {
        try {
          socket.emit(event, data);
        } catch (error) {
          console.warn(`Failed to emit to observer:`, error);
          observers.delete(socket);
        }
      } else {
        observers.delete(socket);
      }
    });
  }

  removeConnection(playerId: PlayerId): boolean {
    const connection = this.connections.get(playerId);
    if (!connection) return false;

    // Remove from socket mapping
    this.socketToPlayer.delete(connection.socket.id);

    // Remove from observer lists if applicable
    if (connection.isObserver && connection.roomId) {
      this.removeObserver(connection.roomId, connection.socket);
    }

    // Remove the connection
    this.connections.delete(playerId);

    console.log(`🔌 Player connection removed: ${playerId}`);
    return true;
  }

  removeConnectionBySocket(socketId: string): PlayerId | null {
    const playerId = this.socketToPlayer.get(socketId);
    if (!playerId) return null;

    this.removeConnection(playerId);
    return playerId;
  }

  getPlayersByRoom(roomId: RoomId): PlayerConnection[] {
    return Array.from(this.connections.values()).filter(
      (conn) => conn.roomId === roomId && !conn.isObserver
    );
  }

  getObserversByRoom(roomId: RoomId): PlayerConnection[] {
    return Array.from(this.connections.values()).filter(
      (conn) => conn.roomId === roomId && conn.isObserver
    );
  }

  getAllConnections(): PlayerConnection[] {
    return Array.from(this.connections.values());
  }

  getActiveConnections(): PlayerConnection[] {
    return Array.from(this.connections.values()).filter(
      (conn) => conn.isActive
    );
  }

  // Enhanced connection validation
  validateConnection(playerId: PlayerId): {
    isValid: boolean;
    issues: string[];
  } {
    const connection = this.connections.get(playerId);
    const issues: string[] = [];

    if (!connection) {
      return { isValid: false, issues: ["Connection not found"] };
    }

    if (!connection.socket.connected) {
      issues.push("Socket disconnected");
    }

    if (!connection.isActive) {
      issues.push("Connection marked inactive");
    }

    const now = Date.now();
    const lastActivity = connection.lastActivity.getTime();
    const timeSinceActivity = now - lastActivity;

    // Flag connections inactive for more than 30 minutes
    if (timeSinceActivity > 30 * 60 * 1000) {
      issues.push("Connection inactive for too long");
    }

    return {
      isValid: issues.length === 0,
      issues,
    };
  }

  // Cleanup inactive connections
  cleanupInactiveConnections(): {
    removed: number;
    details: Array<{ playerId: string; reason: string }>;
  } {
    const removed: Array<{ playerId: string; reason: string }> = [];
    const now = Date.now();
    const INACTIVE_THRESHOLD = 30 * 60 * 1000; // 30 minutes

    for (const [playerId, connection] of this.connections.entries()) {
      const validation = this.validateConnection(playerId);

      if (!validation.isValid) {
        const timeSinceActivity = now - connection.lastActivity.getTime();

        // Remove if socket disconnected and inactive for too long
        if (
          !connection.socket.connected &&
          timeSinceActivity > INACTIVE_THRESHOLD
        ) {
          this.removeConnection(playerId);
          removed.push({
            playerId,
            reason: `Disconnected and inactive for ${Math.round(
              timeSinceActivity / 60000
            )} minutes`,
          });
        }
      }
    }

    return {
      removed: removed.length,
      details: removed,
    };
  }

  // Get connection statistics
  getConnectionStats() {
    const connections = Array.from(this.connections.values());
    const now = Date.now();

    return {
      total: connections.length,
      active: connections.filter((c) => c.isActive && c.socket.connected)
        .length,
      observers: connections.filter((c) => c.isObserver).length,
      players: connections.filter((c) => !c.isObserver).length,
      disconnected: connections.filter((c) => !c.socket.connected).length,
      averageSessionDuration:
        connections.reduce((sum, c) => {
          return sum + (now - c.joinedAt.getTime());
        }, 0) /
        connections.length /
        1000 /
        60, // in minutes
      roomDistribution: this.getRoomDistribution(),
    };
  }

  private getRoomDistribution(): Record<string, number> {
    const distribution: Record<string, number> = {};

    for (const connection of this.connections.values()) {
      if (connection.roomId) {
        distribution[connection.roomId] =
          (distribution[connection.roomId] || 0) + 1;
      }
    }

    return distribution;
  }

  // Force disconnect a player (admin function)
  forceDisconnect(
    playerId: PlayerId,
    reason: string = "Admin disconnect"
  ): boolean {
    const connection = this.connections.get(playerId);
    if (!connection) return false;

    try {
      connection.socket.emit("force_disconnect", {
        reason,
        timestamp: new Date().toISOString(),
      });
      connection.socket.disconnect(true);
      this.removeConnection(playerId);

      console.log(`🔨 Force disconnected player ${playerId}: ${reason}`);
      return true;
    } catch (error) {
      console.error(`Failed to force disconnect player ${playerId}:`, error);
      return false;
    }
  }

  // Broadcast to all players in a room
  broadcastToRoom(
    roomId: RoomId,
    event: string,
    data: any,
    excludeObservers: boolean = false
  ): void {
    const connections = this.getPlayersByRoom(roomId);

    connections.forEach((connection) => {
      if (connection.socket.connected) {
        try {
          connection.socket.emit(event, data);
        } catch (error) {
          console.warn(
            `Failed to broadcast to player ${connection.playerId}:`,
            error
          );
        }
      }
    });

    // Also broadcast to observers unless excluded
    if (!excludeObservers) {
      this.broadcastToObservers(roomId, event, data);
    }
  }

  // Send message to specific player
  sendToPlayer(playerId: PlayerId, event: string, data: any): boolean {
    const connection = this.connections.get(playerId);
    if (!connection || !connection.socket.connected) return false;

    try {
      connection.socket.emit(event, data);
      return true;
    } catch (error) {
      console.warn(`Failed to send to player ${playerId}:`, error);
      return false;
    }
  }
}
