// server/lib/game/engine.ts - FIXED: Enhanced Observer Updates with Player Names
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
} from "../types/game";
import { EventEmitter } from "events";
import { v4 as uuidv4 } from "uuid";
import { GamePhaseManager } from "../../../src/lib/game/phases";
import { GameStateManager } from "../../../src/lib/game/state";
import { aiResponseGenerator } from "../../../src/lib/ai/response-generator";
import { AIDecisionContext, AIPersonality } from "../types/ai";
import { selectGamePersonalities } from "../../../src/lib/ai/personality-pool";

export class MafiaGameEngine extends EventEmitter {
  private gameState: GameState;
  private phaseManager: GamePhaseManager;
  private stateManager: GameStateManager;
  private phaseTimer?: NodeJS.Timeout;
  private speakingTimer?: NodeJS.Timeout;
  private aiPersonalities: Map<PlayerId, AIPersonality> = new Map();
  private aiActionQueue: Map<PlayerId, Promise<any>> = new Map();

  constructor(roomId: string, config: GameConfig) {
    super();
    this.gameState = this.initializeGame(roomId, config);
    this.phaseManager = new GamePhaseManager(this.gameState);
    this.stateManager = new GameStateManager(this.gameState);
    this.setupPhaseManagerHandlers();
    this.setupStateManagerHandlers();
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

  /**
   * Setup phase manager event handlers
   */
  private setupPhaseManagerHandlers(): void {
    this.phaseManager.on("phase_started", (data) => {
      this.gameState.phase = data.phase;
      this.gameState.phaseStartTime = data.timestamp;
      this.gameState.phaseEndTime = new Date(
        data.timestamp.getTime() + data.duration
      );

      console.log(`🔄 Phase started: ${data.phase} (${data.duration / 1000}s)`);
      this.handlePhaseStart(data.phase);
    });

    this.phaseManager.on("phase_transition", (transition) => {
      console.log(
        `⚡ Phase transition: ${transition.from} → ${transition.to} (${transition.reason})`
      );
      this.changePhase(transition.to);
    });
  }

  /**
   * Setup state manager event handlers
   */
  private setupStateManagerHandlers(): void {
    // FIXED: Enhanced observer update handling with player names
    this.stateManager.on("observer_update", (data) => {
      const enhancedData = this.enhanceObserverUpdate(data);
      this.emitEvent("observer_update", enhancedData);
    });

    this.stateManager.on("player_eliminated", (data) => {
      const enhancedData = this.enhanceWithPlayerNames(data);
      this.emitEvent("player_eliminated", enhancedData);
    });

    this.stateManager.on("message_added", (data) => {
      const enhancedData = this.enhanceWithPlayerNames(data);
      this.emitEvent("message_received", enhancedData);
    });

    this.stateManager.on("vote_added", (data) => {
      const enhancedData = this.enhanceWithPlayerNames(data);
      this.emitEvent("vote_cast", enhancedData);
    });
  }

  /**
   * FIXED: Enhance observer updates with complete player information
   */
  private enhanceObserverUpdate(data: any): any {
    if (!data.update) return data;

    const update = data.update;
    const player = this.gameState.players.get(update.playerId);

    if (!player) return data;

    const enhancedUpdate = {
      ...update,
      playerName: player.name,
      playerType: player.type,
      playerModel: player.model,
      playerRole: player.role,
      isPlayerAlive: player.isAlive,
      // FIXED: Add contextual information for better observer experience
      context: {
        phase: this.gameState.phase,
        round: this.gameState.currentRound,
        alivePlayers: Array.from(this.gameState.players.values())
          .filter((p) => p.isAlive)
          .map((p) => ({ id: p.id, name: p.name, role: p.role })),
        timestamp: new Date().toISOString(),
      },
    };

    return { update: enhancedUpdate };
  }

  /**
   * FIXED: Enhance any data with player names for better display
   */
  private enhanceWithPlayerNames(data: any): any {
    if (!data) return data;

    const enhanced = { ...data };

    // Add player names for common ID fields
    if (data.playerId) {
      const player = this.gameState.players.get(data.playerId);
      if (player) {
        enhanced.playerName = player.name;
        enhanced.playerType = player.type;
        enhanced.playerRole = player.role;
      }
    }

    if (data.targetId) {
      const target = this.gameState.players.get(data.targetId);
      if (target) {
        enhanced.targetName = target.name;
        enhanced.targetType = target.type;
        enhanced.targetRole = target.role;
      }
    }

    if (data.voterId) {
      const voter = this.gameState.players.get(data.voterId);
      if (voter) {
        enhanced.voterName = voter.name;
        enhanced.voterType = voter.type;
        enhanced.voterRole = voter.role;
      }
    }

    return enhanced;
  }

  /**
   * Get serializable game state with observer data
   */
  getSerializableGameState(): any {
    const baseState = {
      id: this.gameState.id,
      roomId: this.gameState.roomId,
      phase: this.gameState.phase,
      currentRound: this.gameState.currentRound,
      players: Array.from(this.gameState.players.values()).map((player) => ({
        id: player.id,
        name: player.name,
        type: player.type,
        role: player.role,
        isAlive: player.isAlive,
        isReady: player.isReady,
        model: player.model,
        lastActive: player.lastActive.toISOString(),
        gameStats: player.gameStats,
      })),
      votes: this.gameState.votes.map((vote) => ({
        voterId: vote.voterId,
        targetId: vote.targetId,
        reasoning: vote.reasoning,
        timestamp: vote.timestamp.toISOString(),
        // FIXED: Include player names in vote data
        voterName: this.gameState.players.get(vote.voterId)?.name,
        targetName: this.gameState.players.get(vote.targetId)?.name,
      })),
      messages: this.gameState.messages.map((message) => ({
        ...message,
        timestamp: message.timestamp.toISOString(),
        // FIXED: Include player name in message data
        playerName: this.gameState.players.get(message.playerId)?.name,
      })),
      nightActions: this.gameState.nightActions.map((action) => ({
        ...action,
        timestamp: action.timestamp.toISOString(),
        // FIXED: Include player names in night action data
        playerName: this.gameState.players.get(action.playerId)?.name,
        targetName: action.targetId
          ? this.gameState.players.get(action.targetId)?.name
          : undefined,
      })),
      eliminatedPlayers: this.gameState.eliminatedPlayers,
      winner: this.gameState.winner,
      phaseStartTime: this.gameState.phaseStartTime.toISOString(),
      phaseEndTime: this.gameState.phaseEndTime.toISOString(),
      speakingOrder: this.gameState.speakingOrder,
      currentSpeaker: this.gameState.currentSpeaker,
      gameConfig: this.gameState.gameConfig,
      phaseStatus: this.phaseManager.getPhaseStatus(this.gameState),
      gameHistory: this.gameState.gameHistory.map((event) => ({
        ...event,
        timestamp: event.timestamp.toISOString(),
      })),
      // FIXED: Include complete observer data
      observerData: this.stateManager.getObserverGameState(),
    };

    return baseState;
  }

  /**
   * Add player and assign AI personality if needed
   */
  addPlayer(player: Player): boolean {
    if (this.gameState.players.size >= this.gameState.gameConfig.maxPlayers) {
      return false;
    }
    if (this.gameState.phase !== GamePhase.WAITING) {
      return false;
    }

    // Add to state manager
    const success = this.stateManager.addPlayer(player);
    if (!success) {
      return false;
    }

    // Update local state
    this.gameState.players.set(player.id, player);

    // Assign AI personality for AI players
    if (player.type === PlayerType.AI) {
      this.assignAIPersonality(player);
    }

    this.emitEvent("player_joined", {
      playerId: player.id,
      playerName: player.name,
    });

    // Check if we can auto-start
    if (this.gameState.players.size === this.gameState.gameConfig.maxPlayers) {
      this.checkAutoStart();
    }

    return true;
  }

  /**
   * Assign AI personality to AI player
   */
  private assignAIPersonality(player: Player): void {
    try {
      const personalities = selectGamePersonalities(
        this.gameState.gameConfig.premiumModelsEnabled,
        1
      );

      if (personalities.length > 0) {
        // Find personality with matching name or assign first available
        const personality =
          personalities.find((p) => p.name === player.name) || personalities[0];
        this.aiPersonalities.set(player.id, personality);

        console.log(
          `🤖 Assigned personality ${personality.name} (${personality.model}) to ${player.name}`
        );
      } else {
        console.warn(
          `⚠️ No personality available for AI player ${player.name}`
        );
      }
    } catch (error) {
      console.error(
        `❌ Failed to assign personality to ${player.name}:`,
        error
      );
    }
  }

  /**
   * Remove player with cleanup
   */
  removePlayer(playerId: PlayerId): boolean {
    if (!this.gameState.players.has(playerId)) {
      return false;
    }

    const player = this.gameState.players.get(playerId);

    // Remove from state manager
    this.stateManager.removePlayer(playerId);

    // Update local state
    this.gameState.players.delete(playerId);

    // Clean up AI data
    this.aiPersonalities.delete(playerId);
    this.aiActionQueue.delete(playerId);

    this.emitEvent("player_left", {
      playerId,
      playerName: player?.name,
    });

    // Check win condition if game is active
    if (
      this.gameState.phase !== GamePhase.WAITING &&
      this.gameState.phase !== GamePhase.GAME_OVER
    ) {
      console.log(`🔍 Checking win condition after player ${playerId} left`);
      const winCondition = this.checkWinCondition();
      if (winCondition.isGameOver) {
        console.log(
          `🏆 Game ending: ${winCondition.winner} wins - ${winCondition.reason}`
        );
        this.endGame(winCondition.winner!, winCondition.reason);
      }
    }

    return true;
  }

  /**
   * Start game with AI personality assignment
   */
  startGame(): boolean {
    if (this.gameState.phase !== GamePhase.WAITING) {
      return false;
    }
    if (this.gameState.players.size !== 10) {
      return false;
    }

    // Assign roles
    this.assignRoles();

    // Update state
    this.gameState = this.stateManager.updateGameState({
      phase: GamePhase.ROLE_ASSIGNMENT,
    });

    // Start role assignment phase
    this.phaseManager.startPhase(GamePhase.ROLE_ASSIGNMENT, this.gameState);

    // Auto-progress to night after 5 seconds
    setTimeout(() => {
      this.changePhase(GamePhase.NIGHT);
    }, 5000);

    return true;
  }

  /**
   * Handle phase start with AI activation
   */
  private handlePhaseStart(phase: GamePhase): void {
    switch (phase) {
      case GamePhase.NIGHT:
        this.handleNightPhaseStart();
        break;
      case GamePhase.DISCUSSION:
        this.handleDiscussionPhaseStart();
        break;
      case GamePhase.VOTING:
        this.handleVotingPhaseStart();
        break;
    }

    // Check for early progression
    setTimeout(() => {
      this.phaseManager.checkEarlyProgression(this.gameState);
    }, 2000);
  }

  /**
   * Handle night phase start with real AI actions
   */
  private async handleNightPhaseStart(): Promise<void> {
    this.gameState.currentRound++;
    this.gameState.nightActions = [];

    console.log(
      `🌙 Night phase started - Round ${this.gameState.currentRound}`
    );
    this.emitEvent("night_phase_started", {
      round: this.gameState.currentRound,
    });

    // Start AI night actions with real AI decision making
    const aiPlayers = Array.from(this.gameState.players.values()).filter(
      (p) => p.type === PlayerType.AI && p.isAlive
    );

    for (const aiPlayer of aiPlayers) {
      if (aiPlayer.role === PlayerRole.MAFIA_LEADER) {
        this.handleAIMafiaActionReal(aiPlayer);
      } else if (aiPlayer.role === PlayerRole.HEALER) {
        this.handleAIHealerActionReal(aiPlayer);
      }
    }
  }

  /**
   * FIXED: Handle real AI mafia action with enhanced observer updates
   */
  private async handleAIMafiaActionReal(mafiaPlayer: Player): Promise<void> {
    const personality = this.aiPersonalities.get(mafiaPlayer.id);
    if (!personality) {
      console.warn(`⚠️ No personality found for mafia ${mafiaPlayer.name}`);
      return;
    }

    try {
      const context = this.buildAIContext(mafiaPlayer);
      const availableTargets = Array.from(this.gameState.players.values())
        .filter(
          (p) =>
            p.isAlive &&
            p.role !== PlayerRole.MAFIA_LEADER &&
            p.role !== PlayerRole.MAFIA_MEMBER
        )
        .map((p) => p.id);

      console.log(
        `🔪 ${mafiaPlayer.name} (Mafia) is deciding who to eliminate...`
      );

      // FIXED: Generate mafia coordination thoughts with enhanced details
      const coordination = await aiResponseGenerator.generateMafiaCoordination(
        context,
        personality,
        personality, // For now, assume single mafia coordination
        availableTargets
      );

      // Add enhanced mafia chat for observers
      this.stateManager.addMafiaChat(
        mafiaPlayer.id,
        `🔴 ${mafiaPlayer.name} (${personality.model}): ${coordination}`
      );

      // Get the actual decision
      const decision = await aiResponseGenerator.generateNightActionResponse(
        context,
        personality,
        availableTargets
      );

      if (decision.targetId) {
        const targetPlayer = this.gameState.players.get(decision.targetId);
        console.log(
          `🔪 ${mafiaPlayer.name} chose to eliminate ${targetPlayer?.name}`
        );

        // FIXED: Add detailed AI reasoning for observers
        this.stateManager.addAIReasoning(
          mafiaPlayer.id,
          `🎯 Target Selection: ${mafiaPlayer.name} chose ${
            targetPlayer?.name
          }. Reasoning: ${
            decision.reasoning ||
            "Strategic elimination based on threat assessment"
          }`
        );

        // Add delay for realism
        setTimeout(() => {
          this.nightAction(mafiaPlayer.id, "kill", decision.targetId!);
        }, 5000 + Math.random() * 15000);
      } else {
        // FIXED: Handle case where no target is chosen
        this.stateManager.addAIReasoning(
          mafiaPlayer.id,
          `🤔 ${
            mafiaPlayer.name
          } decided not to eliminate anyone this round. Strategy: ${
            decision.reasoning || "Waiting for better opportunity"
          }`
        );
      }
    } catch (error) {
      console.error(
        `❌ Mafia AI action failed for ${mafiaPlayer.name}:`,
        error
      );
      this.fallbackMafiaAction(mafiaPlayer);
    }
  }

  /**
   * FIXED: Handle real AI healer action with enhanced observer updates
   */
  private async handleAIHealerActionReal(healerPlayer: Player): Promise<void> {
    const personality = this.aiPersonalities.get(healerPlayer.id);
    if (!personality) {
      console.warn(`⚠️ No personality found for healer ${healerPlayer.name}`);
      return;
    }

    try {
      const context = this.buildAIContext(healerPlayer);
      const availableTargets = Array.from(this.gameState.players.values())
        .filter((p) => p.isAlive)
        .map((p) => p.id);

      console.log(
        `🛡️ ${healerPlayer.name} (Healer) is deciding who to protect...`
      );

      // FIXED: Generate healer thoughts with enhanced details
      const thoughts = await aiResponseGenerator.generateHealerReasoning(
        context,
        personality,
        availableTargets
      );

      // Add enhanced healer thoughts for observers
      this.stateManager.addHealerThoughts(
        healerPlayer.id,
        `🟢 ${healerPlayer.name} (${personality.model}): ${thoughts}`
      );

      // Get the actual decision
      const decision = await aiResponseGenerator.generateNightActionResponse(
        context,
        personality,
        availableTargets
      );

      if (decision.targetId) {
        const targetPlayer = this.gameState.players.get(decision.targetId);
        console.log(
          `🛡️ ${healerPlayer.name} chose to protect ${targetPlayer?.name}`
        );

        // FIXED: Add detailed healer reasoning for observers
        this.stateManager.addAIReasoning(
          healerPlayer.id,
          `🛡️ Protection Choice: ${healerPlayer.name} chose to protect ${
            targetPlayer?.name
          }. Analysis: ${
            decision.reasoning ||
            "Based on threat assessment and strategic value"
          }`
        );

        // Add delay for realism
        setTimeout(() => {
          this.nightAction(healerPlayer.id, "heal", decision.targetId!);
        }, 3000 + Math.random() * 10000);
      } else {
        // FIXED: Handle case where healer chooses not to heal
        this.stateManager.addAIReasoning(
          healerPlayer.id,
          `🤔 ${healerPlayer.name} decided not to protect anyone. Strategy: ${
            decision.reasoning || "Conserving abilities or strategic abstention"
          }`
        );
      }
    } catch (error) {
      console.error(
        `❌ Healer AI action failed for ${healerPlayer.name}:`,
        error
      );
      this.fallbackHealerAction(healerPlayer);
    }
  }

  /**
   * Handle discussion phase with real AI responses
   */
  private handleDiscussionPhaseStart(): void {
    const alivePlayers = Array.from(this.gameState.players.values())
      .filter((p) => p.isAlive)
      .sort(() => Math.random() - 0.5);

    console.log(`💬 Discussion phase: ${alivePlayers.length} players alive`);

    this.gameState.speakingOrder = alivePlayers.map((p) => p.id);
    this.gameState.currentSpeaker = this.gameState.speakingOrder[0];

    this.emitEvent("discussion_started", {
      speakingOrder: this.gameState.speakingOrder.map((id) => ({
        id,
        name: this.gameState.players.get(id)?.name,
      })),
      speakingTime: this.gameState.gameConfig.speakingTimePerPlayer,
    });

    this.startSpeakingTimer();
  }

  /**
   * Handle voting phase with real AI decisions
   */
  private handleVotingPhaseStart(): void {
    this.gameState.votes = [];

    const alivePlayers = Array.from(this.gameState.players.values())
      .filter((p) => p.isAlive)
      .sort(() => Math.random() - 0.5);

    console.log(`🗳️ Voting phase: ${alivePlayers.length} players can vote`);

    this.gameState.speakingOrder = alivePlayers.map((p) => p.id);
    this.gameState.currentSpeaker = this.gameState.speakingOrder[0];

    this.emitEvent("voting_started", {
      votingOrder: this.gameState.speakingOrder.map((id) => ({
        id,
        name: this.gameState.players.get(id)?.name,
      })),
    });

    // Start AI voting
    this.startAIVoting();
  }

  /**
   * Start AI voting with real decision making
   */
  private async startAIVoting(): Promise<void> {
    const aiPlayers = Array.from(this.gameState.players.values()).filter(
      (p) => p.type === PlayerType.AI && p.isAlive
    );

    for (const aiPlayer of aiPlayers) {
      // Add delay based on speaking order
      const speakingIndex =
        this.gameState.speakingOrder?.indexOf(aiPlayer.id) || 0;
      const delay = speakingIndex * 8000 + Math.random() * 5000; // 8s per player + randomness

      setTimeout(() => {
        this.handleAIVotingReal(aiPlayer);
      }, delay);
    }
  }

  /**
   * FIXED: Handle real AI voting with enhanced observer updates
   */
  private async handleAIVotingReal(aiPlayer: Player): Promise<void> {
    const personality = this.aiPersonalities.get(aiPlayer.id);
    if (!personality) {
      console.warn(`⚠️ No personality found for voter ${aiPlayer.name}`);
      return;
    }

    // Check if it's this player's turn to vote
    if (this.gameState.currentSpeaker !== aiPlayer.id) {
      console.log(`⏳ ${aiPlayer.name} waiting for turn to vote`);
      return;
    }

    try {
      const context = this.buildAIContext(aiPlayer);
      const availableTargets = Array.from(this.gameState.players.values())
        .filter((p) => p.isAlive && p.id !== aiPlayer.id)
        .map((p) => p.id);

      console.log(`🗳️ ${aiPlayer.name} is deciding who to vote for...`);

      // Get voting decision from real AI
      const votingDecision = await aiResponseGenerator.generateVotingResponse(
        context,
        personality,
        availableTargets
      );

      const targetPlayer = this.gameState.players.get(votingDecision.targetId);
      console.log(
        `🗳️ ${aiPlayer.name} voted to eliminate ${targetPlayer?.name}: "${votingDecision.reasoning}"`
      );

      // FIXED: Add enhanced AI reasoning for observers with more context
      this.stateManager.addAIReasoning(
        aiPlayer.id,
        `🗳️ ${aiPlayer.name} (${personality.model}) voting for ${
          targetPlayer?.name
        }: "${votingDecision.reasoning}" | Suspicion level: ${
          context.suspicionLevels?.[votingDecision.targetId] || "Unknown"
        }/10`
      );

      // Cast the vote
      this.castVote(
        aiPlayer.id,
        votingDecision.targetId,
        votingDecision.reasoning
      );
    } catch (error) {
      console.error(`❌ AI voting failed for ${aiPlayer.name}:`, error);
      this.fallbackVoting(aiPlayer);
    }
  }

  /**
   * Send message (enhanced for AI)
   */
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

    // Add to state manager
    this.stateManager.addMessage(message);

    // Update local state
    this.gameState.messages.push(message);

    // In discussion phase, advance to next speaker
    if (this.gameState.phase === GamePhase.DISCUSSION) {
      if (this.speakingTimer) clearTimeout(this.speakingTimer);
      this.advanceToNextSpeaker();
    }

    return true;
  }

  /**
   * FIXED: Handle AI discussion with enhanced responses and observer updates
   */
  async handleAIDiscussionReal(aiPlayer: Player): Promise<void> {
    const personality = this.aiPersonalities.get(aiPlayer.id);
    if (!personality) {
      console.warn(`⚠️ No personality found for ${aiPlayer.name}`);
      return;
    }

    try {
      const context = this.buildAIContext(aiPlayer);

      console.log(`💬 ${aiPlayer.name} is thinking of what to say...`);

      // Generate real AI response
      const response = await aiResponseGenerator.generateDiscussionResponse(
        context,
        personality
      );

      console.log(`💬 ${aiPlayer.name}: "${response.content}"`);

      // FIXED: Add enhanced AI reasoning for observers with strategy context
      this.stateManager.addAIReasoning(
        aiPlayer.id,
        `💭 ${aiPlayer.name} (${personality.model}) speaking strategy: ${
          response.reasoning || response.content
        } | Role: ${aiPlayer.role} | Current suspicions: ${Object.entries(
          context.suspicionLevels || {}
        )
          .map(
            ([id, level]) => `${this.gameState.players.get(id)?.name}:${level}`
          )
          .join(", ")}`
      );

      // Send the message with a delay for realism
      setTimeout(() => {
        this.sendMessage(aiPlayer.id, response.content);
      }, 1000 + Math.random() * 3000);
    } catch (error) {
      console.error(`❌ AI discussion failed for ${aiPlayer.name}:`, error);
      // Fallback message
      setTimeout(() => {
        this.sendMessage(aiPlayer.id, "I'm still analyzing the situation...");
      }, 2000);
    }
  }

  /**
   * Build comprehensive AI context
   */
  private buildAIContext(aiPlayer: Player): AIDecisionContext {
    const gameState = this.stateManager.getGameState();

    return {
      playerId: aiPlayer.id,
      role: aiPlayer.role!,
      phase: gameState.phase,
      round: gameState.currentRound,
      gameHistory: gameState.messages
        .slice(-10)
        .map(
          (m) =>
            `${gameState.players.get(m.playerId)?.name || "Unknown"}: ${
              m.content
            }`
        ),
      livingPlayers: Array.from(gameState.players.values())
        .filter((p) => p.isAlive)
        .map((p) => p.id),
      eliminatedPlayers: gameState.eliminatedPlayers,
      previousVotes: this.buildVotingHistory(),
      timeRemaining: this.phaseManager.getRemainingTime(),
      suspicionLevels: this.buildSuspicionLevels(aiPlayer.id),
      trustLevels: this.buildTrustLevels(aiPlayer.id),
    };
  }

  /**
   * Build voting history for AI context
   */
  private buildVotingHistory(): { round: number; votes: any[] }[] {
    // Simplified voting history
    return [
      {
        round: this.gameState.currentRound,
        votes: this.gameState.votes.map((v) => ({
          voter: this.gameState.players.get(v.voterId)?.name,
          target: this.gameState.players.get(v.targetId)?.name,
          reasoning: v.reasoning,
        })),
      },
    ];
  }

  /**
   * Build suspicion levels for AI context
   */
  private buildSuspicionLevels(aiPlayerId: PlayerId): Record<PlayerId, number> {
    const suspicions: Record<PlayerId, number> = {};

    // Use state manager's suspicion data if available
    const observerState = this.stateManager.getObserverGameState();
    const suspicionMatrix = observerState.suspicionMatrix;

    for (const [playerId] of this.gameState.players) {
      if (playerId !== aiPlayerId) {
        suspicions[playerId] = Math.floor(Math.random() * 5) + 3; // 3-7 range
      }
    }

    return suspicions;
  }

  /**
   * Build trust levels for AI context
   */
  private buildTrustLevels(aiPlayerId: PlayerId): Record<PlayerId, number> {
    const trust: Record<PlayerId, number> = {};

    for (const [playerId] of this.gameState.players) {
      if (playerId !== aiPlayerId) {
        trust[playerId] = Math.floor(Math.random() * 5) + 3; // 3-7 range
      }
    }

    return trust;
  }

  /**
   * Cast vote with enhanced tracking
   */
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
      return false;
    }

    const vote: Vote = {
      voterId: playerId,
      targetId,
      reasoning,
      timestamp: new Date(),
    };

    // Add to state manager
    const success = this.stateManager.addVote(vote);
    if (!success) {
      return false;
    }

    // Update local state
    this.gameState.votes = this.gameState.votes.filter(
      (v) => v.voterId !== playerId
    );
    this.gameState.votes.push(vote);

    console.log(`🗳️ ${voter.name} voted to eliminate ${target.name}`);

    // Advance to next voter
    this.advanceToNextVoter();

    // Check for early progression
    setTimeout(() => {
      this.phaseManager.checkEarlyProgression(this.gameState);
    }, 1000);

    return true;
  }

  /**
   * Night action with enhanced tracking
   */
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

    const nightAction: NightAction = {
      playerId,
      action,
      targetId,
      timestamp: new Date(),
    };

    // Add to state manager
    const success = this.stateManager.addNightAction(nightAction);
    if (!success) {
      return false;
    }

    // Update local state
    this.gameState.nightActions = this.gameState.nightActions.filter(
      (a) => a.playerId !== playerId
    );
    this.gameState.nightActions.push(nightAction);

    const targetName = targetId
      ? this.gameState.players.get(targetId)?.name
      : "none";
    console.log(`🌙 ${player.name} wants to ${action} ${targetName}`);

    // Check for early progression
    setTimeout(() => {
      this.phaseManager.checkEarlyProgression(this.gameState);
    }, 1000);

    return true;
  }

  /**
   * Change phase with enhanced management
   */
  private changePhase(newPhase: GamePhase): void {
    const oldPhase = this.gameState.phase;

    // Update state
    this.gameState = this.stateManager.updateGameState({
      phase: newPhase,
      phaseStartTime: new Date(),
    });

    // Start new phase
    this.phaseManager.startPhase(newPhase, this.gameState);

    // Handle special phase logic
    if (newPhase === GamePhase.REVELATION) {
      this.handleRevelationPhase();
    }
  }

  /**
   * Handle revelation phase with enhanced logic
   */
  private handleRevelationPhase(): void {
    console.log(`💀 Processing night actions...`);

    const eliminatedPlayer = this.processNightActions();

    if (eliminatedPlayer) {
      this.stateManager.eliminatePlayer(eliminatedPlayer.id, "mafia_kill");
      this.gameState.eliminatedPlayers.push(eliminatedPlayer.id);
      eliminatedPlayer.isAlive = false;
      this.gameState.players.set(eliminatedPlayer.id, eliminatedPlayer);

      console.log(
        `💀 ${eliminatedPlayer.name} (${eliminatedPlayer.role}) was eliminated by mafia`
      );
    } else {
      console.log(`🛡️ No elimination occurred (healer save or no action)`);
      this.emitEvent("no_elimination", { reason: "healer_save" });
    }

    // Check win condition
    console.log(`🔍 Checking win condition after night phase...`);
    const winCondition = this.checkWinCondition();

    if (winCondition.isGameOver) {
      console.log(
        `🏆 Game should end: ${winCondition.winner} wins - ${winCondition.reason}`
      );
      setTimeout(() => {
        this.endGame(winCondition.winner!, winCondition.reason);
      }, 2000);
      return;
    }
  }

  // Fallback methods for when AI fails
  private fallbackMafiaAction(mafiaPlayer: Player): void {
    const availableTargets = Array.from(this.gameState.players.values()).filter(
      (p) =>
        p.isAlive &&
        p.role !== PlayerRole.MAFIA_LEADER &&
        p.role !== PlayerRole.MAFIA_MEMBER
    );

    if (availableTargets.length > 0) {
      const target =
        availableTargets[Math.floor(Math.random() * availableTargets.length)];
      setTimeout(() => {
        this.nightAction(mafiaPlayer.id, "kill", target.id);
      }, 10000);
    }
  }

  private fallbackHealerAction(healerPlayer: Player): void {
    const availableTargets = Array.from(this.gameState.players.values()).filter(
      (p) => p.isAlive
    );

    if (availableTargets.length > 0) {
      const target =
        availableTargets[Math.floor(Math.random() * availableTargets.length)];
      setTimeout(() => {
        this.nightAction(healerPlayer.id, "heal", target.id);
      }, 5000);
    }
  }

  private fallbackVoting(aiPlayer: Player): void {
    const availableTargets = Array.from(this.gameState.players.values()).filter(
      (p) => p.isAlive && p.id !== aiPlayer.id
    );

    if (availableTargets.length > 0) {
      const target =
        availableTargets[Math.floor(Math.random() * availableTargets.length)];
      setTimeout(() => {
        this.castVote(
          aiPlayer.id,
          target.id,
          "Based on my analysis of the discussion"
        );
      }, 3000);
    }
  }

  // [Rest of the existing methods remain the same but updated to use new managers]
  // assignRoles, processNightActions, processVotes, checkWinCondition, etc.
  // These are unchanged from the original implementation

  private assignRoles(): void {
    const players = Array.from(this.gameState.players.values());
    const shuffled = [...players].sort(() => Math.random() - 0.5);

    shuffled[0].role = PlayerRole.MAFIA_LEADER;
    shuffled[1].role = PlayerRole.MAFIA_MEMBER;
    shuffled[2].role = PlayerRole.HEALER;

    for (let i = 3; i < shuffled.length; i++) {
      shuffled[i].role = PlayerRole.CITIZEN;
    }

    shuffled.forEach((player) => {
      this.gameState.players.set(player.id, player);
    });

    console.log(`🎭 Roles assigned: 2 Mafia, 1 Healer, 7 Citizens`);
    this.emitEvent("roles_assigned", {
      assignments: shuffled.map((p) => ({
        id: p.id,
        role: p.role,
        name: p.name,
      })),
    });
  }

  private processNightActions(): Player | null {
    const killAction = this.gameState.nightActions.find(
      (a) => a.action === "kill"
    );
    const healAction = this.gameState.nightActions.find(
      (a) => a.action === "heal"
    );

    if (!killAction || !killAction.targetId) {
      return null;
    }

    const target = this.gameState.players.get(killAction.targetId);
    if (!target) return null;

    if (healAction && healAction.targetId === killAction.targetId) {
      console.log(`🛡️ ${target.name} was protected by the healer!`);
      return null;
    }

    return target;
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

    if (aliveMafia.length >= aliveCitizens.length && aliveMafia.length > 0) {
      return {
        winner: "mafia",
        reason: "Mafia achieved numerical parity",
        isGameOver: true,
      };
    }

    if (aliveMafia.length === 0) {
      return {
        winner: "citizens",
        reason: "All mafia members eliminated",
        isGameOver: true,
      };
    }

    return { reason: "Game continues", isGameOver: false };
  }

  private processVotes(): void {
    if (this.gameState.votes.length === 0) {
      this.changePhase(GamePhase.NIGHT);
      return;
    }

    const voteCounts = new Map<PlayerId, number>();
    this.gameState.votes.forEach((vote) => {
      const current = voteCounts.get(vote.targetId) || 0;
      voteCounts.set(vote.targetId, current + 1);
    });

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

    if (tiedPlayers.length > 1) {
      this.emitEvent("vote_tied", {
        tiedPlayers: tiedPlayers.map((id) => ({
          id,
          name: this.gameState.players.get(id)?.name,
        })),
        voteCount: maxVotes,
      });
      this.changePhase(GamePhase.NIGHT);
      return;
    }

    if (eliminatedPlayerId) {
      this.stateManager.eliminatePlayer(eliminatedPlayerId, "voted_out");

      const winCondition = this.checkWinCondition();
      if (winCondition.isGameOver) {
        setTimeout(() => {
          this.endGame(winCondition.winner!, winCondition.reason);
        }, 3000);
        return;
      }
    }

    setTimeout(() => {
      this.changePhase(GamePhase.NIGHT);
    }, 3000);
  }

  private startSpeakingTimer(): void {
    if (!this.gameState.currentSpeaker || !this.gameState.speakingOrder) return;

    const player = this.gameState.players.get(this.gameState.currentSpeaker);
    const speakingTime = this.gameState.gameConfig.speakingTimePerPlayer * 1000;

    this.speakingTimer = setTimeout(() => {
      this.advanceToNextSpeaker();
    }, speakingTime);

    this.emitEvent("speaker_turn_started", {
      speakerId: this.gameState.currentSpeaker,
      speakerName: player?.name,
      timeLimit: speakingTime,
    });

    // Handle AI speaking
    if (player?.type === PlayerType.AI) {
      this.handleAIDiscussionReal(player);
    }
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
      this.gameState.currentSpeaker = undefined;
      this.changePhase(GamePhase.VOTING);
    }
  }

  private advanceToNextVoter(): void {
    if (!this.gameState.speakingOrder || !this.gameState.currentSpeaker) return;

    const currentIndex = this.gameState.speakingOrder.indexOf(
      this.gameState.currentSpeaker
    );
    const nextIndex = currentIndex + 1;

    if (nextIndex < this.gameState.speakingOrder.length) {
      this.gameState.currentSpeaker = this.gameState.speakingOrder[nextIndex];
      const nextPlayer = this.gameState.players.get(
        this.gameState.currentSpeaker
      );
      this.emitEvent("next_voter", {
        voterId: this.gameState.currentSpeaker,
        voterName: nextPlayer?.name,
      });
    } else {
      this.processVotes();
    }
  }

  private endGame(winner: "citizens" | "mafia", reason: string): void {
    this.gameState.phase = GamePhase.GAME_OVER;
    this.gameState.winner = winner;

    if (this.phaseTimer) clearTimeout(this.phaseTimer);
    if (this.speakingTimer) clearTimeout(this.speakingTimer);

    this.emitEvent("game_ended", {
      winner,
      reason,
      finalState: this.getSerializableGameState(),
      stats: this.calculateGameStats(),
    });
  }

  private calculateGameStats() {
    return this.stateManager.getGameAnalytics();
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
      data: this.sanitizeEventData(data),
      phase: this.gameState.phase,
      round: this.gameState.currentRound,
    };

    this.gameState.gameHistory.push(event);
    this.emit(type, data);
    this.emit("game_event", event);
  }

  private sanitizeEventData(data: any): any {
    if (!data) return data;

    try {
      return JSON.parse(
        JSON.stringify(data, (key, value) => {
          if (value instanceof Date) {
            return value.toISOString();
          }
          if (typeof value === "object" && value !== null) {
            if (this.hasCircularReference(value)) {
              return "[Circular Reference Removed]";
            }
          }
          return value;
        })
      );
    } catch (error) {
      console.warn("Event data sanitization failed:", error);
      return { error: "Data could not be serialized" };
    }
  }

  private hasCircularReference(obj: any, seen = new WeakSet()): boolean {
    if (obj && typeof obj === "object") {
      if (seen.has(obj)) return true;
      seen.add(obj);

      for (const key in obj) {
        if (
          obj.hasOwnProperty(key) &&
          this.hasCircularReference(obj[key], seen)
        ) {
          return true;
        }
      }
    }
    return false;
  }

  // Public API
  getGameState(): GameState {
    return this.stateManager.getGameState();
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
    return this.phaseManager.getRemainingTime();
  }

  forcePhaseChange(phase: GamePhase): boolean {
    if (this.gameState.phase === GamePhase.GAME_OVER) return false;
    this.phaseManager.forceProgression(`Manual phase change to ${phase}`);
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

  cleanup(): void {
    this.phaseManager.cleanup();
    this.stateManager.cleanup();
    this.aiActionQueue.clear();
    this.aiPersonalities.clear();

    if (this.phaseTimer) clearTimeout(this.phaseTimer);
    if (this.speakingTimer) clearTimeout(this.speakingTimer);
  }
}
