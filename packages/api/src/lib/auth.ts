import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { bearer } from "better-auth/plugins";
import { createDb } from "../db";

export const createAuth = (db: D1Database, env: CloudflareBindings) => {
  return betterAuth({
    // Base configuration
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,

    // Database adapter
    database: drizzleAdapter(createDb(db), {
      provider: "sqlite",
    }),

    // Social providers
    socialProviders: {
      google: {
        clientId: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
      },
    },

    // Auth methods
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false, // Start simple, enable later with email service
    },

    // Session configuration
    session: {
      expiresIn: 60 * 60 * 24 * 7, // 7 days
      updateAge: 60 * 60 * 24, // Update session every 24 hours
    },

    // Trusted origins for browser extension
    trustedOrigins: [
      "chrome-extension://*", // Allow all Chrome extensions during development
      "chrome-extension://aglaiobmmdghpbaiggkhmdhfbgfkfkdk",
    ],

    // Advanced settings
    advanced: {
      cookiePrefix: "better-auth",
      crossSubDomainCookies: {
        enabled: false,
      },
    },

    // Plugins
    plugins: [
      bearer(), // Enable bearer token authentication for WebSocket and API clients
    ],
  });
};

export type Auth = ReturnType<typeof createAuth>;
