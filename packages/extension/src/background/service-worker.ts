import { WebSocketServer } from "../lib/websocket-server";
import type { ToolExecutionMessage } from "../types/websocket.types";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

// API base URL - should match your Cloudflare Workers dev server
const API_BASE_URL = "http://localhost:8787";

let wsServer: WebSocketServer | null = null;

/**
 * Initialize WebSocket connection
 */
async function initializeWebSocket() {
  if (wsServer?.isConnected()) {
    console.log("WebSocket already connected");
    return;
  }

  wsServer = new WebSocketServer({
    apiBaseUrl: API_BASE_URL,
    onConnect: () => {
      console.log("✅ Connected to Browserplane server");
      // Update extension badge or icon
      chrome.action.setBadgeText({ text: "ON" });
      chrome.action.setBadgeBackgroundColor({ color: "#4CAF50" });
    },
    onDisconnect: () => {
      console.log("🔌 Disconnected from Browserplane server");
      // Update extension badge or icon
      chrome.action.setBadgeText({ text: "OFF" });
      chrome.action.setBadgeBackgroundColor({ color: "#F44336" });
    },
    onToolExecution: async (message: ToolExecutionMessage) => {
      console.log("🔧 Executing tool:", message.tool);
      await handleToolExecution(message);
    },
    onError: (error: Error) => {
      console.error("❌ WebSocket error:", error);
    },
    reconnectInterval: 5000,
    maxReconnectAttempts: 10,
  });

  const success = await wsServer.connectViaWebSocket();
  if (!success) {
    console.error("❌ Failed to connect to WebSocket");
  }
}

/**
 * Handle tool execution requests from the server
 */
async function handleToolExecution(message: ToolExecutionMessage) {
  const { requestId, tool, input } = message;

  try {
    // Execute the tool based on the tool name
    const result = await executeToolByName(tool, input);

    // Send response back to server
    if (wsServer) {
      wsServer.send({
        type: "tool-response",
        requestId,
        result,
      });
      console.log("✅ Sent tool response for request:", requestId);
    }
  } catch (error) {
    console.error("❌ Error executing tool:", error);

    // Send error response
    if (wsServer) {
      wsServer.send({
        type: "tool-response",
        requestId,
        result: {
          content: [
            {
              type: "text",
              text: `Error executing tool: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        } satisfies CallToolResult,
      });
    }
  }
}

/**
 * Execute tool by name
 * TODO: Implement actual tool handlers
 */
async function executeToolByName(
  toolName: string,
  input: Record<string, unknown>
): Promise<CallToolResult> {
  // Placeholder implementation
  // In the future, this will route to different tool handlers

  console.log(`Executing tool: ${toolName}`, input);

  switch (toolName) {
    case "testTool":
      return {
        content: [
          {
            type: "text",
            text: `Test tool executed successfully with input: ${JSON.stringify(input)}`,
          },
        ],
      };

    // Add more tool handlers here
    // case "navigate":
    //   return await navigateTool(input);
    // case "click":
    //   return await clickTool(input);
    // etc.

    default:
      return {
        content: [
          {
            type: "text",
            text: `Unknown tool: ${toolName}. Tool not implemented yet.`,
          },
        ],
        isError: true,
      };
  }
}

/**
 * Extension installed/updated
 */
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log("Extension installed/updated:", details.reason);

  // Initialize WebSocket connection
  await initializeWebSocket();
});

/**
 * Extension startup (browser launch)
 */
chrome.runtime.onStartup.addListener(async () => {
  console.log("Extension started");

  // Initialize WebSocket connection
  await initializeWebSocket();
});

/**
 * Handle messages from popup/content scripts
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("Received message:", message);

  switch (message.type) {
    case "connect":
      initializeWebSocket().then(() => {
        sendResponse({ success: true, connected: wsServer?.isConnected() });
      });
      return true; // Keep channel open for async response

    case "disconnect":
      wsServer?.disconnect();
      sendResponse({ success: true });
      return false;

    case "status":
      sendResponse({
        connected: wsServer?.isConnected() || false,
        browserId: wsServer?.getBrowserIdSync() || null,
      });
      return false;

    default:
      sendResponse({ error: "Unknown message type" });
      return false;
  }
});

/**
 * Keep service worker alive
 * Chrome extensions can hibernate service workers, so we need to keep it alive
 */
setInterval(() => {
  // Ping to keep service worker active
  if (wsServer?.isConnected()) {
    wsServer.send({
      type: "ping",
      timestamp: Date.now(),
    });
  }
}, 20000); // Every 20 seconds

console.log("🚀 Browserplane service worker initialized");
