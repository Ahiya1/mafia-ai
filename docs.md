# 🕵️‍♂️ AI Mafia Frontend Development Documentation

## Table of Contents

1. [Quick Start](#quick-start)
2. [API Reference](#api-reference)
3. [WebSocket Events](#websocket-events)
4. [Game Flow & Phases](#game-flow--phases)
5. [Data Models](#data-models)
6. [Frontend Architecture](#frontend-architecture)
7. [Component Guide](#component-guide)
8. [State Management](#state-management)
9. [UI/UX Guidelines](#uiux-guidelines)
10. [Integration Examples](#integration-examples)

---

## Quick Start

### Backend Server

- **Base URL**: `http://localhost:3001`
- **WebSocket**: `ws://localhost:3001`
- **Health Check**: `GET /health`

### Key Concepts

- **Rooms**: 6-digit codes for game sessions
- **Players**: Human or AI with unique personalities
- **Phases**: WAITING → ROLE_ASSIGNMENT → NIGHT → REVELATION → DISCUSSION → VOTING → GAME_OVER
- **Roles**: MAFIA_LEADER, MAFIA_MEMBER, HEALER, CITIZEN

---

## API Reference

### Health & Status

#### `GET /health`

Server health check

```json
{
  "status": "healthy",
  "timestamp": "2025-01-20T...",
  "version": "2.0.0",
  "phase": "Phase 1 - Complete",
  "detective": "🕵️‍♂️ AI Mafia Server Online"
}
```

#### `GET /api/stats`

Real-time server statistics

```json
{
  "rooms": {
    "totalRooms": 3,
    "activeRooms": 1,
    "totalPlayers": 12,
    "roomList": [...]
  },
  "ai": [...],
  "server": {
    "uptime": 3600,
    "memoryUsage": {...},
    "timestamp": "2025-01-20T..."
  }
}
```

### Game Management

#### `GET /api/game-modes`

Available game modes

```json
{
  "modes": [
    {
      "id": "single_player",
      "name": "Single Player",
      "description": "1 Human + 9 AI Players",
      "recommended": true,
      "playerCount": { "human": 1, "ai": 9 },
      "features": ["free_models", "basic_analytics"]
    }
  ]
}
```

#### `GET /api/personalities`

AI personality pool information

```json
{
  "totalPersonalities": 30,
  "personalities": [
    {
      "name": "Alex",
      "model": "claude-haiku",
      "archetype": "analytical_detective",
      "description": "Methodical thinker"
    }
  ],
  "modelDistribution": [
    { "model": "claude-haiku", "count": 6 },
    { "model": "gpt-4o-mini", "count": 6 }
  ],
  "tiers": {
    "free": { "models": 3, "personalities": 18 },
    "premium": { "models": 6, "personalities": 30 }
  }
}
```

### Creator Tools

#### `POST /api/verify-creator`

Verify creator access

```json
// Request
{
  "password": "detective_ai_mafia_2025"
}

// Response (200)
{
  "valid": true,
  "message": "Creator access granted",
  "features": ["unlimited_games", "premium_models", "admin_tools"]
}

// Response (401)
{
  "valid": false,
  "message": "Invalid creator password"
}
```

#### `POST /api/creator/ai-only-game`

Create AI-only game (Creator only)

```json
// Request
{
  "password": "detective_ai_mafia_2025",
  "gameConfig": {
    "premiumModelsEnabled": true
  }
}

// Response
{
  "success": true,
  "message": "AI-only game created",
  "roomInfo": {
    "id": "room-uuid",
    "code": "123456",
    "playerCount": 10,
    "maxPlayers": 10
  }
}
```

---

## WebSocket Events

### Connection

```javascript
import { io } from "socket.io-client";

const socket = io("http://localhost:3001", {
  transports: ["websocket"],
});
```

### Client → Server Events

#### `create_room`

Create a new game room

```javascript
socket.emit("create_room", {
  playerName: "PlayerName",
  roomSettings: {
    allowSpectators: false,
    premiumModelsEnabled: false,
  },
});
```

#### `join_room`

Join existing room

```javascript
socket.emit("join_room", {
  roomCode: "123456",
  playerName: "PlayerName",
  playerId: "optional-existing-id",
});
```

#### `game_action`

Send game actions

```javascript
// Start game (host only)
socket.emit("game_action", {
  type: "START_GAME",
  playerId: "player-id",
});

// Send message (during discussion)
socket.emit("game_action", {
  type: "SEND_MESSAGE",
  playerId: "player-id",
  content: "I think Alex is suspicious...",
});

// Cast vote (during voting)
socket.emit("game_action", {
  type: "CAST_VOTE",
  playerId: "player-id",
  targetId: "target-player-id",
  reasoning: "They've been acting strange",
});

// Night action (mafia/healer only)
socket.emit("game_action", {
  type: "NIGHT_ACTION",
  playerId: "player-id",
  action: "kill", // or "heal"
  targetId: "target-player-id",
});
```

#### `ready_up`

Mark player as ready

```javascript
socket.emit("ready_up", {
  playerId: "player-id",
});
```

#### `heartbeat`

Keep connection alive

```javascript
socket.emit("heartbeat");
```

### Server → Client Events

#### `room_created`

Room successfully created

```javascript
socket.on("room_created", (data) => {
  console.log("Room created:", data.roomCode);
  // data: { roomId, roomCode, playerId, roomInfo }
});
```

#### `room_joined`

Successfully joined room

```javascript
socket.on("room_joined", (data) => {
  console.log("Joined room:", data.roomCode);
  // data: { roomId, playerId, roomCode, roomInfo, players }
});
```

#### `player_joined`

Another player joined

```javascript
socket.on("player_joined", (data) => {
  // data: { player: { id, name, type, isReady, ... } }
});
```

#### `player_left`

Player left the room

```javascript
socket.on("player_left", (data) => {
  // data: { playerId }
});
```

#### `game_started`

Game has begun

```javascript
socket.on("game_started", (data) => {
  // data: { gameState: {...} }
});
```

#### `phase_changed`

Game phase transition

```javascript
socket.on("phase_changed", (data) => {
  // data: { oldPhase, newPhase, endTime, round }
});
```

#### `speaker_turn_started`

Player's turn to speak (discussion)

```javascript
socket.on("speaker_turn_started", (data) => {
  // data: { speakerId, timeLimit }
});
```

#### `next_voter`

Player's turn to vote

```javascript
socket.on("next_voter", (data) => {
  // data: { voterId }
});
```

#### `player_eliminated`

Player was eliminated

```javascript
socket.on("player_eliminated", (data) => {
  // data: { playerId, role, cause: "voted_out" | "mafia_kill", voteCount? }
});
```

#### `game_ended`

Game finished

```javascript
socket.on("game_ended", (data) => {
  // data: { winner: "citizens" | "mafia", reason, finalState, stats }
});
```

#### `game_event`

Generic game event

```javascript
socket.on("game_event", (event) => {
  // event: { id, type, timestamp, data, phase, round }
});
```

#### `error`

Error occurred

```javascript
socket.on("error", (error) => {
  // error: { message, code? }
});
```

---

## Game Flow & Phases

### Phase Progression

```
WAITING → ROLE_ASSIGNMENT → NIGHT → REVELATION → DISCUSSION → VOTING → (repeat NIGHT...) → GAME_OVER
```

### 1. WAITING Phase

- Players join the room
- Host can start when 10 players present
- AI players auto-fill remaining slots
- Duration: Until host starts or room fills

**Frontend Actions:**

- Show player list
- Show ready status
- Enable start button for host
- Display room code

### 2. ROLE_ASSIGNMENT Phase

- Roles assigned: 2 Mafia, 1 Healer, 7 Citizens
- Players see their role privately
- Duration: 5 seconds

**Frontend Actions:**

- Show role reveal to player
- Hide role from others
- Display role description

### 3. NIGHT Phase

- Mafia Leader chooses elimination target
- Healer chooses protection target
- Other players wait
- Duration: 90 seconds

**Frontend Actions:**

- Show night action panel for Mafia Leader/Healer
- Show waiting screen for others
- Display countdown timer

### 4. REVELATION Phase

- Night action results revealed
- Player eliminated (if not healed)
- Role of eliminated player shown
- Duration: 10 seconds

**Frontend Actions:**

- Announce elimination result
- Show revealed role
- Update player list

### 5. DISCUSSION Phase

- Players take turns speaking
- Each player gets 30-45 seconds
- Order is randomized each round
- AI players respond naturally

**Frontend Actions:**

- Show speaking order
- Enable message input for current speaker
- Display countdown for speaker
- Show chat history

### 6. VOTING Phase

- Players vote to eliminate someone
- Each player votes once in order
- Majority vote eliminates player
- Ties result in no elimination

**Frontend Actions:**

- Show voting panel for current voter
- Display available targets
- Show vote history (after voting)
- Announce elimination result

### Win Conditions

- **Citizens win**: All mafia eliminated
- **Mafia wins**: Mafia equals/outnumbers citizens

---

## Data Models

### Player

```typescript
interface Player {
  id: string;
  name: string;
  type: "human" | "ai";
  role?: "mafia_leader" | "mafia_member" | "healer" | "citizen";
  isAlive: boolean;
  isReady: boolean;
  model?: string; // AI model for AI players
  votedFor?: string;
  lastActive: string; // ISO date
  gameStats: {
    gamesPlayed: number;
    wins: number;
    accurateVotes: number;
    aiDetectionRate: number;
  };
}
```

### GameState

```typescript
interface GameState {
  id: string;
  roomId: string;
  phase:
    | "waiting"
    | "role_assignment"
    | "night"
    | "revelation"
    | "discussion"
    | "voting"
    | "game_over";
  currentRound: number;
  players: Player[];
  votes: Vote[];
  messages: Message[];
  eliminatedPlayers: string[];
  winner?: "citizens" | "mafia";
  phaseStartTime: string;
  phaseEndTime: string;
  speakingOrder?: string[];
  currentSpeaker?: string;
  gameConfig: GameConfig;
}
```

### Vote

```typescript
interface Vote {
  voterId: string;
  targetId: string;
  reasoning: string;
  timestamp: string;
}
```

### Message

```typescript
interface Message {
  id: string;
  playerId: string;
  content: string;
  timestamp: string;
  phase: string;
  messageType?: "discussion" | "vote" | "action" | "system";
}
```

### GameConfig

```typescript
interface GameConfig {
  maxPlayers: number;
  aiCount: number;
  humanCount: number;
  nightPhaseDuration: number; // 90 seconds
  discussionPhaseDuration: number; // 300 seconds
  votingPhaseDuration: number; // 120 seconds
  revelationPhaseDuration: number; // 10 seconds
  speakingTimePerPlayer: number; // 35 seconds
  allowSpectators: boolean;
  premiumModelsEnabled: boolean;
}
```

### Room Info

```typescript
interface RoomInfo {
  id: string;
  code: string;
  playerCount: number;
  maxPlayers: number;
  gameInProgress: boolean;
  createdAt: string;
}
```

---

## Frontend Architecture

### Recommended Stack

- **Framework**: Next.js 15 (already set up)
- **WebSocket**: Socket.io-client
- **State**: Zustand (already set up)
- **Styling**: TailwindCSS
- **UI**: Headless UI or similar
- **Animations**: Framer Motion

### File Structure

```
src/
├── app/
│   ├── play/page.tsx           # Main game interface
│   └── dashboard/page.tsx      # Admin dashboard
├── components/
│   ├── game/
│   │   ├── game-board.tsx      # Main game container
│   │   ├── player-list.tsx     # Player management
│   │   ├── chat-area.tsx       # Discussion interface
│   │   ├── voting-panel.tsx    # Voting interface
│   │   ├── night-action-panel.tsx # Night actions
│   │   ├── phase-display.tsx   # Current phase info
│   │   └── role-reveal.tsx     # Role assignment
│   ├── room/
│   │   ├── room-lobby.tsx      # Pre-game lobby
│   │   ├── room-setup.tsx      # Room creation
│   │   └── join-room.tsx       # Room joining
│   └── ui/
│       ├── timer.tsx           # Countdown timer
│       ├── player-card.tsx     # Individual player
│       └── game-stats.tsx      # Statistics display
├── lib/
│   ├── socket-context.tsx      # WebSocket provider
│   ├── game-utils.ts           # Game helper functions
│   └── constants.ts            # Game constants
└── stores/
    └── game-store.ts           # Zustand store
```

---

## Component Guide

### 1. GameBoard Component

Main game container that switches between phases

```typescript
interface GameBoardProps {
  gameState: GameState;
  currentPlayer: Player;
  onAction: (action: GameAction) => void;
}

// States to handle:
// - WAITING: Show lobby
// - ROLE_ASSIGNMENT: Show role reveal
// - NIGHT: Show night actions or waiting
// - REVELATION: Show elimination results
// - DISCUSSION: Show chat interface
// - VOTING: Show voting interface
// - GAME_OVER: Show final results
```

### 2. PlayerList Component

Display all players with status

```typescript
interface PlayerListProps {
  players: Player[];
  currentPlayer: Player;
  gamePhase: string;
  eliminatedPlayers: string[];
}

// Show:
// - Player names (human-like for all)
// - Alive/eliminated status
// - Speaking indicator (discussion phase)
// - Voting indicator (voting phase)
// - Ready status (waiting phase)
```

### 3. ChatArea Component

Discussion interface with turn-based speaking

```typescript
interface ChatAreaProps {
  messages: Message[];
  currentSpeaker?: string;
  currentPlayer: Player;
  onSendMessage: (content: string) => void;
  timeRemaining: number;
}

// Features:
// - Message history
// - Input enabled only for current speaker
// - Typing indicator
// - Auto-scroll to latest
```

### 4. VotingPanel Component

Voting interface with player selection

```typescript
interface VotingPanelProps {
  players: Player[];
  currentPlayer: Player;
  currentVoter?: string;
  onVote: (targetId: string, reasoning: string) => void;
  votes: Vote[];
}

// Features:
// - Available targets (living players except self)
// - Reasoning input
// - Vote confirmation
// - Previous votes display (after voting)
```

### 5. NightActionPanel Component

Mafia/Healer night actions

```typescript
interface NightActionPanelProps {
  currentPlayer: Player;
  availableTargets: Player[];
  onNightAction: (targetId: string) => void;
  timeRemaining: number;
}

// Role-specific:
// - Mafia Leader: Choose elimination target
// - Healer: Choose protection target
// - Others: Show waiting screen
```

### 6. Timer Component

Countdown timer for phases

```typescript
interface TimerProps {
  endTime: string;
  onTimeUp?: () => void;
  variant?: "discussion" | "voting" | "night";
}

// Features:
// - Real-time countdown
// - Visual progress bar
// - Color changes as time runs low
// - Sound alerts (optional)
```

---

## State Management

### Zustand Store Structure

```typescript
interface GameStore {
  // Connection state
  socket: Socket | null;
  connectionStatus: "connecting" | "connected" | "disconnected";

  // Room state
  currentRoom: RoomInfo | null;
  roomCode: string;

  // Player state
  currentPlayer: Player | null;
  players: Player[];

  // Game state
  gameState: GameState | null;
  messages: Message[];
  votes: Vote[];

  // UI state
  isLoading: boolean;
  error: string | null;

  // Actions
  connect: () => void;
  disconnect: () => void;
  createRoom: (playerName: string, settings: any) => void;
  joinRoom: (roomCode: string, playerName: string) => void;
  sendMessage: (content: string) => void;
  castVote: (targetId: string, reasoning: string) => void;
  performNightAction: (targetId: string) => void;
  setReady: () => void;
  startGame: () => void;
}
```

### Example Store Implementation

```typescript
import { create } from "zustand";
import { io, Socket } from "socket.io-client";

export const useGameStore = create<GameStore>((set, get) => ({
  // Initial state
  socket: null,
  connectionStatus: "disconnected",
  currentRoom: null,
  roomCode: "",
  currentPlayer: null,
  players: [],
  gameState: null,
  messages: [],
  votes: [],
  isLoading: false,
  error: null,

  // Actions
  connect: () => {
    const socket = io("http://localhost:3001");

    socket.on("connect", () => {
      set({ connectionStatus: "connected" });
    });

    socket.on("disconnect", () => {
      set({ connectionStatus: "disconnected" });
    });

    socket.on("room_created", (data) => {
      set({
        currentRoom: data.roomInfo,
        roomCode: data.roomCode,
        currentPlayer: { id: data.playerId, ...get().currentPlayer },
      });
    });

    socket.on("room_joined", (data) => {
      set({
        currentRoom: data.roomInfo,
        roomCode: data.roomCode,
        players: data.players,
        currentPlayer: { id: data.playerId, ...get().currentPlayer },
      });
    });

    socket.on("game_started", (data) => {
      set({ gameState: data.gameState });
    });

    socket.on("phase_changed", (data) => {
      set((state) => ({
        gameState: state.gameState
          ? {
              ...state.gameState,
              phase: data.newPhase,
              phaseEndTime: data.endTime,
              currentRound: data.round,
            }
          : null,
      }));
    });

    // Add more event handlers...

    set({ socket });
  },

  createRoom: (playerName: string, settings: any) => {
    const { socket } = get();
    if (socket) {
      set({ isLoading: true });
      socket.emit("create_room", { playerName, roomSettings: settings });
    }
  },

  joinRoom: (roomCode: string, playerName: string) => {
    const { socket } = get();
    if (socket) {
      set({ isLoading: true });
      socket.emit("join_room", { roomCode, playerName });
    }
  },

  sendMessage: (content: string) => {
    const { socket, currentPlayer } = get();
    if (socket && currentPlayer) {
      socket.emit("game_action", {
        type: "SEND_MESSAGE",
        playerId: currentPlayer.id,
        content,
      });
    }
  },

  // Add more actions...
}));
```

---

## UI/UX Guidelines

### Design System

#### Colors (Detective Theme)

```css
/* Primary Colors */
--detective-blue: #3b82f6;
--detective-orange: #f97316;
--noir-black: #0a0a0a;
--noir-gray-900: #1a1a1a;
--noir-gray-800: #262626;
--noir-gray-700: #404040;
--noir-gray-600: #525252;

/* Role Colors */
--mafia-red: #dc2626;
--citizen-blue: #3b82f6;
--healer-green: #10b981;

/* Status Colors */
--alive: #10b981;
--eliminated: #6b7280;
--speaking: #f59e0b;
--voting: #8b5cf6;
```

#### Typography

```css
/* Headers */
.heading-detective {
  font-weight: bold;
  color: var(--detective-orange);
  letter-spacing: -0.025em;
}

/* Body text */
.text-detective-primary {
  color: #93c5fd;
}
.text-detective-secondary {
  color: #fb923c;
}
.text-muted {
  color: #737373;
}
```

### Component Styling

#### Detective Card

```css
.detective-card {
  background: #262626;
  border: 1px solid #404040;
  border-radius: 0.75rem;
  box-shadow: 0 10px 25px -3px rgba(0, 0, 0, 0.1);
  backdrop-filter: blur(8px);
}

.detective-card:hover {
  border-color: #3b82f6;
  transition: border-color 0.2s;
}
```

#### Player Card States

```css
.player-card {
  transition: all 0.3s ease;
}

.player-card.alive {
  border-color: #10b981;
  background: #262626;
}

.player-card.eliminated {
  border-color: #6b7280;
  background: #171717;
  opacity: 0.6;
}

.player-card.speaking {
  border-color: #f59e0b;
  box-shadow: 0 0 20px rgba(245, 158, 11, 0.4);
}

.player-card.voting {
  border-color: #8b5cf6;
  box-shadow: 0 0 20px rgba(139, 92, 246, 0.4);
}
```

### User Experience Flows

#### 1. Joining a Game

```
Home Page → Enter Room Code → Enter Name → Waiting Lobby → Game Starts
```

#### 2. Creating a Game

```
Home Page → Create Room → Enter Name → Configure Settings → Waiting Lobby → Game Starts
```

#### 3. Game Flow

```
Role Reveal → Night Phase → Day Results → Discussion → Voting → (Repeat) → Game Over
```

#### 4. Discussion Phase UX

- Clear indication of whose turn it is
- Timer prominently displayed
- Previous messages scrollable
- Input field enabled only for current speaker
- Auto-advance to next speaker

#### 5. Voting Phase UX

- List of available targets
- Reasoning text area
- Clear vote confirmation
- Show voting progress
- Display results after all votes

### Responsive Design

#### Breakpoints

```css
/* Mobile First */
.container {
  padding: 1rem;
}

/* Tablet */
@media (min-width: 768px) {
  .container {
    padding: 1.5rem;
  }
  .game-grid {
    grid-template-columns: 1fr 300px;
  }
}

/* Desktop */
@media (min-width: 1024px) {
  .container {
    padding: 2rem;
  }
  .game-grid {
    grid-template-columns: 300px 1fr 300px;
  }
}
```

#### Mobile Adaptations

- Collapsible player list
- Bottom sheet for actions
- Swipe gestures for phase navigation
- Touch-friendly buttons (min 44px)

---

## Integration Examples

### 1. Complete Game Setup

```typescript
// app/play/page.tsx
"use client";

import { useEffect } from "react";
import { useGameStore } from "@/stores/game-store";
import GameBoard from "@/components/game/game-board";
import RoomLobby from "@/components/room/room-lobby";

export default function PlayPage() {
  const { connect, connectionStatus, gameState, currentRoom } = useGameStore();

  useEffect(() => {
    connect();
  }, [connect]);

  if (connectionStatus !== "connected") {
    return <div>Connecting to server...</div>;
  }

  if (!currentRoom) {
    return <RoomLobby />;
  }

  if (!gameState || gameState.phase === "waiting") {
    return <RoomLobby />;
  }

  return <GameBoard />;
}
```

### 2. WebSocket Integration

```typescript
// lib/socket-context.tsx
import { createContext, useContext, useEffect, useState } from "react";
import { io, Socket } from "socket.io-client";

const SocketContext = createContext<Socket | null>(null);

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    const newSocket = io("http://localhost:3001");

    newSocket.on("connect", () => {
      console.log("Connected to server");
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, []);

  return (
    <SocketContext.Provider value={socket}>{children}</SocketContext.Provider>
  );
}

export const useSocket = () => {
  const socket = useContext(SocketContext);
  if (!socket) {
    throw new Error("useSocket must be used within SocketProvider");
  }
  return socket;
};
```

### 3. Game Phase Handler

```typescript
// components/game/game-board.tsx
import { useGameStore } from "@/stores/game-store";
import PlayerList from "./player-list";
import ChatArea from "./chat-area";
import VotingPanel from "./voting-panel";
import NightActionPanel from "./night-action-panel";
import PhaseDisplay from "./phase-display";

export default function GameBoard() {
  const { gameState, currentPlayer } = useGameStore();

  if (!gameState || !currentPlayer) return null;

  const renderPhaseContent = () => {
    switch (gameState.phase) {
      case "role_assignment":
        return <RoleReveal role={currentPlayer.role} />;

      case "night":
        if (
          currentPlayer.role === "mafia_leader" ||
          currentPlayer.role === "healer"
        ) {
          return <NightActionPanel />;
        }
        return <div>Waiting for night actions...</div>;

      case "revelation":
        return <RevelationDisplay />;

      case "discussion":
        return <ChatArea />;

      case "voting":
        return <VotingPanel />;

      case "game_over":
        return <GameResults />;

      default:
        return <div>Unknown phase: {gameState.phase}</div>;
    }
  };

  return (
    <div className="h-screen bg-noir-black text-white flex">
      {/* Left sidebar - Players */}
      <div className="w-80 border-r border-noir-gray-700">
        <PlayerList />
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col">
        <PhaseDisplay />
        <div className="flex-1 p-6">{renderPhaseContent()}</div>
      </div>
    </div>
  );
}
```

### 4. Real-time Timer

```typescript
// components/ui/timer.tsx
import { useState, useEffect } from "react";

interface TimerProps {
  endTime: string;
  onTimeUp?: () => void;
}

export default function Timer({ endTime, onTimeUp }: TimerProps) {
  const [timeLeft, setTimeLeft] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date().getTime();
      const end = new Date(endTime).getTime();
      const remaining = Math.max(0, end - now);

      setTimeLeft(remaining);

      if (remaining === 0 && onTimeUp) {
        onTimeUp();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [endTime, onTimeUp]);

  const minutes = Math.floor(timeLeft / 60000);
  const seconds = Math.floor((timeLeft % 60000) / 1000);

  return (
    <div className="text-center">
      <div className="text-2xl font-mono">
        {minutes}:{seconds.toString().padStart(2, "0")}
      </div>
      <div className="w-full bg-noir-gray-700 rounded-full h-2 mt-2">
        <div
          className="bg-detective-orange h-2 rounded-full transition-all duration-1000"
          style={{
            width: `${Math.max(0, (timeLeft / 60000) * 100)}%`,
          }}
        />
      </div>
    </div>
  );
}
```

---

## Best Practices

### 1. Error Handling

- Always handle WebSocket disconnections gracefully
- Show user-friendly error messages
- Implement retry mechanisms for failed actions
- Validate user input before sending to server

### 2. Performance

- Use React.memo for expensive components
- Implement virtual scrolling for long chat histories
- Debounce user inputs
- Clean up WebSocket listeners properly

### 3. Accessibility

- Use semantic HTML elements
- Provide keyboard navigation
- Include screen reader support
- Maintain proper color contrast

### 4. Testing

- Unit test individual components
- Integration test WebSocket flows
- E2E test complete game scenarios
- Test with multiple browser tabs (multiplayer)

---

This documentation should give you everything you need to build a polished frontend for AI Mafia! The backend is rock-solid, so focus on creating an engaging user experience that showcases the AI personalities and smooth gameplay. 🕵️‍♂️
