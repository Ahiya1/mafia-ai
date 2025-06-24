// server/lib/auth/auth-manager.ts - FIXED: Added resendConfirmationEmail method
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
  is_verified: boolean;
  created_at: string;
  last_login?: string;
}

export interface UserPackage {
  id: string;
  package_id: string;
  package_name: string;
  games_remaining: number;
  expires_at: string;
  is_active: boolean;
  features: string[];
  amount_paid: number;
  purchase_date: string;
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

export interface GameAccessResult {
  hasAccess: boolean;
  accessType: "admin" | "premium_package" | "free" | "none";
  gamesRemaining: number;
  packageType: string;
  premiumFeatures: boolean;
  reason?: string;
}

export class AuthManager {
  private supabase;

  constructor() {
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }

  // ================================
  // USER AUTHENTICATION & MANAGEMENT
  // ================================

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

      // Create user profile with correct field names
      if (authData.user) {
        const { error: profileError } = await this.supabase
          .from("users")
          .insert({
            id: authData.user.id,
            username,
            email,
            is_verified: false,
            total_games_played: 0,
            total_wins: 0,
            ai_detection_accuracy: 0.0,
            preferred_ai_tier: "free",
            is_creator: false,
          });

        if (profileError) {
          console.error("Profile creation error:", profileError);
          return { user: null, error: profileError };
        }

        // Give new users the free monthly package
        await this.grantFreeMonthlyPackage(authData.user.id);
      }

      return { user: authData.user, error: null };
    } catch (error) {
      return { user: null, error };
    }
  }

  async signInUser(
    email: string,
    password: string
  ): Promise<{ user: User | null; session: Session | null; error: any }> {
    try {
      const { data, error } = await this.supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) return { user: null, session: null, error };

      // Update last login
      if (data.user) {
        await this.updateLastLogin(data.user.id);
      }

      return { user: data.user, session: data.session, error: null };
    } catch (error) {
      return { user: null, session: null, error };
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

  private async updateLastLogin(userId: string): Promise<void> {
    try {
      await this.supabase
        .from("users")
        .update({ last_login: new Date().toISOString() })
        .eq("id", userId);
    } catch (error) {
      console.error("Error updating last login:", error);
    }
  }

  // ================================
  // EMAIL MANAGEMENT METHODS
  // ================================

  async resendConfirmationEmail(email: string): Promise<{ error: any }> {
    try {
      const { error } = await this.supabase.auth.resend({
        type: "signup",
        email: email,
      });

      return { error };
    } catch (error) {
      console.error("Error resending confirmation email:", error);
      return { error };
    }
  }

  async confirmEmail(
    code: string
  ): Promise<{ success: boolean; message: string; user?: any; error?: any }> {
    try {
      if (!code) {
        return {
          success: false,
          message: "Confirmation code is required",
          error: { message: "Confirmation code is required" },
        };
      }

      // Use Supabase client to verify the code
      const { data, error } = await this.supabase.auth.exchangeCodeForSession(
        code
      );

      if (error) {
        console.error("Email confirmation error:", error);
        return {
          success: false,
          message: error.message || "Failed to confirm email",
          error,
        };
      }

      if (data.user) {
        // Update user as verified in our database
        const { error: updateError } = await this.supabase
          .from("users")
          .update({
            is_verified: true,
            updated_at: new Date().toISOString(),
          })
          .eq("id", data.user.id);

        if (updateError) {
          console.error(
            "Error updating user verification status:",
            updateError
          );
        }

        console.log("User email confirmed successfully", {
          userId: data.user.id,
          email: data.user.email,
        });

        return {
          success: true,
          message: "Email confirmed successfully",
          user: {
            id: data.user.id,
            email: data.user.email,
            confirmed: true,
          },
        };
      }

      return {
        success: false,
        message: "Invalid confirmation code",
        error: { message: "Invalid confirmation code" },
      };
    } catch (error) {
      console.error("Email confirmation error:", error);
      return {
        success: false,
        message: "Internal server error",
        error,
      };
    }
  }

  async manuallyVerifyUser(
    email: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      const { error } = await this.supabase
        .from("users")
        .update({
          is_verified: true,
          updated_at: new Date().toISOString(),
        })
        .eq("email", email);

      if (error) {
        console.error("Error manually verifying user:", error);
        return {
          success: false,
          message: "Failed to verify user",
        };
      }

      console.log("User manually verified:", email);
      return {
        success: true,
        message: "User verified successfully",
      };
    } catch (error) {
      console.error("Manual verification error:", error);
      return {
        success: false,
        message: "Internal server error",
      };
    }
  }

  // ================================
  // ADMIN USER SETUP
  // ================================

  async setupAdminUser(
    email: string = "ahiya.butman@gmail.com",
    password: string = "detective_ai_mafia_2025"
  ): Promise<{ success: boolean; message: string; userId?: string }> {
    try {
      // Try to find existing user
      const { data: existingUser, error: findError } = await this.supabase
        .from("users")
        .select("id, email, is_creator")
        .eq("email", email)
        .single();

      if (existingUser) {
        // Update existing user to admin
        const { error: updateError } = await this.supabase
          .from("users")
          .update({
            is_creator: true,
            creator_permissions: [
              "unlimited_games",
              "premium_models",
              "admin_tools",
              "ai_only_games",
              "analytics_export",
              "user_management",
              "database_access",
            ],
            updated_at: new Date().toISOString(),
          })
          .eq("id", existingUser.id);

        if (updateError) {
          return {
            success: false,
            message: `Failed to update user to admin: ${updateError.message}`,
          };
        }

        return {
          success: true,
          message: "User updated to admin successfully",
          userId: existingUser.id,
        };
      } else {
        // Create new admin user
        const { user, error } = await this.createUser(email, password, "Admin");

        if (error || !user) {
          return {
            success: false,
            message: `Failed to create admin user: ${
              error?.message || "Unknown error"
            }`,
          };
        }

        // Update to admin permissions
        const { error: adminError } = await this.supabase
          .from("users")
          .update({
            is_creator: true,
            creator_permissions: [
              "unlimited_games",
              "premium_models",
              "admin_tools",
              "ai_only_games",
              "analytics_export",
              "user_management",
              "database_access",
            ],
            updated_at: new Date().toISOString(),
          })
          .eq("id", user.id);

        if (adminError) {
          return {
            success: false,
            message: `Failed to set admin permissions: ${adminError.message}`,
          };
        }

        return {
          success: true,
          message: "Admin user created successfully",
          userId: user.id,
        };
      }
    } catch (error) {
      return {
        success: false,
        message: `Admin setup failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      };
    }
  }

  // ================================
  // PACKAGE MANAGEMENT
  // ================================

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
          amount_paid: pkg.amount_paid,
          purchase_date: pkg.purchase_date,
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
  ): Promise<{ success: boolean; message: string; packageInfo?: any }> {
    try {
      // Get package details
      const { data: packageData, error: packageError } = await this.supabase
        .from("packages")
        .select("*")
        .eq("id", packageId)
        .single();

      if (packageError || !packageData) {
        return { success: false, message: "Package not found" };
      }

      // Calculate expiration date
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + packageData.expiration_days);

      // Create user package
      const { data: userPackage, error: userPackageError } = await this.supabase
        .from("user_packages")
        .insert({
          user_id: userId,
          package_id: packageId,
          games_remaining: packageData.games_included,
          expires_at: expiresAt.toISOString(),
          amount_paid: amountPaid,
          purchase_date: new Date().toISOString(),
        })
        .select()
        .single();

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
        return { success: false, message: "Failed to complete purchase" };
      }

      return {
        success: true,
        message: `Successfully purchased ${packageData.name}`,
        packageInfo: {
          ...userPackage,
          package_name: packageData.name,
          features: packageData.features,
        },
      };
    } catch (error) {
      console.error("Error in purchasePackage:", error);
      return { success: false, message: "Purchase failed due to system error" };
    }
  }

  // ================================
  // GAME ACCESS CONTROL
  // ================================

  async checkGameAccess(
    userId: string,
    requiresPremium: boolean = false
  ): Promise<GameAccessResult> {
    try {
      // Use the SQL function we created
      const { data, error } = await this.supabase.rpc(
        "check_user_game_access",
        {
          user_uuid: userId,
          requires_premium: requiresPremium,
        }
      );

      if (error) {
        console.error("Error checking game access:", error);
        return {
          hasAccess: false,
          accessType: "none",
          gamesRemaining: 0,
          packageType: "none",
          premiumFeatures: false,
          reason: "System error",
        };
      }

      return data;
    } catch (error) {
      console.error("Error in checkGameAccess:", error);
      return {
        hasAccess: false,
        accessType: "none",
        gamesRemaining: 0,
        packageType: "none",
        premiumFeatures: false,
        reason: "System error",
      };
    }
  }

  async consumeGame(
    userId: string,
    isPremiumGame: boolean = false
  ): Promise<{ success: boolean; message: string; gamesRemaining: number }> {
    try {
      // Use the SQL function we created
      const { data, error } = await this.supabase.rpc("consume_user_game", {
        user_uuid: userId,
        is_premium_game: isPremiumGame,
      });

      if (error) {
        console.error("Error consuming game:", error);
        return {
          success: false,
          message: "Failed to consume game",
          gamesRemaining: 0,
        };
      }

      return {
        success: data.success,
        message: data.message,
        gamesRemaining: data.gamesRemaining,
      };
    } catch (error) {
      console.error("Error in consumeGame:", error);
      return {
        success: false,
        message: "System error",
        gamesRemaining: 0,
      };
    }
  }

  // ================================
  // ANALYTICS & GAME TRACKING
  // ================================

  async recordGameStart(
    userId: string,
    gameSessionId: string,
    roomCode: string,
    gameConfig: any
  ): Promise<void> {
    try {
      await this.supabase.from("game_sessions").insert({
        id: gameSessionId,
        room_code: roomCode,
        total_players: gameConfig.maxPlayers || 10,
        human_players: gameConfig.humanCount || 1,
        ai_players: gameConfig.aiCount || 9,
        premium_models_enabled: gameConfig.premiumModelsEnabled || false,
        started_at: new Date().toISOString(),
      });

      // Record player session
      await this.supabase.from("player_sessions").insert({
        game_session_id: gameSessionId,
        user_id: userId,
        player_name: "Human Player", // This should come from the actual player name
        player_type: "human",
        assigned_role: "unknown", // Will be updated when roles are assigned
      });

      console.log(`🎮 Game session recorded: ${gameSessionId}`);
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
    aiRequests: number,
    gameDurationSeconds: number
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
          duration_seconds: gameDurationSeconds,
        })
        .eq("id", gameSessionId);

      console.log(`📊 Game session completed: ${gameSessionId}`);
    } catch (error) {
      console.error("Error recording game end:", error);
    }
  }

  async recordGameAnalytics(
    gameSessionId: string,
    eventType: string,
    eventData: any,
    gamePhase: string,
    roundNumber: number,
    playerId?: string,
    aiModel?: string,
    aiCost?: number,
    aiTokens?: number,
    aiResponseTime?: number
  ): Promise<void> {
    try {
      await this.supabase.from("game_analytics").insert({
        game_session_id: gameSessionId,
        event_type: eventType,
        event_data: eventData,
        game_phase: gamePhase,
        round_number: roundNumber,
        player_id: playerId,
        ai_model: aiModel,
        ai_cost: aiCost || 0,
        ai_tokens_used: aiTokens || 0,
        ai_response_time_ms: aiResponseTime || 0,
      });
    } catch (error) {
      console.error("Error recording game analytics:", error);
    }
  }

  // ================================
  // UTILITY FUNCTIONS
  // ================================

  private async grantFreeMonthlyPackage(userId: string): Promise<void> {
    try {
      // Get the free monthly package
      const { data: freePackage, error: packageError } = await this.supabase
        .from("packages")
        .select("*")
        .eq("name", "Free Monthly")
        .single();

      if (packageError || !freePackage) {
        console.error("Free package not found:", packageError);
        return;
      }

      // Grant the package
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + freePackage.expiration_days);

      await this.supabase.from("user_packages").insert({
        user_id: userId,
        package_id: freePackage.id,
        games_remaining: freePackage.games_included,
        expires_at: expiresAt.toISOString(),
        amount_paid: 0,
        purchase_date: new Date().toISOString(),
      });

      console.log(`🎁 Granted free monthly package to user ${userId}`);
    } catch (error) {
      console.error("Error granting free package:", error);
    }
  }

  // ================================
  // ADMIN ANALYTICS
  // ================================

  async getSystemAnalytics(): Promise<any> {
    try {
      const [usersData, gamesData, revenueData, aiUsageData] =
        await Promise.all([
          this.supabase
            .from("users")
            .select("id, created_at, total_games_played")
            .order("created_at", { ascending: false })
            .limit(100),
          this.supabase
            .from("game_sessions")
            .select("*")
            .order("started_at", { ascending: false })
            .limit(100),
          this.supabase
            .from("payment_transactions")
            .select("amount, created_at, status")
            .eq("status", "completed"),
          this.supabase
            .from("ai_usage_stats")
            .select("*")
            .order("date", { ascending: false })
            .limit(30),
        ]);

      return {
        users: {
          total: usersData.data?.length || 0,
          recent: usersData.data?.slice(0, 10) || [],
        },
        games: {
          total: gamesData.data?.length || 0,
          recent: gamesData.data?.slice(0, 10) || [],
        },
        revenue: {
          total: revenueData.data?.reduce((sum, t) => sum + t.amount, 0) || 0,
          transactions: revenueData.data?.length || 0,
        },
        aiUsage: aiUsageData.data || [],
      };
    } catch (error) {
      console.error("Error fetching system analytics:", error);
      return {};
    }
  }
}

// Export singleton instance
export const authManager = new AuthManager();
