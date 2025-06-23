// src/app/dashboard/page.tsx - AI Mafia Detective Control Center
"use client";

import { useState, useEffect } from "react";
import { io, Socket } from "socket.io-client";

interface ServerStats {
  rooms: {
    totalRooms: number;
    activeRooms: number;
    totalPlayers: number;
    roomList: any[];
  };
  ai: [string, any][];
  server: {
    uptime: number;
    memoryUsage: any;
    timestamp: string;
  };
}

interface PersonalityInfo {
  totalPersonalities: number;
  personalities: Array<{
    name: string;
    model: string;
    archetype: string;
    description: string;
  }>;
  modelDistribution: Array<{
    model: string;
    count: number;
  }>;
}

interface GameModes {
  modes: Array<{
    id: string;
    name: string;
    description: string;
    recommended: boolean;
    playerCount: any;
    requiresCreatorAccess?: boolean;
  }>;
}

export default function Dashboard() {
  const [serverStats, setServerStats] = useState<ServerStats | null>(null);
  const [personalityInfo, setPersonalityInfo] =
    useState<PersonalityInfo | null>(null);
  const [gameModes, setGameModes] = useState<GameModes | null>(null);
  const [serverHealth, setServerHealth] = useState<any>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<
    "connecting" | "connected" | "disconnected"
  >("disconnected");
  const [liveEvents, setLiveEvents] = useState<any[]>([]);
  const [creatorPassword, setCreatorPassword] = useState("");
  const [creatorAccess, setCreatorAccess] = useState(false);

  useEffect(() => {
    // Connect to WebSocket for live updates
    const newSocket = io("http://localhost:3001");

    newSocket.on("connect", () => {
      setConnectionStatus("connected");
      console.log("🔌 Dashboard connected to server");
    });

    newSocket.on("disconnect", () => {
      setConnectionStatus("disconnected");
    });

    // Listen for all possible game events
    newSocket.on("game_event", (event) => {
      setLiveEvents((prev) =>
        [{ ...event, source: "game_event" }, ...prev].slice(0, 20)
      );
    });

    newSocket.on("player_joined", (data) => {
      setLiveEvents((prev) =>
        [
          {
            type: "player_joined",
            data,
            timestamp: new Date(),
            source: "direct",
          },
          ...prev,
        ].slice(0, 20)
      );
    });

    newSocket.on("player_left", (data) => {
      setLiveEvents((prev) =>
        [
          {
            type: "player_left",
            data,
            timestamp: new Date(),
            source: "direct",
          },
          ...prev,
        ].slice(0, 20)
      );
    });

    newSocket.on("room_created", (data) => {
      setLiveEvents((prev) =>
        [
          {
            type: "room_created",
            data,
            timestamp: new Date(),
            source: "direct",
          },
          ...prev,
        ].slice(0, 20)
      );
    });

    newSocket.on("game_started", (data) => {
      setLiveEvents((prev) =>
        [
          {
            type: "game_started",
            data,
            timestamp: new Date(),
            source: "direct",
          },
          ...prev,
        ].slice(0, 20)
      );
    });

    newSocket.on("phase_changed", (data) => {
      setLiveEvents((prev) =>
        [
          {
            type: "phase_changed",
            data,
            timestamp: new Date(),
            source: "direct",
          },
          ...prev,
        ].slice(0, 20)
      );
    });

    newSocket.on("player_eliminated", (data) => {
      setLiveEvents((prev) =>
        [
          {
            type: "player_eliminated",
            data,
            timestamp: new Date(),
            source: "direct",
          },
          ...prev,
        ].slice(0, 20)
      );
    });

    newSocket.on("vote_cast", (data) => {
      setLiveEvents((prev) =>
        [
          { type: "vote_cast", data, timestamp: new Date(), source: "direct" },
          ...prev,
        ].slice(0, 20)
      );
    });

    newSocket.on("message_received", (data) => {
      setLiveEvents((prev) =>
        [
          {
            type: "message_received",
            data,
            timestamp: new Date(),
            source: "direct",
          },
          ...prev,
        ].slice(0, 20)
      );
    });

    newSocket.on("game_ended", (data) => {
      setLiveEvents((prev) =>
        [
          { type: "game_ended", data, timestamp: new Date(), source: "direct" },
          ...prev,
        ].slice(0, 20)
      );
    });

    // Debug: Log all events
    newSocket.onAny((eventName, ...args) => {
      console.log(`🔴 Socket Event: ${eventName}`, args);
    });

    setSocket(newSocket);

    // Fetch initial data
    fetchAllData();

    // Set up polling for stats (more frequent)
    const interval = setInterval(fetchAllData, 2000); // Every 2 seconds

    return () => {
      newSocket.disconnect();
      clearInterval(interval);
    };
  }, []);

  const fetchAllData = async () => {
    try {
      // Check if server is running first
      const healthCheck = await fetch("http://localhost:3001/health").catch(
        () => null
      );

      if (!healthCheck || !healthCheck.ok) {
        // Server is offline
        setServerStats(null);
        setPersonalityInfo(null);
        setGameModes(null);
        setServerHealth(null);
        return;
      }

      const [statsRes, personalityRes, modesRes, healthRes] = await Promise.all(
        [
          fetch("http://localhost:3001/api/stats").catch(() => null),
          fetch("http://localhost:3001/api/personalities").catch(() => null),
          fetch("http://localhost:3001/api/game-modes").catch(() => null),
          fetch("http://localhost:3001/health").catch(() => null),
        ]
      );

      if (statsRes?.ok) setServerStats(await statsRes.json());
      if (personalityRes?.ok) setPersonalityInfo(await personalityRes.json());
      if (modesRes?.ok) setGameModes(await modesRes.json());
      if (healthRes?.ok) setServerHealth(await healthRes.json());
    } catch (error) {
      console.error("Error fetching data:", error);
      // Set all to null on error
      setServerStats(null);
      setPersonalityInfo(null);
      setGameModes(null);
      setServerHealth(null);
    }
  };

  const verifyCreatorAccess = async () => {
    try {
      const response = await fetch("http://localhost:3001/api/verify-creator", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: creatorPassword }),
      });

      if (response.ok) {
        setCreatorAccess(true);
        alert("🕵️‍♂️ Creator access granted!");
      } else {
        alert("❌ Invalid creator password");
      }
    } catch (error) {
      alert("❌ Error verifying creator access");
    }
  };

  const createAIOnlyGame = async () => {
    if (!creatorAccess) {
      alert("❌ Creator access required");
      return;
    }

    try {
      const response = await fetch(
        "http://localhost:3001/api/creator/ai-only-game",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            password: creatorPassword,
            gameConfig: { premiumModelsEnabled: true },
          }),
        }
      );

      if (response.ok) {
        const result = await response.json();
        alert(`🤖 AI-only game created! Room code: ${result.roomInfo.code}`);
        fetchAllData(); // Refresh stats
      } else {
        alert("❌ Failed to create AI-only game");
      }
    } catch (error) {
      alert("❌ Error creating AI-only game");
    }
  };

  const formatUptime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    return `${hours}h ${minutes}m ${secs}s`;
  };

  const formatMemory = (bytes: number) => {
    return `${Math.round(bytes / 1024 / 1024)}MB`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "connected":
        return "text-green-500";
      case "connecting":
        return "text-yellow-500";
      case "disconnected":
        return "text-red-500";
      default:
        return "text-gray-500";
    }
  };

  return (
    <div className="min-h-screen bg-noir-black text-white p-6">
      {/* Header */}
      <div className="detective-card p-6 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-detective-orange-500 mb-2">
              🕵️‍♂️ AI Mafia Detective Control Center
            </h1>
            <p className="text-noir-gray-300">
              Real-time monitoring and administration dashboard
            </p>
          </div>
          <div className="text-right">
            <div
              className={`text-sm font-medium ${getStatusColor(
                connectionStatus
              )}`}
            >
              ● {connectionStatus.toUpperCase()}
            </div>
            <div className="text-xs text-noir-gray-400 mt-1">
              {serverHealth?.timestamp &&
                new Date(serverHealth.timestamp).toLocaleTimeString()}
            </div>
          </div>
        </div>
      </div>

      {/* Server Status Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        {/* Server Health */}
        <div className="detective-card p-4">
          <h3 className="text-lg font-semibold text-detective-blue-400 mb-3">
            Server Health
          </h3>
          {serverHealth ? (
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-muted">Status:</span>
                <span className="text-green-500 font-medium">🟢 Healthy</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Uptime:</span>
                <span className="text-white">
                  {formatUptime(serverStats?.server.uptime || 0)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Memory:</span>
                <span className="text-white">
                  {formatMemory(serverStats?.server.memoryUsage?.heapUsed || 0)}
                </span>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="text-red-500 font-medium">❌ Server Offline</div>
              <div className="text-xs text-muted">
                <div className="mb-2">To start the server:</div>
                <div className="bg-noir-black p-2 rounded text-detective-blue-400 font-mono">
                  npm run dev
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Room Statistics */}
        <div className="detective-card p-4">
          <h3 className="text-lg font-semibold text-detective-blue-400 mb-3">
            Rooms
          </h3>
          {serverStats ? (
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-noir-gray-300">Total:</span>
                <span className="text-white font-medium">
                  {serverStats.rooms.totalRooms}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-noir-gray-300">Active:</span>
                <span className="text-detective-orange-500 font-medium">
                  {serverStats.rooms.activeRooms}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-noir-gray-300">Players:</span>
                <span className="text-white font-medium">
                  {serverStats.rooms.totalPlayers}
                </span>
              </div>
            </div>
          ) : (
            <div className="text-gray-500">Loading...</div>
          )}
        </div>

        {/* AI Models */}
        <div className="detective-card p-4">
          <h3 className="text-lg font-semibold text-detective-blue-400 mb-3">
            AI Models
          </h3>
          {personalityInfo ? (
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-noir-gray-300">Personalities:</span>
                <span className="text-white font-medium">
                  {personalityInfo.totalPersonalities}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-noir-gray-300">Free Tier:</span>
                <span className="text-detective-blue-400 font-medium">18</span>
              </div>
              <div className="flex justify-between">
                <span className="text-noir-gray-300">Premium:</span>
                <span className="text-detective-orange-500 font-medium">
                  {personalityInfo.totalPersonalities - 18}
                </span>
              </div>
            </div>
          ) : (
            <div className="text-gray-500">Loading...</div>
          )}
        </div>

        {/* Live Events */}
        <div className="detective-card p-4">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-lg font-semibold text-detective-blue-400">
              Live Activity
            </h3>
            <button
              onClick={fetchAllData}
              className="text-xs px-2 py-1 bg-detective-blue-600 hover:bg-detective-blue-700 rounded text-white"
            >
              🔄 Refresh
            </button>
          </div>
          <div className="space-y-1 text-sm">
            {liveEvents.length > 0 ? (
              liveEvents.slice(0, 3).map((event, i) => (
                <div key={i} className="text-detective-blue-300 truncate">
                  🔴 {event.type || "unknown"}
                  {event.timestamp && (
                    <span className="text-xs text-gray-400 ml-2">
                      {new Date(event.timestamp).toLocaleTimeString()}
                    </span>
                  )}
                </div>
              ))
            ) : (
              <div className="space-y-1">
                <div className="text-gray-500 text-xs">No recent activity</div>
                <div className="text-xs text-detective-blue-400">
                  WebSocket: {connectionStatus}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Active Rooms */}
        <div className="detective-card p-6">
          <h3 className="text-xl font-semibold text-detective-orange-500 mb-4">
            Active Rooms
          </h3>
          {serverStats?.rooms.roomList.length ? (
            <div className="space-y-3">
              {serverStats.rooms.roomList.map((room, i) => (
                <div
                  key={i}
                  className="bg-noir-gray-800 p-3 rounded border border-noir-gray-700"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-medium text-white">
                        Room {room.code}
                      </div>
                      <div className="text-sm text-noir-gray-300">
                        Players: {room.playerCount}/{room.maxPlayers}
                      </div>
                    </div>
                    <div className="text-right">
                      {room.gameInProgress ? (
                        <span className="px-2 py-1 bg-detective-orange-500 text-white text-xs rounded">
                          🎮 Playing
                        </span>
                      ) : (
                        <span className="px-2 py-1 bg-detective-blue-500 text-white text-xs rounded">
                          ⏳ Waiting
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center text-noir-gray-500 py-8">
              <div className="text-4xl mb-2">🏠</div>
              <div>No active rooms</div>
            </div>
          )}
        </div>

        {/* AI Personality Pool */}
        <div className="detective-card p-6">
          <h3 className="text-xl font-semibold text-detective-orange-500 mb-4">
            AI Personality Pool
          </h3>
          {personalityInfo ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                {personalityInfo.modelDistribution.map((model, i) => (
                  <div
                    key={i}
                    className="bg-noir-gray-800 p-3 rounded border border-noir-gray-700"
                  >
                    <div className="text-sm font-medium text-white">
                      {model.model}
                    </div>
                    <div className="text-detective-blue-400 font-bold">
                      {model.count} personalities
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-4">
                <h4 className="text-sm font-medium text-noir-gray-300 mb-2">
                  Sample Personalities:
                </h4>
                <div className="space-y-2 max-h-32 overflow-y-auto">
                  {personalityInfo.personalities
                    .slice(0, 5)
                    .map((personality, i) => (
                      <div key={i} className="text-sm">
                        <span className="text-detective-orange-400 font-medium">
                          {personality.name}
                        </span>
                        <span className="text-noir-gray-400 ml-2">
                          ({personality.archetype})
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-gray-500">Loading personalities...</div>
          )}
        </div>

        {/* Game Modes */}
        <div className="detective-card p-6">
          <h3 className="text-xl font-semibold text-detective-orange-500 mb-4">
            Available Game Modes
          </h3>
          {gameModes ? (
            <div className="space-y-3">
              {gameModes.modes.map((mode, i) => (
                <div
                  key={i}
                  className="bg-noir-gray-800 p-3 rounded border border-noir-gray-700"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-medium text-white">{mode.name}</div>
                      <div className="text-sm text-noir-gray-300">
                        {mode.description}
                      </div>
                      <div className="text-xs text-detective-blue-400 mt-1">
                        Players:{" "}
                        {typeof mode.playerCount === "object"
                          ? `${mode.playerCount.human} Human + ${mode.playerCount.ai} AI`
                          : mode.playerCount}
                      </div>
                    </div>
                    <div className="flex flex-col gap-1">
                      {mode.recommended && (
                        <span className="px-2 py-1 bg-detective-orange-500 text-white text-xs rounded">
                          ⭐ Recommended
                        </span>
                      )}
                      {mode.requiresCreatorAccess && (
                        <span className="px-2 py-1 bg-purple-600 text-white text-xs rounded">
                          🔒 Creator Only
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-gray-500">Loading game modes...</div>
          )}
        </div>

        {/* Creator Tools */}
        <div className="detective-card p-6">
          <h3 className="text-xl font-semibold text-detective-orange-500 mb-4">
            🔧 Creator Tools
          </h3>

          {!creatorAccess ? (
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-noir-gray-300 mb-2">
                  Creator Password:
                </label>
                <input
                  type="password"
                  value={creatorPassword}
                  onChange={(e) => setCreatorPassword(e.target.value)}
                  className="w-full px-3 py-2 bg-noir-gray-800 border border-noir-gray-600 rounded text-white"
                  placeholder="Enter creator password..."
                />
              </div>
              <button
                onClick={verifyCreatorAccess}
                className="w-full px-4 py-2 bg-detective-blue-600 hover:bg-detective-blue-700 text-white rounded font-medium"
              >
                🔓 Verify Access
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="text-green-500 font-medium">
                ✅ Creator access granted!
              </div>

              <button
                onClick={createAIOnlyGame}
                className="w-full px-4 py-2 bg-detective-orange-600 hover:bg-detective-orange-700 text-white rounded font-medium mb-3"
              >
                🤖 Create AI-Only Game
              </button>

              <button
                onClick={() => {
                  if (socket) {
                    socket.emit("heartbeat");
                    setLiveEvents((prev) =>
                      [
                        {
                          type: "test_event",
                          data: { message: "Manual test from dashboard" },
                          timestamp: new Date(),
                          source: "manual",
                        },
                        ...prev,
                      ].slice(0, 20)
                    );
                  }
                }}
                className="w-full px-4 py-2 bg-detective-blue-600 hover:bg-detective-blue-700 text-white rounded font-medium"
              >
                🧪 Test WebSocket
              </button>

              <div className="text-xs text-noir-gray-400">
                Creates a game with 10 AI players for testing and observation
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Live Events Feed */}
      <div className="detective-card p-6 mt-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-semibold text-detective-orange-500">
            🔴 Live Events Feed
          </h3>
          <div className="flex items-center space-x-4">
            <span className="text-sm text-gray-400">
              Events: {liveEvents.length}
            </span>
            <span className={`text-sm ${getStatusColor(connectionStatus)}`}>
              ● {connectionStatus.toUpperCase()}
            </span>
            <button
              onClick={() => setLiveEvents([])}
              className="text-xs px-2 py-1 bg-red-600 hover:bg-red-700 rounded text-white"
            >
              Clear
            </button>
          </div>
        </div>

        {liveEvents.length > 0 ? (
          <div className="bg-noir-black p-4 rounded max-h-64 overflow-y-auto">
            {liveEvents.map((event, i) => (
              <div
                key={i}
                className="text-sm font-mono mb-2 border-b border-gray-700 pb-2"
              >
                <div className="flex justify-between items-start">
                  <span className="text-detective-blue-400">
                    {event.timestamp
                      ? new Date(event.timestamp).toLocaleTimeString()
                      : "Now"}
                  </span>
                  <span className="text-detective-orange-400 font-medium">
                    {event.type || "unknown_event"}
                  </span>
                </div>
                <div className="text-gray-300 text-xs mt-1">
                  {event.data
                    ? JSON.stringify(event.data).substring(0, 150)
                    : "No data"}
                  {event.source && (
                    <span className="text-purple-400 ml-2">
                      ({event.source})
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-noir-black p-8 rounded text-center">
            <div className="text-gray-500 mb-4">
              <div className="text-4xl mb-2">📡</div>
              <div>No live events detected</div>
            </div>
            <div className="text-xs text-gray-400 space-y-1">
              <div>
                WebSocket:{" "}
                <span className={getStatusColor(connectionStatus)}>
                  {connectionStatus}
                </span>
              </div>
              <div>Check browser console for socket events</div>
              <div>Game events should appear when players take actions</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
