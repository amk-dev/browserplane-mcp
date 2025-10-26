import { Hono } from "hono";
import { nanoid } from "nanoid";
import { eq } from "drizzle-orm";
import { createDb } from "../db";
import { browser } from "../db/browser.schema";
import { requireAuth, requireTokenAuth, type AuthVariables } from "../middleware/auth.middleware";

export const browserController = new Hono<{
  Bindings: CloudflareBindings;
  Variables: AuthVariables;
}>();

// POST /api/browser/register - Create a new browser
browserController.post("/register", requireAuth(), async (c) => {
  const user = c.get("user");

  // Generate nano ID
  const browserId = nanoid();

  // Insert into database
  const db = createDb(c.env.DB);
  await db.insert(browser).values({
    id: browserId,
    userId: user.id,
  });

  return c.json({ browserId });
});

// GET /api/browser/list - List user's browsers
browserController.get("/list", requireAuth(), async (c) => {
  const user = c.get("user");

  // Query user's browsers
  const db = createDb(c.env.DB);
  const browsers = await db
    .select()
    .from(browser)
    .where(eq(browser.userId, user.id));

  return c.json({ browsers });
});

// GET /api/browser/:browserId/connect - WebSocket connection for browser extension
browserController.get("/:browserId/connect", requireTokenAuth(), async (c) => {
  const user = c.get("user");
  const browserId = c.req.param("browserId");

  // Get browser and validate ownership
  const db = createDb(c.env.DB);
  const browserRecord = await db.query.browser.findFirst({
    where: eq(browser.id, browserId),
  });

  if (!browserRecord) {
    return c.json({ error: "Browser not found" }, 404);
  }

  // Security check: Browser must belong to authenticated user
  if (browserRecord.userId !== user.id) {
    return c.json({ error: "Forbidden" }, 403);
  }

  // Check for WebSocket upgrade
  const upgradeHeader = c.req.header("Upgrade");
  if (!upgradeHeader || upgradeHeader !== "websocket") {
    return c.json({ error: "Expected WebSocket upgrade" }, 426);
  }

  // Route to Durable Object
  const id = c.env.BROWSER_PROXY.idFromName(browserId);
  const stub = c.env.BROWSER_PROXY.get(id);

  return stub.fetch(c.req.raw);
});
