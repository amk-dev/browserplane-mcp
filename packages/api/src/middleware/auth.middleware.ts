import type { Context, Next } from "hono";
import { createAuth } from "../lib/auth";
import type { Session, User } from "better-auth/types";

export type AuthVariables = {
  user: User;
  session: Session;
};

/**
 * Middleware to require authentication on routes.
 * Validates session using Better Auth and attaches user/session to context.
 * Returns 401 if not authenticated.
 */
export const requireAuth = () => {
  return async (c: Context<{ Bindings: CloudflareBindings; Variables: AuthVariables }>, next: Next) => {
    // Debug logging
    console.log("requireAuth middleware:");
    console.log("- Path:", c.req.path);
    console.log("- Cookie header:", c.req.header("Cookie"));
    console.log("- All headers:", Object.fromEntries(c.req.raw.headers.entries()));

    const auth = createAuth(c.env.DB, c.env);
    const session = await auth.api.getSession({ headers: c.req.raw.headers });

    console.log("- Session result:", session ? "Found" : "Not found");
    console.log("- User:", session?.user?.email);

    if (!session?.user) {
      console.log("❌ Auth failed - returning 401");
      return c.json({ error: "Unauthorized" }, 401);
    }

    console.log("✅ Auth succeeded");
    c.set("user", session.user);
    c.set("session", session.session);

    await next();
  };
};

/**
 * Middleware to require authentication via token query parameter.
 * Useful for WebSocket connections where cookies may not be properly sent.
 * Extracts token from query params, converts to Bearer header, and validates.
 * Returns 401 if token is missing or invalid.
 *
 * The bearer plugin automatically converts the Authorization header to a session cookie internally.
 */
export const requireTokenAuth = () => {
  return async (c: Context<{ Bindings: CloudflareBindings; Variables: AuthVariables }>, next: Next) => {
    // Debug logging
    console.log("requireTokenAuth middleware:");
    console.log("- Path:", c.req.path);

    // Extract token from query parameters
    const token = c.req.query("token");
    console.log("- Token present:", !!token);

    if (!token) {
      console.log("❌ Auth failed - no token provided");
      return c.json({ error: "Unauthorized: token required" }, 401);
    }

    // Create new headers with Authorization: Bearer token
    // The bearer plugin will intercept this and convert it to a session cookie
    const headers = new Headers(c.req.raw.headers);
    headers.set("Authorization", `Bearer ${token}`);

    const auth = createAuth(c.env.DB, c.env);
    const session = await auth.api.getSession({ headers });

    console.log("- Session result:", session ? "Found" : "Not found");
    console.log("- User:", session?.user?.email);

    if (!session?.user) {
      console.log("❌ Auth failed - invalid token");
      return c.json({ error: "Unauthorized: invalid token" }, 401);
    }

    console.log("✅ Auth succeeded");
    c.set("user", session.user);
    c.set("session", session.session);

    await next();
  };
};
