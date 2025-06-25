// server/lib/game/context/name-registry.ts - Perfect Name/ID Mapping System
import { PlayerId, PlayerType } from "../../types/game";
import { NameRegistryInterface } from "../../types/ai";

export interface NameRegistryStats {
  totalMappings: number;
  humanMappings: number;
  aiMappings: number;
  gamesActive: number;
}

interface GameMapping {
  gameId: string;
  nameToId: Map<string, PlayerId>;
  idToName: Map<PlayerId, string>;
  playerTypes: Map<PlayerId, PlayerType>;
  createdAt: Date;
}

export class NameRegistry implements NameRegistryInterface {
  private gameMappings: Map<string, GameMapping> = new Map();
  private usedNames: Set<string> = new Set();

  constructor() {
    console.log("🏷️ NameRegistry initialized for perfect anonymity");
  }

  /**
   * Register a player with their game name and real ID
   */
  registerPlayer(name: string, id: PlayerId, gameId: string): void {
    const mapping = this.ensureGameMapping(gameId);

    // Validate inputs
    if (!name || !id || !gameId) {
      throw new Error("Invalid registration parameters");
    }

    // Check for conflicts
    if (mapping.nameToId.has(name)) {
      throw new Error(`Name ${name} already registered in game ${gameId}`);
    }

    if (mapping.idToName.has(id)) {
      throw new Error(`ID ${id} already registered in game ${gameId}`);
    }

    // Register the mapping
    mapping.nameToId.set(name, id);
    mapping.idToName.set(id, name);
    this.usedNames.add(name);

    console.log(
      `✅ Registered player: "${name}" → ${id.slice(-6)} in game ${gameId}`
    );
  }

  /**
   * Get player ID from game name - CRITICAL for AI targeting
   */
  getId(name: string, gameId: string): PlayerId | null {
    const mapping = this.gameMappings.get(gameId);
    if (!mapping) {
      console.warn(`⚠️ Game ${gameId} not found in name registry`);
      return null;
    }

    const id = mapping.nameToId.get(name);
    if (!id) {
      console.warn(`⚠️ Name "${name}" not found in game ${gameId}`);
      return null;
    }

    return id;
  }

  /**
   * Get game name from player ID - CRITICAL for context building
   */
  getName(id: PlayerId, gameId: string): string | null {
    const mapping = this.gameMappings.get(gameId);
    if (!mapping) {
      console.warn(`⚠️ Game ${gameId} not found in name registry`);
      return null;
    }

    const name = mapping.idToName.get(id);
    if (!name) {
      console.warn(`⚠️ ID ${id} not found in game ${gameId}`);
      return null;
    }

    return name;
  }

  /**
   * Check if a name is registered in a game
   */
  isNameRegistered(name: string, gameId: string): boolean {
    const mapping = this.gameMappings.get(gameId);
    return mapping ? mapping.nameToId.has(name) : false;
  }

  /**
   * Check if an ID is registered in a game
   */
  isIdRegistered(id: PlayerId, gameId: string): boolean {
    const mapping = this.gameMappings.get(gameId);
    return mapping ? mapping.idToName.has(id) : false;
  }

  /**
   * Create a new game mapping
   */
  createGameMapping(gameId: string): void {
    if (this.gameMappings.has(gameId)) {
      console.log(
        `🔄 Game mapping for ${gameId} already exists, using existing`
      );
      return;
    }

    const mapping: GameMapping = {
      gameId,
      nameToId: new Map(),
      idToName: new Map(),
      playerTypes: new Map(),
      createdAt: new Date(),
    };

    this.gameMappings.set(gameId, mapping);
    console.log(`🎮 Created game mapping for ${gameId}`);
  }

  /**
   * Clear a game mapping (cleanup after game ends)
   */
  clearGameMapping(gameId: string): void {
    const mapping = this.gameMappings.get(gameId);
    if (!mapping) {
      console.warn(`⚠️ No mapping found for game ${gameId} to clear`);
      return;
    }

    // Free up the used names
    for (const name of mapping.nameToId.keys()) {
      this.usedNames.delete(name);
    }

    this.gameMappings.delete(gameId);
    console.log(`🧹 Cleared game mapping for ${gameId}`);
  }

  /**
   * Get all players in a game with their name mappings
   */
  getGamePlayers(gameId: string): Array<{ name: string; id: PlayerId }> {
    const mapping = this.gameMappings.get(gameId);
    if (!mapping) {
      return [];
    }

    return Array.from(mapping.nameToId.entries()).map(([name, id]) => ({
      name,
      id,
    }));
  }

  /**
   * Validate name/ID consistency for a game
   */
  validateGameMapping(gameId: string): { isValid: boolean; errors: string[] } {
    const mapping = this.gameMappings.get(gameId);
    const errors: string[] = [];

    if (!mapping) {
      return { isValid: false, errors: [`Game ${gameId} not found`] };
    }

    // Check bi-directional consistency
    for (const [name, id] of mapping.nameToId.entries()) {
      const reverseName = mapping.idToName.get(id);
      if (reverseName !== name) {
        errors.push(`Inconsistent mapping: ${name} → ${id} → ${reverseName}`);
      }
    }

    for (const [id, name] of mapping.idToName.entries()) {
      const reverseId = mapping.nameToId.get(name);
      if (reverseId !== id) {
        errors.push(`Inconsistent mapping: ${id} → ${name} → ${reverseId}`);
      }
    }

    return { isValid: errors.length === 0, errors };
  }

  /**
   * Get registry statistics
   */
  getRegistryStats(): NameRegistryStats {
    let totalMappings = 0;
    let humanMappings = 0;
    let aiMappings = 0;

    for (const mapping of this.gameMappings.values()) {
      totalMappings += mapping.nameToId.size;

      for (const id of mapping.idToName.keys()) {
        const playerType = mapping.playerTypes.get(id);
        if (playerType === PlayerType.HUMAN) {
          humanMappings++;
        } else if (playerType === PlayerType.AI) {
          aiMappings++;
        }
      }
    }

    return {
      totalMappings,
      humanMappings,
      aiMappings,
      gamesActive: this.gameMappings.size,
    };
  }

  /**
   * Generate a random human-like name that hasn't been used
   */
  generateRandomName(): string {
    const commonNames = [
      "Alex",
      "Blake",
      "Casey",
      "Drew",
      "Emery",
      "Finley",
      "Harper",
      "Indigo",
      "Jordan",
      "Kai",
      "Lane",
      "Morgan",
      "Nova",
      "Orion",
      "Parker",
      "Quinn",
      "Reese",
      "River",
      "Rowan",
      "Sage",
      "Skylar",
      "Taylor",
      "Val",
      "Winter",
      "Azure",
      "Brook",
      "Cedar",
      "Echo",
      "Frost",
      "Gray",
      "Haven",
      "Iris",
      "Jade",
      "Knox",
      "Lux",
      "Max",
      "Noel",
      "Ocean",
      "Path",
      "Ray",
      "Rain",
      "Storm",
      "True",
      "Vale",
      "Wave",
      "Zion",
      "Ash",
      "Bay",
      "Cam",
      "Dove",
      "Eden",
      "Fox",
      "Glen",
      "Hope",
      "June",
      "Kit",
      "Lee",
      "Moon",
      "Pine",
      "Star",
    ];

    const availableNames = commonNames.filter(
      (name) => !this.usedNames.has(name)
    );

    if (availableNames.length === 0) {
      // Fallback to generated names if all common names are used
      let generatedName: string;
      do {
        generatedName = `Player${Math.floor(Math.random() * 10000)}`;
      } while (this.usedNames.has(generatedName));
      return generatedName;
    }

    return availableNames[Math.floor(Math.random() * availableNames.length)];
  }

  /**
   * Register player type for analytics
   */
  setPlayerType(id: PlayerId, gameId: string, type: PlayerType): void {
    const mapping = this.gameMappings.get(gameId);
    if (mapping) {
      mapping.playerTypes.set(id, type);
    }
  }

  /**
   * Debug: Get detailed mapping info
   */
  getDebugInfo(): any {
    const debug: any = {
      totalGames: this.gameMappings.size,
      totalUsedNames: this.usedNames.size,
      games: {},
    };

    for (const [gameId, mapping] of this.gameMappings.entries()) {
      debug.games[gameId] = {
        playerCount: mapping.nameToId.size,
        createdAt: mapping.createdAt.toISOString(),
        players: Array.from(mapping.nameToId.entries()).map(([name, id]) => ({
          name,
          idPreview: id.slice(-6),
          type: mapping.playerTypes.get(id) || "unknown",
        })),
      };
    }

    return debug;
  }

  /**
   * Cleanup old mappings (maintenance function)
   */
  cleanupOldMappings(maxAgeHours: number = 24): number {
    const cutoffTime = new Date(Date.now() - maxAgeHours * 60 * 60 * 1000);
    let cleaned = 0;

    for (const [gameId, mapping] of this.gameMappings.entries()) {
      if (mapping.createdAt < cutoffTime) {
        this.clearGameMapping(gameId);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      console.log(`🧹 Cleaned up ${cleaned} old game mappings`);
    }

    return cleaned;
  }

  /**
   * Ensure game mapping exists
   */
  private ensureGameMapping(gameId: string): GameMapping {
    if (!this.gameMappings.has(gameId)) {
      this.createGameMapping(gameId);
    }
    return this.gameMappings.get(gameId)!;
  }
}

// Export singleton instance
export const nameRegistry = new NameRegistry();
