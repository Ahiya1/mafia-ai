// server/lib/game/phases/voting-manager.ts - Parallel Voting System
import { EventEmitter } from "events";
import { PlayerId, Player, Vote, PlayerType } from "../../types/game";
import { contextManager } from "../context/context-manager";
import { aiContextBuilder } from "../context/ai-context-builder";
import { nameRegistry } from "../context/name-registry";
import { responseParser } from "../context/response-parser";

interface VotingState {
  alivePlayers: PlayerId[];
  votes: Map<PlayerId, Vote>;
  votingStartTime: Date;
  votingDuration: number;
  votingTimeout?: NodeJS.Timeout;
  aiVotingTimeouts: Map<PlayerId, NodeJS.Timeout>;
}

export class VotingManager extends EventEmitter {
  private gameId: string;
  private votingState: VotingState | null = null;
  private players: Map<PlayerId, Player> = new Map();
  private discussionHistory: string[] = [];

  constructor(gameId: string) {
    super();
    this.gameId = gameId;
    console.log(`🗳️ VotingManager initialized for game ${gameId}`);
  }

  /**
   * Start voting phase with parallel voting system
   */
  startVoting(
    players: Map<PlayerId, Player>,
    discussionHistory: string[] = [],
    votingDuration: number = 120000
  ): void {
    this.players = new Map(players);
    this.discussionHistory = discussionHistory;

    const alivePlayers = Array.from(players.values())
      .filter((p) => p.isAlive)
      .map((p) => p.id);

    if (alivePlayers.length < 2) {
      console.error("❌ Not enough alive players for voting");
      this.emit("voting_ended", { reason: "insufficient_players" });
      return;
    }

    this.votingState = {
      alivePlayers,
      votes: new Map(),
      votingStartTime: new Date(),
      votingDuration,
      aiVotingTimeouts: new Map(),
    };

    console.log(
      `🗳️ Voting started: ${alivePlayers.length} players, ${
        votingDuration / 1000
      }s duration`
    );

    // Set overall voting timeout
    this.votingState.votingTimeout = setTimeout(() => {
      this.endVoting("timeout");
    }, votingDuration);

    // 🆕 REVOLUTIONARY: Broadcast full discussion to all players
    this.broadcastVotingStart(alivePlayers);

    // 🆕 Start coordinated AI voting
    this.startCoordinatedAIVoting();

    this.emit("voting_started", {
      alivePlayers: alivePlayers.map((id) => ({
        id,
        name: this.players.get(id)?.name || "Unknown",
      })),
      votingDuration,
      canVoteFor: alivePlayers.map(
        (id) => this.players.get(id)?.name || "Unknown"
      ),
    });
  }

  /**
   * Handle vote from player with comprehensive validation
   */
  castVote(voterId: PlayerId, targetId: PlayerId, reasoning: string): boolean {
    if (!this.votingState) {
      console.log(`❌ No active voting for vote from ${voterId}`);
      return false;
    }

    const voter = this.players.get(voterId);
    const target = this.players.get(targetId);

    // Comprehensive validation
    if (!voter || !target) {
      console.log(
        `❌ Invalid players - voter: ${!!voter}, target: ${!!target}`
      );
      return false;
    }

    if (!voter.isAlive || !target.isAlive) {
      console.log(
        `❌ Dead players - voter alive: ${voter.isAlive}, target alive: ${target.isAlive}`
      );
      return false;
    }

    if (voterId === targetId) {
      console.log(`❌ ${voter.name} cannot vote for themselves`);
      return false;
    }

    if (!this.votingState.alivePlayers.includes(voterId)) {
      console.log(`❌ ${voter.name} not in alive players list`);
      return false;
    }

    if (!this.votingState.alivePlayers.includes(targetId)) {
      console.log(`❌ ${target.name} not in alive players list`);
      return false;
    }

    // Check for duplicate vote
    if (this.votingState.votes.has(voterId)) {
      const existingVote = this.votingState.votes.get(voterId)!;
      const existingTargetName = this.players.get(existingVote.targetId)?.name;
      console.log(`❌ ${voter.name} already voted for ${existingTargetName}`);
      return false;
    }

    // Create vote
    const vote: Vote = {
      voterId,
      targetId,
      reasoning: reasoning.trim() || "No reason provided",
      timestamp: new Date(),
    };

    // Add vote
    this.votingState.votes.set(voterId, vote);

    // Clear AI timeout for this player
    const timeout = this.votingState.aiVotingTimeouts.get(voterId);
    if (timeout) {
      clearTimeout(timeout);
      this.votingState.aiVotingTimeouts.delete(voterId);
    }

    console.log(
      `✅ Vote cast: ${voter.name} → ${target.name} ("${reasoning}")`
    );

    this.emit("vote_cast", {
      vote,
      voterName: voter.name,
      targetName: target.name,
      votesRemaining:
        this.votingState.alivePlayers.length - this.votingState.votes.size,
    });

    // Check if all votes are in
    if (this.votingState.votes.size >= this.votingState.alivePlayers.length) {
      console.log(`🗳️ All votes collected, ending voting early`);
      this.endVoting("all_votes_cast");
    }

    return true;
  }

  /**
   * 🔥 REVOLUTIONARY: Start coordinated AI voting with staggered timing
   */
  private async startCoordinatedAIVoting(): Promise<void> {
    if (!this.votingState) return;

    const aiPlayers = this.votingState.alivePlayers
      .map((id) => this.players.get(id)!)
      .filter((p) => p.type === PlayerType.AI);

    console.log(
      `🤖 Starting coordinated AI voting for ${aiPlayers.length} AI players`
    );

    // Stagger AI voting to prevent race conditions
    aiPlayers.forEach((aiPlayer, index) => {
      const delay = index * 3000 + Math.random() * 2000; // 3s base + randomness

      setTimeout(() => {
        this.triggerAIVoting(aiPlayer);
      }, delay);
    });
  }

  /**
   * 🔥 CRITICAL: Trigger AI voting with bulletproof coordination
   */
  private async triggerAIVoting(aiPlayer: Player): Promise<void> {
    if (!this.votingState) return;

    // Check if player already voted
    if (this.votingState.votes.has(aiPlayer.id)) {
      console.log(`🤖 ${aiPlayer.name} already voted, skipping`);
      return;
    }

    try {
      console.log(`🤖 Triggering AI voting for ${aiPlayer.name}`);

      // Set timeout protection (15s max)
      const timeoutId = setTimeout(() => {
        console.log(
          `⏰ AI voting timeout for ${aiPlayer.name}, using fallback`
        );
        this.fallbackAIVoting(aiPlayer);
      }, 15000);

      this.votingState.aiVotingTimeouts.set(aiPlayer.id, timeoutId);

      // Build rich voting context
      const context = aiContextBuilder.buildVotingContext(aiPlayer.id);

      // Get available targets (all alive players except self)
      const availableTargets = this.votingState.alivePlayers
        .filter((id) => id !== aiPlayer.id)
        .map((id) => nameRegistry.getName(id, this.gameId) || "Unknown");

      // 🆕 TRIGGER: AI voting with full discussion context
      const response = await contextManager.trigger(aiPlayer.id, {
        type: "voting_turn",
        data: {
          your_name: aiPlayer.name,
          phase: "voting",
          full_discussion: this.discussionHistory,
          available_targets: availableTargets,
          voting_time_remaining: Math.max(
            0,
            this.votingState.votingDuration -
              (Date.now() - this.votingState.votingStartTime.getTime())
          ),
          votes_cast_so_far: this.votingState.votes.size,
          total_voters: this.votingState.alivePlayers.length,
        },
        requiresResponse: true,
        timeoutMs: 12000,
      });

      // Clear timeout on successful response
      clearTimeout(timeoutId);
      this.votingState.aiVotingTimeouts.delete(aiPlayer.id);

      // Parse AI response with bulletproof validation
      const parsedResponse = responseParser.parseResponse(
        response.content,
        "voting",
        availableTargets
      );

      if (!parsedResponse.isValid) {
        console.warn(
          `⚠️ Invalid AI voting response from ${aiPlayer.name}:`,
          parsedResponse.errors
        );
        this.fallbackAIVoting(aiPlayer);
        return;
      }

      // Extract target from parsed response
      const votingData = parsedResponse.data as any;
      const targetName = votingData.vote_target;
      const targetId = nameRegistry.getId(targetName, this.gameId);

      if (!targetId || !this.votingState.alivePlayers.includes(targetId)) {
        console.warn(`⚠️ Invalid target ${targetName} from ${aiPlayer.name}`);
        this.fallbackAIVoting(aiPlayer);
        return;
      }

      // Cast the vote
      const success = this.castVote(
        aiPlayer.id,
        targetId,
        votingData.message || "Based on my analysis of the discussion"
      );

      if (!success) {
        console.error(
          `❌ Vote casting failed for ${aiPlayer.name}, using fallback`
        );
        this.fallbackAIVoting(aiPlayer);
      }
    } catch (error) {
      console.error(`❌ AI voting failed for ${aiPlayer.name}:`, error);

      // Clear timeout on error
      const timeout = this.votingState?.aiVotingTimeouts.get(aiPlayer.id);
      if (timeout) {
        clearTimeout(timeout);
        this.votingState?.aiVotingTimeouts.delete(aiPlayer.id);
      }

      this.fallbackAIVoting(aiPlayer);
    }
  }

  /**
   * Fallback voting for AI when response fails
   */
  private fallbackAIVoting(aiPlayer: Player): void {
    if (!this.votingState || this.votingState.votes.has(aiPlayer.id)) {
      return; // Already voted or voting ended
    }

    console.log(`🔄 Using fallback voting for ${aiPlayer.name}`);

    // Get available targets
    const availableTargets = this.votingState.alivePlayers.filter(
      (id) => id !== aiPlayer.id
    );

    if (availableTargets.length === 0) {
      console.error(
        `❌ No targets available for fallback voting: ${aiPlayer.name}`
      );
      return;
    }

    // Random selection as last resort
    const targetId =
      availableTargets[Math.floor(Math.random() * availableTargets.length)];

    setTimeout(() => {
      this.castVote(
        aiPlayer.id,
        targetId,
        "Based on my analysis of the current situation"
      );
    }, 1000);
  }

  /**
   * End voting and process results
   */
  private endVoting(reason: string): void {
    if (!this.votingState) return;

    // Clear all timeouts
    if (this.votingState.votingTimeout) {
      clearTimeout(this.votingState.votingTimeout);
    }

    this.votingState.aiVotingTimeouts.forEach((timeout) =>
      clearTimeout(timeout)
    );
    this.votingState.aiVotingTimeouts.clear();

    const votes = Array.from(this.votingState.votes.values());

    console.log(
      `🗳️ Voting ended (${reason}): ${votes.length}/${this.votingState.alivePlayers.length} votes cast`
    );

    // Process votes to determine elimination
    const eliminationResult = this.processVotes(votes);

    this.emit("voting_ended", {
      reason,
      votes,
      eliminationResult,
      votesCollected: votes.length,
      totalVoters: this.votingState.alivePlayers.length,
    });

    this.votingState = null;
  }

  /**
   * Process votes with comprehensive tie handling
   */
  private processVotes(votes: Vote[]): any {
    console.log(`📊 Processing ${votes.length} votes...`);

    if (votes.length === 0) {
      return {
        eliminated: null,
        reason: "no_votes_cast",
        voteCount: 0,
      };
    }

    // Count votes for each target
    const voteCounts = new Map<PlayerId, number>();
    votes.forEach((vote) => {
      const current = voteCounts.get(vote.targetId) || 0;
      voteCounts.set(vote.targetId, current + 1);
    });

    // Log vote breakdown
    console.log(`📊 Vote breakdown:`);
    voteCounts.forEach((count, playerId) => {
      const playerName = this.players.get(playerId)?.name || "Unknown";
      console.log(`📊 ${playerName}: ${count} vote${count === 1 ? "" : "s"}`);
    });

    // Find player(s) with most votes
    let maxVotes = 0;
    let eliminatedPlayerId: PlayerId | null = null;
    const tiedPlayers: PlayerId[] = [];

    voteCounts.forEach((voteCount, playerId) => {
      if (voteCount > maxVotes) {
        maxVotes = voteCount;
        eliminatedPlayerId = playerId;
        tiedPlayers.length = 0;
        tiedPlayers.push(playerId);
      } else if (voteCount === maxVotes) {
        tiedPlayers.push(playerId);
      }
    });

    // Handle ties
    if (tiedPlayers.length > 1) {
      const tiedPlayerNames = tiedPlayers.map(
        (id) => this.players.get(id)?.name || "Unknown"
      );
      console.log(
        `🤝 Vote tied between: ${tiedPlayerNames.join(
          ", "
        )} (${maxVotes} votes each)`
      );

      return {
        eliminated: null,
        reason: "tie",
        tiedPlayers: tiedPlayers.map((id) => ({
          id,
          name: this.players.get(id)?.name || "Unknown",
          votes: maxVotes,
        })),
        voteCount: maxVotes,
      };
    }

    // Single elimination
    if (eliminatedPlayerId) {
      const eliminatedPlayer = this.players.get(eliminatedPlayerId);
      console.log(
        `🏆 ${
          eliminatedPlayer?.name || "Unknown"
        } eliminated with ${maxVotes} votes`
      );

      return {
        eliminated: {
          id: eliminatedPlayerId,
          name: eliminatedPlayer?.name || "Unknown",
          role: eliminatedPlayer?.role || "unknown",
        },
        reason: "majority_vote",
        voteCount: maxVotes,
        totalVotes: votes.length,
      };
    }

    return {
      eliminated: null,
      reason: "no_clear_majority",
      voteCount: 0,
    };
  }

  /**
   * Broadcast voting start with full discussion context
   */
  private broadcastVotingStart(alivePlayers: PlayerId[]): void {
    const votingData = {
      phase: "voting",
      alive_players: alivePlayers.map(
        (id) => nameRegistry.getName(id, this.gameId) || "Unknown"
      ),
      voting_duration: this.votingState!.votingDuration,
      can_vote_for: alivePlayers.map(
        (id) => nameRegistry.getName(id, this.gameId) || "Unknown"
      ),
    };

    // 🆕 PUSH: Full discussion + voting context to all players
    contextManager.push({
      type: "full_discussion",
      data: {
        ...votingData,
        full_discussion_history: this.discussionHistory,
        phase_description: "Vote to eliminate someone you suspect is mafia",
      },
    });

    // 🆕 UPDATE: Each player gets personalized voting context
    alivePlayers.forEach((playerId) => {
      const playerName =
        nameRegistry.getName(playerId, this.gameId) || "Unknown";
      const otherPlayers = alivePlayers
        .filter((id) => id !== playerId)
        .map((id) => nameRegistry.getName(id, this.gameId) || "Unknown");

      contextManager.update(playerId, {
        type: "game_state",
        data: {
          ...votingData,
          your_name: playerName,
          you_can_vote_for: otherPlayers,
          voting_instructions: "Choose carefully - your vote matters!",
        },
      });
    });
  }

  /**
   * Force end voting (admin control)
   */
  forceEndVoting(): void {
    this.endVoting("forced_end");
  }

  /**
   * Get current voting status
   */
  getVotingStatus(): any {
    if (!this.votingState) {
      return { active: false };
    }

    const timeRemaining = Math.max(
      0,
      this.votingState.votingDuration -
        (Date.now() - this.votingState.votingStartTime.getTime())
    );

    return {
      active: true,
      votesCollected: this.votingState.votes.size,
      totalVoters: this.votingState.alivePlayers.length,
      timeRemaining,
      progress:
        this.votingState.votes.size / this.votingState.alivePlayers.length,
      votes: Array.from(this.votingState.votes.values()).map((vote) => ({
        voterId: vote.voterId,
        voterName: this.players.get(vote.voterId)?.name || "Unknown",
        targetId: vote.targetId,
        targetName: this.players.get(vote.targetId)?.name || "Unknown",
        reasoning: vote.reasoning,
        timestamp: vote.timestamp.toISOString(),
      })),
    };
  }

  /**
   * Check if voting can end early
   */
  canEndEarly(): boolean {
    if (!this.votingState) return false;
    return this.votingState.votes.size >= this.votingState.alivePlayers.length;
  }

  /**
   * Get debug information
   */
  getDebugInfo(): any {
    return {
      gameId: this.gameId,
      votingState: this.votingState
        ? {
            alivePlayersCount: this.votingState.alivePlayers.length,
            votesCollected: this.votingState.votes.size,
            votingDuration: this.votingState.votingDuration,
            aiTimeoutsActive: this.votingState.aiVotingTimeouts.size,
            hasMainTimeout: !!this.votingState.votingTimeout,
          }
        : null,
      discussionHistoryLength: this.discussionHistory.length,
      playersCount: this.players.size,
    };
  }

  /**
   * Cleanup voting manager
   */
  cleanup(): void {
    if (this.votingState) {
      if (this.votingState.votingTimeout) {
        clearTimeout(this.votingState.votingTimeout);
      }
      this.votingState.aiVotingTimeouts.forEach((timeout) =>
        clearTimeout(timeout)
      );
      this.votingState = null;
    }

    this.players.clear();
    this.discussionHistory = [];
    this.removeAllListeners();
    console.log(`🧹 VotingManager cleanup completed`);
  }
}
