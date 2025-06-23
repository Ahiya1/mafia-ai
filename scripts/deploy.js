// scripts/deploy.js - Railway Deployment Script
require("dotenv").config();
const { execSync } = require("child_process");
const fs = require("fs");

async function deploy() {
  console.log("🚀 Starting AI Mafia deployment to Railway...");

  try {
    // 1. Verify environment
    console.log("📋 Checking environment variables...");
    const requiredEnvVars = [
      "NEXT_PUBLIC_SUPABASE_URL",
      "SUPABASE_SERVICE_ROLE_KEY",
      "OPENAI_API_KEY",
      "ANTHROPIC_API_KEY",
      "GOOGLE_AI_API_KEY",
    ];

    for (const envVar of requiredEnvVars) {
      if (!process.env[envVar]) {
        console.warn(`⚠️  Warning: ${envVar} not set`);
      }
    }

    // 2. Build application
    console.log("🔨 Building application...");
    execSync("npm run build", { stdio: "inherit" });
    execSync("npm run build:server", { stdio: "inherit" });

    // 3. Run database migrations
    console.log("📊 Running database migrations...");
    await runMigrations();

    // 4. Seed default data
    console.log("🌱 Seeding default data...");
    await seedDatabase();

    // 5. Deploy to Railway
    console.log("🚂 Deploying to Railway...");
    execSync("railway deploy", { stdio: "inherit" });

    console.log("✅ Deployment completed successfully!");
    console.log("🌐 Your app should be available at: https://mafia-ai.xyz");
  } catch (error) {
    console.error("❌ Deployment failed:", error.message);
    process.exit(1);
  }
}

async function runMigrations() {
  const { createClient } = require("@supabase/supabase-js");

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  // Read and execute SQL schema
  const schemaSQL = fs.readFileSync("./database/schema.sql", "utf8");

  // Split by statements and execute
  const statements = schemaSQL.split(";").filter((stmt) => stmt.trim());

  for (const statement of statements) {
    if (statement.trim()) {
      try {
        const { error } = await supabase.rpc("exec_sql", { sql: statement });
        if (error) {
          console.warn("Migration warning:", error.message);
        }
      } catch (err) {
        console.log(
          "Skipping statement (might already exist):",
          statement.substring(0, 50) + "..."
        );
      }
    }
  }

  console.log("✅ Database migrations completed");
}

async function seedDatabase() {
  const { createClient } = require("@supabase/supabase-js");

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  // Insert default packages
  const defaultPackages = [
    {
      name: "Free Daily",
      description: "One free game per day with basic AI models",
      price_usd: 0.0,
      games_included: 1,
      expiration_days: 1,
      features: ["free_models", "basic_analytics"],
    },
    {
      name: "Starter Pack",
      description: "10 games with premium AI models and advanced analytics",
      price_usd: 5.0,
      games_included: 10,
      expiration_days: 90,
      features: ["premium_models", "advanced_analytics", "no_ads"],
    },
    {
      name: "Social Pack",
      description: "25 games with all features and game recording",
      price_usd: 10.0,
      games_included: 25,
      expiration_days: 90,
      features: [
        "premium_models",
        "advanced_analytics",
        "game_recording",
        "custom_rooms",
      ],
    },
  ];

  for (const pkg of defaultPackages) {
    const { error } = await supabase
      .from("packages")
      .upsert(pkg, { onConflict: "name" });

    if (error) {
      console.warn("Package seeding warning:", error.message);
    }
  }

  console.log("✅ Database seeding completed");
}

// scripts/migrate.js - Standalone migration script
async function migrate() {
  console.log("📊 Running database migrations...");
  await runMigrations();
  console.log("✅ Migrations completed");
}

// scripts/seed.js - Standalone seeding script
async function seed() {
  console.log("🌱 Seeding database...");
  await seedDatabase();
  console.log("✅ Seeding completed");
}

// Export functions for individual use
module.exports = { deploy, runMigrations, seedDatabase, migrate, seed };

// Run deploy if called directly
if (require.main === module) {
  const command = process.argv[2] || "deploy";

  switch (command) {
    case "deploy":
      deploy();
      break;
    case "migrate":
      migrate();
      break;
    case "seed":
      seed();
      break;
    default:
      console.log("Usage: node deploy.js [deploy|migrate|seed]");
  }
}
