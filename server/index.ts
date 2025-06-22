// Main Server Entry Point for AI Mafia
import express from "express";
import { createServer } from "http";
import cors from "cors";
import dotenv from "dotenv";
import { GameSocketServer } from "./socket/game-server";

// Load environment variables
dotenv.config();

const app = express();
const httpServer = createServer(app);
const PORT = process.env.PORT || 3001;

// Middleware
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    credentials: true,
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Initialize WebSocket server
const gameServer = new GameSocketServer(httpServer);

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    version: "1.0.0",
  });
});

// Room statistics endpoint
app.get("/api/stats", (req, res) => {
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
app.post("/api/verify-creator", (req, res) => {
  const { password } = req.body;
  const creatorPassword = process.env.CREATOR_BYPASS_PASSWORD;

  if (creatorPassword && password === creatorPassword) {
    res.json({
      valid: true,
      message: "Creator access granted",
      features: ["unlimited_games", "premium_models", "admin_tools"],
    });
  } else {
    res.status(401).json({
      valid: false,
      message: "Invalid creator password",
    });
  }
});

// Payment webhook endpoint (placeholder for PayPal integration)
app.post("/api/webhook/payment", (req, res) => {
  // TODO: Implement PayPal webhook validation and package delivery
  console.log("Payment webhook received:", req.body);
  res.status(200).json({ received: true });
});

// Error handling middleware
app.use(
  (
    err: any,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    console.error("Server error:", err);
    res.status(500).json({
      error: "Internal server error",
      message:
        process.env.NODE_ENV === "development"
          ? err.message
          : "Something went wrong",
    });
  }
);

// 404 handler
app.use("*", (req, res) => {
  res.status(404).json({ error: "Endpoint not found" });
});

// Start server
httpServer.listen(PORT, () => {
  console.log(`🎮 AI Mafia Server running on port ${PORT}`);
  console.log(`🔌 WebSocket server initialized`);
  console.log(`🤖 AI models loaded: OpenAI, Anthropic, Google`);
  console.log(`🎭 Detective AI personalities ready`);

  if (process.env.NODE_ENV === "development") {
    console.log(`📊 Stats available at: http://localhost:${PORT}/api/stats`);
    console.log(`❤️  Health check at: http://localhost:${PORT}/health`);
  }
});

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("SIGTERM received, shutting down gracefully...");
  httpServer.close(() => {
    console.log("Server closed");
    process.exit(0);
  });
});

process.on("SIGINT", () => {
  console.log("SIGINT received, shutting down gracefully...");
  httpServer.close(() => {
    console.log("Server closed");
    process.exit(0);
  });
});

export { app, httpServer, gameServer };
