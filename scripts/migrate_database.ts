// scripts/migrate-database.ts - COMMIT 4: Database Migration CLI Tool (FIXED)
import * as dotenv from "dotenv";
import { databaseManager } from "../server/lib/database/setup";

// Load environment variables
dotenv.config();

interface MigrationOptions {
  force?: boolean;
  checkOnly?: boolean;
  setupAdmin?: boolean;
  verbose?: boolean;
}

class MigrationCLI {
  private options: MigrationOptions;

  constructor(options: MigrationOptions = {}) {
    this.options = options;
  }

  async run(): Promise<void> {
    console.log(
      "🔥 AI Mafia Database Migration Tool - Revolutionary Architecture"
    );
    console.log(
      "================================================================"
    );

    try {
      // Check if this is a health check only
      if (this.options.checkOnly) {
        await this.checkDatabaseHealth();
        return;
      }

      // Test connection first
      console.log("🔌 Testing database connection...");
      const connected = await databaseManager.testConnection();

      if (!connected) {
        console.error("❌ Database connection failed!");
        console.error(
          "Please check your NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables."
        );
        process.exit(1);
      }

      console.log("✅ Database connection successful");

      // Check current health
      const health = await databaseManager.checkHealth();

      if (health.revolutionaryArchitectureReady && !this.options.force) {
        console.log("🎉 Revolutionary architecture is already set up!");
        console.log(
          "Use --force to run migrations anyway, or --setup-admin to only setup admin user."
        );

        if (this.options.setupAdmin) {
          await this.setupAdminUser();
        }

        await this.showArchitectureStats();
        return;
      }

      // Run migrations
      console.log("🚀 Running database migrations...");
      const migrationResult = await databaseManager.runMigrations();

      if (migrationResult.success) {
        console.log("✅ Migrations completed successfully!");
        console.log(`📊 ${migrationResult.migrationsRun} migrations executed`);
      } else {
        console.error("❌ Migration failed!");
        console.error(migrationResult.message);
        if (migrationResult.errors) {
          migrationResult.errors.forEach((error) => {
            console.error(`   - ${error}`);
          });
        }
        process.exit(1);
      }

      // Setup admin user
      if (this.options.setupAdmin !== false) {
        await this.setupAdminUser();
      }

      // Final health check
      console.log("🏥 Running final health check...");
      const finalHealth = await databaseManager.checkHealth();

      if (finalHealth.revolutionaryArchitectureReady) {
        console.log("🎉 Revolutionary architecture is ready!");
        await this.showArchitectureStats();
      } else {
        console.warn("⚠️ Revolutionary architecture setup incomplete");
        this.showHealthStatus(finalHealth);
      }
    } catch (error) {
      console.error("💥 Migration process failed:", error);
      process.exit(1);
    }
  }

  private async checkDatabaseHealth(): Promise<void> {
    console.log("🏥 Checking database health...");

    try {
      const health = await databaseManager.checkHealth();
      this.showHealthStatus(health);

      if (health.revolutionaryArchitectureReady) {
        await this.showArchitectureStats();
      }

      const status = await databaseManager.getStatus();
      console.log("\n📊 System Status:");
      console.log(`   Connected: ${status.connected ? "✅" : "❌"}`);
      console.log(`   Tables Ready: ${status.tablesReady ? "✅" : "❌"}`);
      console.log(
        `   Revolutionary Architecture: ${
          status.revolutionaryArchitecture ? "✅" : "❌"
        }`
      );
      console.log(
        `   Admin User Ready: ${status.adminUserReady ? "✅" : "❌"}`
      );
    } catch (error) {
      console.error("❌ Health check failed:", error);
      process.exit(1);
    }
  }

  private showHealthStatus(health: any): void {
    console.log("\n🏥 Database Health Status:");
    console.log(`   Connected: ${health.connected ? "✅" : "❌"}`);
    console.log(`   Tables Created: ${health.tablesCreated ? "✅" : "❌"}`);
    console.log(`   Indexes Created: ${health.indexesCreated ? "✅" : "❌"}`);
    console.log(
      `   Functions Created: ${health.functionsCreated ? "✅" : "❌"}`
    );
    console.log(`   Packages Seeded: ${health.packagesSeeded ? "✅" : "❌"}`);
    console.log(
      `   Revolutionary Architecture: ${
        health.revolutionaryArchitectureReady ? "✅ READY" : "❌ NOT READY"
      }`
    );
  }

  private async setupAdminUser(): Promise<void> {
    console.log("👑 Setting up admin user...");

    try {
      const adminResult = await databaseManager.setupAdminUser();

      if (adminResult.success) {
        console.log("✅ Admin user setup completed!");
        console.log("📧 Email: ahiya.butman@gmail.com");
        console.log("🔑 Password: detective_ai_mafia_2025");
        console.log("🎭 Permissions: Revolutionary Architecture Access");
      } else {
        console.warn("⚠️ Admin user setup failed:", adminResult.message);
      }
    } catch (error) {
      console.error("❌ Admin user setup error:", error);
    }
  }

  private async showArchitectureStats(): Promise<void> {
    try {
      const stats = await databaseManager.getArchitectureStats();

      if (stats) {
        console.log("\n🔥 Revolutionary Architecture Statistics:");
        console.log(`   Total Games: ${stats.totalGames}`);
        console.log(
          `   Context Operations: ${stats.revolutionaryArchitecture.contextOperations}`
        );
        console.log(
          `   Name Mappings: ${stats.revolutionaryArchitecture.nameMappings}`
        );
        console.log(
          `   Parsing Success Rate: ${stats.revolutionaryArchitecture.averageParsingSuccessRate.toFixed(
            2
          )}%`
        );
        console.log(
          `   Phase Transitions: ${stats.revolutionaryArchitecture.phaseTransitions}`
        );
        console.log(
          `   AI Requests: ${stats.revolutionaryArchitecture.aiRequests}`
        );
        console.log(
          `   Perfect Anonymity: ${
            stats.revolutionaryArchitecture.perfectAnonymity ? "✅" : "❌"
          }`
        );
        console.log(
          `   Bulletproof Parsing: ${
            stats.revolutionaryArchitecture.bulletproofParsing ? "✅" : "❌"
          }`
        );
      }
    } catch (error) {
      console.warn("⚠️ Could not retrieve architecture stats:", error);
    }
  }
}

// Parse command line arguments
function parseArgs(): MigrationOptions {
  const args = process.argv.slice(2);
  const options: MigrationOptions = {};

  for (const arg of args) {
    switch (arg) {
      case "--force":
        options.force = true;
        break;
      case "--check-only":
      case "--check":
        options.checkOnly = true;
        break;
      case "--setup-admin":
        options.setupAdmin = true;
        break;
      case "--no-admin":
        options.setupAdmin = false;
        break;
      case "--verbose":
      case "-v":
        options.verbose = true;
        break;
      case "--help":
      case "-h":
        showHelp();
        process.exit(0);
        break;
      default:
        console.warn(`⚠️ Unknown argument: ${arg}`);
        break;
    }
  }

  return options;
}

function showHelp(): void {
  console.log(`
🔥 AI Mafia Database Migration Tool - Revolutionary Architecture

Usage: npm run db:migrate [options]

Options:
  --check-only        Only check database health, don't run migrations
  --force            Force run migrations even if already set up
  --setup-admin      Only setup admin user (requires existing database)
  --no-admin         Skip admin user setup
  --verbose, -v      Verbose output
  --help, -h         Show this help message

Examples:
  npm run db:migrate                    # Run full migration setup
  npm run db:migrate --check-only       # Check database health
  npm run db:migrate --force            # Force re-run migrations
  npm run db:migrate --setup-admin      # Only setup admin user

Environment Variables Required:
  NEXT_PUBLIC_SUPABASE_URL          # Your Supabase project URL
  SUPABASE_SERVICE_ROLE_KEY         # Your Supabase service role key

The revolutionary architecture includes:
  🎭 Perfect Anonymity System (Name Registry)
  🧠 Context Operations (trigger/update/push)
  💬 Phase Managers (Discussion, Voting, Night, Role)
  🔍 Bulletproof JSON Parsing
  📊 Enhanced Analytics Integration
  `);
}

// Main execution
async function main(): Promise<void> {
  try {
    const options = parseArgs();
    const cli = new MigrationCLI(options);
    await cli.run();

    console.log("\n🎉 Migration process completed successfully!");
    console.log("🕵️‍♂️ Revolutionary architecture is ready for detective work!");
  } catch (error) {
    console.error("💥 Migration failed:", error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

export { MigrationCLI };
