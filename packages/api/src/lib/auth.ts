import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
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

    // Advanced settings
    advanced: {
      cookiePrefix: "better-auth",
      crossSubDomainCookies: {
        enabled: false,
      },
    },
  });
};

export type Auth = ReturnType<typeof createAuth>;
