# 🕵️‍♂️ AI Mafia - Phase 1 Complete

A groundbreaking social deduction game that merges classic Mafia mechanics with cutting-edge AI personalities.

## ✅ Phase 1 Features Implemented

- **🎮 Complete Game Engine**: Full state machine with all phases, roles, and win conditions
- **🤖 AI Model Integration**: OpenAI, Anthropic, and Google AI with 25+ unique personalities
- **🔌 Real-time WebSocket Server**: Multiplayer coordination and live event streaming
- **📊 Detective Dashboard**: Beautiful monitoring interface for development and testing
- **🎨 Detective Theme**: Complete UI system with noir/detective aesthetics

## 🚀 Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Setup Environment

```bash
# Copy the example environment file
cp .env.example .env.local

# Edit .env.local and add your API keys (optional for testing)
# The system will use fallback responses if API keys are not provided
```

### 3. Start the Development Environment

```bash
# Start both frontend and backend in development mode
npm run dev
```

This will start:

- **Frontend**: http://localhost:3000 (Next.js app)
- **Backend**: http://localhost:3001 (WebSocket server)

### 4. Access the Dashboard

Open your browser and navigate to:

- **Home Page**: http://localhost:3000
- **Dashboard**: http://localhost:3000/dashboard

## 📊 Dashboard Features

The Detective Control Center provides real-time monitoring and administration:

### 🔍 Server Monitoring

- **Health Status**: Real-time server health and uptime
- **Memory Usage**: Current memory consumption and performance
- **Connection Status**: WebSocket connection monitoring

### 🏠 Room Management

- **Active Rooms**: View all active game rooms and their status
- **Player Counts**: Monitor player distribution across rooms
- **Game States**: See which rooms are playing vs waiting

### 🤖 AI Analytics

- **Personality Pool**: Browse all 25+ AI personalities
- **Model Distribution**: See usage across different AI models (Claude, GPT, Gemini)
- **Usage Statistics**: Track AI API calls and costs

### 🔴 Live Activity Feed

- **Real-time Events**: Watch game events as they happen
- **Player Actions**: Monitor voting, discussions, eliminations
- **System Events**: Track room creation, player joins/leaves

### 🔧 Creator Tools

- **Creator Access**: Secure password-based admin access
- **AI-Only Games**: Create games with 10 AI players for testing
- **Advanced Controls**: Future admin features and debugging tools

## 🧪 Testing

Run the comprehensive test suite:

```bash
# Make the test script executable (Linux/Mac)
chmod +x test-server.sh

# Run all tests
./test-server.sh

# Or run specific test categories
./test-server.sh endpoints    # Test HTTP endpoints
./test-server.sh websocket   # Test WebSocket connection
./test-server.sh ai          # Test AI model integration
```

The test script will:

- ✅ Install dependencies
- ✅ Setup environment
- ✅ Start the server
- ✅ Test all HTTP endpoints
- ✅ Verify WebSocket connections
- ✅ Test AI model integration
- ✅ Run load tests
- ✅ Generate test report

## 🎮 Game Modes Available

### 1. Single Player (Recommended)

- **1 Human + 9 AI Players**
- Perfect for testing AI personalities
- Full game experience with balanced AI

### 2. Multiplayer

- **2-10 Humans + AI Players**
- Dynamic AI backfill
- Social deduction with friends

### 3. AI Observatory (Creator Only)

- **10 AI Players Only**
- Watch AI-vs-AI games
- Research and development tool

## 🤖 AI Personality System

### Free Tier (18 Personalities)

- **Claude Haiku**: 6 analytical detective personalities
- **GPT-4o Mini**: 6 creative storyteller personalities
- **Gemini 2.5 Flash**: 6 direct analyst personalities

### Premium Tier (30+ Personalities)

- **Claude Sonnet 4**: Master detective personalities
- **GPT-4o**: Advanced storyteller personalities
- **Gemini 2.5 Pro**: Strategic analyst personalities
- **All Free Tier**: Complete personality pool

## 🔧 API Endpoints

### Health & Monitoring

- `GET /health` - Server health check
- `GET /api/stats` - Server and room statistics
- `GET /api/personalities` - AI personality pool info
- `GET /api/game-modes` - Available game modes

### Creator Tools

- `POST /api/verify-creator` - Verify creator password
- `POST /api/creator/ai-only-game` - Create AI-only game

### WebSocket Events

- `create_room` - Create new game room
- `join_room` - Join existing room
- `game_action` - Send game actions
- `game_event` - Receive live game events

## 🔑 Creator Access

Use the creator password in the dashboard to access:

- **Default Password**: `detective_ai_mafia_2025`
- **Features**: AI-only games, premium models, admin tools
- **Purpose**: Testing, development, and content creation

## 📁 Project Structure

```
mafia-ai/
├── src/                    # Frontend (Next.js)
│   ├── app/               # App router pages
│   │   ├── dashboard/     # Detective dashboard
│   │   ├── layout.tsx     # Root layout
│   │   └── page.tsx       # Home page
│   ├── lib/               # Shared libraries
│   ├── types/             # TypeScript definitions
│   └── components/        # React components (Phase 2)
├── server/                # Backend (Node.js + Socket.io)
│   ├── index.ts          # Main server entry
│   ├── lib/              # Game engine and AI
│   │   ├── game/         # Game logic
│   │   ├── ai/           # AI model integration
│   │   └── types/        # Backend types
│   └── socket/           # WebSocket handlers
├── test-server.sh        # Comprehensive test suite
└── README.md            # This file
```

## 🎨 Design System

### Color Palette

- **Detective Blue**: Primary brand color (#3b82f6)
- **Detective Orange**: Action/accent color (#f97316)
- **Noir Grays**: Dark theme background colors
- **Role Colors**: Mafia (red), Citizen (blue), Healer (green)

### Components

- **Detective Cards**: Primary container component
- **Badges**: Role and status indicators
- **Buttons**: Themed interaction elements
- **Inputs**: Form controls with detective styling

## 🚧 Next Steps (Phase 2)

- **Database Integration**: Supabase PostgreSQL setup
- **User Authentication**: Account system and sessions
- **Payment Integration**: PayPal package system
- **Frontend Game UI**: React components for gameplay
- **Room Management**: Enhanced multiplayer features

## 🚧 Future Features (Phase 3)

- **Advanced Analytics**: Research data visualization
- **Tournament Mode**: Competitive gameplay
- **Custom Personalities**: User-created AI personalities
- **Mobile App**: React Native implementation
- **API Access**: Developer API for integrations

## 🐛 Troubleshooting

### Server Won't Start

1. Check if ports 3000/3001 are available
2. Verify Node.js version >= 20.0.0
3. Run `npm install` to ensure dependencies

### WebSocket Connection Issues

1. Check firewall settings
2. Verify server is running on correct port
3. Check browser console for connection errors

### AI Models Not Responding

1. Verify API keys are set in `.env.local`
2. Check API rate limits and quotas
3. Review server logs for API errors

### Dashboard Not Loading

1. Ensure server is running on port 3001
2. Check browser console for CORS errors
3. Verify API endpoints are accessible

## 📞 Support

For issues, questions, or contributions:

1. Check the test results: `./test-server.sh`
2. Review server logs: `server.log`
3. Check the dashboard for live monitoring
4. Examine API responses at endpoints above

---

**🕵️‍♂️ Detective's Note**: Phase 1 is complete and ready for testing! The dashboard provides everything you need to monitor and test the game system. Have fun exploring the AI personalities and watching them play against each other! 🎮
