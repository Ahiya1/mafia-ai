// server/index.ts - Updated with Phase 2 Features
import express, { Request, Response, NextFunction } from "express";
import { createServer } from "http";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import dotenv from "dotenv";
import winston from "winston";
import { GameSocketServer } from "./socket/game-server";
import { authManager } from "./lib/auth/auth-manager";
import { analyticsManager } from "./lib/analytics/analytics-manager";
import { createClient } from "@supabase/supabase-js";

// Load environment variables
dotenv.config({});

// Initialize logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
    }),
    new winston.transports.File({ filename: "error.log", level: "error" }),
    new winston.transports.File({ filename: "combined.log" }),
  ],
});

const app = express();
const httpServer = createServer(app);
const PORT = process.env.PORT || 3001;

// Security middleware
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'", "wss:", "https:"],
      },
    },
  })
);

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || "900000"), // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || "100"),
  standardHeaders: true,
  legacyHeaders: false,
  message: "Too many requests from this IP, please try again later.",
});

app.use(limiter);

// CORS configuration
app.use(
  cors({
    origin: [
      process.env.FRONTEND_URL || "http://localhost:3000",
      "http://localhost:3001",
      "http://127.0.0.1:3001",
      "https://mafia-ai.xyz",
      "https://mafia-ai.up.railway.app",
    ],
    credentials: true,
  })
);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Request logging middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  logger.info(`${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.get("User-Agent"),
    timestamp: new Date().toISOString(),
  });
  next();
});

// Initialize WebSocket server
const gameServer = new GameSocketServer(httpServer);

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Health check endpoint
app.get("/health", (_req: Request, res: Response) => {
  res.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    version: "2.0.0",
    phase: "Phase 2 - Database & Analytics",
    detective: "🕵️‍♂️ AI Mafia Server Online with Database",
    database: "connected",
    features: [
      "user_authentication",
      "package_management",
      "advanced_analytics",
      "payment_processing",
    ],
  });
});

// Enhanced stats endpoint with database analytics
app.get("/api/stats", async (_req: Request, res: Response) => {
  try {
    const roomStats = gameServer.getRoomStats();
    const aiStats = gameServer.getAIUsageStats();

    // Get database analytics
    const [playerInsights, aiPerformance, gameTrends] = await Promise.all([
      analyticsManager.getPlayerBehaviorInsights("day"),
      analyticsManager.getAIModelPerformance("day"),
      analyticsManager.getGameTrends("day"),
    ]);

    return res.json({
      rooms: roomStats,
      ai: Array.from(aiStats.entries()),
      server: {
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage(),
        timestamp: new Date().toISOString(),
      },
      analytics: {
        playerInsights,
        aiPerformance,
        gameTrends,
      },
    });
  } catch (error) {
    logger.error("Error fetching stats:", error);
    return res.status(500).json({ error: "Failed to fetch statistics" });
  }
});

// User authentication endpoints
app.post("/api/auth/signup", async (req: Request, res: Response) => {
  try {
    const { email, password, username } = req.body;

    if (!email || !password || !username) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const { user, error } = await authManager.createUser(
      email,
      password,
      username
    );

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    return res.status(201).json({
      success: true,
      user: { id: user?.id, email: user?.email },
      message: "Account created successfully",
    });
  } catch (error) {
    logger.error("Signup error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

app.post("/api/auth/signin", async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return res.status(401).json({ error: error.message });
    }

    return res.json({
      success: true,
      user: data.user,
      session: data.session,
    });
  } catch (error) {
    logger.error("Signin error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/api/user/profile/:userId", async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const profile = await authManager.getUserProfile(userId);

    if (!profile) {
      return res.status(404).json({ error: "User not found" });
    }

    return res.json(profile);
  } catch (error) {
    logger.error("Profile fetch error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Package management endpoints
app.get("/api/packages", async (_req: Request, res: Response) => {
  try {
    const packages = await authManager.getAvailablePackages();
    return res.json(packages);
  } catch (error) {
    logger.error("Package fetch error:", error);
    return res.status(500).json({ error: "Failed to fetch packages" });
  }
});

app.get("/api/user/:userId/packages", async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const packages = await authManager.getUserPackages(userId);
    return res.json(packages);
  } catch (error) {
    logger.error("User packages fetch error:", error);
    return res.status(500).json({ error: "Failed to fetch user packages" });
  }
});

app.post(
  "/api/user/:userId/access-check",
  async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;
      const { features = [] } = req.body;

      const access = await authManager.checkUserAccess(userId, features);
      return res.json(access);
    } catch (error) {
      logger.error("Access check error:", error);
      return res.status(500).json({ error: "Failed to check access" });
    }
  }
);

// Payment processing endpoints
app.post("/api/purchase", async (req: Request, res: Response) => {
  try {
    const { userId, packageId, paypalTransactionId, amount } = req.body;

    if (!userId || !packageId || !paypalTransactionId || !amount) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const success = await authManager.purchasePackage(
      userId,
      packageId,
      paypalTransactionId,
      amount
    );

    if (success) {
      logger.info("Package purchased", { userId, packageId, amount });
      return res.json({
        success: true,
        message: "Package purchased successfully",
      });
    } else {
      return res.status(400).json({ error: "Purchase failed" });
    }
  } catch (error) {
    logger.error("Purchase error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Analytics endpoints
app.get(
  "/api/analytics/player-behavior",
  async (req: Request, res: Response) => {
    try {
      const timeframe =
        (req.query.timeframe as "day" | "week" | "month") || "week";
      const insights = await analyticsManager.getPlayerBehaviorInsights(
        timeframe
      );
      return res.json(insights);
    } catch (error) {
      logger.error("Analytics error:", error);
      return res.status(500).json({ error: "Failed to fetch analytics" });
    }
  }
);

app.get(
  "/api/analytics/ai-performance",
  async (req: Request, res: Response) => {
    try {
      const timeframe =
        (req.query.timeframe as "day" | "week" | "month") || "week";
      const performance = await analyticsManager.getAIModelPerformance(
        timeframe
      );
      return res.json(performance);
    } catch (error) {
      logger.error("AI performance error:", error);
      return res.status(500).json({ error: "Failed to fetch AI performance" });
    }
  }
);

app.get("/api/analytics/revenue", async (req: Request, res: Response) => {
  try {
    const timeframe =
      (req.query.timeframe as "day" | "week" | "month") || "month";
    const revenue = await analyticsManager.getRevenueAnalytics(timeframe);
    return res.json(revenue);
  } catch (error) {
    logger.error("Revenue analytics error:", error);
    return res.status(500).json({ error: "Failed to fetch revenue analytics" });
  }
});

// Creator tools (enhanced)
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
        "database_access",
        "analytics_export",
      ],
    });
  } else {
    res.status(401).json({
      valid: false,
      message: "Invalid creator password",
    });
  }
});

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
    logger.info("AI-only game created", { roomInfo });
    return res.json({
      success: true,
      message: "AI-only game created",
      roomInfo,
    });
  } catch (error) {
    logger.error("AI-only game creation error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to create AI-only game",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Enhanced personality endpoint
app.get("/api/personalities", (_req: Request, res: Response) => {
  const personalityInfo = gameServer.getPersonalityPoolInfo();
  res.json(personalityInfo);
});

// Game modes endpoint
app.get("/api/game-modes", (_req: Request, res: Response) => {
  res.json({
    modes: [
      {
        id: "single_player",
        name: "Single Player",
        description: "1 Human + 9 AI Players",
        recommended: true,
        playerCount: { human: 1, ai: 9 },
        features: ["free_models", "basic_analytics"],
      },
      {
        id: "multiplayer",
        name: "Multiplayer",
        description: "2+ Humans + AI Players",
        recommended: false,
        playerCount: { human: "2-10", ai: "0-8" },
        features: ["free_models", "basic_analytics"],
      },
      {
        id: "premium_single",
        name: "Premium Single Player",
        description: "1 Human + 9 Premium AI Players",
        recommended: true,
        playerCount: { human: 1, ai: 9 },
        features: ["premium_models", "advanced_analytics"],
      },
      {
        id: "ai_only",
        name: "AI Observatory",
        description: "Watch 10 AI Players (Creator Only)",
        recommended: false,
        playerCount: { human: 0, ai: 10 },
        requiresCreatorAccess: true,
        features: ["premium_models", "research_mode"],
      },
    ],
  });
});

// PayPal webhook endpoint
app.post("/api/webhook/paypal", async (req: Request, res: Response) => {
  try {
    // TODO: Implement PayPal webhook validation
    logger.info("PayPal webhook received", { body: req.body });

    // Process payment confirmation
    const { resource } = req.body;
    if (resource && resource.status === "COMPLETED") {
      // Handle successful payment
      logger.info("Payment completed", { resource });
    }

    return res.status(200).json({ received: true });
  } catch (error) {
    logger.error("PayPal webhook error:", error);
    return res.status(500).json({ error: "Webhook processing failed" });
  }
});

// Error handling middleware
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  logger.error("Server error:", {
    error: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
  });

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

// Background tasks
const startBackgroundTasks = () => {
  // Generate research insights weekly
  setInterval(async () => {
    try {
      await analyticsManager.generateResearchInsights();
      logger.info("Research insights generated");
    } catch (error) {
      logger.error("Research insights generation failed:", error);
    }
  }, 7 * 24 * 60 * 60 * 1000); // Weekly

  // Clean up old sessions daily
  setInterval(() => {
    gameServer.cleanupOldSessions();
    logger.info("Old sessions cleaned up");
  }, 24 * 60 * 60 * 1000); // Daily
};

// Start server
httpServer.listen(PORT, () => {
  logger.info(`🎮 AI Mafia Server running on port ${PORT}`);
  logger.info(`🔌 WebSocket server initialized`);
  logger.info(`🗄️  Database connected (Supabase)`);
  logger.info(`🤖 AI models loaded: OpenAI, Anthropic, Google`);
  logger.info(`🎭 30+ Detective AI personalities ready`);
  logger.info(`💳 Payment processing enabled (PayPal)`);
  logger.info(`📊 Advanced analytics active`);
  logger.info(`🕵️‍♂️ Phase 2 features activated`);

  // Start background tasks
  startBackgroundTasks();

  if (process.env.NODE_ENV === "development") {
    logger.info(`📊 Stats available at: http://localhost:${PORT}/api/stats`);
    logger.info(`❤️  Health check at: http://localhost:${PORT}/health`);
    logger.info(`🎪 Game modes at: http://localhost:${PORT}/api/game-modes`);
    logger.info(`📦 Packages at: http://localhost:${PORT}/api/packages`);
  }
});

// Graceful shutdown
const gracefulShutdown = (signal: string) => {
  logger.info(`${signal} received, shutting down gracefully...`);
  httpServer.close(() => {
    logger.info("🕵️‍♂️ Detective AI server closed");
    process.exit(0);
  });
};

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

export { app, httpServer, gameServer };
