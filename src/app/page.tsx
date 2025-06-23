// src/app/page.tsx - AI Mafia Home Page
"use client";

import Link from "next/link";
import { useState, useEffect } from "react";

export default function HomePage() {
  const [serverStatus, setServerStatus] = useState<
    "checking" | "online" | "offline"
  >("checking");

  useEffect(() => {
    // Check server status
    fetch("http://localhost:3001/health")
      .then((response) =>
        response.ok ? setServerStatus("online") : setServerStatus("offline")
      )
      .catch(() => setServerStatus("offline"));
  }, []);

  const getStatusIndicator = () => {
    switch (serverStatus) {
      case "checking":
        return <span className="text-yellow-500">🟡 Checking...</span>;
      case "online":
        return <span className="text-green-500">🟢 Online</span>;
      case "offline":
        return <span className="text-red-500">🔴 Offline</span>;
    }
  };

  return (
    <div className="min-h-screen bg-noir-gradient">
      {/* Hero Section */}
      <div className="container-detective py-20">
        <div className="text-center space-y-8">
          {/* Logo and Title */}
          <div className="space-y-4">
            <div className="text-8xl animate-detective-badge">🕵️‍♂️</div>
            <h1 className="text-6xl font-bold heading-detective">AI Mafia</h1>
            <p className="text-2xl text-detective-blue-400 max-w-3xl mx-auto">
              A groundbreaking social deduction game that merges classic Mafia
              mechanics with cutting-edge AI personalities
            </p>
          </div>

          {/* Server Status */}
          <div className="detective-card inline-block p-4">
            <div className="flex items-center space-x-3">
              <span className="text-noir-gray-300">Server Status:</span>
              {getStatusIndicator()}
            </div>
          </div>

          {/* Navigation Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-16 max-w-5xl mx-auto">
            {/* Dashboard */}
            <Link href="/dashboard" className="group">
              <div className="detective-card p-8 h-full transition-all duration-300 group-hover:shadow-glow-blue group-hover:scale-105">
                <div className="text-5xl mb-4">📊</div>
                <h3 className="text-2xl font-bold text-detective-orange-500 mb-3">
                  Control Center
                </h3>
                <p className="text-noir-gray-300">
                  Real-time monitoring dashboard for rooms, games, and AI
                  behavior. Perfect for testing and administration.
                </p>
                <div className="mt-4 text-detective-blue-400 group-hover:text-detective-blue-300">
                  Launch Dashboard →
                </div>
              </div>
            </Link>

            {/* Game */}
            <div className="group">
              <div className="detective-card p-8 h-full transition-all duration-300 group-hover:shadow-glow-orange opacity-60">
                <div className="text-5xl mb-4">🎮</div>
                <h3 className="text-2xl font-bold text-detective-orange-500 mb-3">
                  Play Game
                </h3>
                <p className="text-noir-gray-300">
                  Join or create a game room to play against AI personalities.
                  Experience the future of social deduction.
                </p>
                <div className="mt-4 text-noir-gray-500">
                  Coming in Phase 2 →
                </div>
              </div>
            </div>

            {/* Analytics */}
            <div className="group">
              <div className="detective-card p-8 h-full transition-all duration-300 group-hover:shadow-glow-blue opacity-60">
                <div className="text-5xl mb-4">📈</div>
                <h3 className="text-2xl font-bold text-detective-orange-500 mb-3">
                  Analytics
                </h3>
                <p className="text-noir-gray-300">
                  Detailed analytics and research data about human-AI
                  interactions and behavioral patterns.
                </p>
                <div className="mt-4 text-noir-gray-500">
                  Coming in Phase 3 →
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="bg-noir-gray-900/50 py-20">
        <div className="container-detective">
          <h2 className="text-4xl font-bold heading-detective text-center mb-16">
            Phase 1: Foundation Complete
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {/* Core Engine */}
            <div className="detective-card p-6 text-center">
              <div className="text-4xl mb-4">⚙️</div>
              <h3 className="text-xl font-semibold text-detective-blue-400 mb-3">
                Game Engine
              </h3>
              <p className="text-noir-gray-300 text-sm">
                Complete state machine with all game phases, role management,
                and win condition checking.
              </p>
            </div>

            {/* AI Integration */}
            <div className="detective-card p-6 text-center">
              <div className="text-4xl mb-4">🤖</div>
              <h3 className="text-xl font-semibold text-detective-blue-400 mb-3">
                AI Models
              </h3>
              <p className="text-noir-gray-300 text-sm">
                Integration with OpenAI, Anthropic, and Google AI with 25+
                unique personalities.
              </p>
            </div>

            {/* WebSocket Server */}
            <div className="detective-card p-6 text-center">
              <div className="text-4xl mb-4">🔌</div>
              <h3 className="text-xl font-semibold text-detective-blue-400 mb-3">
                Real-time Server
              </h3>
              <p className="text-noir-gray-300 text-sm">
                WebSocket-based multiplayer coordination with room management
                and live event streaming.
              </p>
            </div>

            {/* Dashboard */}
            <div className="detective-card p-6 text-center">
              <div className="text-4xl mb-4">📊</div>
              <h3 className="text-xl font-semibold text-detective-blue-400 mb-3">
                Control Center
              </h3>
              <p className="text-noir-gray-300 text-sm">
                Live monitoring dashboard with server stats, room management,
                and creator tools.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Tech Stack */}
      <div className="py-20">
        <div className="container-detective">
          <h2 className="text-4xl font-bold heading-detective text-center mb-16">
            Built with Modern Technology
          </h2>

          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-8 items-center justify-items-center">
            {[
              { name: "Next.js 15", icon: "⚛️" },
              { name: "TypeScript", icon: "📘" },
              { name: "Socket.io", icon: "🔌" },
              { name: "TailwindCSS", icon: "🎨" },
              { name: "OpenAI", icon: "🧠" },
              { name: "Anthropic", icon: "🤖" },
            ].map((tech, i) => (
              <div key={i} className="text-center group">
                <div className="text-4xl mb-2 group-hover:scale-110 transition-transform">
                  {tech.icon}
                </div>
                <div className="text-sm text-noir-gray-400 group-hover:text-detective-blue-400 transition-colors">
                  {tech.name}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-noir-gray-900 py-12">
        <div className="container-detective">
          <div className="text-center space-y-4">
            <div className="text-3xl">🕵️‍♂️</div>
            <p className="text-noir-gray-400">
              AI Mafia - Social Deduction Redefined
            </p>
            <div className="flex justify-center space-x-6 text-sm text-noir-gray-500">
              <span>Phase 1: Complete</span>
              <span>•</span>
              <span>Phase 2: In Development</span>
              <span>•</span>
              <span>Phase 3: Coming Soon</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
