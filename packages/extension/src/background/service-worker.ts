import { WebSocketServer } from "../lib/websocket-server";
import type { ToolExecutionMessage } from "../types/websocket.types";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { getActiveTabId, getAllTabs } from "../lib/extension-helpers";

// API base URL - should match your Cloudflare Workers dev server
// @CLAUDE-CODE: move to an environment variable
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
              text: `Error executing tool: ${
                error instanceof Error ? error.message : String(error)
              }`,
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
            text: `Test tool executed successfully with input: ${JSON.stringify(
              input
            )}`,
          },
        ],
      };

    case "captureScreenshot": {
      const tabId = await getActiveTabId();
      if (!tabId) {
        return {
          content: [
            {
              type: "text",
              text: "No active tab found. Cannot capture screenshot.",
            },
          ],
          isError: true,
        };
      }

      try {
        const dataUrl = await chrome.tabs.captureVisibleTab({
          format: "jpeg",
          quality: 90,
        });

        // Extract base64 data from data URL
        const base64Data = dataUrl.split(",")[1];

        return {
          content: [
            {
              type: "image",
              data: base64Data,
              mimeType: "image/jpeg",
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Failed to capture screenshot: ${
                error instanceof Error ? error.message : String(error)
              }`,
            },
          ],
          isError: true,
        };
      }
    }

    case "runJavascript": {
      const code = input.code as string;
      const targetTabId = (input.tabId as number | undefined) ?? (await getActiveTabId());

      if (!targetTabId) {
        return {
          content: [
            {
              type: "text",
              text: "No active tab found. Cannot execute JavaScript.",
            },
          ],
          isError: true,
        };
      }

      try {
        // Execute JavaScript using userScripts API (same as old implementation)
        const result = await chrome.userScripts.execute({
          target: { tabId: targetTabId },
          world: "MAIN",
          js: [
            {
              code: code,
            },
          ],
        });

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Failed to execute JavaScript: ${
                error instanceof Error ? error.message : String(error)
              }`,
            },
          ],
          isError: true,
        };
      }
    }

    case "listTabs": {
      try {
        const tabs = await getAllTabs();
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(tabs, null, 2),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Failed to list tabs: ${
                error instanceof Error ? error.message : String(error)
              }`,
            },
          ],
          isError: true,
        };
      }
    }

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
