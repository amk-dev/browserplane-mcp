/**
 * Better Auth configuration for schema generation
 *
 * This file is used by the Better Auth CLI to generate the database schema.
 * The actual runtime auth instance is created in auth.ts using the createAuth factory.
 */

import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";

// Dummy drizzle instance for schema generation only
// The CLI just needs to know we're using Drizzle + SQLite
const dummyDb = {} as any;

export const auth = betterAuth({
  // Database configuration
  database: drizzleAdapter(dummyDb, {
    provider: "sqlite",
  }),

  // Auth methods
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
  },

  // Session configuration
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // Update session every 24 hours
  },
});
