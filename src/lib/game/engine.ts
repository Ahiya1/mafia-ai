// Core Game Engine for AI Mafia - Complete State Machine Implementation
import {
  GameState,
  Player,
  PlayerRole,
  GamePhase,
  PlayerId,
  Vote,
  NightAction,
  Message,
  GameEvent,
  WinCondition,
  GameConfig,
  PlayerType,
} from "../../types/game";
import { EventEmitter } from "events";
import { v4 as uuidv4 } from "uuid";

export class MafiaGameEngine extends EventEmitter {
  private gameState: GameState;
  private phaseTimer?: NodeJS.Timeout;
  private speakingTimer?: NodeJS.Timeout;

  constructor(roomId: string, config: GameConfig) {
    super();
    this.gameState = this.initializeGame(roomId, config);
  }

  private initializeGame(roomId: string, config: GameConfig): GameState {
    return {
      id: uuidv4(),
      roomId,
      phase: GamePhase.WAITING,
      currentRound: 0,
      players: new Map(),
      votes: [],
      messages: [],
      nightActions: [],
      eliminatedPlayers: [],
      phaseStartTime: new Date(),
      phaseEndTime: new Date(Date.now() + 300000), // 5 minutes waiting
      gameConfig: config,
      gameHistory: [],
    };
  }

  // Player Management
  addPlayer(player: Player): boolean {
    if (this.gameState.players.size >= this.gameState.gameConfig.maxPlayers) {
      return false;
    }
    if (this.gameState.phase !== GamePhase.WAITING) {
      return false;
    }

    this.gameState.players.set(player.id, player);
    this.emitEvent("player_joined", { playerId: player.id });

    // Start game if we have enough players
    if (this.gameState.players.size === this.gameState.gameConfig.maxPlayers) {
      this.checkAutoStart();
    }

    return true;
  }

  removePlayer(playerId: PlayerId): boolean {
    if (!this.gameState.players.has(playerId)) {
      return false;
    }

    this.gameState.players.delete(playerId);
    this.emitEvent("player_left", { playerId });

    // Check if game should end due to insufficient players
    if (
      this.gameState.phase !== GamePhase.WAITING &&
      this.gameState.phase !== GamePhase.GAME_OVER
    ) {
      const winCondition = this.checkWinCondition();
      if (winCondition.isGameOver) {
        this.endGame(winCondition.winner!, winCondition.reason);
      }
    }

    return true;
  }

  // Game Flow Control
  startGame(): boolean {
    if (this.gameState.phase !== GamePhase.WAITING) {
      return false;
    }
    if (this.gameState.players.size !== 10) {
      return false;
    }

    // Assign roles
    this.assignRoles();
    this.changePhase(GamePhase.ROLE_ASSIGNMENT);

    setTimeout(() => {
      this.changePhase(GamePhase.NIGHT);
    }, 5000); // 5 seconds to see roles

    return true;
  }

  private assignRoles(): void {
    const players = Array.from(this.gameState.players.values());
    const shuffled = [...players].sort(() => Math.random() - 0.5);

    // Fixed role distribution: 2 Mafia, 1 Healer, 7 Citizens
    shuffled[0].role = PlayerRole.MAFIA_LEADER;
    shuffled[1].role = PlayerRole.MAFIA_MEMBER;
    shuffled[2].role = PlayerRole.HEALER;

    for (let i = 3; i < shuffled.length; i++) {
      shuffled[i].role = PlayerRole.CITIZEN;
    }

    // Update players in state
    shuffled.forEach((player) => {
      this.gameState.players.set(player.id, player);
    });

    this.emitEvent("roles_assigned", {
      assignments: shuffled.map((p) => ({ id: p.id, role: p.role })),
    });
  }

  private changePhase(newPhase: GamePhase): void {
    const oldPhase = this.gameState.phase;
    this.gameState.phase = newPhase;
    this.gameState.phaseStartTime = new Date();

    // Clear existing timers
    if (this.phaseTimer) clearTimeout(this.phaseTimer);
    if (this.speakingTimer) clearTimeout(this.speakingTimer);

    // Set phase duration and end time
    let duration: number;
    switch (newPhase) {
      case GamePhase.NIGHT:
        duration = this.gameState.gameConfig.nightPhaseDuration * 1000; // 90 seconds
        this.handleNightPhase();
        break;
      case GamePhase.REVELATION:
        duration = this.gameState.gameConfig.revelationPhaseDuration * 1000; // 10 seconds
        this.handleRevelationPhase();
        break;
      case GamePhase.DISCUSSION:
        duration = this.gameState.gameConfig.discussionPhaseDuration * 1000; // 4-6 minutes
        this.handleDiscussionPhase();
        break;
      case GamePhase.VOTING:
        duration = this.gameState.gameConfig.votingPhaseDuration * 1000; // 2 minutes
        this.handleVotingPhase();
        break;
      default:
        duration = 30000; // 30 seconds default
    }

    this.gameState.phaseEndTime = new Date(Date.now() + duration);

    // Set timer for automatic phase progression
    this.phaseTimer = setTimeout(() => {
      this.handlePhaseTimeout();
    }, duration);

    this.emitEvent("phase_changed", {
      oldPhase,
      newPhase,
      endTime: this.gameState.phaseEndTime,
      round: this.gameState.currentRound,
    });
  }

  private handleNightPhase(): void {
    this.gameState.currentRound++;
    this.gameState.nightActions = [];

    // Night phase allows mafia to discuss and choose target, healer to choose protection
    this.emitEvent("night_phase_started", {
      round: this.gameState.currentRound,
    });
  }

  private handleRevelationPhase(): void {
    // Process night actions and reveal results
    const eliminatedPlayer = this.processNightActions();

    if (eliminatedPlayer) {
      this.gameState.eliminatedPlayers.push(eliminatedPlayer.id);
      eliminatedPlayer.isAlive = false;
      this.gameState.players.set(eliminatedPlayer.id, eliminatedPlayer);

      this.emitEvent("player_eliminated", {
        playerId: eliminatedPlayer.id,
        role: eliminatedPlayer.role!,
        cause: "mafia_kill",
      });
    } else {
      this.emitEvent("no_elimination", { reason: "healer_save" });
    }

    // Check win condition
    const winCondition = this.checkWinCondition();
    if (winCondition.isGameOver) {
      setTimeout(() => {
        this.endGame(winCondition.winner!, winCondition.reason);
      }, 2000);
    }
  }

  private handleDiscussionPhase(): void {
    // Set up speaking order
    const alivePlayers = Array.from(this.gameState.players.values())
      .filter((p) => p.isAlive)
      .sort(() => Math.random() - 0.5); // Randomize order

    this.gameState.speakingOrder = alivePlayers.map((p) => p.id);
    this.gameState.currentSpeaker = this.gameState.speakingOrder[0];

    this.emitEvent("discussion_started", {
      speakingOrder: this.gameState.speakingOrder,
      speakingTime: this.gameState.gameConfig.speakingTimePerPlayer,
    });

    this.startSpeakingTimer();
  }

  private startSpeakingTimer(): void {
    if (!this.gameState.currentSpeaker || !this.gameState.speakingOrder) return;

    const speakingTime = this.gameState.gameConfig.speakingTimePerPlayer * 1000;

    this.speakingTimer = setTimeout(() => {
      this.advanceToNextSpeaker();
    }, speakingTime);

    this.emitEvent("speaker_turn_started", {
      speakerId: this.gameState.currentSpeaker,
      timeLimit: speakingTime,
    });
  }

  private advanceToNextSpeaker(): void {
    if (!this.gameState.speakingOrder || !this.gameState.currentSpeaker) return;

    const currentIndex = this.gameState.speakingOrder.indexOf(
      this.gameState.currentSpeaker
    );
    const nextIndex = currentIndex + 1;

    if (nextIndex < this.gameState.speakingOrder.length) {
      this.gameState.currentSpeaker = this.gameState.speakingOrder[nextIndex];
      this.startSpeakingTimer();
    } else {
      // All players have spoken, move to voting
      this.gameState.currentSpeaker = undefined;
      this.changePhase(GamePhase.VOTING);
    }
  }

  private handleVotingPhase(): void {
    this.gameState.votes = [];

    // Set up voting order (randomized)
    const alivePlayers = Array.from(this.gameState.players.values())
      .filter((p) => p.isAlive)
      .sort(() => Math.random() - 0.5);

    this.gameState.speakingOrder = alivePlayers.map((p) => p.id);
    this.gameState.currentSpeaker = this.gameState.speakingOrder[0];

    this.emitEvent("voting_started", {
      votingOrder: this.gameState.speakingOrder,
    });
  }

  private handlePhaseTimeout(): void {
    switch (this.gameState.phase) {
      case GamePhase.NIGHT:
        this.changePhase(GamePhase.REVELATION);
        break;
      case GamePhase.REVELATION:
        this.changePhase(GamePhase.DISCUSSION);
        break;
      case GamePhase.DISCUSSION:
        this.changePhase(GamePhase.VOTING);
        break;
      case GamePhase.VOTING:
        this.processVotes();
        break;
    }
  }

  // Actions
  sendMessage(playerId: PlayerId, content: string): boolean {
    const player = this.gameState.players.get(playerId);
    if (!player || !player.isAlive) return false;

    // Phase-specific message validation
    if (this.gameState.phase === GamePhase.DISCUSSION) {
      if (this.gameState.currentSpeaker !== playerId) {
        return false; // Not this player's turn to speak
      }
    }

    const message: Message = {
      id: uuidv4(),
      playerId,
      content,
      timestamp: new Date(),
      phase: this.gameState.phase,
      messageType: "discussion",
    };

    this.gameState.messages.push(message);
    this.emitEvent("message_received", { message });

    // In discussion phase, advance to next speaker
    if (this.gameState.phase === GamePhase.DISCUSSION) {
      if (this.speakingTimer) clearTimeout(this.speakingTimer);
      this.advanceToNextSpeaker();
    }

    return true;
  }

  castVote(playerId: PlayerId, targetId: PlayerId, reasoning: string): boolean {
    const voter = this.gameState.players.get(playerId);
    const target = this.gameState.players.get(targetId);

    if (!voter || !target || !voter.isAlive || !target.isAlive) {
      return false;
    }
    if (this.gameState.phase !== GamePhase.VOTING) {
      return false;
    }
    if (playerId === targetId) {
      return false; // Can't vote for yourself
    }

    // Check if it's this player's turn to vote
    if (this.gameState.currentSpeaker !== playerId) {
      return false;
    }

    const vote: Vote = {
      voterId: playerId,
      targetId,
      reasoning,
      timestamp: new Date(),
    };

    // Remove any existing vote from this player
    this.gameState.votes = this.gameState.votes.filter(
      (v) => v.voterId !== playerId
    );
    this.gameState.votes.push(vote);

    this.emitEvent("vote_cast", { vote });

    // Advance to next voter
    this.advanceToNextVoter();

    return true;
  }

  private advanceToNextVoter(): void {
    if (!this.gameState.speakingOrder || !this.gameState.currentSpeaker) return;

    const currentIndex = this.gameState.speakingOrder.indexOf(
      this.gameState.currentSpeaker
    );
    const nextIndex = currentIndex + 1;

    if (nextIndex < this.gameState.speakingOrder.length) {
      this.gameState.currentSpeaker = this.gameState.speakingOrder[nextIndex];
      this.emitEvent("next_voter", { voterId: this.gameState.currentSpeaker });
    } else {
      // All votes cast, process results
      this.processVotes();
    }
  }

  nightAction(
    playerId: PlayerId,
    action: "kill" | "heal",
    targetId?: PlayerId
  ): boolean {
    const player = this.gameState.players.get(playerId);
    if (
      !player ||
      !player.isAlive ||
      this.gameState.phase !== GamePhase.NIGHT
    ) {
      return false;
    }

    // Validate action based on role
    if (action === "kill" && player.role !== PlayerRole.MAFIA_LEADER) {
      return false;
    }
    if (action === "heal" && player.role !== PlayerRole.HEALER) {
      return false;
    }
    if (action === "kill" && !targetId) {
      return false;
    }
    if (targetId && !this.gameState.players.get(targetId)?.isAlive) {
      return false;
    }

    const nightAction: NightAction = {
      playerId,
      action,
      targetId,
      timestamp: new Date(),
    };

    // Remove any existing action from this player
    this.gameState.nightActions = this.gameState.nightActions.filter(
      (a) => a.playerId !== playerId
    );
    this.gameState.nightActions.push(nightAction);

    this.emitEvent("night_action_received", { action: nightAction });

    return true;
  }

  // Processing Logic
  private processNightActions(): Player | null {
    const killAction = this.gameState.nightActions.find(
      (a) => a.action === "kill"
    );
    const healAction = this.gameState.nightActions.find(
      (a) => a.action === "heal"
    );

    if (!killAction || !killAction.targetId) {
      return null; // No kill attempted
    }

    const target = this.gameState.players.get(killAction.targetId);
    if (!target) return null;

    // Check if target was healed
    if (healAction && healAction.targetId === killAction.targetId) {
      return null; // Healer saved the target
    }

    return target;
  }

  private processVotes(): void {
    if (this.gameState.votes.length === 0) {
      // No votes cast, move to next night
      this.changePhase(GamePhase.NIGHT);
      return;
    }

    // Count votes
    const voteCounts = new Map<PlayerId, number>();
    this.gameState.votes.forEach((vote) => {
      const current = voteCounts.get(vote.targetId) || 0;
      voteCounts.set(vote.targetId, current + 1);
    });

    // Find player with most votes
    let maxVotes = 0;
    let eliminatedPlayerId: PlayerId | null = null;
    let tiedPlayers: PlayerId[] = [];

    voteCounts.forEach((votes, playerId) => {
      if (votes > maxVotes) {
        maxVotes = votes;
        eliminatedPlayerId = playerId;
        tiedPlayers = [playerId];
      } else if (votes === maxVotes) {
        tiedPlayers.push(playerId);
      }
    });

    // Handle ties (no elimination)
    if (tiedPlayers.length > 1) {
      this.emitEvent("vote_tied", { tiedPlayers, voteCount: maxVotes });
      this.changePhase(GamePhase.NIGHT);
      return;
    }

    // Eliminate the player
    if (eliminatedPlayerId) {
      const eliminatedPlayer = this.gameState.players.get(eliminatedPlayerId)!;
      eliminatedPlayer.isAlive = false;
      this.gameState.eliminatedPlayers.push(eliminatedPlayerId);
      this.gameState.players.set(eliminatedPlayerId, eliminatedPlayer);

      this.emitEvent("player_eliminated", {
        playerId: eliminatedPlayerId,
        role: eliminatedPlayer.role!,
        cause: "voted_out",
        voteCount: maxVotes,
      });

      // Check win condition
      const winCondition = this.checkWinCondition();
      if (winCondition.isGameOver) {
        setTimeout(() => {
          this.endGame(winCondition.winner!, winCondition.reason);
        }, 3000);
        return;
      }
    }

    // Continue to next night
    setTimeout(() => {
      this.changePhase(GamePhase.NIGHT);
    }, 3000);
  }

  private checkWinCondition(): WinCondition {
    const alivePlayers = Array.from(this.gameState.players.values()).filter(
      (p) => p.isAlive
    );
    const aliveMafia = alivePlayers.filter(
      (p) =>
        p.role === PlayerRole.MAFIA_LEADER || p.role === PlayerRole.MAFIA_MEMBER
    );
    const aliveCitizens = alivePlayers.filter(
      (p) => p.role === PlayerRole.CITIZEN || p.role === PlayerRole.HEALER
    );

    // Mafia wins if they equal or outnumber citizens
    if (aliveMafia.length >= aliveCitizens.length) {
      return {
        winner: "mafia",
        reason: "Mafia achieved numerical parity",
        isGameOver: true,
      };
    }

    // Citizens win if all mafia are eliminated
    if (aliveMafia.length === 0) {
      return {
        winner: "citizens",
        reason: "All mafia members eliminated",
        isGameOver: true,
      };
    }

    return {
      reason: "Game continues",
      isGameOver: false,
    };
  }

  private endGame(winner: "citizens" | "mafia", reason: string): void {
    this.gameState.phase = GamePhase.GAME_OVER;
    this.gameState.winner = winner;

    if (this.phaseTimer) clearTimeout(this.phaseTimer);
    if (this.speakingTimer) clearTimeout(this.speakingTimer);

    this.emitEvent("game_ended", {
      winner,
      reason,
      finalState: this.getGameState(),
      stats: this.calculateGameStats(),
    });
  }

  private calculateGameStats() {
    const players = Array.from(this.gameState.players.values());
    return {
      totalRounds: this.gameState.currentRound,
      totalMessages: this.gameState.messages.length,
      totalVotes: this.gameState.votes.length,
      aiPlayers: players.filter((p) => p.type === PlayerType.AI).length,
      humanPlayers: players.filter((p) => p.type === PlayerType.HUMAN).length,
      gameDuration: Date.now() - this.gameState.phaseStartTime.getTime(),
    };
  }

  private checkAutoStart(): void {
    const allPlayers = Array.from(this.gameState.players.values());
    const readyPlayers = allPlayers.filter((p) => p.isReady);

    if (readyPlayers.length === allPlayers.length && allPlayers.length === 10) {
      setTimeout(() => this.startGame(), 2000);
    }
  }

  private emitEvent(type: string, data: any): void {
    const event: GameEvent = {
      id: uuidv4(),
      type: type as any,
      timestamp: new Date(),
      data,
      phase: this.gameState.phase,
      round: this.gameState.currentRound,
    };

    this.gameState.gameHistory.push(event);
    this.emit(type, data);
    this.emit("game_event", event);
  }

  // Public API
  getGameState(): GameState {
    return { ...this.gameState };
  }

  getPlayerRole(playerId: PlayerId): PlayerRole | undefined {
    return this.gameState.players.get(playerId)?.role;
  }

  isPlayerAlive(playerId: PlayerId): boolean {
    return this.gameState.players.get(playerId)?.isAlive || false;
  }

  getCurrentPhase(): GamePhase {
    return this.gameState.phase;
  }

  getAlivePlayers(): Player[] {
    return Array.from(this.gameState.players.values()).filter((p) => p.isAlive);
  }

  getRemainingTime(): number {
    return Math.max(0, this.gameState.phaseEndTime.getTime() - Date.now());
  }

  // Admin functions
  forcePhaseChange(phase: GamePhase): boolean {
    if (this.gameState.phase === GamePhase.GAME_OVER) return false;
    this.changePhase(phase);
    return true;
  }

  setPlayerReady(playerId: PlayerId, ready: boolean): boolean {
    const player = this.gameState.players.get(playerId);
    if (!player) return false;

    player.isReady = ready;
    this.gameState.players.set(playerId, player);

    if (ready) {
      this.checkAutoStart();
    }

    return true;
  }
}
