// Core game types for AI Mafia
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

export interface Room {
  id: RoomId;
  name: string;
  code: string; // 6-digit room code
  hostId: PlayerId;
  players: PlayerId[];
  maxPlayers: number;
  isPrivate: boolean;
  gameState?: GameState;
  createdAt: Date;
  settings: RoomSettings;
}

export interface RoomSettings {
  allowSpectators: boolean;
  premiumModelsOnly: boolean;
  customAICount?: number;
  timeMultiplier: number; // For shorter/longer games
  difficulty: "easy" | "normal" | "hard";
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

// Analytics and Research Data Types
export interface PlayerBehaviorData {
  playerId: PlayerId;
  gameId: GameId;
  aiDetectionAccuracy: number;
  votingPatterns: VotingPattern[];
  communicationStyle: CommunicationAnalysis;
  trustNetworkPosition: number;
  strategicDecisions: StrategicDecision[];
}

export interface VotingPattern {
  round: number;
  targetId: PlayerId;
  reasoning: string;
  followedCrowd: boolean;
  changedVote: boolean;
  confidenceLevel: number;
}

export interface CommunicationAnalysis {
  averageMessageLength: number;
  sentimentScore: number;
  aggressionLevel: number;
  leadershipIndicators: number;
  responseLatency: number[];
}

export interface StrategicDecision {
  round: number;
  phase: GamePhase;
  decision: string;
  outcome: "positive" | "negative" | "neutral";
  riskLevel: number;
}
