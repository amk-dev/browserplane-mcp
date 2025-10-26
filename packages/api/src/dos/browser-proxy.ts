import { DurableObject } from "cloudflare:workers";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

const toolExecutionRequestSchema = z.object({
  tool: z.string(),
  input: z.record(z.unknown()),
  requestId: z.string(),
});

type PendingRequest = {
  resolve: (value: CallToolResult) => void;
  reject: (error: Error) => void;
  timeoutId: ReturnType<typeof setTimeout>;
};

export class BrowserProxy extends DurableObject {
  private pendingRequests: Map<string, PendingRequest> = new Map();

  constructor(ctx: DurableObjectState, env: CloudflareBindings) {
    super(ctx, env);

    // Restore any hibernated WebSockets
    this.ctx.getWebSockets().forEach((ws) => {
      // const attachment = ws.deserializeAttachment();
      // if (attachment) {
      //   console.log(
      //     "Restored WebSocket - connected at:",
      //     new Date(attachment.connectedAt)
      //   );
      // }
    });

    // Set up auto-response for ping/pong without waking the DO
    this.ctx.setWebSocketAutoResponse(
      new WebSocketRequestResponsePair("ping", "pong")
    );
  }

  async fetch(request: Request): Promise<Response> {
    const upgradeHeader = request.headers.get("Upgrade");

    // Handle WebSocket upgrades from browser extension
    if (upgradeHeader === "websocket") {
      return this.handleWebSocketUpgrade(request);
    }

    // Handle tool execution requests from MCP server
    const url = new URL(request.url);
    if (request.method === "POST" && url.pathname === "/execute-tool") {
      return this.handleToolExecution(request);
    }

    return new Response("WebSocket upgrade or /execute-tool POST expected", {
      status: 426,
    });
  }

  /**
   * Handle WebSocket upgrade from browser extension
   * Only allows one connection per browser - closes existing ones
   */
  private handleWebSocketUpgrade(request: Request): Response {
    // Close any existing connections (browser reconnecting)
    const existingConnections = this.ctx.getWebSockets();
    if (existingConnections.length > 0) {
      existingConnections.forEach((ws) => {
        ws.close(1000, "New connection established");
      });
    }

    // Create WebSocket pair
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    // Accept WebSocket with hibernation support
    this.ctx.acceptWebSocket(server);

    // Attach metadata that survives hibernation
    server.serializeAttachment({
      connectedAt: Date.now(),
    });

    // Return the client side of the WebSocket
    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  }

  /**
   * Called automatically when browser sends a message
   * DO wakes from hibernation if needed
   */
  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
    console.log("Received message from browser:", message);

    try {
      const messageStr =
        typeof message === "string"
          ? message
          : new TextDecoder().decode(message);
      const data = JSON.parse(messageStr);

      // Handle tool execution
      if (data.type === "tool-response" && data.requestId) {
        const pending = this.pendingRequests.get(data.requestId);

        if (pending) {
          console.log("Resolving pending request:", data.requestId);

          // Clear timeout
          clearTimeout(pending.timeoutId);

          // Resolve the promise with the result
          pending.resolve(data.result);

          // Clean up
          this.pendingRequests.delete(data.requestId);
        } else {
          console.warn(
            "Received response for unknown requestId:",
            data.requestId
          );
        }
        return;
      }
    } catch (error) {
      console.error("Error handling message:", error);
      ws.send(
        JSON.stringify({
          type: "error",
          message: "Failed to parse message",
        })
      );
    }
  }

  /**
   * Called when browser closes the connection
   * Immediately rejects all pending tool requests
   */
  async webSocketClose(
    ws: WebSocket,
    code: number,
    reason: string,
    wasClean: boolean
  ) {
    // Reject all pending tool requests immediately
    if (this.pendingRequests.size > 0) {
      this.pendingRequests.forEach(({ reject, timeoutId }) => {
        clearTimeout(timeoutId);
        reject(new Error("Browser disconnected"));
      });

      // Clear the map
      this.pendingRequests.clear();
    }

    ws.close(code, "Durable Object closing WebSocket");
  }

  /**
   * Called when there's a WebSocket error
   */
  async webSocketError(ws: WebSocket, error: unknown) {
    console.error("WebSocket error:", error);
  }

  /**
   * Handle tool execution request from MCP server
   * Forwards to browser via WebSocket and waits for response
   */
  private async handleToolExecution(request: Request): Promise<Response> {
    try {
      // Parse and validate request body with Zod
      const requestBody = await request.json();
      const parseResult = toolExecutionRequestSchema.safeParse(requestBody);

      if (!parseResult.success) {
        return new Response(
          JSON.stringify({
            error: "Invalid request body",
            details: parseResult.error.format(),
          }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }

      const { tool, input, requestId } = parseResult.data;

      // Check if browser is connected
      const websockets = this.ctx.getWebSockets();
      if (websockets.length === 0) {
        return new Response(
          JSON.stringify({
            error: "Browser not connected",
          }),
          { status: 503, headers: { "Content-Type": "application/json" } }
        );
      }

      const ws = websockets[0]; // We only allow one connection

      // Create promise that resolves when browser responds
      const responsePromise = new Promise<any>((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          this.pendingRequests.delete(requestId);
          reject(new Error("Tool execution timeout (30s)"));
        }, 30000);

        this.pendingRequests.set(requestId, {
          resolve,
          reject,
          timeoutId,
        });
      });

      // Send tool execution request to browser
      ws.send(
        JSON.stringify({
          type: "tool-execution",
          requestId,
          tool,
          input,
        })
      );

      // Wait for browser response
      const result = await responsePromise;

      return new Response(JSON.stringify(result), {
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      return new Response(
        JSON.stringify({
          error: "Tool execution failed",
          message: error instanceof Error ? error.message : String(error),
        }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
  }
}
