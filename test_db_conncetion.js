// test-db-connection.js - Quick test for database connection
const { Client } = require("pg");
require("dotenv").config();

async function testConnection() {
  console.log("🔍 Testing database connection...");

  const DATABASE_URL = process.env.DATABASE_URL;
  const DIRECT_URL = process.env.DIRECT_URL;

  console.log("DATABASE_URL:", DATABASE_URL ? "Set ✅" : "Missing ❌");
  console.log("DIRECT_URL:", DIRECT_URL ? "Set ✅" : "Missing ❌");

  if (!DATABASE_URL) {
    console.log("❌ DATABASE_URL not found in .env");
    return;
  }

  try {
    // Test with transaction pooler (DATABASE_URL)
    console.log("\n🧪 Testing transaction pooler connection...");
    const client = new Client({ connectionString: DATABASE_URL });
    await client.connect();

    const result = await client.query("SELECT NOW()");
    console.log("✅ Transaction pooler connected successfully!");
    console.log("   Server time:", result.rows[0].now);

    await client.end();

    // Test direct connection if available
    if (DIRECT_URL) {
      console.log("\n🧪 Testing direct connection...");
      const directClient = new Client({ connectionString: DIRECT_URL });
      await directClient.connect();

      const directResult = await directClient.query("SELECT version()");
      console.log("✅ Direct connection successful!");
      console.log(
        "   PostgreSQL version:",
        directResult.rows[0].version.split(" ")[0]
      );

      await directClient.end();
    }

    console.log("\n🎉 All connections working! You can now run:");
    console.log("   npx prisma db push");
    console.log("   npx prisma generate");
  } catch (error) {
    console.log("❌ Connection failed:", error.message);
    console.log("\n🔧 Possible fixes:");
    console.log("1. Check your password in Supabase dashboard");
    console.log("2. URL-encode special characters in password");
    console.log("3. Reset database password for cleaner format");
    console.log(
      "4. Check if your IP is allowed (Supabase > Settings > Database > Network Access)"
    );
  }
}

testConnection().catch(console.error);
