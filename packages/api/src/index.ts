import { Hono } from "hono";
import { authController } from "./controllers/auth.controller";
import { browserController } from "./controllers/browser.controller";
import mcpController from "./controllers/mcp.controller";

const app = new Hono<{ Bindings: CloudflareBindings }>();

// Mount auth routes
app.route("/api/auth", authController);

// Mount browser routes
app.route("/api/browser", browserController);

// Mount browser-specific MCP server (browserId acts as secret)
app.route("/mcp/:browserId/mcp", mcpController);

app.get("/", (c) => {
  return c.text("Hello Hono!");
});

// Route to Durable Object by userId
// Temporarily commented out for initial deployment
// app.all("/proxy/:userId/*", async (c) => {
//   const userId = c.req.param("userId");

//   // Get Durable Object stub for this user
//   const id = c.env.BROWSER_PROXY.idFromName(userId);
//   const stub = c.env.BROWSER_PROXY.get(id);

//   // Forward request to Durable Object
//   return stub.fetch(c.req.raw);
// });

// Export Durable Object class
export { BrowserProxy } from "./dos/browser-proxy";

export default app;
