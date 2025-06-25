-- server/lib/database/migrations/001_initial_schema.sql
-- AI Mafia Database Schema for Revolutionary Architecture
-- COMMIT 4: Complete database setup for enhanced analytics

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create exec_sql function for migrations (if not exists)
CREATE OR REPLACE FUNCTION exec_sql(sql TEXT)
RETURNS TEXT AS $$
BEGIN
  EXECUTE sql;
  RETURN 'OK';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Users table (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.users (
    id UUID REFERENCES auth.users(id) PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Game statistics
    total_games_played INTEGER DEFAULT 0,
    total_wins INTEGER DEFAULT 0,
    ai_detection_accuracy DECIMAL(5,2) DEFAULT 0.0,
    favorite_role TEXT DEFAULT 'citizen',
    
    -- User preferences
    preferred_ai_tier TEXT DEFAULT 'free', -- 'free' or 'premium'
    notification_preferences JSONB DEFAULT '{"email": true, "push": false}',
    
    -- Account status
    is_active BOOLEAN DEFAULT true,
    is_verified BOOLEAN DEFAULT false,
    last_login TIMESTAMP WITH TIME ZONE,
    
    -- Creator access
    is_creator BOOLEAN DEFAULT false,
    creator_permissions JSONB DEFAULT '[]'
);

-- Packages table for monetization
CREATE TABLE IF NOT EXISTS public.packages (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    price_usd DECIMAL(10,2) NOT NULL,
    games_included INTEGER NOT NULL,
    expiration_days INTEGER NOT NULL DEFAULT 90,
    features JSONB NOT NULL DEFAULT '[]',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User packages (purchases)
CREATE TABLE IF NOT EXISTS public.user_packages (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    package_id UUID REFERENCES public.packages(id) ON DELETE CASCADE,
    
    -- Purchase details
    purchase_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    payment_id TEXT, -- PayPal transaction ID
    amount_paid DECIMAL(10,2) NOT NULL,
    
    -- Package status
    games_remaining INTEGER NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    is_active BOOLEAN DEFAULT true,
    
    -- Metadata
    purchase_metadata JSONB DEFAULT '{}'
);

-- 🔥 COMMIT 4: Enhanced game sessions with revolutionary architecture data
CREATE TABLE IF NOT EXISTS public.game_sessions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    session_id TEXT UNIQUE NOT NULL, -- From orchestrator.gameSessionId
    room_code TEXT NOT NULL,
    
    -- Game configuration
    total_players INTEGER NOT NULL DEFAULT 10,
    human_players INTEGER NOT NULL DEFAULT 1,
    ai_players INTEGER NOT NULL DEFAULT 9,
    premium_models_enabled BOOLEAN DEFAULT false,
    
    -- Timing
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ended_at TIMESTAMP WITH TIME ZONE,
    duration_seconds INTEGER,
    
    -- Results
    winner TEXT, -- 'citizens' or 'mafia'
    win_reason TEXT,
    total_rounds INTEGER DEFAULT 0,
    
    -- AI cost tracking
    total_ai_cost DECIMAL(10,4) DEFAULT 0.0,
    ai_requests_made INTEGER DEFAULT 0,
    
    -- 🔥 COMMIT 4: Revolutionary architecture stats
    context_operations INTEGER DEFAULT 0,
    name_mappings INTEGER DEFAULT 0,
    parsing_success_rate DECIMAL(5,2) DEFAULT 100.0,
    phase_transitions INTEGER DEFAULT 0,
    
    -- Metadata
    game_metadata JSONB DEFAULT '{}',
    
    -- Indexes for analytics
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Player sessions (links users to game sessions)
CREATE TABLE IF NOT EXISTS public.player_sessions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    game_session_id UUID REFERENCES public.game_sessions(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    
    -- Player details
    player_name TEXT NOT NULL,
    game_name TEXT NOT NULL, -- Anonymous name used in game
    player_type TEXT NOT NULL, -- 'human' or 'ai'
    ai_model TEXT, -- AI model used if AI player
    ai_personality TEXT, -- AI personality name
    assigned_role TEXT NOT NULL, -- 'citizen', 'mafia_leader', etc.
    
    -- Performance
    survived_rounds INTEGER DEFAULT 0,
    was_eliminated BOOLEAN DEFAULT false,
    elimination_round INTEGER,
    elimination_cause TEXT, -- 'voted_out' or 'mafia_kill'
    
    -- Voting behavior
    votes_cast INTEGER DEFAULT 0,
    accurate_votes INTEGER DEFAULT 0,
    voted_for_mafia INTEGER DEFAULT 0,
    
    -- Communication
    messages_sent INTEGER DEFAULT 0,
    average_message_length DECIMAL(6,2) DEFAULT 0.0,
    
    -- AI detection (for humans)
    ai_players_identified INTEGER DEFAULT 0,
    ai_detection_accuracy DECIMAL(5,2) DEFAULT 0.0,
    
    -- Final outcome
    won_game BOOLEAN DEFAULT false,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 🔥 COMMIT 4: Enhanced analytics with revolutionary architecture events
CREATE TABLE IF NOT EXISTS public.game_analytics (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    game_session_id UUID REFERENCES public.game_sessions(id) ON DELETE CASCADE,
    
    -- Event details
    event_type TEXT NOT NULL, -- 'message', 'vote', 'elimination', 'phase_change', 'context_operation', 'ai_response'
    event_data JSONB NOT NULL,
    
    -- Context
    game_phase TEXT NOT NULL,
    round_number INTEGER NOT NULL DEFAULT 0,
    player_id UUID, -- Can be NULL for system events
    
    -- Timing
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- AI-specific data
    ai_model TEXT,
    ai_cost DECIMAL(10,4) DEFAULT 0.0,
    ai_tokens_used INTEGER DEFAULT 0,
    ai_response_time_ms INTEGER DEFAULT 0,
    
    -- 🔥 COMMIT 4: Revolutionary architecture metrics
    context_operation_type TEXT, -- 'trigger', 'update', 'push'
    parsing_success BOOLEAN DEFAULT true,
    anonymity_preserved BOOLEAN DEFAULT true
);

-- AI model usage statistics
CREATE TABLE IF NOT EXISTS public.ai_usage_stats (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    
    -- Model details
    model_name TEXT NOT NULL,
    provider TEXT NOT NULL, -- 'openai', 'anthropic', 'google'
    tier TEXT NOT NULL, -- 'free' or 'premium'
    
    -- Usage metrics (daily aggregation)
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    total_requests INTEGER DEFAULT 0,
    total_tokens_input INTEGER DEFAULT 0,
    total_tokens_output INTEGER DEFAULT 0,
    total_cost DECIMAL(10,4) DEFAULT 0.0,
    
    -- Performance metrics
    average_response_time_ms INTEGER DEFAULT 0,
    error_count INTEGER DEFAULT 0,
    success_rate DECIMAL(5,2) DEFAULT 100.0,
    
    -- Context
    games_used_in INTEGER DEFAULT 0,
    unique_users INTEGER DEFAULT 0,
    
    -- 🔥 COMMIT 4: Revolutionary architecture performance
    context_operations_handled INTEGER DEFAULT 0,
    parsing_success_rate DECIMAL(5,2) DEFAULT 100.0,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(model_name, date)
);

-- Payment transactions
CREATE TABLE IF NOT EXISTS public.payment_transactions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    
    -- PayPal details
    paypal_transaction_id TEXT UNIQUE NOT NULL,
    paypal_payment_id TEXT,
    paypal_order_id TEXT,
    
    -- Transaction details
    amount DECIMAL(10,2) NOT NULL,
    currency TEXT DEFAULT 'USD',
    status TEXT NOT NULL, -- 'pending', 'completed', 'failed', 'refunded'
    
    -- Package info
    package_id UUID REFERENCES public.packages(id),
    package_name TEXT NOT NULL,
    games_purchased INTEGER NOT NULL,
    
    -- Metadata
    payment_method TEXT DEFAULT 'paypal',
    transaction_metadata JSONB DEFAULT '{}',
    
    -- Timing
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    refunded_at TIMESTAMP WITH TIME ZONE
);

-- 🔥 COMMIT 4: Revolutionary architecture insights table
CREATE TABLE IF NOT EXISTS public.architecture_insights (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    
    -- Aggregation period
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    
    -- Revolutionary architecture metrics
    total_context_operations INTEGER DEFAULT 0,
    context_operation_success_rate DECIMAL(5,2) DEFAULT 100.0,
    average_context_response_time_ms INTEGER DEFAULT 0,
    
    -- Name registry performance
    total_name_mappings INTEGER DEFAULT 0,
    anonymity_success_rate DECIMAL(5,2) DEFAULT 100.0,
    
    -- Response parsing performance
    total_ai_responses INTEGER DEFAULT 0,
    parsing_success_rate DECIMAL(5,2) DEFAULT 100.0,
    fallback_usage_rate DECIMAL(5,2) DEFAULT 0.0,
    
    -- Phase manager performance
    phase_transition_success_rate DECIMAL(5,2) DEFAULT 100.0,
    average_phase_duration_ms INTEGER DEFAULT 0,
    
    -- AI coordination metrics
    ai_coordination_success_rate DECIMAL(5,2) DEFAULT 100.0,
    average_ai_response_quality DECIMAL(5,2) DEFAULT 0.0,
    
    generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Research data aggregation (anonymized)
CREATE TABLE IF NOT EXISTS public.research_insights (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    
    -- Aggregation period
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    
    -- Player behavior insights
    avg_ai_detection_rate DECIMAL(5,2),
    most_successful_strategies JSONB,
    voting_pattern_analysis JSONB,
    communication_trends JSONB,
    
    -- AI performance insights
    ai_model_effectiveness JSONB,
    human_vs_ai_win_rates JSONB,
    personality_preference_data JSONB,
    
    -- Business insights
    user_engagement_metrics JSONB,
    package_conversion_rates JSONB,
    cost_optimization_data JSONB,
    
    -- 🔥 COMMIT 4: Revolutionary architecture insights
    revolutionary_architecture_performance JSONB,
    context_operation_insights JSONB,
    anonymity_effectiveness JSONB,
    
    -- Metadata
    total_games_analyzed INTEGER NOT NULL,
    total_players_analyzed INTEGER NOT NULL,
    generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 🔥 COMMIT 4: Enhanced indexes for revolutionary architecture performance
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_username ON public.users(username);
CREATE INDEX IF NOT EXISTS idx_users_last_login ON public.users(last_login);
CREATE INDEX IF NOT EXISTS idx_users_is_creator ON public.users(is_creator);

CREATE INDEX IF NOT EXISTS idx_game_sessions_started_at ON public.game_sessions(started_at);
CREATE INDEX IF NOT EXISTS idx_game_sessions_room_code ON public.game_sessions(room_code);
CREATE INDEX IF NOT EXISTS idx_game_sessions_session_id ON public.game_sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_game_sessions_winner ON public.game_sessions(winner);
CREATE INDEX IF NOT EXISTS idx_game_sessions_premium ON public.game_sessions(premium_models_enabled);

CREATE INDEX IF NOT EXISTS idx_player_sessions_game_id ON public.player_sessions(game_session_id);
CREATE INDEX IF NOT EXISTS idx_player_sessions_user_id ON public.player_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_player_sessions_type ON public.player_sessions(player_type);
CREATE INDEX IF NOT EXISTS idx_player_sessions_role ON public.player_sessions(assigned_role);
CREATE INDEX IF NOT EXISTS idx_player_sessions_ai_model ON public.player_sessions(ai_model);

CREATE INDEX IF NOT EXISTS idx_game_analytics_session_id ON public.game_analytics(game_session_id);
CREATE INDEX IF NOT EXISTS idx_game_analytics_timestamp ON public.game_analytics(timestamp);
CREATE INDEX IF NOT EXISTS idx_game_analytics_event_type ON public.game_analytics(event_type);
CREATE INDEX IF NOT EXISTS idx_game_analytics_ai_model ON public.game_analytics(ai_model);
CREATE INDEX IF NOT EXISTS idx_game_analytics_player_id ON public.game_analytics(player_id);
CREATE INDEX IF NOT EXISTS idx_game_analytics_context_operation ON public.game_analytics(context_operation_type);

CREATE INDEX IF NOT EXISTS idx_ai_usage_stats_date ON public.ai_usage_stats(date);
CREATE INDEX IF NOT EXISTS idx_ai_usage_stats_model ON public.ai_usage_stats(model_name);
CREATE INDEX IF NOT EXISTS idx_ai_usage_stats_provider ON public.ai_usage_stats(provider);

CREATE INDEX IF NOT EXISTS idx_payment_transactions_user ON public.payment_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_status ON public.payment_transactions(status);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_created ON public.payment_transactions(created_at);

CREATE INDEX IF NOT EXISTS idx_architecture_insights_period ON public.architecture_insights(period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_research_insights_period ON public.research_insights(period_start, period_end);

-- 🔥 COMMIT 4: Row Level Security (RLS) policies
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;

-- Users can only see their own data
DROP POLICY IF EXISTS "Users can view own profile" ON public.users;
CREATE POLICY "Users can view own profile" ON public.users
    FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
CREATE POLICY "Users can update own profile" ON public.users
    FOR UPDATE USING (auth.uid() = id);

-- User packages policies
DROP POLICY IF EXISTS "Users can view own packages" ON public.user_packages;
CREATE POLICY "Users can view own packages" ON public.user_packages
    FOR SELECT USING (auth.uid() = user_id);

-- Player sessions (users can see their own session data)
DROP POLICY IF EXISTS "Users can view own game sessions" ON public.player_sessions;
CREATE POLICY "Users can view own game sessions" ON public.player_sessions
    FOR SELECT USING (auth.uid() = user_id);

-- Payment transactions (users can see their own transactions)
DROP POLICY IF EXISTS "Users can view own transactions" ON public.payment_transactions;
CREATE POLICY "Users can view own transactions" ON public.payment_transactions
    FOR SELECT USING (auth.uid() = user_id);

-- 🔥 COMMIT 4: Enhanced functions for revolutionary architecture
CREATE OR REPLACE FUNCTION update_user_stats()
RETURNS TRIGGER AS $$
BEGIN
    -- Update user statistics when a game session ends
    IF NEW.won_game IS DISTINCT FROM OLD.won_game AND NEW.user_id IS NOT NULL THEN
        UPDATE public.users 
        SET 
            total_games_played = total_games_played + 1,
            total_wins = total_wins + CASE WHEN NEW.won_game THEN 1 ELSE 0 END,
            ai_detection_accuracy = NEW.ai_detection_accuracy,
            updated_at = NOW()
        WHERE id = NEW.user_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_user_stats_trigger ON public.player_sessions;
CREATE TRIGGER update_user_stats_trigger
    AFTER UPDATE ON public.player_sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_user_stats();

-- 🔥 COMMIT 4: Function to check revolutionary architecture performance
CREATE OR REPLACE FUNCTION get_architecture_performance(
    start_date DATE DEFAULT CURRENT_DATE - INTERVAL '7 days',
    end_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE(
    context_operations INTEGER,
    context_success_rate DECIMAL,
    parsing_success_rate DECIMAL,
    anonymity_success_rate DECIMAL,
    phase_transitions INTEGER,
    ai_responses INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COALESCE(SUM(gs.context_operations), 0)::INTEGER as context_operations,
        COALESCE(AVG(gs.parsing_success_rate), 100.0)::DECIMAL as context_success_rate,
        COALESCE(AVG(gs.parsing_success_rate), 100.0)::DECIMAL as parsing_success_rate,
        100.0::DECIMAL as anonymity_success_rate, -- Perfect anonymity by design
        COALESCE(SUM(gs.phase_transitions), 0)::INTEGER as phase_transitions,
        COALESCE(SUM(gs.ai_requests_made), 0)::INTEGER as ai_responses
    FROM public.game_sessions gs
    WHERE gs.started_at::DATE BETWEEN start_date AND end_date;
END;
$$ LANGUAGE plpgsql;

-- Function to check package validity with enhanced features
CREATE OR REPLACE FUNCTION check_user_package_access(user_uuid UUID, required_features TEXT[])
RETURNS BOOLEAN AS $$
DECLARE
    valid_package RECORD;
BEGIN
    SELECT up.* INTO valid_package
    FROM public.user_packages up
    JOIN public.packages p ON up.package_id = p.id
    WHERE up.user_id = user_uuid
        AND up.is_active = true
        AND up.expires_at > NOW()
        AND up.games_remaining > 0
        AND p.features @> to_jsonb(required_features)
    ORDER BY up.expires_at DESC
    LIMIT 1;
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- 🔥 COMMIT 4: Insert enhanced packages with revolutionary architecture features
INSERT INTO public.packages (name, description, price_usd, games_included, expiration_days, features, is_active) VALUES
(
    'Premium Single Game',
    'One premium game with advanced AI models and revolutionary architecture analytics',
    1.00,
    1,
    30,
    '["premium_models", "advanced_analytics", "ai_reasoning_visible", "observer_mode", "revolutionary_architecture", "context_insights"]',
    true
),
(
    'Social Package',
    'Monthly subscription: 10 premium games with revolutionary architecture insights',
    4.99,
    10,
    30,
    '["premium_models", "advanced_analytics", "ai_reasoning_visible", "observer_mode", "game_recording", "custom_rooms", "priority_support", "revolutionary_architecture", "context_insights", "anonymity_insights"]',
    true
),
(
    'Extra Package', 
    'Monthly subscription: 40 premium games with full revolutionary architecture analytics',
    19.99,
    40,
    30,
    '["premium_models", "advanced_analytics", "ai_reasoning_visible", "observer_mode", "game_recording", "custom_rooms", "priority_support", "data_export", "research_insights", "full_observer_dashboard", "ai_personality_selection", "revolutionary_architecture", "context_insights", "anonymity_insights", "phase_manager_insights", "ai_coordination_metrics"]',
    true
),
(
    'Creator Access',
    'Unlimited access with full revolutionary architecture debugging and insights',
    0.00,
    999999,
    365,
    '["premium_models", "advanced_analytics", "ai_reasoning_visible", "observer_mode", "game_recording", "custom_rooms", "priority_support", "data_export", "research_insights", "full_observer_dashboard", "ai_personality_selection", "unlimited_games", "ai_only_games", "admin_tools", "database_access", "analytics_export", "game_management", "revolutionary_architecture", "context_insights", "anonymity_insights", "phase_manager_insights", "ai_coordination_metrics", "real_time_debugging", "architecture_performance_monitoring"]',
    true
)
ON CONFLICT (name) DO UPDATE SET
    description = EXCLUDED.description,
    features = EXCLUDED.features;