import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

type ToolName = Parameters<typeof McpServer.prototype.registerTool>[0];
type ToolDef = Parameters<typeof McpServer.prototype.registerTool>[1];

// in here, we dont have handlers, the actual execution takes place in the browser extension
type BrowserplaneServerTool = {
  name: ToolName;
  def: ToolDef;
};

export const testTool: BrowserplaneServerTool = {
  name: "testTool",
  def: {
    title: "Test Tool - testing browser communication",
    description: "A test tool that forwards execution to the browser extension",
    inputSchema: {},
  },
};

export const captureScreenshotTool: BrowserplaneServerTool = {
  name: "captureScreenshot",
  def: {
    title: "Capture Screenshot",
    description:
      "Captures a screenshot of the current active browser tab for visual understanding of the page. Returns a base64-encoded JPEG image.",
    inputSchema: {},
  },
};

export const runJavascriptTool: BrowserplaneServerTool = {
  name: "runJavascript",
  def: {
    title: "Run JavaScript",
    description:
      "Executes JavaScript code in a specified browser tab or the active tab, allowing DOM manipulation and data extraction. The code should be wrapped in a function that returns a value. Use human-like behavior patterns: focus elements before interaction, check button states, etc. All returned data must be JSON-serializable.",
    inputSchema: {
      code: z
        .string()
        .describe(
          "The JavaScript code to execute. Should be wrapped in a function with a return value."
        ),
      tabId: z
        .number()
        .optional()
        .describe(
          "Optional tab ID for execution. If omitted, uses the active tab."
        ),
    },
  },
};

export const listTabsTool: BrowserplaneServerTool = {
  name: "listTabs",
  def: {
    title: "List Tabs",
    description:
      "Lists all open browser tabs with their metadata (id, title, url, active status, windowId). Useful for tab management and multi-tab workflows.",
    inputSchema: {},
  },
};
