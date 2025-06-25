// server/lib/game/phases/night-manager.ts - Night Phase Coordination
import { EventEmitter } from "events";
import {
  PlayerId,
  Player,
  NightAction,
  PlayerRole,
  PlayerType,
} from "../../types/game";
import { contextManager } from "../context/context-manager";
import { aiContextBuilder } from "../context/ai-context-builder";
import { nameRegistry } from "../context/name-registry";
import { responseParser } from "../context/response-parser";

interface NightState {
  round: number;
  alivePlayers: PlayerId[];
  nightActions: Map<PlayerId, NightAction>;
  startTime: Date;
  duration: number;
  nightTimeout?: NodeJS.Timeout;
  actionTimeouts: Map<PlayerId, NodeJS.Timeout>;
  mafiaChat: Array<{ playerId: PlayerId; message: string; timestamp: Date }>;
}

export class NightManager extends EventEmitter {
  private gameId: string;
  private nightState: NightState | null = null;
  private players: Map<PlayerId, Player> = new Map();

  constructor(gameId: string) {
    super();
    this.gameId = gameId;
    console.log(`🌙 NightManager initialized for game ${gameId}`);
  }

  /**
   * Start night phase with action coordination
   */
  startNight(
    players: Map<PlayerId, Player>,
    round: number,
    duration: number = 90000
  ): void {
    this.players = new Map(players);

    const alivePlayers = Array.from(players.values())
      .filter((p) => p.isAlive)
      .map((p) => p.id);

    this.nightState = {
      round,
      alivePlayers,
      nightActions: new Map(),
      startTime: new Date(),
      duration,
      actionTimeouts: new Map(),
      mafiaChat: [],
    };

    console.log(
      `🌙 Night ${round} started: ${alivePlayers.length} alive players, ${
        duration / 1000
      }s duration`
    );

    // Set overall night timeout
    this.nightState.nightTimeout = setTimeout(() => {
      this.endNight("timeout");
    }, duration);

    // 🆕 REVOLUTIONARY: Setup night phase context for all players
    this.broadcastNightStart(alivePlayers, round);

    // 🆕 Start AI night actions
    this.startAINightActions();

    this.emit("night_started", {
      round,
      alivePlayers: alivePlayers.map((id) => ({
        id,
        name: this.players.get(id)?.name || "Unknown",
      })),
      duration,
    });
  }

  /**
   * Handle night action submission
   */
  submitNightAction(
    playerId: PlayerId,
    action: "kill" | "heal",
    targetId?: PlayerId
  ): boolean {
    if (!this.nightState) {
      console.log(`❌ No active night phase for action from ${playerId}`);
      return false;
    }

    const player = this.players.get(playerId);
    if (!player || !player.isAlive) {
      console.log(`❌ Invalid player ${playerId} submitting night action`);
      return false;
    }

    // Validate action based on role
    if (action === "kill" && player.role !== PlayerRole.MAFIA_LEADER) {
      console.log(`❌ Player ${player.name} cannot kill (not mafia leader)`);
      return false;
    }

    if (action === "heal" && player.role !== PlayerRole.HEALER) {
      console.log(`❌ Player ${player.name} cannot heal (not healer)`);
      return false;
    }

    // Validate target
    if (targetId) {
      const target = this.players.get(targetId);
      if (!target || !target.isAlive) {
        console.log(`❌ Invalid target ${targetId} for night action`);
        return false;
      }

      // Mafia can't target other mafia
      if (
        action === "kill" &&
        (target.role === PlayerRole.MAFIA_LEADER ||
          target.role === PlayerRole.MAFIA_MEMBER)
      ) {
        console.log(`❌ Mafia cannot target other mafia members`);
        return false;
      }
    }

    // Remove existing action from this player
    this.nightState.nightActions.delete(playerId);

    // Create new action
    const nightAction: NightAction = {
      playerId,
      action,
      targetId,
      timestamp: new Date(),
    };

    this.nightState.nightActions.set(playerId, nightAction);

    // Clear timeout for this player
    const timeout = this.nightState.actionTimeouts.get(playerId);
    if (timeout) {
      clearTimeout(timeout);
      this.nightState.actionTimeouts.delete(playerId);
    }

    const targetName = targetId ? this.players.get(targetId)?.name : "nobody";
    console.log(
      `🌙 Night action: ${player.name} wants to ${action} ${targetName}`
    );

    this.emit("night_action_submitted", {
      playerId,
      playerName: player.name,
      action,
      targetId,
      targetName,
      timestamp: nightAction.timestamp,
    });

    // Check if all required actions are submitted
    if (this.areAllActionsSubmitted()) {
      console.log(`🌙 All night actions submitted, ending night early`);
      this.endNight("all_actions_submitted");
    }

    return true;
  }

  /**
   * Add mafia chat message
   */
  addMafiaChat(mafiaPlayerId: PlayerId, message: string): boolean {
    if (!this.nightState) {
      console.log(
        `❌ No active night phase for mafia chat from ${mafiaPlayerId}`
      );
      return false;
    }

    const player = this.players.get(mafiaPlayerId);
    if (!player || !player.isAlive) {
      console.log(`❌ Invalid player ${mafiaPlayerId} for mafia chat`);
      return false;
    }

    if (
      player.role !== PlayerRole.MAFIA_LEADER &&
      player.role !== PlayerRole.MAFIA_MEMBER
    ) {
      console.log(
        `❌ Player ${player.name} is not mafia, cannot use mafia chat`
      );
      return false;
    }

    const chatMessage = {
      playerId: mafiaPlayerId,
      message,
      timestamp: new Date(),
    };

    this.nightState.mafiaChat.push(chatMessage);

    console.log(`🔴 Mafia chat: ${player.name}: "${message}"`);

    this.emit("mafia_chat", {
      playerId: mafiaPlayerId,
      playerName: player.name,
      message,
      timestamp: chatMessage.timestamp,
    });

    return true;
  }

  /**
   * 🔥 REVOLUTIONARY: Start AI night actions with coordination
   */
  private async startAINightActions(): Promise<void> {
    if (!this.nightState) return;

    const aiPlayers = this.nightState.alivePlayers
      .map((id) => this.players.get(id)!)
      .filter((p) => p.type === PlayerType.AI && this.hasNightAction(p));

    console.log(
      `🤖 Starting AI night actions for ${aiPlayers.length} AI players`
    );

    // Start mafia coordination first
    const mafiaPlayers = aiPlayers.filter(
      (p) =>
        p.role === PlayerRole.MAFIA_LEADER || p.role === PlayerRole.MAFIA_MEMBER
    );

    if (mafiaPlayers.length > 0) {
      setTimeout(() => this.startMafiaCoordination(mafiaPlayers), 2000);
    }

    // Then start individual actions
    aiPlayers.forEach((aiPlayer, index) => {
      const delay = 5000 + index * 2000 + Math.random() * 3000; // Staggered timing

      setTimeout(() => {
        this.triggerAINightAction(aiPlayer);
      }, delay);
    });
  }

  /**
   * 🔥 Start mafia coordination chat
   */
  private async startMafiaCoordination(mafiaPlayers: Player[]): Promise<void> {
    if (mafiaPlayers.length === 0) return;

    console.log(
      `🔴 Starting mafia coordination between ${mafiaPlayers
        .map((p) => p.name)
        .join(" and ")}`
    );

    try {
      console.log(`🔴 STEP 1: Getting available targets`);
      const availableTargets = this.nightState!.alivePlayers.filter((id) => {
        const player = this.players.get(id);
        return (
          player &&
          player.role !== PlayerRole.MAFIA_LEADER &&
          player.role !== PlayerRole.MAFIA_MEMBER
        );
      }).map((id) => nameRegistry.getName(id, this.gameId) || "Unknown");

      console.log(
        `🔴 STEP 2: Available targets: ${availableTargets.join(", ")}`
      );

      for (const mafiaPlayer of mafiaPlayers) {
        try {
          console.log(
            `🔴 STEP 3: Starting coordination for ${mafiaPlayer.name}`
          );

          console.log(`🔴 STEP 4: Building context for ${mafiaPlayer.name}`);
          const context = aiContextBuilder.buildNightActionContext(
            mafiaPlayer.id
          );
          console.log(
            `🔴 STEP 5: Context built successfully for ${mafiaPlayer.name}`
          );

          console.log(
            `🔴 STEP 6: Calling contextManager.trigger for ${mafiaPlayer.name}`
          );
          const response = await contextManager.trigger(mafiaPlayer.id, {
            type: "night_action",
            data: {
              your_name: mafiaPlayer.name,
              your_role: mafiaPlayer.role,
              phase: "mafia_coordination",
              available_targets: availableTargets,
              mafia_team: mafiaPlayers.map((p) => p.name),
              round: this.nightState!.round,
            },
            requiresResponse: true,
            timeoutMs: 10000,
          });
          console.log(
            `🔴 STEP 7: Got response for ${
              mafiaPlayer.name
            }: ${response.content?.substring(0, 100)}`
          );

          if (response.content) {
            console.log(`🔴 STEP 8: Adding mafia chat for ${mafiaPlayer.name}`);
            this.addMafiaChat(mafiaPlayer.id, response.content);
            console.log(
              `🔴 STEP 9: Mafia chat added successfully for ${mafiaPlayer.name}`
            );
          }
        } catch (error) {
          console.error(
            `❌ INNER ERROR: Mafia coordination failed for ${mafiaPlayer.name}:`,
            error
          );
          console.error(`❌ ERROR STACK:`, error.stack);
        }

        console.log(`🔴 STEP 10: Waiting between mafia messages`);
        await new Promise((resolve) =>
          setTimeout(resolve, 1000 + Math.random() * 2000)
        );
      }

      console.log(`🔴 STEP 11: All mafia coordination completed successfully`);
    } catch (outerError) {
      console.error(`❌ OUTER ERROR in startMafiaCoordination:`, outerError);
      console.error(`❌ OUTER ERROR STACK:`, outerError.stack);
    }
  }

  /**
   * 🔥 CRITICAL: Trigger AI night action
   */
  private async triggerAINightAction(aiPlayer: Player): Promise<void> {
    if (!this.nightState) return;

    // Check if player already submitted action
    if (this.nightState.nightActions.has(aiPlayer.id)) {
      console.log(`🤖 ${aiPlayer.name} already submitted night action`);
      return;
    }

    try {
      console.log(
        `🤖 Triggering night action for ${aiPlayer.name} (${aiPlayer.role})`
      );

      // Set timeout protection
      const timeoutId = setTimeout(() => {
        console.log(
          `⏰ Night action timeout for ${aiPlayer.name}, using fallback`
        );
        this.fallbackNightAction(aiPlayer);
      }, 20000);

      this.nightState.actionTimeouts.set(aiPlayer.id, timeoutId);

      // Build night action context
      const context = aiContextBuilder.buildNightActionContext(aiPlayer.id);

      // Get available targets based on role
      const availableTargets = this.getAvailableTargets(aiPlayer);

      // 🆕 TRIGGER: AI night action with role-specific context
      const response = await contextManager.trigger(aiPlayer.id, {
        type: "night_action",
        data: {
          your_name: aiPlayer.name,
          your_role: aiPlayer.role,
          phase: "night_action",
          available_targets: availableTargets,
          round: this.nightState.round,
          time_remaining: Math.max(
            0,
            this.nightState.duration -
              (Date.now() - this.nightState.startTime.getTime())
          ),
          mafia_chat_history: this.nightState.mafiaChat.map(
            (msg) => `${this.players.get(msg.playerId)?.name}: ${msg.message}`
          ),
        },
        requiresResponse: true,
        timeoutMs: 15000,
      });

      // Clear timeout on successful response
      clearTimeout(timeoutId);
      this.nightState.actionTimeouts.delete(aiPlayer.id);

      // Parse AI response
      const parsedResponse = responseParser.parseResponse(
        response.content,
        "night_action",
        availableTargets
      );

      if (!parsedResponse.isValid) {
        console.warn(
          `⚠️ Invalid AI night action from ${aiPlayer.name}:`,
          parsedResponse.errors
        );
        this.fallbackNightAction(aiPlayer);
        return;
      }

      // Extract action from parsed response
      const actionData = parsedResponse.data as any;
      const action = actionData.action;
      const targetName = actionData.target;

      // Handle "no action" case
      if (
        !targetName ||
        targetName.toLowerCase() === "nobody" ||
        targetName.toLowerCase() === "none"
      ) {
        console.log(`🤖 ${aiPlayer.name} chose not to act tonight`);
        this.submitNightAction(aiPlayer.id, action, undefined);
        return;
      }

      // Get target ID
      const targetId = nameRegistry.getId(targetName, this.gameId);

      if (!targetId || !this.nightState.alivePlayers.includes(targetId)) {
        console.warn(`⚠️ Invalid target ${targetName} from ${aiPlayer.name}`);
        this.fallbackNightAction(aiPlayer);
        return;
      }

      // Submit the action
      const success = this.submitNightAction(aiPlayer.id, action, targetId);

      if (!success) {
        console.error(
          `❌ Night action submission failed for ${aiPlayer.name}, using fallback`
        );
        this.fallbackNightAction(aiPlayer);
      }
    } catch (error) {
      console.error(`❌ AI night action failed for ${aiPlayer.name}:`, error);

      // Clear timeout on error
      const timeout = this.nightState?.actionTimeouts.get(aiPlayer.id);
      if (timeout) {
        clearTimeout(timeout);
        this.nightState?.actionTimeouts.delete(aiPlayer.id);
      }

      this.fallbackNightAction(aiPlayer);
    }
  }

  /**
   * Fallback night action for AI
   */
  private fallbackNightAction(aiPlayer: Player): void {
    if (!this.nightState || this.nightState.nightActions.has(aiPlayer.id)) {
      return; // Already submitted or night ended
    }

    console.log(`🔄 Using fallback night action for ${aiPlayer.name}`);

    const availableTargets = this.getAvailableTargetsIds(aiPlayer);

    if (availableTargets.length === 0) {
      // No targets available, submit action with no target
      this.submitNightAction(
        aiPlayer.id,
        aiPlayer.role === PlayerRole.MAFIA_LEADER ? "kill" : "heal",
        undefined
      );
      return;
    }

    // Random selection as last resort
    const targetId =
      availableTargets[Math.floor(Math.random() * availableTargets.length)];

    setTimeout(() => {
      this.submitNightAction(
        aiPlayer.id,
        aiPlayer.role === PlayerRole.MAFIA_LEADER ? "kill" : "heal",
        targetId
      );
    }, 1000);
  }

  /**
   * Get available targets as names for AI
   */
  private getAvailableTargets(player: Player): string[] {
    if (!this.nightState) return [];

    if (player.role === PlayerRole.MAFIA_LEADER) {
      // Mafia can target all non-mafia players
      return this.nightState.alivePlayers
        .filter((id) => {
          const target = this.players.get(id);
          return (
            target &&
            target.role !== PlayerRole.MAFIA_LEADER &&
            target.role !== PlayerRole.MAFIA_MEMBER
          );
        })
        .map((id) => nameRegistry.getName(id, this.gameId) || "Unknown");
    }

    if (player.role === PlayerRole.HEALER) {
      // Healer can target all alive players
      return this.nightState.alivePlayers.map(
        (id) => nameRegistry.getName(id, this.gameId) || "Unknown"
      );
    }

    return [];
  }

  /**
   * Get available target IDs for fallback
   */
  private getAvailableTargetsIds(player: Player): PlayerId[] {
    if (!this.nightState) return [];

    if (player.role === PlayerRole.MAFIA_LEADER) {
      return this.nightState.alivePlayers.filter((id) => {
        const target = this.players.get(id);
        return (
          target &&
          target.role !== PlayerRole.MAFIA_LEADER &&
          target.role !== PlayerRole.MAFIA_MEMBER
        );
      });
    }

    if (player.role === PlayerRole.HEALER) {
      return this.nightState.alivePlayers;
    }

    return [];
  }

  /**
   * Check if player has a night action
   */
  private hasNightAction(player: Player): boolean {
    return (
      player.role === PlayerRole.MAFIA_LEADER ||
      player.role === PlayerRole.MAFIA_MEMBER ||
      player.role === PlayerRole.HEALER
    );
  }

  /**
   * Check if all required actions are submitted
   */
  private areAllActionsSubmitted(): boolean {
    if (!this.nightState) return false;

    const requiredActors = this.nightState.alivePlayers
      .map((id) => this.players.get(id)!)
      .filter((p) => this.hasNightAction(p));

    return requiredActors.every((player) =>
      this.nightState!.nightActions.has(player.id)
    );
  }

  /**
   * End night phase and process actions
   */
  private endNight(reason: string): void {
    if (!this.nightState) return;

    // Clear all timeouts
    if (this.nightState.nightTimeout) {
      clearTimeout(this.nightState.nightTimeout);
    }

    this.nightState.actionTimeouts.forEach((timeout) => clearTimeout(timeout));
    this.nightState.actionTimeouts.clear();

    const nightActions = Array.from(this.nightState.nightActions.values());

    console.log(
      `🌙 Night ${this.nightState.round} ended (${reason}): ${nightActions.length} actions submitted`
    );

    // Process night actions to determine result
    const nightResult = this.processNightActions(nightActions);

    this.emit("night_ended", {
      reason,
      round: this.nightState.round,
      nightActions,
      nightResult,
      mafiaChat: this.nightState.mafiaChat,
    });

    this.nightState = null;
  }

  /**
   * Process night actions to determine elimination
   */
  private processNightActions(nightActions: NightAction[]): any {
    console.log(`🌙 Processing ${nightActions.length} night actions...`);

    const killAction = nightActions.find((a) => a.action === "kill");
    const healAction = nightActions.find((a) => a.action === "heal");

    // Log all actions
    nightActions.forEach((action) => {
      const player = this.players.get(action.playerId);
      const target = action.targetId ? this.players.get(action.targetId) : null;
      console.log(
        `🌙 ${player?.name} wants to ${action.action} ${
          target?.name || "nobody"
        }`
      );
    });

    // No kill action or no target
    if (!killAction || !killAction.targetId) {
      console.log(`🌙 No kill action or target, nobody dies`);
      return {
        eliminated: null,
        reason: "no_kill_action",
        protected: false,
      };
    }

    const targetPlayer = this.players.get(killAction.targetId);
    if (!targetPlayer) {
      console.log(`🌙 Kill target not found: ${killAction.targetId}`);
      return {
        eliminated: null,
        reason: "invalid_target",
        protected: false,
      };
    }

    // Check if target was protected by healer
    const wasProtected =
      healAction && healAction.targetId === killAction.targetId;

    if (wasProtected) {
      const healerName = this.players.get(healAction.playerId)?.name;
      console.log(`🛡️ ${targetPlayer.name} was protected by ${healerName}!`);

      return {
        eliminated: null,
        reason: "healer_protection",
        protected: true,
        target: {
          id: targetPlayer.id,
          name: targetPlayer.name,
        },
        healer: {
          id: healAction.playerId,
          name: healerName,
        },
      };
    }

    // Target was killed
    console.log(`💀 ${targetPlayer.name} was eliminated by mafia`);

    return {
      eliminated: {
        id: targetPlayer.id,
        name: targetPlayer.name,
        role: targetPlayer.role,
      },
      reason: "mafia_kill",
      protected: false,
    };
  }

  /**
   * Broadcast night start to all players
   */
  private broadcastNightStart(alivePlayers: PlayerId[], round: number): void {
    const nightData = {
      phase: "night",
      round,
      alive_players: alivePlayers.map(
        (id) => nameRegistry.getName(id, this.gameId) || "Unknown"
      ),
      night_duration: this.nightState!.duration,
    };

    // 🆕 PUSH: Broadcast night start to all players
    contextManager.push({
      type: "phase_change",
      data: {
        ...nightData,
        phase_description:
          "Special roles act in secret. Mafia kills, Healer protects.",
      },
    });

    // 🆕 UPDATE: Give each player role-specific instructions
    alivePlayers.forEach((playerId) => {
      const player = this.players.get(playerId);
      if (!player) return;

      const playerName =
        nameRegistry.getName(playerId, this.gameId) || "Unknown";
      let roleInstructions = "";

      if (player.role === PlayerRole.MAFIA_LEADER) {
        const targets = this.getAvailableTargets(player);
        roleInstructions = `As Mafia Leader, choose who to eliminate tonight. Available targets: ${targets.join(
          ", "
        )}`;
      } else if (player.role === PlayerRole.MAFIA_MEMBER) {
        roleInstructions =
          "You are Mafia. Coordinate with your leader and help choose the target.";
      } else if (player.role === PlayerRole.HEALER) {
        const targets = this.getAvailableTargets(player);
        roleInstructions = `As Healer, choose who to protect tonight. You can protect: ${targets.join(
          ", "
        )}`;
      } else {
        roleInstructions =
          "You are a Citizen. Rest while the special roles act.";
      }

      contextManager.update(playerId, {
        type: "game_state",
        data: {
          ...nightData,
          your_name: playerName,
          your_role: player.role,
          role_instructions: roleInstructions,
          has_night_action: this.hasNightAction(player),
        },
      });
    });
  }

  /**
   * Force end night (admin control)
   */
  forceEndNight(): void {
    this.endNight("forced_end");
  }

  /**
   * Get current night status
   */
  getNightStatus(): any {
    if (!this.nightState) {
      return { active: false };
    }

    const timeRemaining = Math.max(
      0,
      this.nightState.duration -
        (Date.now() - this.nightState.startTime.getTime())
    );

    const requiredActors = this.nightState.alivePlayers
      .map((id) => this.players.get(id)!)
      .filter((p) => this.hasNightAction(p));

    return {
      active: true,
      round: this.nightState.round,
      actionsSubmitted: this.nightState.nightActions.size,
      requiredActions: requiredActors.length,
      timeRemaining,
      progress:
        this.nightState.nightActions.size / Math.max(requiredActors.length, 1),
      mafiaMessages: this.nightState.mafiaChat.length,
      actions: Array.from(this.nightState.nightActions.values()).map(
        (action) => ({
          playerId: action.playerId,
          playerName: this.players.get(action.playerId)?.name || "Unknown",
          action: action.action,
          targetId: action.targetId,
          targetName: action.targetId
            ? this.players.get(action.targetId)?.name || "Unknown"
            : "Nobody",
          timestamp: action.timestamp.toISOString(),
        })
      ),
    };
  }

  /**
   * Can night end early?
   */
  canEndEarly(): boolean {
    return this.areAllActionsSubmitted();
  }

  /**
   * Get debug information
   */
  getDebugInfo(): any {
    return {
      gameId: this.gameId,
      nightState: this.nightState
        ? {
            round: this.nightState.round,
            alivePlayersCount: this.nightState.alivePlayers.length,
            actionsSubmitted: this.nightState.nightActions.size,
            actionTimeoutsActive: this.nightState.actionTimeouts.size,
            mafiaMessagesCount: this.nightState.mafiaChat.length,
            hasMainTimeout: !!this.nightState.nightTimeout,
          }
        : null,
      playersCount: this.players.size,
    };
  }

  /**
   * Cleanup night manager
   */
  cleanup(): void {
    if (this.nightState) {
      if (this.nightState.nightTimeout) {
        clearTimeout(this.nightState.nightTimeout);
      }
      this.nightState.actionTimeouts.forEach((timeout) =>
        clearTimeout(timeout)
      );
      this.nightState = null;
    }

    this.players.clear();
    this.removeAllListeners();
    console.log(`🧹 NightManager cleanup completed`);
  }
}
