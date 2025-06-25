// server/lib/game/phases/role-manager.ts - Enhanced Role Assignment Logic
import { EventEmitter } from "events";
import { PlayerId, Player, PlayerRole, PlayerType } from "../../types/game";
import { contextManager } from "../context/context-manager";
import { nameRegistry } from "../context/name-registry";

interface RoleAssignment {
  playerId: PlayerId;
  playerName: string;
  role: PlayerRole;
  assignedAt: Date;
}

interface RoleDistribution {
  mafiaLeader: number;
  mafiaMembers: number;
  healers: number;
  citizens: number;
}

export class RoleManager extends EventEmitter {
  private gameId: string;
  private assignments: Map<PlayerId, RoleAssignment> = new Map();

  constructor(gameId: string) {
    super();
    this.gameId = gameId;
    console.log(`🎭 RoleManager initialized for game ${gameId}`);
  }

  /**
   * Assign roles to players with enhanced logic
   */
  assignRoles(players: Map<PlayerId, Player>): Map<PlayerId, Player> {
    const playerArray = Array.from(players.values());

    if (playerArray.length !== 10) {
      throw new Error(
        `Invalid player count: ${playerArray.length} (expected 10)`
      );
    }

    console.log(`🎭 Assigning roles to ${playerArray.length} players`);

    // Create role distribution
    const roleDistribution = this.calculateRoleDistribution(playerArray.length);
    console.log(`🎭 Role distribution:`, roleDistribution);

    // Shuffle players for random assignment
    const shuffledPlayers = [...playerArray].sort(() => Math.random() - 0.5);

    // Assign roles based on distribution
    const updatedPlayers = this.distributeRoles(
      shuffledPlayers,
      roleDistribution
    );

    // Update player map
    const updatedPlayerMap = new Map<PlayerId, Player>();
    updatedPlayers.forEach((player) => {
      updatedPlayerMap.set(player.id, player);

      // Record assignment
      this.assignments.set(player.id, {
        playerId: player.id,
        playerName: player.name,
        role: player.role!,
        assignedAt: new Date(),
      });
    });

    // 🆕 REVOLUTIONARY: Update all players with role assignments
    this.broadcastRoleAssignments(updatedPlayers);

    // Emit role assignment event
    this.emit("roles_assigned", {
      assignments: Array.from(this.assignments.values()),
      distribution: roleDistribution,
      timestamp: new Date(),
    });

    console.log(`✅ Roles assigned successfully`);
    return updatedPlayerMap;
  }

  /**
   * Calculate optimal role distribution for player count
   */
  private calculateRoleDistribution(playerCount: number): RoleDistribution {
    // Standard 10-player Mafia setup
    if (playerCount === 10) {
      return {
        mafiaLeader: 1,
        mafiaMembers: 1,
        healers: 1,
        citizens: 7,
      };
    }

    // Fallback for other player counts (though game expects 10)
    const mafiaCount = Math.ceil(playerCount * 0.25); // ~25% mafia
    const healerCount = Math.min(1, Math.floor(playerCount * 0.1)); // 1 healer max
    const citizenCount = playerCount - mafiaCount - healerCount;

    return {
      mafiaLeader: 1,
      mafiaMembers: mafiaCount - 1,
      healers: healerCount,
      citizens: citizenCount,
    };
  }

  /**
   * Distribute roles among shuffled players
   */
  private distributeRoles(
    shuffledPlayers: Player[],
    distribution: RoleDistribution
  ): Player[] {
    let roleIndex = 0;
    const roles: PlayerRole[] = [];

    // Build role array based on distribution
    for (let i = 0; i < distribution.mafiaLeader; i++) {
      roles.push(PlayerRole.MAFIA_LEADER);
    }
    for (let i = 0; i < distribution.mafiaMembers; i++) {
      roles.push(PlayerRole.MAFIA_MEMBER);
    }
    for (let i = 0; i < distribution.healers; i++) {
      roles.push(PlayerRole.HEALER);
    }
    for (let i = 0; i < distribution.citizens; i++) {
      roles.push(PlayerRole.CITIZEN);
    }

    // Shuffle roles for extra randomness
    roles.sort(() => Math.random() - 0.5);

    // Assign roles to players
    const updatedPlayers = shuffledPlayers.map((player, index) => ({
      ...player,
      role: roles[index],
    }));

    // Log assignments for debugging
    console.log(`🎭 Role assignments:`);
    updatedPlayers.forEach((player) => {
      console.log(`🎭 ${player.name}: ${player.role} (${player.type})`);
    });

    return updatedPlayers;
  }

  /**
   * 🆕 REVOLUTIONARY: Broadcast role assignments with perfect anonymity
   */
  private broadcastRoleAssignments(players: Player[]): void {
    // Group players by role for team information
    const mafiaTeam = players.filter(
      (p) =>
        p.role === PlayerRole.MAFIA_LEADER || p.role === PlayerRole.MAFIA_MEMBER
    );

    // 🆕 UPDATE: Give each player their specific role information
    players.forEach((player) => {
      const roleData = this.buildRoleContext(player, mafiaTeam);

      contextManager.update(player.id, {
        type: "role_assignment",
        data: roleData,
      });
    });

    // 🆕 PUSH: Broadcast role assignment complete to all players
    contextManager.push({
      type: "phase_change",
      data: {
        phase: "role_assignment",
        phase_description:
          "Roles have been assigned. Check your role and prepare for the game!",
        total_players: players.length,
        game_setup: "2 Mafia, 1 Healer, 7 Citizens",
      },
    });
  }

  /**
   * Build role-specific context for a player
   */
  private buildRoleContext(player: Player, mafiaTeam: Player[]): any {
    const playerName =
      nameRegistry.getName(player.id, this.gameId) || player.name;

    const baseContext = {
      your_name: playerName,
      your_role: player.role,
      phase: "role_assignment",
      game_starting: true,
    };

    switch (player.role) {
      case PlayerRole.MAFIA_LEADER:
        return {
          ...baseContext,
          role_description:
            "You are the Mafia Leader. Lead your team to victory by eliminating citizens.",
          team_members: mafiaTeam
            .filter((p) => p.id !== player.id)
            .map((p) => nameRegistry.getName(p.id, this.gameId) || p.name),
          special_abilities: [
            "Choose elimination target each night",
            "Coordinate with mafia team",
          ],
          win_condition:
            "Eliminate citizens until mafia equals or outnumbers them",
          strategy_tips: [
            "Coordinate with your mafia partner",
            "Blend in during discussions",
            "Choose strategic elimination targets",
            "Deflect suspicion onto citizens",
          ],
        };

      case PlayerRole.MAFIA_MEMBER:
        return {
          ...baseContext,
          role_description:
            "You are a Mafia Member. Help your leader eliminate the citizens.",
          team_members: mafiaTeam
            .filter((p) => p.id !== player.id)
            .map((p) => nameRegistry.getName(p.id, this.gameId) || p.name),
          special_abilities: [
            "Coordinate with mafia leader",
            "Help choose targets",
          ],
          win_condition:
            "Eliminate citizens until mafia equals or outnumbers them",
          strategy_tips: [
            "Support your mafia leader",
            "Help deflect suspicion",
            "Vote strategically during eliminations",
            "Maintain your cover as a citizen",
          ],
        };

      case PlayerRole.HEALER:
        return {
          ...baseContext,
          role_description:
            "You are the Healer. Protect players from mafia elimination.",
          special_abilities: ["Protect one player each night from elimination"],
          win_condition: "Help eliminate all mafia members",
          strategy_tips: [
            "Protect players you suspect mafia will target",
            "Don't reveal your role too early",
            "Pay attention to who seems threatened",
            "You can protect yourself if needed",
          ],
        };

      case PlayerRole.CITIZEN:
        return {
          ...baseContext,
          role_description:
            "You are a Citizen. Find and eliminate the mafia members.",
          special_abilities: [
            "Vote during elimination phases",
            "Participate in discussions",
          ],
          win_condition: "Help eliminate all mafia members",
          strategy_tips: [
            "Pay attention to voting patterns",
            "Look for suspicious behavior",
            "Share your observations with others",
            "Work together to find the mafia",
          ],
        };

      default:
        return baseContext;
    }
  }

  /**
   * Get role assignment for a specific player
   */
  getRoleAssignment(playerId: PlayerId): RoleAssignment | undefined {
    return this.assignments.get(playerId);
  }

  /**
   * Get all role assignments
   */
  getAllAssignments(): RoleAssignment[] {
    return Array.from(this.assignments.values());
  }

  /**
   * Get players by role
   */
  getPlayersByRole(role: PlayerRole): RoleAssignment[] {
    return Array.from(this.assignments.values()).filter((a) => a.role === role);
  }

  /**
   * Get mafia team members
   */
  getMafiaTeam(): RoleAssignment[] {
    return Array.from(this.assignments.values()).filter(
      (a) =>
        a.role === PlayerRole.MAFIA_LEADER || a.role === PlayerRole.MAFIA_MEMBER
    );
  }

  /**
   * Get team composition for analytics
   */
  getTeamComposition(): any {
    const assignments = Array.from(this.assignments.values());

    return {
      mafia: assignments.filter(
        (a) =>
          a.role === PlayerRole.MAFIA_LEADER ||
          a.role === PlayerRole.MAFIA_MEMBER
      ).length,
      citizens: assignments.filter(
        (a) => a.role === PlayerRole.CITIZEN || a.role === PlayerRole.HEALER
      ).length,
      roles: {
        [PlayerRole.MAFIA_LEADER]: assignments.filter(
          (a) => a.role === PlayerRole.MAFIA_LEADER
        ).length,
        [PlayerRole.MAFIA_MEMBER]: assignments.filter(
          (a) => a.role === PlayerRole.MAFIA_MEMBER
        ).length,
        [PlayerRole.HEALER]: assignments.filter(
          (a) => a.role === PlayerRole.HEALER
        ).length,
        [PlayerRole.CITIZEN]: assignments.filter(
          (a) => a.role === PlayerRole.CITIZEN
        ).length,
      },
    };
  }

  /**
   * Validate role assignments
   */
  validateAssignments(): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    const assignments = Array.from(this.assignments.values());

    // Check total count
    if (assignments.length !== 10) {
      errors.push(
        `Invalid assignment count: ${assignments.length} (expected 10)`
      );
    }

    // Check role distribution
    const roleCount = {
      [PlayerRole.MAFIA_LEADER]: 0,
      [PlayerRole.MAFIA_MEMBER]: 0,
      [PlayerRole.HEALER]: 0,
      [PlayerRole.CITIZEN]: 0,
    };

    assignments.forEach((assignment) => {
      roleCount[assignment.role]++;
    });

    if (roleCount[PlayerRole.MAFIA_LEADER] !== 1) {
      errors.push(
        `Invalid mafia leader count: ${
          roleCount[PlayerRole.MAFIA_LEADER]
        } (expected 1)`
      );
    }
    if (roleCount[PlayerRole.MAFIA_MEMBER] !== 1) {
      errors.push(
        `Invalid mafia member count: ${
          roleCount[PlayerRole.MAFIA_MEMBER]
        } (expected 1)`
      );
    }
    if (roleCount[PlayerRole.HEALER] !== 1) {
      errors.push(
        `Invalid healer count: ${roleCount[PlayerRole.HEALER]} (expected 1)`
      );
    }
    if (roleCount[PlayerRole.CITIZEN] !== 7) {
      errors.push(
        `Invalid citizen count: ${roleCount[PlayerRole.CITIZEN]} (expected 7)`
      );
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Get role assignment statistics
   */
  getAssignmentStats(): any {
    const assignments = Array.from(this.assignments.values());

    return {
      totalAssignments: assignments.length,
      assignmentTime: assignments[0]?.assignedAt || null,
      composition: this.getTeamComposition(),
      validation: this.validateAssignments(),
      distribution: {
        humanPlayers: assignments.length, // Would be filtered by player type in real usage
        aiPlayers: 0, // Would be calculated from actual player data
      },
    };
  }

  /**
   * Get debug information
   */
  getDebugInfo(): any {
    return {
      gameId: this.gameId,
      assignmentsCount: this.assignments.size,
      assignments: Array.from(this.assignments.values()).map((a) => ({
        playerName: a.playerName,
        role: a.role,
        assignedAt: a.assignedAt.toISOString(),
      })),
      validation: this.validateAssignments(),
      composition: this.getTeamComposition(),
    };
  }

  /**
   * Reset role assignments (for new game)
   */
  reset(): void {
    this.assignments.clear();
    console.log(`🔄 RoleManager reset for game ${this.gameId}`);
  }

  /**
   * Cleanup role manager
   */
  cleanup(): void {
    this.assignments.clear();
    this.removeAllListeners();
    console.log(`🧹 RoleManager cleanup completed`);
  }
}
