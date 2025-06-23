// server/lib/auth/auth-manager.ts
import { createClient } from "@supabase/supabase-js";
import { User, Session } from "@supabase/supabase-js";

export interface UserProfile {
  id: string;
  username: string;
  email: string;
  total_games_played: number;
  total_wins: number;
  ai_detection_accuracy: number;
  preferred_ai_tier: "free" | "premium";
  is_creator: boolean;
  created_at: string;
}

export interface UserPackage {
  id: string;
  package_id: string;
  package_name: string;
  games_remaining: number;
  expires_at: string;
  is_active: boolean;
  features: string[];
}

export interface GamePackage {
  id: string;
  name: string;
  description: string;
  price_usd: number;
  games_included: number;
  expiration_days: number;
  features: string[];
  is_active: boolean;
}

export class AuthManager {
  private supabase;

  constructor() {
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }

  // User Authentication
  async createUser(
    email: string,
    password: string,
    username: string
  ): Promise<{ user: User | null; error: any }> {
    try {
      // Create auth user
      const { data: authData, error: authError } =
        await this.supabase.auth.signUp({
          email,
          password,
        });

      if (authError) return { user: null, error: authError };

      // Create user profile
      if (authData.user) {
        const { error: profileError } = await this.supabase
          .from("users")
          .insert({
            id: authData.user.id,
            username,
            email,
            is_verified: false,
          });

        if (profileError) {
          console.error("Profile creation error:", profileError);
        }
      }

      return { user: authData.user, error: null };
    } catch (error) {
      return { user: null, error };
    }
  }

  async getUserProfile(userId: string): Promise<UserProfile | null> {
    try {
      const { data, error } = await this.supabase
        .from("users")
        .select("*")
        .eq("id", userId)
        .single();

      if (error) {
        console.error("Error fetching user profile:", error);
        return null;
      }

      return data;
    } catch (error) {
      console.error("Error in getUserProfile:", error);
      return null;
    }
  }

  async updateUserProfile(
    userId: string,
    updates: Partial<UserProfile>
  ): Promise<boolean> {
    try {
      const { error } = await this.supabase
        .from("users")
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq("id", userId);

      return !error;
    } catch (error) {
      console.error("Error updating user profile:", error);
      return false;
    }
  }

  // Package Management
  async getAvailablePackages(): Promise<GamePackage[]> {
    try {
      const { data, error } = await this.supabase
        .from("packages")
        .select("*")
        .eq("is_active", true)
        .order("price_usd", { ascending: true });

      if (error) {
        console.error("Error fetching packages:", error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error("Error in getAvailablePackages:", error);
      return [];
    }
  }

  async getUserPackages(userId: string): Promise<UserPackage[]> {
    try {
      const { data, error } = await this.supabase
        .from("user_packages")
        .select(
          `
          *,
          packages:package_id (
            name,
            features
          )
        `
        )
        .eq("user_id", userId)
        .eq("is_active", true)
        .gte("expires_at", new Date().toISOString())
        .order("expires_at", { ascending: false });

      if (error) {
        console.error("Error fetching user packages:", error);
        return [];
      }

      return (
        data?.map((pkg: any) => ({
          id: pkg.id,
          package_id: pkg.package_id,
          package_name: pkg.packages?.name || "Unknown Package",
          games_remaining: pkg.games_remaining,
          expires_at: pkg.expires_at,
          is_active: pkg.is_active,
          features: pkg.packages?.features || [],
        })) || []
      );
    } catch (error) {
      console.error("Error in getUserPackages:", error);
      return [];
    }
  }

  async purchasePackage(
    userId: string,
    packageId: string,
    paypalTransactionId: string,
    amountPaid: number
  ): Promise<boolean> {
    try {
      // Get package details
      const { data: packageData, error: packageError } = await this.supabase
        .from("packages")
        .select("*")
        .eq("id", packageId)
        .single();

      if (packageError || !packageData) {
        console.error("Package not found:", packageError);
        return false;
      }

      // Calculate expiration date
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + packageData.expiration_days);

      // Create user package
      const { error: userPackageError } = await this.supabase
        .from("user_packages")
        .insert({
          user_id: userId,
          package_id: packageId,
          games_remaining: packageData.games_included,
          expires_at: expiresAt.toISOString(),
          amount_paid: amountPaid,
        });

      // Record payment transaction
      const { error: transactionError } = await this.supabase
        .from("payment_transactions")
        .insert({
          user_id: userId,
          paypal_transaction_id: paypalTransactionId,
          amount: amountPaid,
          status: "completed",
          package_id: packageId,
          package_name: packageData.name,
          games_purchased: packageData.games_included,
          completed_at: new Date().toISOString(),
        });

      if (userPackageError || transactionError) {
        console.error("Error creating package/transaction:", {
          userPackageError,
          transactionError,
        });
        return false;
      }

      return true;
    } catch (error) {
      console.error("Error in purchasePackage:", error);
      return false;
    }
  }

  async consumeGame(userId: string, features: string[] = []): Promise<boolean> {
    try {
      // Find a valid package that has the required features
      const { data: userPackages, error } = await this.supabase
        .from("user_packages")
        .select(
          `
          *,
          packages:package_id (
            features
          )
        `
        )
        .eq("user_id", userId)
        .eq("is_active", true)
        .gt("games_remaining", 0)
        .gte("expires_at", new Date().toISOString())
        .order("expires_at", { ascending: true });

      if (error || !userPackages?.length) {
        return false; // No valid packages
      }

      // Find package with required features
      const validPackage = userPackages.find((pkg: any) => {
        const packageFeatures = pkg.packages?.features || [];
        return features.every((feature) => packageFeatures.includes(feature));
      });

      if (!validPackage) {
        return false; // No package with required features
      }

      // Consume one game
      const { error: updateError } = await this.supabase
        .from("user_packages")
        .update({
          games_remaining: validPackage.games_remaining - 1,
          is_active: validPackage.games_remaining - 1 > 0,
        })
        .eq("id", validPackage.id);

      return !updateError;
    } catch (error) {
      console.error("Error consuming game:", error);
      return false;
    }
  }

  async checkUserAccess(
    userId: string,
    features: string[] = []
  ): Promise<{
    hasAccess: boolean;
    packageType: "free" | "premium";
    gamesRemaining: number;
  }> {
    try {
      const userPackages = await this.getUserPackages(userId);

      // Check for package with required features
      const validPackage = userPackages.find((pkg) => {
        return features.every((feature) => pkg.features.includes(feature));
      });

      if (validPackage) {
        return {
          hasAccess: true,
          packageType: validPackage.features.includes("premium_models")
            ? "premium"
            : "free",
          gamesRemaining: validPackage.games_remaining,
        };
      }

      // Check for free daily access
      const today = new Date().toDateString();
      const { data: todayGames, error } = await this.supabase
        .from("player_sessions")
        .select("created_at")
        .eq("user_id", userId)
        .gte("created_at", today)
        .limit(1);

      if (error) {
        console.error("Error checking daily access:", error);
        return { hasAccess: false, packageType: "free", gamesRemaining: 0 };
      }

      // Free daily game available if no games played today
      return {
        hasAccess: !todayGames?.length,
        packageType: "free",
        gamesRemaining: todayGames?.length ? 0 : 1,
      };
    } catch (error) {
      console.error("Error checking user access:", error);
      return { hasAccess: false, packageType: "free", gamesRemaining: 0 };
    }
  }

  // Analytics helpers
  async recordGameStart(
    userId: string,
    gameSessionId: string,
    roomCode: string
  ): Promise<void> {
    try {
      await this.supabase.from("game_sessions").insert({
        id: gameSessionId,
        room_code: roomCode,
        started_at: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Error recording game start:", error);
    }
  }

  async recordGameEnd(
    gameSessionId: string,
    winner: "citizens" | "mafia",
    winReason: string,
    totalRounds: number,
    aiCost: number,
    aiRequests: number
  ): Promise<void> {
    try {
      await this.supabase
        .from("game_sessions")
        .update({
          ended_at: new Date().toISOString(),
          winner,
          win_reason: winReason,
          total_rounds: totalRounds,
          total_ai_cost: aiCost,
          ai_requests_made: aiRequests,
        })
        .eq("id", gameSessionId);
    } catch (error) {
      console.error("Error recording game end:", error);
    }
  }
}

// Export singleton instance
export const authManager = new AuthManager();
