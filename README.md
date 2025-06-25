# 🕵️‍♂️ AI Mafia - Revolutionary Architecture Game Engine

> **A groundbreaking social deduction game that merges classic Mafia mechanics with cutting-edge AI personalities using Revolutionary Architecture.**

[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue.svg)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-15.3-black.svg)](https://nextjs.org/)
[![Node.js](https://img.shields.io/badge/Node.js-20+-green.svg)](https://nodejs.org/)
[![Socket.io](https://img.shields.io/badge/Socket.io-4.8-purple.svg)](https://socket.io/)
[![Railway](https://img.shields.io/badge/Deployed%20on-Railway-blueviolet.svg)](https://railway.app/)

---

## 🏗️ Revolutionary Architecture Overview

AI Mafia introduces a **Revolutionary Architecture** system that enables seamless human-AI interaction in real-time multiplayer games through five core components:

### 1. **Context Operations System** (`trigger/update/push`)

```typescript
// Three fundamental operations for AI coordination
await contextManager.trigger(playerId, temporaryContext); // ⚡ Request AI response
contextManager.update(playerId, persistentContext); // 🔄 Update player state
contextManager.push(broadcastContext); // 📢 Broadcast to all
```

### 2. **Perfect Anonymity System**

- **Name Registry**: Maps real player IDs to anonymous game names
- **Zero Player Identification**: AI cannot identify human vs AI players
- **Game Isolation**: Each game maintains separate name mappings

### 3. **Bulletproof JSON Parsing**

- **5-Strategy Parser**: Direct JSON → Cleaned JSON → Pattern Extraction → Content Analysis → Fallback
- **Zero Game Hangs**: Emergency fallbacks for all AI failures
- **Confidence Scoring**: Each parsed response includes confidence metrics

### 4. **Phase Management System**

- **DiscussionManager**: Turn-based speaking with AI coordination
- **VotingManager**: Race condition-free voting with timeout protection
- **NightManager**: Mafia kills and healer protections with AI reasoning
- **RoleManager**: Dynamic role assignment and team composition

### 5. **Enhanced Analytics Integration**

- **Real-time Event Tracking**: Every game action logged with metadata
- **AI Performance Metrics**: Response times, costs, success rates
- **Research-Grade Data**: Player behavior analysis and game theory insights

---

## 🤖 AI Integration Architecture

### **Supported AI Models**

#### **Premium Tier** ($4.99-$19.99/month)

| Model               | Provider  | Cost/Token      | Use Case                           |
| ------------------- | --------- | --------------- | ---------------------------------- |
| **Claude Sonnet 4** | Anthropic | $0.003/$0.015   | Master detective personalities     |
| **GPT-4o**          | OpenAI    | $0.0025/$0.01   | Advanced storyteller personalities |
| **Gemini 2.5 Pro**  | Google    | $0.00125/$0.005 | Strategic analyst personalities    |

#### **Free Tier** (3 games/month)

| Model                | Provider  | Cost/Token        | Use Case                           |
| -------------------- | --------- | ----------------- | ---------------------------------- |
| **Claude Haiku**     | Anthropic | $0.00025/$0.00125 | Analytical detective personalities |
| **GPT-4o Mini**      | OpenAI    | $0.00015/$0.0006  | Creative storyteller personalities |
| **Gemini 2.5 Flash** | Google    | $0.000075/$0.0003 | Direct analyst personalities       |

### **AI Personality System**

**50+ Unique Personalities** across three archetypes:

```typescript
interface AIPersonality {
  model: AIModel;
  name: string;
  archetype: "analytical_detective" | "creative_storyteller" | "direct_analyst";
  communicationStyle: {
    averageMessageLength: "short" | "medium" | "long";
    formalityLevel: "casual" | "mixed" | "formal";
    emotionalExpression: "low" | "medium" | "high";
    questionFrequency: "low" | "medium" | "high";
    storytellingTendency: "low" | "medium" | "high";
    logicalReasoning: "low" | "medium" | "high";
  };
  strategicApproach: {
    votesTiming: "early" | "middle" | "late" | "varies";
    allianceBuilding: "cautious" | "opportunistic" | "aggressive";
    informationSharing: "secretive" | "selective" | "open";
    riskTolerance: "conservative" | "moderate" | "aggressive";
  };
}
```

### **AI Decision Generation**

```typescript
// Discussion Phase
const discussionResponse = await aiCoordinator.generateDiscussionResponse(
  playerId,
  context,
  personality,
  temporaryContext
);

// Voting Phase
const votingResponse = await aiCoordinator.generateVotingResponse(
  playerId,
  context,
  personality,
  temporaryContext
);

// Night Phase
const nightActionResponse = await aiCoordinator.generateNightActionResponse(
  playerId,
  context,
  personality,
  temporaryContext
);
```

---

## 🎮 Game Engine Architecture

### **Dual Engine System**

#### **1. Game Orchestrator** (Recommended)

**File**: `server/lib/game/orchestrator.ts`

- **Revolutionary Architecture Integration**: Full context operations support
- **Phase Manager Coordination**: Seamless integration with all four phase managers
- **Analytics Integration**: Real-time event tracking and performance metrics
- **Enhanced Observer Mode**: Complete game visibility with AI reasoning insights

#### **2. Legacy Game Engine** (Bulletproof Fallback)

**File**: `server/lib/game/engine.ts`

- **Zero Race Conditions**: Bulletproof AI voting with comprehensive timeout handling
- **Built-in Debugging**: Real-time game state inspection and stuck state detection
- **Emergency Recovery**: Force progression mechanisms for production stability
- **Performance Monitoring**: Memory usage, response times, error tracking

### **Phase Management Details**

#### **Discussion Manager** (`server/lib/game/phases/discussion-manager.ts`)

```typescript
class DiscussionManager {
  // Turn-based speaking with real AI coordination
  async startDiscussion(players: Map<PlayerId, Player>, timePerPlayer: number);

  // Handle human messages with validation
  handleMessage(playerId: PlayerId, content: string): boolean;

  // AI turn triggering with rich context
  private async triggerAIDiscussion(aiPlayer: Player): Promise<void>;
}
```

**Features:**

- **Turn-Based Speaking**: Enforced speaking order with 35-second time limits
- **AI Context Building**: Rich context including game history and player dynamics
- **Real-time Coordination**: WebSocket events for turn management
- **Skip Protection**: Automatic advancement for timeouts or errors

#### **Voting Manager** (`server/lib/game/phases/voting-manager.ts`)

```typescript
class VotingManager {
  // Bulletproof voting coordination
  async startVoting(
    players: Map<PlayerId, Player>,
    discussionHistory: string[]
  );

  // Race condition-free vote casting
  castVote(playerId: PlayerId, targetId: PlayerId, reasoning: string): boolean;

  // Enhanced AI voting with context
  private async handleAIVoting(aiPlayer: Player): Promise<void>;
}
```

**Anti-Hang Mechanisms:**

- **Turn Validation**: Strict checking of current voter
- **Duplicate Prevention**: Vote deduplication with clear error messages
- **Timeout Protection**: 15-second AI decision timeouts with fallbacks
- **Emergency Progression**: Force advancement for stuck states

#### **Night Manager** (`server/lib/game/phases/night-manager.ts`)

```typescript
class NightManager {
  // Night phase coordination with AI reasoning
  async startNight(players: Map<PlayerId, Player>, round: number);

  // Mafia coordination with enhanced context
  private async coordinateMafiaActions(mafiaPlayers: Player[]): Promise<void>;

  // Healer protection with strategic reasoning
  private async handleHealerActions(healerPlayers: Player[]): Promise<void>;
}
```

**Enhanced Features:**

- **Mafia Chat System**: Private coordination between mafia members
- **AI Reasoning Visibility**: Observer mode shows AI thought processes
- **Strategic Decision Making**: Context-aware target selection
- **Action Resolution**: Proper kill/heal interaction handling

---

## 🌐 WebSocket Architecture

### **GameSocketServer** (`server/socket/game-server.ts`)

**Core Responsibilities:**

- **Real-time Multiplayer**: WebSocket-based game coordination
- **Observer Broadcasting**: Spectator mode with full game visibility
- **Dashboard Integration**: Live stats and monitoring for development
- **AI-Only Games**: Creator tool for AI vs AI observation

**Enhanced Event System:**

```typescript
// Phase manager events
engine.on("discussion_started", (data) => {
  /* Real-time coordination */
});
engine.on("voting_started", (data) => {
  /* Turn-based voting setup */
});
engine.on("night_started", (data) => {
  /* Night phase AI coordination */
});

// Observer events
engine.on("mafia_chat", (data) => {
  /* Private mafia communication */
});
engine.on("observer_update", (data) => {
  /* AI reasoning insights */
});
```

### **Room Management** (`server/socket/room-manager.ts`)

**Dynamic Room System:**

```typescript
interface GameRoom {
  id: RoomId;
  code: string; // 6-digit room codes
  hostId: PlayerId;
  players: Map<PlayerId, Player>;
  config: GameConfig;
  gameEngine: GameOrchestrator | null;
  observerSockets: Set<Socket>;
  isAIOnly: boolean; // Creator-only AI vs AI games
}
```

**AI Player Filling:**

- **Automatic AI Addition**: Rooms auto-fill with AI players to reach 10 total
- **Personality Selection**: Real AI personalities with unique characteristics
- **Model Distribution**: Balanced across free/premium tiers based on package

### **Player Management** (`server/socket/player-manager.ts`)

**Connection Lifecycle:**

```typescript
interface PlayerConnection {
  playerId: PlayerId;
  socket: Socket;
  roomId: RoomId | null;
  isActive: boolean;
  isObserver: boolean; // Observer mode support
  joinedAt: Date;
  lastActivity: Date;
}
```

---

## 🔐 Authentication & Package System

### **Authentication Manager** (`server/lib/auth/auth-manager.ts`)

**Supabase Integration:**

- **User Management**: Account creation, email verification, password reset
- **Session Handling**: JWT tokens with automatic refresh
- **Game Access Control**: Package-based game consumption tracking
- **Admin System**: Creator bypass with unlimited access

### **Package System**

Based on database schema with four tiers:

#### **Free Monthly** - $0.00

- **3 games per month** (30-day expiration)
- **Free AI models**: Claude Haiku, GPT-4o Mini, Gemini 2.5 Flash
- **Basic analytics** and **observer mode**

#### **Premium Game** - $1.00

- **1 premium game** (7-day expiration)
- **Premium AI models**: Claude Sonnet 4, GPT-4o, Gemini 2.5 Pro
- **Advanced analytics** and **AI reasoning visibility**

#### **Social** - $4.99/month ⭐ _Most Popular_

- **10 premium games per month** (30-day expiration)
- **All premium AI models** with advanced personalities
- **Game recording** and **enhanced observer mode**
- **AI reasoning visibility** for learning

#### **Extra** - $19.99/month

- **40 premium games per month** (30-day expiration)
- **All features** including **custom personalities**
- **Data export** and **priority support**
- **Research-grade analytics** access

### **Game Access Control**

```typescript
interface GameAccessResult {
  hasAccess: boolean;
  accessType: "admin" | "premium_package" | "free" | "none";
  gamesRemaining: number;
  packageType: string;
  premiumFeatures: boolean;
  reason?: string;
}
```

---

## 📊 Analytics & Monitoring

### **Analytics Manager** (`server/lib/analytics/analytics-manager.ts`)

**Real-time Event Tracking:**

```typescript
interface GameAnalyticsEvent {
  gameSessionId: string;
  eventType:
    | "message"
    | "vote"
    | "elimination"
    | "phase_change"
    | "night_action";
  eventData: any;
  gamePhase: GamePhase;
  roundNumber: number;
  playerId?: string;
  aiModel?: AIModel;
  aiCost?: number;
  aiTokensUsed?: number;
  aiResponseTimeMs?: number;
}
```

**Research-Grade Data Collection:**

- **Player Behavior Analysis**: Communication patterns, voting accuracy, AI detection rates
- **AI Performance Metrics**: Response times, costs, success rates by model
- **Game Theory Insights**: Win rate analysis, strategy effectiveness
- **Cost Optimization**: AI usage patterns and budget management

### **Enhanced Observer Mode**

**Observer Features:**

- **Real-time Game State**: Complete visibility of all game elements
- **AI Reasoning Insights**: See AI thought processes and decision making
- **Mafia Chat Visibility**: Observer-only access to private mafia communication
- **Analytics Dashboard**: Live game metrics and player behavior data
- **Phase Manager Status**: Real-time status of all four phase managers

---

## 🚀 Deployment Architecture

### **Railway Deployment**

**Configuration Files:**

- `railway.toml`: Build and deployment configuration
- `railway.json`: Health check and environment setup
- `Dockerfile`: Multi-stage Docker build with optimizations

**Production Features:**

- **Health Checks**: `/health` endpoint with comprehensive status
- **Environment Variables**: Secure API key management
- **Auto-scaling**: Railway's automatic scaling based on load
- **Monitoring**: Built-in logging and performance tracking

### **Database Architecture**

**PostgreSQL with Supabase:**

- **Migration System**: Automated schema updates with `scripts/migrate-database.ts`
- **Connection Pooling**: Transaction pooler for production scale
- **Real-time Subscriptions**: WebSocket integration for live data
- **Row Level Security**: User isolation and data protection

**Core Tables:**

```sql
-- User management
users, user_packages, payment_transactions

-- Game data
game_sessions, player_sessions, game_analytics

-- Package system
packages, ai_usage_stats

-- Research data
research_insights
```

---

## 🛠️ Development Environment

### **Quick Start**

```bash
# Install dependencies
npm install

# Setup environment (copy API keys)
cp .env.example .env.local

# Start development servers
npm run dev  # Starts both frontend (3000) and backend (3001)

# Run comprehensive tests
chmod +x test-server.sh && ./test-server.sh
```

### **Environment Variables**

**Required for AI Integration:**

```bash
# AI Model APIs
OPENAI_API_KEY=your_openai_key
ANTHROPIC_API_KEY=your_anthropic_key
GOOGLE_AI_API_KEY=your_google_key

# Database
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_key

# Creator Access
CREATOR_BYPASS_PASSWORD=detective_ai_mafia_2025
```

**Optional for Enhanced Features:**

```bash
# Payment Processing
PAYPAL_CLIENT_ID=your_paypal_id
PAYPAL_CLIENT_SECRET=your_paypal_secret

# Advanced Configuration
MAX_COST_PER_GAME=0.10
DAILY_AI_BUDGET=50.00
```

### **Test Suite** (`test-server.sh`)

**Comprehensive Testing:**

- **Dependencies**: Installation and environment validation
- **HTTP Endpoints**: All API routes with authentication
- **WebSocket Integration**: Real-time connection testing
- **AI Model Integration**: Response generation and parsing
- **Database Operations**: Connection, queries, migrations
- **Load Testing**: Performance under concurrent users

### **Creator Tools**

**Admin Dashboard Features:**

- **AI-Only Games**: Create 10 AI vs AI games for testing
- **Real-time Monitoring**: Live game stats and player behavior
- **Server Health**: Memory usage, connection counts, error rates
- **Game Management**: Force phase changes, terminate stuck games
- **Analytics Export**: Research data download and analysis

---

## 🔧 Technical Implementation Details

### **Context Operations in Detail**

#### **1. TRIGGER Operation**

```typescript
// Request AI response with rich context
const response = await contextManager.trigger(playerId, {
  type: "discussion_turn",
  data: {
    your_name: "Alex",           // Anonymous game name
    your_turn: true,
    previous_messages: [...],     // Recent game history
    alive_players: [...],        // Current living players
    round: 3,
    phase: "discussion"
  },
  requiresResponse: true,
  timeoutMs: 15000              // 15-second timeout
});
```

#### **2. UPDATE Operation**

```typescript
// Persistent context updates
contextManager.update(playerId, {
  type: "role_assignment",
  data: {
    your_role: "mafia_leader",
    your_name: "Alex", // Anonymous name
    game_phase: "role_assignment",
  },
});
```

#### **3. PUSH Operation**

```typescript
// Broadcast to all players
contextManager.push({
  type: "phase_change",
  data: {
    oldPhase: "discussion",
    newPhase: "voting",
    round: 3,
    timestamp: new Date(),
  },
});
```

### **Bulletproof JSON Parsing Strategies**

**5-Level Parsing System:**

1. **Direct JSON Parse**: Standard `JSON.parse()` attempt
2. **Cleaned JSON Parse**: Remove trailing commas, fix common issues
3. **Pattern Extraction**: Regex patterns for vote targets, actions
4. **Content Analysis**: Intelligent content parsing for player names
5. **Emergency Fallback**: Guaranteed valid response generation

```typescript
interface ParsedAIResponse {
  isValid: boolean;
  responseType: "discussion" | "voting" | "night_action";
  data: any;
  errors: string[];
  parsingMethod:
    | "json"
    | "cleaned_json"
    | "pattern"
    | "content_analysis"
    | "fallback";
  confidence: number; // 0.1 to 0.9
}
```

### **Race Condition Prevention**

**Voting System Anti-Hang Mechanisms:**

```typescript
// 1. Strict turn validation
if (this.gameState.currentSpeaker !== playerId) {
  return false; // Not your turn
}

// 2. Duplicate vote prevention
const hasAlreadyVoted = this.gameState.votes.some(
  (v) => v.voterId === playerId
);
if (hasAlreadyVoted) {
  return false; // Already voted
}

// 3. Timeout protection
const timeoutId = setTimeout(() => {
  this.fallbackVoting(aiPlayer);
}, 15000);

// 4. Emergency progression
if (allPlayersVoted || timeoutReached) {
  this.processVotes();
}
```

---

## 📈 Performance & Scalability

### **AI Cost Management**

**Cost Tracking by Model:**

```typescript
interface APIUsageStats {
  model: AIModel;
  totalRequests: number;
  totalTokensInput: number;
  totalTokensOutput: number;
  totalCost: number;
  averageResponseTime: number;
  errorRate: number;
}
```

**Budget Controls:**

- **Per-Game Limits**: Maximum $0.10 per game
- **Daily Budget**: $50.00 daily AI budget cap
- **Model Selection**: Automatic free/premium based on package
- **Cost Optimization**: Response caching and token management

### **Memory Management**

**Cleanup Systems:**

```typescript
// Automatic cleanup every 5 minutes
setInterval(() => {
  this.cleanupOldSessions(); // Remove inactive connections
  aiResponseGenerator.cleanupCache(); // Clear AI response cache
  nameRegistry.cleanupOldMappings(); // Remove old name mappings
}, 300000);
```

### **Real-time Performance**

**WebSocket Optimizations:**

- **Event Broadcasting**: Efficient room-based message routing
- **Observer Separation**: Dedicated observer channels to prevent spam
- **Connection Pooling**: Reuse connections across game sessions
- **Data Sanitization**: Automatic circular reference removal

---

## 🔍 Debugging & Monitoring

### **Built-in Debugging System**

**Game State Inspection:**

```typescript
// Real-time game debugging
app.get("/api/debug/game/:roomId", (req, res) => {
  const room = gameSocketServer.getRoomById(roomId);
  const debugInfo = room.gameEngine.getDebugInfo();

  res.json({
    revolutionaryArchitecture: debugInfo.revolutionaryArchitecture,
    phaseManagers: debugInfo.phaseManagers,
    aiIntegration: debugInfo.aiIntegration,
  });
});
```

**Stuck State Detection:**

```typescript
// Automatic stuck game detection
checkForStuckStates(gameState: GameState): string[] {
  const issues = [];

  if (gameState.phase === 'voting' && !gameState.currentSpeaker) {
    issues.push('No current speaker set for voting phase');
  }

  if (gameState.currentSpeaker && !gameState.players.get(gameState.currentSpeaker)?.isAlive) {
    issues.push('Current speaker is not alive');
  }

  return issues;
}
```

### **Production Monitoring**

**Health Check Endpoint** (`/health`):

```json
{
  "status": "healthy",
  "revolutionaryArchitecture": {
    "enabled": true,
    "status": "ready",
    "features": [
      "Perfect Anonymity System",
      "Context Operations",
      "Phase Managers",
      "Bulletproof Parsing"
    ]
  },
  "database": "connected",
  "realAI": "active",
  "personalities": "loaded"
}
```

---

## 🎯 Game Mechanics

### **Role Distribution**

- **2 Mafia**: Mafia Leader + Mafia Member
- **1 Healer**: Can protect one player per night
- **7 Citizens**: Identify and eliminate mafia through discussion and voting

### **Phase Cycle**

1. **Role Assignment** (5 seconds): Players learn their roles privately
2. **Night Phase** (60-90 seconds): Mafia chooses target, Healer chooses protection
3. **Revelation** (10 seconds): Night results revealed
4. **Discussion** (4-6 minutes): Players share thoughts and suspicions (turn-based)
5. **Voting** (2 minutes): Players vote to eliminate someone (turn-based)
6. **Repeat** until win condition met

### **Win Conditions**

- **Citizens Win**: All mafia members eliminated
- **Mafia Wins**: Mafia equals or outnumbers citizens

### **Advanced Features**

- **Observer Mode**: Spectators can watch with full game visibility including AI reasoning
- **AI-Only Games**: Creator tool for AI vs AI research and entertainment
- **Turn-Based Systems**: Structured speaking and voting to prevent chaos
- **Real-time Analytics**: Live game metrics and player behavior tracking

---

## 📚 API Reference

### **Core Game Actions**

```typescript
// WebSocket game actions
interface GameAction {
  | { type: "JOIN_ROOM"; roomId: RoomId; playerId: PlayerId }
  | { type: "START_GAME"; playerId: PlayerId }
  | { type: "SEND_MESSAGE"; playerId: PlayerId; content: string }
  | { type: "CAST_VOTE"; playerId: PlayerId; targetId: PlayerId; reasoning: string }
  | { type: "NIGHT_ACTION"; playerId: PlayerId; action: "kill" | "heal"; targetId?: PlayerId }
}
```

### **HTTP Endpoints**

**Game Management:**

- `GET /health` - Server health and status
- `GET /api/stats` - Room and AI usage statistics
- `GET /api/game-modes` - Available game modes and features
- `GET /api/personalities` - AI personality information

**Authentication:**

- `POST /api/auth/signup` - Create new user account
- `POST /api/auth/signin` - User authentication
- `POST /api/auth/confirm` - Email verification

**Package Management:**

- `GET /api/packages` - Available packages and pricing
- `GET /api/user/packages` - User's current packages
- `POST /api/purchase` - Purchase new package

**Creator Tools:**

- `POST /api/verify-creator` - Verify creator access
- `POST /api/creator/ai-only-game` - Create AI vs AI game
- `GET /api/creator/active-games` - List all active games

---

## 🤝 Contributing

### **Development Guidelines**

**Architecture Principles:**

1. **Revolutionary Architecture First**: Use context operations for all AI interactions
2. **Zero Race Conditions**: Implement bulletproof coordination for multiplayer
3. **Real-time Everything**: WebSocket events for all game state changes
4. **AI-First Design**: Build with AI players as first-class citizens
5. **Observer Transparency**: Full game visibility for research and learning

**Code Standards:**

- **TypeScript Strict Mode**: Full type safety with strict configuration
- **Event-Driven Architecture**: WebSocket events for all game interactions
- **Error Handling**: Comprehensive fallbacks for AI and network failures
- **Performance Monitoring**: Built-in analytics and performance tracking

### **Testing Requirements**

**Pre-deployment Checklist:**

```bash
# Run full test suite
./test-server.sh

# Test specific components
./test-server.sh endpoints    # HTTP API testing
./test-server.sh websocket   # Real-time functionality
./test-server.sh ai          # AI integration testing
./test-server.sh load        # Performance testing
```

---

## 📄 License & Legal

This project demonstrates advanced full-stack development capabilities including:

- **Real-time Multiplayer Systems** with WebSocket architecture
- **AI Integration** with multiple providers and cost optimization
- **Complex Game Logic** with bulletproof state management
- **Production Deployment** with monitoring and analytics
- **Payment Processing** with subscription management

**Built with:** TypeScript, Next.js, Node.js, Socket.io, PostgreSQL, Supabase, Railway

---

_🕵️‍♂️ Ready to experience the future of social deduction gaming with Revolutionary Architecture? Deploy your own instance or join a game to see AI personalities in action!_
