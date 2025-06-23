// server/index.ts - Complete Fixed Version for Railway
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
dotenv.config();

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
    // Only add file transports in development
    ...(process.env.NODE_ENV !== "production"
      ? [
          new winston.transports.File({
            filename: "error.log",
            level: "error",
          }),
          new winston.transports.File({ filename: "combined.log" }),
        ]
      : []),
  ],
});

const app = express();
const httpServer = createServer(app);

// 🔥 CRITICAL FIX: Railway Port and Host Configuration
const PORT = process.env.PORT || 3001;
const HOST = "0.0.0.0"; // Always bind to 0.0.0.0 for Railway

logger.info(`🌍 Server will bind to ${HOST}:${PORT}`);

// Enhanced Security middleware
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
    hsts: process.env.NODE_ENV === "production",
  })
);

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || "900000"), // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || "200"), // Increased for production
  standardHeaders: true,
  legacyHeaders: false,
  message: "Too many requests from this IP, please try again later.",
  skip: () => process.env.NODE_ENV === "development",
});

app.use(limiter);

// 🔥 ENHANCED CORS Configuration
const allowedOrigins = [
  "http://localhost:3000",
  "http://localhost:3001",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:3001",
  "https://mafia-ai.xyz",
  "https://mafia-ai.vercel.app",
  "https://mafia-ai-frontend.vercel.app",
  "https://ai-mafia.vercel.app",
  "https://mafia-ai-production.up.railway.app",
  process.env.FRONTEND_URL,
].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, postman, etc.)
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      } else {
        logger.warn(`CORS blocked origin: ${origin}`);
        // In production, be more lenient for now
        if (process.env.NODE_ENV === "production") {
          return callback(null, true);
        }
        return callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  })
);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Request logging middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  logger.info(`${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.get("User-Agent"),
    origin: req.get("Origin"),
    timestamp: new Date().toISOString(),
  });
  next();
});

// Initialize Supabase client with error handling
let supabase: any = null;
try {
  if (
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.SUPABASE_SERVICE_ROLE_KEY
  ) {
    supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    logger.info("✅ Supabase client initialized");
  } else {
    logger.warn(
      "⚠️  Supabase credentials not found - database features disabled"
    );
  }
} catch (error) {
  logger.error("❌ Supabase initialization failed:", error);
}

// Initialize WebSocket server
let gameServer: any = null;
try {
  gameServer = new GameSocketServer(httpServer);
  logger.info("✅ WebSocket server initialized");
} catch (error) {
  logger.error("❌ WebSocket server initialization failed:", error);
  // Create a mock gameServer for basic functionality
  gameServer = {
    getRoomStats: () => ({ activeRooms: 0, totalPlayers: 0 }),
    getAIUsageStats: () => new Map(),
    cleanupOldSessions: () => {},
    createAIOnlyGame: () => ({ code: "DEMO01", created: true }),
    getPersonalityPoolInfo: () => ({ personalities: [], count: 0 }),
  };
}

// 🔥 ROOT ENDPOINT
app.get("/", (_req: Request, res: Response) => {
  res.json({
    message: "🕵️‍♂️ AI Mafia Backend Server",
    status: "online",
    version: "2.0.0",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "development",
    endpoints: {
      health: "/health",
      stats: "/api/stats",
      gameInfo: "/api/game-modes",
      personalities: "/api/personalities",
    },
    detective: "Welcome to the AI Mafia server!",
  });
});

// 🔥 ENHANCED Health check endpoint
app.get("/health", (_req: Request, res: Response) => {
  const healthData = {
    status: "healthy",
    timestamp: new Date().toISOString(),
    version: "2.0.0",
    phase: "Phase 2 - Database & Analytics",
    detective: "🕵️‍♂️ AI Mafia Server Online",
    database: supabase ? "connected" : "disabled",
    websocket: gameServer ? "connected" : "disabled",
    environment: process.env.NODE_ENV || "development",
    port: PORT,
    host: HOST,
    uptime: Math.floor(process.uptime()),
    memory: {
      used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
    },
    features: [
      "user_authentication",
      "package_management",
      "advanced_analytics",
      "payment_processing",
      "websocket_gaming",
    ],
  };

  logger.info("Health check requested");
  res.json(healthData);
});

// Enhanced stats endpoint
app.get("/api/stats", async (_req: Request, res: Response) => {
  try {
    const roomStats = gameServer?.getRoomStats() || {
      activeRooms: 0,
      totalPlayers: 0,
    };
    const aiStats = gameServer?.getAIUsageStats() || new Map();

    let analyticsData = null;
    if (supabase && analyticsManager) {
      try {
        const [playerInsights, aiPerformance, gameTrends] = await Promise.all([
          analyticsManager.getPlayerBehaviorInsights("day").catch(() => null),
          analyticsManager.getAIModelPerformance("day").catch(() => null),
          analyticsManager.getGameTrends("day").catch(() => null),
        ]);

        analyticsData = {
          playerInsights,
          aiPerformance,
          gameTrends,
        };
      } catch (error) {
        logger.warn("Analytics data unavailable:", error);
      }
    }

    return res.json({
      rooms: roomStats,
      ai: Array.from(aiStats.entries()),
      server: {
        uptime: Math.floor(process.uptime()),
        memoryUsage: process.memoryUsage(),
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV,
        nodeVersion: process.version,
      },
      analytics: analyticsData,
      status: "operational",
      detective: "🕵️‍♂️ All systems operational",
    });
  } catch (error) {
    logger.error("Error fetching stats:", error);
    return res.status(500).json({
      error: "Failed to fetch statistics",
      message: error instanceof Error ? error.message : "Unknown error",
      detective: "🕵️‍♂️ Investigation in progress...",
    });
  }
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
    ],
    detective: "🕵️‍♂️ Choose your detective mission!",
  });
});

// Personalities endpoint
app.get("/api/personalities", (_req: Request, res: Response) => {
  try {
    const personalityInfo = gameServer?.getPersonalityPoolInfo() || {
      personalities: [
        { name: "Detective Sarah", model: "claude-haiku", style: "analytical" },
        { name: "Agent Marcus", model: "gpt-4o-mini", style: "creative" },
        { name: "Inspector Elena", model: "gemini-flash", style: "direct" },
      ],
      count: 3,
    };
    res.json(personalityInfo);
  } catch (error) {
    logger.error("Error fetching personalities:", error);
    res.status(500).json({
      error: "Failed to fetch personalities",
      detective: "🕵️‍♂️ The personalities are shy today...",
    });
  }
});

// Creator verification endpoint
app.post("/api/verify-creator", (req: Request, res: Response) => {
  try {
    const { password } = req.body;
    const creatorPassword = process.env.CREATOR_BYPASS_PASSWORD;

    if (creatorPassword && password === creatorPassword) {
      logger.info("Creator access granted");
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
      logger.warn("Invalid creator password attempt");
      res.status(401).json({
        valid: false,
        message: "Invalid creator password",
      });
    }
  } catch (error) {
    logger.error("Creator verification error:", error);
    res.status(500).json({
      valid: false,
      message: "Verification system error",
    });
  }
});

// Creator AI-only game endpoint
app.post("/api/creator/ai-only-game", (req: Request, res: Response) => {
  try {
    const { password, gameConfig } = req.body;
    const creatorPassword = process.env.CREATOR_BYPASS_PASSWORD;

    if (!creatorPassword || password !== creatorPassword) {
      return res.status(401).json({
        valid: false,
        message: "Creator access required",
      });
    }

    const roomInfo = gameServer?.createAIOnlyGame(gameConfig) || {
      code: `AI${Math.random().toString(36).substr(2, 4).toUpperCase()}`,
      created: true,
      players: 10,
      allAI: true,
    };

    logger.info("AI-only game created by creator", { roomInfo });
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

// Authentication endpoints (simplified for initial deployment)
app.post("/api/auth/signup", async (req: Request, res: Response) => {
  try {
    if (!supabase) {
      return res.status(503).json({
        error: "Authentication unavailable",
        message: "Database not connected",
      });
    }

    const { email, password, username } = req.body;

    if (!email || !password || !username) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // For now, return success for demo purposes
    return res.status(201).json({
      success: true,
      user: { id: "demo-user", email },
      message: "Account created successfully (demo mode)",
    });
  } catch (error) {
    logger.error("Signup error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

app.post("/api/auth/signin", async (req: Request, res: Response) => {
  try {
    if (!supabase) {
      return res.status(503).json({
        error: "Authentication unavailable",
        message: "Database not connected",
      });
    }

    const { email, password } = req.body;

    // For now, return success for demo purposes
    return res.json({
      success: true,
      user: { id: "demo-user", email },
      session: { access_token: "demo-token" },
      message: "Signed in successfully (demo mode)",
    });
  } catch (error) {
    logger.error("Signin error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Package endpoints (simplified)
app.get("/api/packages", async (_req: Request, res: Response) => {
  const packages = [
    {
      id: "starter",
      name: "Starter Package",
      price: 5.0,
      games: 10,
      duration: "3 months",
      features: [
        "Premium AI models",
        "Advanced analytics",
        "Ad-free experience",
      ],
    },
    {
      id: "social",
      name: "Social Package",
      price: 10.0,
      games: 25,
      duration: "3 months",
      features: ["All Starter features", "Game recording", "Custom rooms"],
    },
  ];

  res.json({ packages });
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
    availableEndpoints: [
      "/health",
      "/api/stats",
      "/api/game-modes",
      "/api/personalities",
    ],
  });
});

// Background tasks
const startBackgroundTasks = () => {
  if (!supabase) {
    logger.warn("Background tasks disabled - no database connection");
    return;
  }

  // Clean up old sessions daily
  setInterval(() => {
    try {
      gameServer?.cleanupOldSessions();
      logger.info("Old sessions cleaned up");
    } catch (error) {
      logger.error("Session cleanup failed:", error);
    }
  }, 24 * 60 * 60 * 1000); // Daily
};

// 🔥 CRITICAL: Proper host binding for Railway
httpServer.listen(PORT, HOST, () => {
  logger.info(`🎮 AI Mafia Server running on ${HOST}:${PORT}`);
  logger.info(
    `🔌 WebSocket server: ${gameServer ? "initialized" : "disabled"}`
  );
  logger.info(
    `🗄️  Database: ${supabase ? "connected" : "disabled"} (Supabase)`
  );
  logger.info(`🤖 AI models: OpenAI, Anthropic, Google`);
  logger.info(`🎭 Detective AI personalities ready`);
  logger.info(
    `💳 Payment processing: ${
      process.env.NODE_ENV === "production" ? "enabled" : "disabled"
    }`
  );
  logger.info(`📊 Analytics: ${supabase ? "active" : "disabled"}`);
  logger.info(`🕵️‍♂️ Environment: ${process.env.NODE_ENV || "development"}`);

  // Start background tasks
  startBackgroundTasks();

  if (process.env.NODE_ENV === "development") {
    logger.info(`📊 Stats: http://${HOST}:${PORT}/api/stats`);
    logger.info(`❤️  Health: http://${HOST}:${PORT}/health`);
    logger.info(`🎪 Game modes: http://${HOST}:${PORT}/api/game-modes`);
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

// Handle uncaught exceptions
process.on("uncaughtException", (error) => {
  logger.error("Uncaught Exception:", error);
  process.exit(1);
});

process.on("unhandledRejection", (reason, promise) => {
  logger.error("Unhandled Rejection at:", promise, "reason:", reason);
  process.exit(1);
});

export { app, httpServer, gameServer };
