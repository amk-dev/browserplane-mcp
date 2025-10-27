import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { experimental_createMcpHandler } from "agents/mcp";
import { Hono } from "hono";
import type { Context } from "hono";
import { eq } from "drizzle-orm";
import { createDb } from "../db";
import { browser } from "../db/browser.schema";
import {
  testTool,
  captureScreenshotTool,
  runJavascriptTool,
  listTabsTool,
} from "../lib/tools";

const tools = [
  testTool,
  captureScreenshotTool,
  runJavascriptTool,
  listTabsTool,
];

/**
 * Factory function that creates MCP server for a specific browser
 * browserId and env are captured in closure for tool handlers
 */
function createMcpServerForBrowser(browserId: string, env: CloudflareBindings) {
  const server = new McpServer({
    name: "Browserplane MCP",
    version: "0.0.1",
  });

  for (const tool of tools) {
    server.registerTool(tool.name, tool.def, async (input) => {
      // Get DO stub for this browser (browserId from closure)
      const id = env.BROWSER_PROXY.idFromName(browserId);
      const stub = env.BROWSER_PROXY.get(id);

      // Forward tool execution to DO
      const response = await stub.fetch(
        new Request("http://do/execute-tool", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tool: tool.name,
            input,
            requestId: crypto.randomUUID(),
          }),
        })
      );

      if (!response.ok) {
        const error = await response.json();

        if (error.error instanceof Error) {
          throw new Error(error.error);
        }
      }
      const result = await response.json();
      return result;
    });
  }

  // server.registerTool(
  //   "testTool",
  //   {
  //     title: "Test Tool - testing browser communication",
  //     description:
  //       "A test tool that forwards execution to the browser extension",
  //     inputSchema: {
  //       name: z.string().describe("Your name"),
  //     },
  //   },
  //   async (input) => {
  //     // Get DO stub for this browser (browserId from closure)
  //     const id = env.BROWSER_PROXY.idFromName(browserId);
  //     const stub = env.BROWSER_PROXY.get(id);

  //     // Forward tool execution to DO
  //     const response = await stub.fetch(
  //       new Request("http://do/execute-tool", {
  //         method: "POST",
  //         headers: { "Content-Type": "application/json" },
  //         body: JSON.stringify({
  //           tool: "testTool",
  //           input,
  //           requestId: crypto.randomUUID(),
  //         }),
  //       })
  //     );

  //     if (!response.ok) {
  //       const error = await response.json();
  //       throw new Error(error.error || "Tool execution failed");
  //     }

  //     const result = await response.json();
  //     return result;
  //   }
  // );

  return server;
}

const app = new Hono<{ Bindings: CloudflareBindings }>();

app.post("/", async (c: Context<{ Bindings: CloudflareBindings }>) => {
  console.log("Received MCP request" + new Date().toISOString());

  // Extract browserId from the route parameter
  const browserId = c.req.param("browserId");

  if (!browserId) {
    return c.json({ error: "Browser ID is required" }, 400);
  }

  console.log("MCP request for browserId:", browserId);

  // Validate that the browser exists in the database
  const db = createDb(c.env.DB);
  const browserRecord = await db.query.browser.findFirst({
    where: eq(browser.id, browserId),
  });

  if (!browserRecord) {
    return c.json({ error: "Browser not found" }, 404);
  }

  console.log("Browser found, userId:", browserRecord.userId);

  // Create MCP server for this browser (with browserId/env in closure)
  const server = createMcpServerForBrowser(browserId, c.env);

  // Create handler from the server
  const mcpHandler = experimental_createMcpHandler(server, {
    enableJsonResponse: true,
    route: `/mcp/${browserId}/mcp`, // Match the exact route path
  });

  // Handle the MCP request
  const response = await mcpHandler(c.req.raw, c.env, c.executionCtx);
  return response;
});

export default app;
