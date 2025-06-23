// src/lib/game/phases.ts - Enhanced Phase Management for AI Mafia
import { EventEmitter } from "events";
import {
  GamePhase,
  PlayerRole,
  PlayerId,
  GameState,
  Player,
  Vote,
  NightAction,
} from "../../types/game";

export interface PhaseConfig {
  duration: number; // milliseconds
  canSkipEarly: boolean;
  requiredActions: string[];
  autoProgressConditions: string[];
}

export interface PhaseTransition {
  from: GamePhase;
  to: GamePhase;
  reason: string;
  timestamp: Date;
  actionsCompleted?: string[];
}

export class GamePhaseManager extends EventEmitter {
  private currentPhase: GamePhase;
  private phaseStartTime: Date;
  private phaseTimer?: NodeJS.Timeout;
  private phaseConfig: Record<GamePhase, PhaseConfig>;
  private gameState: GameState;

  constructor(gameState: GameState) {
    super();
    this.gameState = gameState;
    this.currentPhase = gameState.phase;
    this.phaseStartTime = gameState.phaseStartTime;

    this.phaseConfig = {
      [GamePhase.WAITING]: {
        duration: 300000, // 5 minutes
        canSkipEarly: true,
        requiredActions: ["all_players_ready"],
        autoProgressConditions: ["all_players_ready", "room_full"],
      },
      [GamePhase.ROLE_ASSIGNMENT]: {
        duration: 5000, // 5 seconds
        canSkipEarly: false,
        requiredActions: [],
        autoProgressConditions: ["timer_complete"],
      },
      [GamePhase.NIGHT]: {
        duration: 90000, // 90 seconds
        canSkipEarly: true,
        requiredActions: ["mafia_action", "healer_action"],
        autoProgressConditions: ["all_night_actions_complete"],
      },
      [GamePhase.REVELATION]: {
        duration: 10000, // 10 seconds
        canSkipEarly: false,
        requiredActions: [],
        autoProgressConditions: ["timer_complete"],
      },
      [GamePhase.DISCUSSION]: {
        duration: 300000, // 5 minutes (will be dynamic based on player count)
        canSkipEarly: true,
        requiredActions: ["all_players_speak"],
        autoProgressConditions: ["all_players_spoke", "early_skip_vote"],
      },
      [GamePhase.VOTING]: {
        duration: 120000, // 2 minutes
        canSkipEarly: true,
        requiredActions: ["all_votes_cast"],
        autoProgressConditions: ["all_votes_complete"],
      },
      [GamePhase.GAME_OVER]: {
        duration: 0,
        canSkipEarly: false,
        requiredActions: [],
        autoProgressConditions: [],
      },
    };
  }

  /**
   * Start a new phase with automatic progression logic
   */
  startPhase(newPhase: GamePhase, gameState: GameState): void {
    const oldPhase = this.currentPhase;
    this.currentPhase = newPhase;
    this.phaseStartTime = new Date();
    this.gameState = gameState;

    // Clear existing timer
    if (this.phaseTimer) {
      clearTimeout(this.phaseTimer);
    }

    const config = this.phaseConfig[newPhase];
    let duration = config.duration;

    // Dynamic duration adjustments
    if (newPhase === GamePhase.DISCUSSION) {
      duration = this.calculateDiscussionDuration(gameState);
    } else if (newPhase === GamePhase.NIGHT) {
      duration = this.calculateNightDuration(gameState);
    }

    console.log(
      `🔄 Phase started: ${newPhase} (${duration / 1000}s, can skip: ${
        config.canSkipEarly
      })`
    );

    // Set up phase timer
    this.phaseTimer = setTimeout(() => {
      this.handlePhaseTimeout(newPhase);
    }, duration);

    // Start monitoring for early completion
    if (config.canSkipEarly) {
      this.startEarlyCompletionMonitoring(newPhase);
    }

    // Emit phase change event
    this.emit("phase_started", {
      phase: newPhase,
      oldPhase,
      duration,
      canSkipEarly: config.canSkipEarly,
      requiredActions: config.requiredActions,
      timestamp: this.phaseStartTime,
    });
  }

  /**
   * Check if phase can progress early based on completed actions
   */
  checkEarlyProgression(gameState: GameState): boolean {
    this.gameState = gameState;
    const config = this.phaseConfig[this.currentPhase];

    if (!config.canSkipEarly) {
      return false;
    }

    const completionStatus = this.checkPhaseCompletion(
      this.currentPhase,
      gameState
    );

    if (completionStatus.canProgress) {
      console.log(
        `⚡ Early progression triggered for ${this.currentPhase}: ${completionStatus.reason}`
      );
      this.progressToNextPhase(
        completionStatus.reason,
        completionStatus.actionsCompleted
      );
      return true;
    }

    return false;
  }

  /**
   * Force progression to next phase
   */
  forceProgression(reason: string = "Manual override"): void {
    console.log(`🔧 Force progressing from ${this.currentPhase}: ${reason}`);
    this.progressToNextPhase(reason, []);
  }

  /**
   * Check what actions are still needed for phase completion
   */
  getPhaseStatus(gameState: GameState): {
    phase: GamePhase;
    timeRemaining: number;
    completionStatus: any;
    nextActions: string[];
  } {
    this.gameState = gameState;
    const timeRemaining = this.getRemainingTime();
    const completionStatus = this.checkPhaseCompletion(
      this.currentPhase,
      gameState
    );

    return {
      phase: this.currentPhase,
      timeRemaining,
      completionStatus,
      nextActions: this.getNextRequiredActions(gameState),
    };
  }

  /**
   * Calculate remaining time in current phase
   */
  getRemainingTime(): number {
    const config = this.phaseConfig[this.currentPhase];
    let duration = config.duration;

    if (this.currentPhase === GamePhase.DISCUSSION) {
      duration = this.calculateDiscussionDuration(this.gameState);
    }

    const elapsed = Date.now() - this.phaseStartTime.getTime();
    return Math.max(0, duration - elapsed);
  }

  /**
   * Start monitoring for early completion conditions
   */
  private startEarlyCompletionMonitoring(phase: GamePhase): void {
    const checkInterval = setInterval(() => {
      if (this.currentPhase !== phase) {
        clearInterval(checkInterval);
        return;
      }

      const completionStatus = this.checkPhaseCompletion(phase, this.gameState);
      if (completionStatus.canProgress) {
        clearInterval(checkInterval);
        console.log(`⚡ Auto-progression: ${completionStatus.reason}`);
        this.progressToNextPhase(
          completionStatus.reason,
          completionStatus.actionsCompleted
        );
      }
    }, 2000); // Check every 2 seconds
  }

  /**
   * Check phase completion conditions
   */
  private checkPhaseCompletion(
    phase: GamePhase,
    gameState: GameState
  ): {
    canProgress: boolean;
    reason: string;
    actionsCompleted: string[];
    progress: number;
  } {
    switch (phase) {
      case GamePhase.NIGHT:
        return this.checkNightPhaseCompletion(gameState);
      case GamePhase.DISCUSSION:
        return this.checkDiscussionPhaseCompletion(gameState);
      case GamePhase.VOTING:
        return this.checkVotingPhaseCompletion(gameState);
      case GamePhase.WAITING:
        return this.checkWaitingPhaseCompletion(gameState);
      default:
        return {
          canProgress: false,
          reason: "Phase does not support early completion",
          actionsCompleted: [],
          progress: 0,
        };
    }
  }

  /**
   * Check night phase completion (all night actions submitted)
   */
  private checkNightPhaseCompletion(gameState: GameState): any {
    const alivePlayers = Array.from(gameState.players.values()).filter(
      (p) => p.isAlive
    );
    const mafiaLeader = alivePlayers.find(
      (p) => p.role === PlayerRole.MAFIA_LEADER
    );
    const healer = alivePlayers.find((p) => p.role === PlayerRole.HEALER);

    const nightActions = gameState.nightActions;
    const mafiaActionSubmitted =
      !mafiaLeader ||
      nightActions.some(
        (a) => a.playerId === mafiaLeader.id && a.action === "kill"
      );
    const healerActionSubmitted =
      !healer ||
      nightActions.some((a) => a.playerId === healer.id && a.action === "heal");

    const actionsCompleted = [];
    let progress = 0;

    if (mafiaActionSubmitted) {
      actionsCompleted.push("mafia_action");
      progress += 0.5;
    }
    if (healerActionSubmitted) {
      actionsCompleted.push("healer_action");
      progress += 0.5;
    }

    const canProgress = mafiaActionSubmitted && healerActionSubmitted;

    return {
      canProgress,
      reason: canProgress
        ? "All night actions submitted"
        : `Waiting for: ${!mafiaActionSubmitted ? "Mafia" : ""}${
            !mafiaActionSubmitted && !healerActionSubmitted ? ", " : ""
          }${!healerActionSubmitted ? "Healer" : ""}`,
      actionsCompleted,
      progress,
    };
  }

  /**
   * Check discussion phase completion (all players spoke)
   */
  private checkDiscussionPhaseCompletion(gameState: GameState): any {
    const alivePlayers = Array.from(gameState.players.values()).filter(
      (p) => p.isAlive
    );
    const speakingOrder = gameState.speakingOrder || [];
    const currentSpeaker = gameState.currentSpeaker;

    // If no speaking order set, can't complete early
    if (speakingOrder.length === 0) {
      return {
        canProgress: false,
        reason: "Speaking order not initialized",
        actionsCompleted: [],
        progress: 0,
      };
    }

    // Calculate progress based on speaking order
    const currentIndex = currentSpeaker
      ? speakingOrder.indexOf(currentSpeaker)
      : speakingOrder.length;
    const progress = currentIndex / speakingOrder.length;

    // All players have spoken if we're past the last speaker
    const allSpoke = currentIndex >= speakingOrder.length || !currentSpeaker;

    return {
      canProgress: allSpoke,
      reason: allSpoke
        ? "All players have spoken"
        : `${speakingOrder.length - currentIndex} players remaining`,
      actionsCompleted: allSpoke ? ["all_players_spoke"] : [],
      progress,
    };
  }

  /**
   * Check voting phase completion (all votes cast)
   */
  private checkVotingPhaseCompletion(gameState: GameState): any {
    const alivePlayers = Array.from(gameState.players.values()).filter(
      (p) => p.isAlive
    );
    const votes = gameState.votes;

    // Check if all alive players have voted
    const votersWhoVoted = new Set(votes.map((v) => v.voterId));
    const playersWhoNeedToVote = alivePlayers.filter(
      (p) => !votersWhoVoted.has(p.id)
    );

    const progress = votersWhoVoted.size / alivePlayers.length;
    const allVoted = playersWhoNeedToVote.length === 0;

    return {
      canProgress: allVoted,
      reason: allVoted
        ? "All votes have been cast"
        : `${playersWhoNeedToVote.length} players still need to vote`,
      actionsCompleted: allVoted ? ["all_votes_cast"] : [],
      progress,
    };
  }

  /**
   * Check waiting phase completion (all players ready)
   */
  private checkWaitingPhaseCompletion(gameState: GameState): any {
    const players = Array.from(gameState.players.values());
    const readyPlayers = players.filter((p) => p.isReady);

    const progress = readyPlayers.length / players.length;
    const allReady =
      readyPlayers.length === players.length && players.length >= 10;

    return {
      canProgress: allReady,
      reason: allReady
        ? "All players are ready"
        : `${players.length - readyPlayers.length} players not ready`,
      actionsCompleted: allReady ? ["all_players_ready"] : [],
      progress,
    };
  }

  /**
   * Calculate dynamic discussion duration based on player count and complexity
   */
  private calculateDiscussionDuration(gameState: GameState): number {
    const alivePlayers = Array.from(gameState.players.values()).filter(
      (p) => p.isAlive
    );
    const baseTimePerPlayer = gameState.gameConfig.speakingTimePerPlayer * 1000; // Convert to ms

    // Add buffer time for transitions between speakers
    const bufferTime = alivePlayers.length * 3000; // 3 seconds buffer per player

    return alivePlayers.length * baseTimePerPlayer + bufferTime;
  }

  /**
   * Calculate dynamic night duration based on game complexity
   */
  private calculateNightDuration(gameState: GameState): number {
    const baseNightDuration = gameState.gameConfig.nightPhaseDuration * 1000;

    // Reduce time in later rounds as players get familiar
    const roundMultiplier = Math.max(0.7, 1 - gameState.currentRound * 0.05);

    return Math.floor(baseNightDuration * roundMultiplier);
  }

  /**
   * Get next required actions for current phase
   */
  private getNextRequiredActions(gameState: GameState): string[] {
    switch (this.currentPhase) {
      case GamePhase.NIGHT:
        const nightStatus = this.checkNightPhaseCompletion(gameState);
        const needed = [];
        if (!nightStatus.actionsCompleted.includes("mafia_action")) {
          needed.push("Mafia needs to choose target");
        }
        if (!nightStatus.actionsCompleted.includes("healer_action")) {
          needed.push("Healer needs to choose protection");
        }
        return needed;

      case GamePhase.DISCUSSION:
        const discussionStatus = this.checkDiscussionPhaseCompletion(gameState);
        if (gameState.currentSpeaker) {
          const player = gameState.players.get(gameState.currentSpeaker);
          return [`${player?.name || "Current player"} is speaking`];
        }
        return ["Waiting for discussion to begin"];

      case GamePhase.VOTING:
        const votingStatus = this.checkVotingPhaseCompletion(gameState);
        const alivePlayers = Array.from(gameState.players.values()).filter(
          (p) => p.isAlive
        );
        const votersWhoVoted = new Set(gameState.votes.map((v) => v.voterId));
        const needToVote = alivePlayers.filter(
          (p) => !votersWhoVoted.has(p.id)
        );
        return needToVote.map((p) => `${p.name} needs to vote`);

      default:
        return [];
    }
  }

  /**
   * Handle phase timeout
   */
  private handlePhaseTimeout(phase: GamePhase): void {
    if (this.currentPhase !== phase) {
      return; // Phase already changed
    }

    console.log(`⏰ Phase timeout: ${phase}`);
    this.progressToNextPhase("Time limit reached", []);
  }

  /**
   * Progress to the next logical phase
   */
  private progressToNextPhase(
    reason: string,
    actionsCompleted: string[]
  ): void {
    const nextPhase = this.getNextPhase(this.currentPhase);

    if (nextPhase) {
      const transition: PhaseTransition = {
        from: this.currentPhase,
        to: nextPhase,
        reason,
        timestamp: new Date(),
        actionsCompleted,
      };

      this.emit("phase_transition", transition);
      console.log(
        `🔄 Phase transition: ${this.currentPhase} → ${nextPhase} (${reason})`
      );
    }
  }

  /**
   * Determine next phase in the game flow
   */
  private getNextPhase(currentPhase: GamePhase): GamePhase | null {
    switch (currentPhase) {
      case GamePhase.WAITING:
        return GamePhase.ROLE_ASSIGNMENT;
      case GamePhase.ROLE_ASSIGNMENT:
        return GamePhase.NIGHT;
      case GamePhase.NIGHT:
        return GamePhase.REVELATION;
      case GamePhase.REVELATION:
        return GamePhase.DISCUSSION;
      case GamePhase.DISCUSSION:
        return GamePhase.VOTING;
      case GamePhase.VOTING:
        return GamePhase.NIGHT; // Loop back to night (unless game ends)
      case GamePhase.GAME_OVER:
        return null;
      default:
        return null;
    }
  }

  /**
   * Clean up phase manager
   */
  cleanup(): void {
    if (this.phaseTimer) {
      clearTimeout(this.phaseTimer);
    }
    this.removeAllListeners();
  }

  /**
   * Get phase configuration
   */
  getPhaseConfig(phase: GamePhase): PhaseConfig {
    return this.phaseConfig[phase];
  }

  /**
   * Update phase duration (for admin controls)
   */
  updatePhaseDuration(phase: GamePhase, duration: number): void {
    this.phaseConfig[phase].duration = duration;
    console.log(`⚙️ Updated ${phase} duration to ${duration}ms`);
  }
}

// Helper functions for phase management
export function isPhaseSkippable(phase: GamePhase): boolean {
  return (
    phase === GamePhase.NIGHT ||
    phase === GamePhase.DISCUSSION ||
    phase === GamePhase.VOTING
  );
}

export function getPhaseDisplayName(phase: GamePhase): string {
  const names: Record<GamePhase, string> = {
    [GamePhase.WAITING]: "Waiting for Players",
    [GamePhase.ROLE_ASSIGNMENT]: "Role Assignment",
    [GamePhase.NIGHT]: "Night Phase",
    [GamePhase.REVELATION]: "Morning Revelation",
    [GamePhase.DISCUSSION]: "Discussion",
    [GamePhase.VOTING]: "Voting",
    [GamePhase.GAME_OVER]: "Game Over",
  };
  return names[phase] || phase;
}

export function getPhaseIcon(phase: GamePhase): string {
  const icons: Record<GamePhase, string> = {
    [GamePhase.WAITING]: "⏳",
    [GamePhase.ROLE_ASSIGNMENT]: "🎭",
    [GamePhase.NIGHT]: "🌙",
    [GamePhase.REVELATION]: "☀️",
    [GamePhase.DISCUSSION]: "💬",
    [GamePhase.VOTING]: "🗳️",
    [GamePhase.GAME_OVER]: "🏆",
  };
  return icons[phase] || "❓";
}
