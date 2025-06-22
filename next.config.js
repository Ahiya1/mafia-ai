/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable experimental features
  experimental: {
    // Turbopack for faster builds in development
    turbo: {
      rules: {
        "*.svg": {
          loaders: ["@svgr/webpack"],
          as: "*.js",
        },
      },
    },
    // Server actions for form handling
    serverActions: true,
  },

  // TypeScript configuration
  typescript: {
    // Allow production builds to successfully complete even if there are type errors
    ignoreBuildErrors: false,
  },

  // ESLint configuration
  eslint: {
    // Disable ESLint during production builds
    ignoreDuringBuilds: false,
  },

  // Image optimization
  images: {
    formats: ["image/webp", "image/avif"],
    domains: ["localhost", "mafia-ai.xyz"],
  },

  // Environment variables
  env: {
    CUSTOM_KEY: process.env.CUSTOM_KEY,
  },

  // Headers for security
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "origin-when-cross-origin",
          },
        ],
      },
      // Enable CORS for API routes
      {
        source: "/api/:path*",
        headers: [
          {
            key: "Access-Control-Allow-Origin",
            value: process.env.FRONTEND_URL || "http://localhost:3000",
          },
          {
            key: "Access-Control-Allow-Methods",
            value: "GET, POST, PUT, DELETE, OPTIONS",
          },
          {
            key: "Access-Control-Allow-Headers",
            value: "Content-Type, Authorization",
          },
        ],
      },
    ];
  },

  // Redirects
  async redirects() {
    return [
      {
        source: "/game",
        destination: "/play",
        permanent: true,
      },
    ];
  },

  // Webpack configuration for better imports and SVG handling
  webpack: (config, { buildId, dev, isServer, defaultLoaders, webpack }) => {
    // SVG handling for the detective logo
    config.module.rules.push({
      test: /\.svg$/i,
      issuer: /\.[jt]sx?$/,
      use: ["@svgr/webpack"],
    });

    // Optimize bundle analyzer
    if (process.env.ANALYZE === "true") {
      const { BundleAnalyzerPlugin } = require("webpack-bundle-analyzer");
      config.plugins.push(
        new BundleAnalyzerPlugin({
          analyzerMode: "static",
          openAnalyzer: false,
        })
      );
    }

    return config;
  },

  // Output configuration for static export if needed
  output: process.env.BUILD_STANDALONE === "true" ? "standalone" : undefined,

  // Development configuration
  ...(process.env.NODE_ENV === "development" && {
    // Faster refresh in development
    fastRefresh: true,
    // Detailed error overlay
    onDemandEntries: {
      maxInactiveAge: 25 * 1000,
      pagesBufferLength: 2,
    },
  }),
};

module.exports = nextConfig;
