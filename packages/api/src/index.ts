import { Hono } from "hono";

const app = new Hono<{ Bindings: CloudflareBindings }>();

app.get("/", (c) => {
  return c.text("Hello Hono!");
});

// Route to Durable Object by userId
app.all("/proxy/:userId/*", async (c) => {
  const userId = c.req.param("userId");

  // Get Durable Object stub for this user
  const id = c.env.BROWSER_PROXY.idFromName(userId);
  const stub = c.env.BROWSER_PROXY.get(id);

  // Forward request to Durable Object
  return stub.fetch(c.req.raw);
});

// Export Durable Object class
export { BrowserProxy } from "./dos/browser-proxy";

export default app;
