// Main Server Entry Point for AI Mafia
import express, { Request, Response, NextFunction } from "express";
import { createServer } from "http";
import cors from "cors";
import dotenv from "dotenv";
import { GameSocketServer } from "./socket/game-server";

// Load environment variables
dotenv.config({ path: ".env.local", override: true });

const app = express();
const httpServer = createServer(app);
const PORT = process.env.PORT || 3001;

// Middleware
// Update server/index.ts CORS configuration
app.use(
  cors({
    origin: [
      process.env.FRONTEND_URL || "http://localhost:3000",
      "http://localhost:3001",
      "http://127.0.0.1:3001",
      "http://localhost:8080", // For debugger
      "http://127.0.0.1:8080", // For debugger (your current setup)
      "http://localhost:8000", // Common alternative
      "null", // For file:// protocol
    ],
    credentials: true,
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Initialize WebSocket server
const gameServer = new GameSocketServer(httpServer);

// Health check endpoint
app.get("/health", (_req: Request, res: Response) => {
  res.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    version: "1.0.0",
    detective: "🕵️‍♂️ AI Mafia Server Online",
  });
});

// Room statistics endpoint
app.get("/api/stats", (_req: Request, res: Response) => {
  const roomStats = gameServer.getRoomStats();
  const aiStats = gameServer.getAIUsageStats();

  res.json({
    rooms: roomStats,
    ai: Array.from(aiStats.entries()),
    server: {
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage(),
      timestamp: new Date().toISOString(),
    },
  });
});

// Creator bypass verification endpoint
app.post("/api/verify-creator", (req: Request, res: Response) => {
  const { password } = req.body;
  const creatorPassword = process.env.CREATOR_BYPASS_PASSWORD;

  if (creatorPassword && password === creatorPassword) {
    res.json({
      valid: true,
      message: "Creator access granted",
      features: [
        "unlimited_games",
        "premium_models",
        "admin_tools",
        "ai_only_games",
        "personality_debug",
      ],
    });
  } else {
    res.status(401).json({
      valid: false,
      message: "Invalid creator password",
    });
  }
});

// Creator endpoint to start AI-only games (0 humans, 10 AI)
app.post("/api/creator/ai-only-game", (req: Request, res: Response) => {
  const { password, gameConfig } = req.body;
  const creatorPassword = process.env.CREATOR_BYPASS_PASSWORD;

  if (!creatorPassword || password !== creatorPassword) {
    return res.status(401).json({
      valid: false,
      message: "Creator access required",
    });
  }

  try {
    const roomInfo = gameServer.createAIOnlyGame(gameConfig);
    res.json({
      success: true,
      message: "AI-only game created",
      roomInfo,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to create AI-only game",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
  // FIXED: Added return statement to ensure all code paths return
  return;
});

// Get personality pool information
app.get("/api/personalities", (_req: Request, res: Response) => {
  const personalityInfo = gameServer.getPersonalityPoolInfo();
  res.json(personalityInfo);
});

// Payment webhook endpoint (placeholder for PayPal integration)
app.post("/api/webhook/payment", (req: Request, res: Response) => {
  // TODO: Implement PayPal webhook validation and package delivery
  console.log("Payment webhook received:", req.body);
  res.status(200).json({ received: true });
});

// Game mode configuration endpoint
app.get("/api/game-modes", (_req: Request, res: Response) => {
  res.json({
    modes: [
      {
        id: "single_player",
        name: "Single Player",
        description: "1 Human + 9 AI Players",
        recommended: true,
        playerCount: { human: 1, ai: 9 },
      },
      {
        id: "multiplayer",
        name: "Multiplayer",
        description: "2+ Humans + AI Players",
        recommended: false,
        playerCount: { human: "2-10", ai: "0-8" },
      },
      {
        id: "ai_only",
        name: "AI Observatory",
        description: "Watch 10 AI Players (Creator Only)",
        recommended: false,
        playerCount: { human: 0, ai: 10 },
        requiresCreatorAccess: true,
      },
    ],
  });
});

// Error handling middleware
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error("Server error:", err);
  res.status(500).json({
    error: "Internal server error",
    message:
      process.env.NODE_ENV === "development"
        ? err.message
        : "Something went wrong",
    detective: "🕵️‍♂️ The detective is investigating...",
  });
});

// 404 handler
app.use("*", (_req: Request, res: Response) => {
  res.status(404).json({
    error: "Endpoint not found",
    detective: "🕵️‍♂️ This case is closed - endpoint doesn't exist",
  });
});

// Start server
httpServer.listen(PORT, () => {
  console.log(`🎮 AI Mafia Server running on port ${PORT}`);
  console.log(`🔌 WebSocket server initialized`);
  console.log(`🤖 AI models loaded: OpenAI, Anthropic, Google`);
  console.log(`🎭 25+ Detective AI personalities ready`);
  console.log(`🕵️‍♂️ Perfect anonymity system active`);

  if (process.env.NODE_ENV === "development") {
    console.log(`📊 Stats available at: http://localhost:${PORT}/api/stats`);
    console.log(`❤️  Health check at: http://localhost:${PORT}/health`);
    console.log(`🎪 Game modes at: http://localhost:${PORT}/api/game-modes`);
  }
});

// Graceful shutdown
const gracefulShutdown = (signal: string) => {
  console.log(`${signal} received, shutting down gracefully...`);
  httpServer.close(() => {
    console.log("🕵️‍♂️ Detective AI server closed");
    process.exit(0);
  });
};

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

export { app, httpServer, gameServer };
