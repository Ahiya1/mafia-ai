/// <reference types="next" />
/// <reference types="next/image-types/global" />

// NOTE: This file should not be edited
// see https://nextjs.org/docs/basic-features/typescript for more information.

declare namespace NodeJS {
  interface ProcessEnv {
    OPENAI_API_KEY: string;
    ANTHROPIC_API_KEY: string;
    GOOGLE_AI_API_KEY: string;
    CREATOR_BYPASS_PASSWORD: string;
    PORT?: string;
    NODE_ENV: "development" | "production" | "test";
    FRONTEND_URL?: string;
  }
}
