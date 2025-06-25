// server/lib/types/game.ts - Enhanced with new architecture types
export type PlayerId = string;
export type RoomId = string;
export type GameId = string;

export enum PlayerRole {
  MAFIA_LEADER = "mafia_leader",
  MAFIA_MEMBER = "mafia_member",
  HEALER = "healer",
  CITIZEN = "citizen",
}

export enum GamePhase {
  WAITING = "waiting",
  ROLE_ASSIGNMENT = "role_assignment",
  NIGHT = "night",
  REVELATION = "revelation",
  DISCUSSION = "discussion",
  VOTING = "voting",
  GAME_OVER = "game_over",
}

export enum PlayerType {
  HUMAN = "human",
  AI = "ai",
}

export enum AIModel {
  // Premium Models
  CLAUDE_SONNET_4 = "claude-sonnet-4",
  GPT_4O = "gpt-4o",
  GEMINI_2_5_PRO = "gemini-2.5-pro",
  // Free Models
  CLAUDE_HAIKU = "claude-haiku",
  GPT_4O_MINI = "gpt-4o-mini",
  GEMINI_2_5_FLASH = "gemini-2.5-flash",
}

export interface Player {
  id: PlayerId;
  name: string;
  type: PlayerType;
  role?: PlayerRole;
  isAlive: boolean;
  isReady: boolean;
  model?: AIModel; // Only for AI players
  votedFor?: PlayerId;
  lastActive: Date;
  gameStats: {
    gamesPlayed: number;
    wins: number;
    accurateVotes: number;
    aiDetectionRate: number;
  };
}

export interface Vote {
  voterId: PlayerId;
  targetId: PlayerId;
  reasoning: string;
  timestamp: Date;
}

export interface Message {
  id: string;
  playerId: PlayerId;
  content: string;
  timestamp: Date;
  phase: GamePhase;
  isSystemMessage?: boolean;
  messageType?: "discussion" | "vote" | "action" | "system";
}

export interface NightAction {
  playerId: PlayerId;
  action: "kill" | "heal" | "protect";
  targetId?: PlayerId;
  timestamp: Date;
}

export interface GameState {
  id: GameId;
  roomId: RoomId;
  phase: GamePhase;
  currentRound: number;
  players: Map<PlayerId, Player>;
  votes: Vote[];
  messages: Message[];
  nightActions: NightAction[];
  eliminatedPlayers: PlayerId[];
  winner?: "citizens" | "mafia";
  phaseStartTime: Date;
  phaseEndTime: Date;
  speakingOrder?: PlayerId[];
  currentSpeaker?: PlayerId;
  gameConfig: GameConfig;
  gameHistory: GameEvent[];
}

export interface GameConfig {
  maxPlayers: number;
  aiCount: number;
  humanCount: number;
  nightPhaseDuration: number; // 90 seconds
  discussionPhaseDuration: number; // 4-6 minutes
  votingPhaseDuration: number; // 2 minutes
  revelationPhaseDuration: number; // 10 seconds
  speakingTimePerPlayer: number; // 30-45 seconds
  allowSpectators: boolean;
  premiumModelsEnabled: boolean;
}

export interface GameEvent {
  id: string;
  type:
    | "phase_change"
    | "player_eliminated"
    | "vote_cast"
    | "message_sent"
    | "action_taken";
  timestamp: Date;
  playerId?: PlayerId;
  data: any;
  phase: GamePhase;
  round: number;
}

// 🆕 NEW: Context Operation Types for Revolutionary Architecture
export interface ContextOperation {
  operationType: "trigger" | "update" | "push";
  targetPlayerId?: PlayerId; // undefined for push operations
  timestamp: Date;
}

export interface TemporaryContext extends ContextOperation {
  operationType: "trigger";
  targetPlayerId: PlayerId;
  contextType: "discussion_turn" | "voting_turn" | "night_action";
  data: any;
  requiresResponse: boolean;
  timeoutMs?: number;
}

export interface PersistentContext extends ContextOperation {
  operationType: "update";
  targetPlayerId: PlayerId;
  contextType: "role_assignment" | "player_status" | "game_state";
  data: any;
}

export interface BroadcastContext extends ContextOperation {
  operationType: "push";
  contextType:
    | "phase_change"
    | "elimination_result"
    | "full_discussion"
    | "game_end";
  data: any;
  targetedPlayers?: PlayerId[]; // if undefined, broadcasts to all
}

// 🆕 NEW: Name Registry Types
export interface NameMapping {
  gameId: GameId;
  realName: string;
  realId: PlayerId;
  gameName: string;
  playerType: PlayerType;
  assignedAt: Date;
}

export interface NameRegistryStats {
  totalMappings: number;
  humanMappings: number;
  aiMappings: number;
  gamesActive: number;
}

// 🆕 NEW: Orchestrator Interface (matches current engine API)
export interface GameOrchestratorInterface {
  // Core game management
  addPlayer(player: Player): boolean;
  removePlayer(playerId: PlayerId): boolean;
  startGame(): boolean;

  // Player actions
  sendMessage(playerId: PlayerId, content: string): boolean;
  castVote(playerId: PlayerId, targetId: PlayerId, reasoning: string): boolean;
  nightAction(
    playerId: PlayerId,
    action: "kill" | "heal",
    targetId?: PlayerId
  ): boolean;

  // State access
  getGameState(): GameState;
  getPlayerRole(playerId: PlayerId): PlayerRole | undefined;
  isPlayerAlive(playerId: PlayerId): boolean;
  getCurrentPhase(): GamePhase;
  getAlivePlayers(): Player[];

  // Admin controls
  forcePhaseChange(phase: GamePhase): boolean;
  setPlayerReady(playerId: PlayerId, ready: boolean): boolean;

  // Lifecycle
  cleanup(): void;
}

// 🆕 NEW: Response Parsing Types
export interface ParsedResponse {
  isValid: boolean;
  responseType: "discussion" | "voting" | "night_action";
  data: any;
  errors: string[];
  parsingMethod: string;
  confidence: number;
}

export interface DiscussionResponse {
  message: string;
}

export interface VotingResponse {
  message: string;
  vote_target: string;
}

export interface NightActionResponse {
  action: "kill" | "heal";
  target: string;
  reasoning: string;
}

// Game action types that can be sent through WebSocket
export type GameAction =
  | { type: "JOIN_ROOM"; roomId: RoomId; playerId: PlayerId }
  | { type: "LEAVE_ROOM"; playerId: PlayerId }
  | { type: "START_GAME"; playerId: PlayerId }
  | { type: "SEND_MESSAGE"; playerId: PlayerId; content: string }
  | {
      type: "CAST_VOTE";
      playerId: PlayerId;
      targetId: PlayerId;
      reasoning: string;
    }
  | {
      type: "NIGHT_ACTION";
      playerId: PlayerId;
      action: "kill" | "heal";
      targetId?: PlayerId;
    }
  | { type: "READY_UP"; playerId: PlayerId }
  | { type: "REQUEST_PHASE_SKIP"; playerId: PlayerId };

export type GameResponse =
  | { type: "GAME_STATE_UPDATE"; gameState: GameState }
  | { type: "PLAYER_JOINED"; player: Player }
  | { type: "PLAYER_LEFT"; playerId: PlayerId }
  | { type: "PHASE_CHANGED"; phase: GamePhase; endTime: Date }
  | { type: "MESSAGE_RECEIVED"; message: Message }
  | { type: "VOTE_RECEIVED"; vote: Vote }
  | { type: "PLAYER_ELIMINATED"; playerId: PlayerId; role: PlayerRole }
  | { type: "GAME_ENDED"; winner: "citizens" | "mafia"; finalState: GameState }
  | { type: "ERROR"; message: string; code?: string };

// Win condition checking
export interface WinCondition {
  winner?: "citizens" | "mafia";
  reason: string;
  isGameOver: boolean;
}
