/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      // 🕵️‍♂️ AI Mafia Detective Theme Colors
      colors: {
        // Primary Brand Colors (Blue & Orange)
        detective: {
          blue: {
            50: "#eff6ff",
            100: "#dbeafe",
            200: "#bfdbfe",
            300: "#93c5fd",
            400: "#60a5fa",
            500: "#3b82f6", // Primary blue
            600: "#2563eb",
            700: "#1d4ed8",
            800: "#1e40af",
            900: "#1e3a8a",
            950: "#172554",
          },
          orange: {
            50: "#fff7ed",
            100: "#ffedd5",
            200: "#fed7aa",
            300: "#fdba74",
            400: "#fb923c",
            500: "#f97316", // Primary orange
            600: "#ea580c",
            700: "#c2410c",
            800: "#9a3412",
            900: "#7c2d12",
            950: "#431407",
          },
        },

        // Noir/Dark Theme Colors
        noir: {
          black: "#0a0a0a",
          gray: {
            900: "#111111",
            800: "#1a1a1a",
            700: "#262626",
            600: "#404040",
            500: "#525252",
            400: "#737373",
            300: "#a3a3a3",
            200: "#d4d4d4",
            100: "#f5f5f5",
          },
          red: {
            500: "#ef4444", // Danger/Mafia red
            600: "#dc2626",
            700: "#b91c1c",
          },
          green: {
            500: "#10b981", // Success/Citizen green
            600: "#059669",
            700: "#047857",
          },
          amber: {
            500: "#f59e0b", // Warning/Suspicion amber
            600: "#d97706",
            700: "#b45309",
          },
        },

        // Game Phase Colors
        phase: {
          waiting: "#6b7280",
          night: "#1e293b",
          discussion: "#3b82f6",
          voting: "#f97316",
          revelation: "#ef4444",
          gameOver: "#059669",
        },

        // Role Colors
        role: {
          mafia: "#dc2626",
          citizen: "#3b82f6",
          healer: "#10b981",
          unknown: "#6b7280",
        },
      },

      // Detective Typography
      fontFamily: {
        detective: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "Menlo", "Monaco", "monospace"],
      },

      // Animation & Transitions
      animation: {
        "fade-in": "fadeIn 0.5s ease-in-out",
        "slide-up": "slideUp 0.3s ease-out",
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        glow: "glow 2s ease-in-out infinite alternate",
        "detective-badge": "detectiveBadge 1s ease-in-out",
      },

      keyframes: {
        fadeIn: {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        slideUp: {
          "0%": { transform: "translateY(100%)" },
          "100%": { transform: "translateY(0)" },
        },
        glow: {
          "0%": { boxShadow: "0 0 5px rgba(59, 130, 246, 0.5)" },
          "100%": { boxShadow: "0 0 20px rgba(59, 130, 246, 0.8)" },
        },
        detectiveBadge: {
          "0%": { transform: "scale(0.9) rotate(-5deg)", opacity: "0" },
          "50%": { transform: "scale(1.1) rotate(2deg)", opacity: "1" },
          "100%": { transform: "scale(1) rotate(0deg)", opacity: "1" },
        },
      },

      // Spacing for game elements
      spacing: {
        18: "4.5rem",
        88: "22rem",
        128: "32rem",
      },

      // Game-specific shadows
      boxShadow: {
        detective:
          "0 10px 25px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)",
        mafia:
          "0 10px 25px -3px rgba(220, 38, 38, 0.2), 0 4px 6px -2px rgba(220, 38, 38, 0.1)",
        citizen:
          "0 10px 25px -3px rgba(59, 130, 246, 0.2), 0 4px 6px -2px rgba(59, 130, 246, 0.1)",
        "glow-blue": "0 0 20px rgba(59, 130, 246, 0.4)",
        "glow-orange": "0 0 20px rgba(249, 115, 22, 0.4)",
      },

      // Border radius for game UI
      borderRadius: {
        detective: "0.75rem",
        badge: "9999px",
      },

      // Game board grid
      gridTemplateColumns: {
        players: "repeat(auto-fit, minmax(250px, 1fr))",
        roles: "repeat(4, 1fr)",
      },

      // Responsive breakpoints for game UI
      screens: {
        xs: "475px",
        "3xl": "1600px",
      },

      // Background patterns
      backgroundImage: {
        "detective-pattern":
          "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23000000' fill-opacity='0.03'%3E%3Cpath d='m36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")",
        "noir-gradient": "linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 100%)",
      },

      // Z-index layers for game UI
      zIndex: {
        modal: "1000",
        dropdown: "100",
        header: "50",
        default: "1",
        below: "-1",
      },
    },
  },
  plugins: [
    // Custom plugin for detective-themed utilities
    function ({ addUtilities }) {
      const newUtilities = {
        ".text-shadow-detective": {
          textShadow: "2px 2px 4px rgba(0, 0, 0, 0.3)",
        },
        ".text-glow-blue": {
          textShadow: "0 0 10px rgba(59, 130, 246, 0.8)",
        },
        ".text-glow-orange": {
          textShadow: "0 0 10px rgba(249, 115, 22, 0.8)",
        },
        ".detective-card": {
          "@apply bg-noir-gray-800 border border-noir-gray-700 rounded-detective shadow-detective":
            {},
        },
        ".mafia-glow": {
          "@apply ring-2 ring-role-mafia shadow-mafia": {},
        },
        ".citizen-glow": {
          "@apply ring-2 ring-role-citizen shadow-citizen": {},
        },
        ".phase-indicator": {
          "@apply px-3 py-1 rounded-badge text-sm font-medium uppercase tracking-wide":
            {},
        },
      };
      addUtilities(newUtilities);
    },
  ],
};
