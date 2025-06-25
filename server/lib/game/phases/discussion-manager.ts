// server/lib/game/phases/discussion-manager.ts - Turn-Based Discussion Logic
import { EventEmitter } from "events";
import { PlayerId, Player, GamePhase, PlayerType } from "../../types/game";
import { contextManager } from "../context/context-manager";
import { aiContextBuilder } from "../context/ai-context-builder";
import { nameRegistry } from "../context/name-registry";

interface DiscussionState {
  speakingOrder: PlayerId[];
  currentSpeakerIndex: number;
  currentSpeaker: PlayerId | null;
  hasSpoken: Set<PlayerId>;
  startTime: Date;
  timePerPlayer: number;
  speakerTimeout?: NodeJS.Timeout;
}

export class DiscussionManager extends EventEmitter {
  private gameId: string;
  private discussionState: DiscussionState | null = null;
  private players: Map<PlayerId, Player> = new Map();

  constructor(gameId: string) {
    super();
    this.gameId = gameId;
    console.log(`💬 DiscussionManager initialized for game ${gameId}`);
  }

  /**
   * Start discussion phase with perfect turn-based progression
   */
  startDiscussion(
    players: Map<PlayerId, Player>,
    timePerPlayer: number = 35000
  ): void {
    this.players = new Map(players);

    // Get alive players and randomize speaking order
    const alivePlayers = Array.from(players.values())
      .filter((p) => p.isAlive)
      .sort(() => Math.random() - 0.5);

    if (alivePlayers.length === 0) {
      console.error("❌ No alive players for discussion");
      this.emit("discussion_ended", { reason: "no_alive_players" });
      return;
    }

    this.discussionState = {
      speakingOrder: alivePlayers.map((p) => p.id),
      currentSpeakerIndex: 0,
      currentSpeaker: alivePlayers[0].id,
      hasSpoken: new Set(),
      startTime: new Date(),
      timePerPlayer,
    };

    console.log(
      `💬 Discussion started: ${alivePlayers.length} players, ${
        timePerPlayer / 1000
      }s each`
    );
    console.log(
      `🗣️ Speaking order: ${alivePlayers.map((p) => p.name).join(" → ")}`
    );

    // 🆕 REVOLUTIONARY: Update all players with discussion context
    this.broadcastDiscussionStart(alivePlayers);

    // Start first speaker's turn
    this.startSpeakerTurn();

    this.emit("discussion_started", {
      speakingOrder: this.discussionState.speakingOrder.map((id) => ({
        id,
        name: this.players.get(id)?.name || "Unknown",
      })),
      currentSpeaker: this.discussionState.currentSpeaker,
      timePerPlayer,
    });
  }

  /**
   * Handle player message during discussion
   */
  handleMessage(playerId: PlayerId, content: string): boolean {
    if (!this.discussionState) {
      console.log(`❌ No active discussion for message from ${playerId}`);
      return false;
    }

    const player = this.players.get(playerId);
    if (!player || !player.isAlive) {
      console.log(`❌ Invalid player ${playerId} trying to speak`);
      return false;
    }

    // Check if it's this player's turn
    if (this.discussionState.currentSpeaker !== playerId) {
      const currentSpeakerName = this.players.get(
        this.discussionState.currentSpeaker || ""
      )?.name;
      console.log(
        `❌ ${player.name} tried to speak out of turn (current: ${currentSpeakerName})`
      );
      return false;
    }

    // Mark player as having spoken
    this.discussionState.hasSpoken.add(playerId);

    // Add to game history for context building
    aiContextBuilder.addGameHistoryMessage(`${player.name}: ${content}`);

    console.log(`💬 ${player.name}: "${content}"`);

    this.emit("message_received", {
      playerId,
      playerName: player.name,
      content,
      timestamp: new Date(),
    });

    // Move to next speaker
    this.advanceToNextSpeaker();

    return true;
  }

  /**
   * Skip current speaker (if timeout or manual skip)
   */
  skipCurrentSpeaker(reason: string = "timeout"): void {
    if (!this.discussionState || !this.discussionState.currentSpeaker) {
      return;
    }

    const player = this.players.get(this.discussionState.currentSpeaker);
    console.log(`⏭️ Skipping ${player?.name} (${reason})`);

    this.discussionState.hasSpoken.add(this.discussionState.currentSpeaker);

    this.emit("speaker_skipped", {
      playerId: this.discussionState.currentSpeaker,
      playerName: player?.name,
      reason,
    });

    this.advanceToNextSpeaker();
  }

  /**
   * Force end discussion (admin control)
   */
  endDiscussion(): void {
    if (!this.discussionState) {
      return;
    }

    this.clearSpeakerTimeout();

    console.log(`💬 Discussion ended manually`);

    this.emit("discussion_ended", {
      reason: "forced_end",
      hasSpoken: Array.from(this.discussionState.hasSpoken),
      speakingOrder: this.discussionState.speakingOrder,
    });

    this.discussionState = null;
  }

  /**
   * Get current discussion status
   */
  getDiscussionStatus(): any {
    if (!this.discussionState) {
      return { active: false };
    }

    const currentPlayer = this.players.get(
      this.discussionState.currentSpeaker || ""
    );
    const progress =
      this.discussionState.hasSpoken.size /
      this.discussionState.speakingOrder.length;

    return {
      active: true,
      currentSpeaker: {
        id: this.discussionState.currentSpeaker,
        name: currentPlayer?.name,
        index: this.discussionState.currentSpeakerIndex,
      },
      progress,
      hasSpoken: this.discussionState.hasSpoken.size,
      totalSpeakers: this.discussionState.speakingOrder.length,
      timePerPlayer: this.discussionState.timePerPlayer,
      startTime: this.discussionState.startTime.toISOString(),
    };
  }

  /**
   * Start current speaker's turn with AI coordination
   */
  private startSpeakerTurn(): void {
    if (!this.discussionState || !this.discussionState.currentSpeaker) {
      return;
    }

    const currentPlayer = this.players.get(this.discussionState.currentSpeaker);
    if (!currentPlayer) {
      console.error(
        `❌ Current speaker ${this.discussionState.currentSpeaker} not found`
      );
      this.advanceToNextSpeaker();
      return;
    }

    console.log(
      `🗣️ ${currentPlayer.name}'s turn to speak (${
        this.discussionState.currentSpeakerIndex + 1
      }/${this.discussionState.speakingOrder.length})`
    );

    // Set timeout for this speaker
    this.clearSpeakerTimeout();
    this.discussionState.speakerTimeout = setTimeout(() => {
      this.skipCurrentSpeaker("timeout");
    }, this.discussionState.timePerPlayer);

    // 🆕 REVOLUTIONARY: If AI player, trigger AI response
    if (currentPlayer.type === PlayerType.AI) {
      this.triggerAIDiscussion(currentPlayer);
    }

    this.emit("speaker_turn_started", {
      speakerId: this.discussionState.currentSpeaker,
      speakerName: currentPlayer.name,
      speakerType: currentPlayer.type,
      timeLimit: this.discussionState.timePerPlayer,
      speakerIndex: this.discussionState.currentSpeakerIndex,
    });
  }

  /**
   * 🔥 REVOLUTIONARY: Trigger AI discussion with rich context
   */
  private async triggerAIDiscussion(aiPlayer: Player): Promise<void> {
    try {
      console.log(`🤖 Triggering AI discussion for ${aiPlayer.name}`);

      // Build rich context for AI
      const context = aiContextBuilder.buildDiscussionContext(aiPlayer.id);

      // Get previous messages for cumulative context
      const recentHistory = context.gameHistory.slice(-5);

      // 🆕 TRIGGER: AI's turn to speak with rich context
      const response = await contextManager.trigger(aiPlayer.id, {
        type: "discussion_turn",
        data: {
          your_name: aiPlayer.name,
          your_turn: true,
          previous_messages: recentHistory,
          available_actions: ["speak"],
          time_limit: this.discussionState!.timePerPlayer,
          round: context.round,
          phase: GamePhase.DISCUSSION,
          alive_players: context.livingPlayers.map(
            (id) => nameRegistry.getName(id, this.gameId) || "Unknown"
          ),
        },
        requiresResponse: true,
        timeoutMs: Math.min(this.discussionState!.timePerPlayer - 2000, 15000), // Leave buffer
      });

      // Handle AI response
      if (response && response.content) {
        // Simulate the AI "sending" a message
        setTimeout(() => {
          this.handleMessage(aiPlayer.id, response.content);
        }, 1000 + Math.random() * 2000); // Realistic delay
      } else {
        console.warn(`⚠️ Empty AI response from ${aiPlayer.name}`);
        this.skipCurrentSpeaker("empty_response");
      }
    } catch (error) {
      console.error(`❌ AI discussion failed for ${aiPlayer.name}:`, error);
      this.skipCurrentSpeaker("ai_error");
    }
  }

  /**
   * Advance to next speaker in the speaking order
   */
  private advanceToNextSpeaker(): void {
    if (!this.discussionState) return;

    this.clearSpeakerTimeout();

    // Move to next speaker
    this.discussionState.currentSpeakerIndex++;

    if (
      this.discussionState.currentSpeakerIndex >=
      this.discussionState.speakingOrder.length
    ) {
      // All players have spoken, end discussion
      console.log(`💬 All players have spoken, ending discussion`);

      this.emit("discussion_ended", {
        reason: "all_players_spoke",
        hasSpoken: Array.from(this.discussionState.hasSpoken),
        speakingOrder: this.discussionState.speakingOrder,
      });

      this.discussionState = null;
      return;
    }

    // Set next speaker
    this.discussionState.currentSpeaker =
      this.discussionState.speakingOrder[
        this.discussionState.currentSpeakerIndex
      ];

    // Start next speaker's turn
    this.startSpeakerTurn();
  }

  /**
   * Broadcast discussion start to all players
   */
  private broadcastDiscussionStart(alivePlayers: Player[]): void {
    const discussionData = {
      phase: GamePhase.DISCUSSION,
      speaking_order: alivePlayers.map((p) => p.name),
      total_speakers: alivePlayers.length,
      time_per_player: this.discussionState!.timePerPlayer,
      your_position: -1, // Will be set per player
    };

    // 🆕 PUSH: Broadcast to all players
    contextManager.push({
      type: "phase_change",
      data: {
        ...discussionData,
        phase_name: "Discussion Phase",
        description: "Players take turns sharing their thoughts and suspicions",
      },
    });

    // 🆕 UPDATE: Give each player their specific position
    alivePlayers.forEach((player, index) => {
      contextManager.update(player.id, {
        type: "game_state",
        data: {
          ...discussionData,
          your_position: index + 1,
          your_turn_coming: index === 0 ? "now" : `in ${index} turns`,
        },
      });
    });
  }

  /**
   * Clear speaker timeout
   */
  private clearSpeakerTimeout(): void {
    if (this.discussionState?.speakerTimeout) {
      clearTimeout(this.discussionState.speakerTimeout);
      this.discussionState.speakerTimeout = undefined;
    }
  }

  /**
   * Check if discussion can be skipped early
   */
  canSkipEarly(): boolean {
    if (!this.discussionState) return false;

    // Can skip if all players have spoken
    return (
      this.discussionState.hasSpoken.size >=
      this.discussionState.speakingOrder.length
    );
  }

  /**
   * Get debug information
   */
  getDebugInfo(): any {
    return {
      gameId: this.gameId,
      discussionState: this.discussionState
        ? {
            speakingOrderCount: this.discussionState.speakingOrder.length,
            currentSpeakerIndex: this.discussionState.currentSpeakerIndex,
            currentSpeaker: this.discussionState.currentSpeaker,
            hasSpokenCount: this.discussionState.hasSpoken.size,
            timePerPlayer: this.discussionState.timePerPlayer,
            hasTimeout: !!this.discussionState.speakerTimeout,
          }
        : null,
      playersCount: this.players.size,
    };
  }

  /**
   * Cleanup discussion manager
   */
  cleanup(): void {
    this.clearSpeakerTimeout();
    this.discussionState = null;
    this.players.clear();
    this.removeAllListeners();
    console.log(`🧹 DiscussionManager cleanup completed`);
  }
}
