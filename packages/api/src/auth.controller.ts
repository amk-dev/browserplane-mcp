import { Hono } from "hono";
import { createAuth, type Auth } from "./lib/auth";

type Variables = {
  auth: Auth;
};

export const authController = new Hono<{
  Bindings: CloudflareBindings;
  Variables: Variables;
}>();

// Auth middleware - creates auth instance and stores in context
authController.use("*", async (c, next) => {
  const auth = createAuth(c.env.DB, c.env);
  c.set("auth", auth);
  await next();
});

// Mount Better Auth handler - handles all /api/auth/* routes
authController.on(["POST", "GET"], "/*", (c) => {
  return c.var.auth.handler(c.req.raw);
});
