import type {
  ServerMessage,
  ToolExecutionMessage,
} from "../types/websocket.types";
import { WHITELISTED_MESSAGE_TYPES } from "../types/websocket.types";

type MessageHandler = (message: ServerMessage) => void | Promise<void>;
type ToolExecutionHandler = (message: ToolExecutionMessage) => void | Promise<void>;

export type WebSocketServerConfig = {
  apiBaseUrl: string;
  onMessage?: MessageHandler;
  onToolExecution?: ToolExecutionHandler;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: Error) => void;
  reconnectInterval?: number; // milliseconds
  maxReconnectAttempts?: number;
};

export class WebSocketServer {
  private ws: WebSocket | null = null;
  private config: Required<WebSocketServerConfig>;
  private reconnectAttempts = 0;
  private reconnectTimeoutId: number | null = null;
  private isIntentionalClose = false;
  private browserId: string | null = null;

  constructor(config: WebSocketServerConfig) {
    this.config = {
      onMessage: () => {},
      onToolExecution: () => {},
      onConnect: () => {},
      onDisconnect: () => {},
      onError: () => {},
      reconnectInterval: 5000,
      maxReconnectAttempts: 10,
      ...config,
    };
  }

  /**
   * Get session token from the API
   */
  private async getSessionToken(): Promise<string | null> {
    try {
      const response = await fetch(`${this.config.apiBaseUrl}/api/auth/get-session`, {
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error(`Failed to get session: ${response.statusText}`);
      }

      const session = await response.json();

      if (!session?.session?.token) {
        console.error("❌ No active session found");
        return null;
      }

      console.log("✅ Got session token");
      return session.session.token;
    } catch (error) {
      console.error("❌ Error getting session token:", error);
      this.config.onError(
        error instanceof Error ? error : new Error(String(error))
      );
      return null;
    }
  }

  /**
   * Register this browser with the API and get browserId
   */
  async registerBrowser(): Promise<string | null> {
    try {
      const response = await fetch(`${this.config.apiBaseUrl}/api/browser/register`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to register browser: ${response.statusText}`);
      }

      const data = await response.json();

      if (!data?.browserId) {
        throw new Error("No browserId received from registration");
      }

      this.browserId = data.browserId;

      // Store browserId in extension storage for persistence
      await chrome.storage.local.set({ browserId: this.browserId });

      console.log("✅ Browser registered with ID:", this.browserId);
      return this.browserId;
    } catch (error) {
      console.error("❌ Error registering browser:", error);
      this.config.onError(
        error instanceof Error ? error : new Error(String(error))
      );
      return null;
    }
  }

  /**
   * Get browserId from storage or register new one
   */
  private async getBrowserId(): Promise<string | null> {
    // Try to get from memory first
    if (this.browserId) {
      return this.browserId;
    }

    // Try to get from storage
    const storage = await chrome.storage.local.get("browserId");
    if (storage.browserId) {
      this.browserId = storage.browserId;
      console.log("✅ Retrieved browserId from storage:", this.browserId);
      return this.browserId;
    }

    // Register new browser
    return await this.registerBrowser();
  }

  /**
   * Connect to the WebSocket server
   */
  async connectViaWebSocket(): Promise<boolean> {
    this.isIntentionalClose = false;

    // Get session token
    const token = await this.getSessionToken();
    if (!token) {
      console.error("❌ Cannot connect: No session token");
      return false;
    }

    // Get browserId
    const browserId = await this.getBrowserId();
    if (!browserId) {
      console.error("❌ Cannot connect: No browser ID");
      return false;
    }

    try {
      // Build WebSocket URL
      const wsUrl = this.config.apiBaseUrl
        .replace("http://", "ws://")
        .replace("https://", "wss://");
      const url = `${wsUrl}/api/browser/${browserId}/connect?token=${token}`;

      console.log("🔌 Connecting to WebSocket...");
      this.ws = new WebSocket(url);

      // Set up event handlers
      this.ws.onopen = () => this.handleOpen();
      this.ws.onmessage = (event) => this.handleMessage(event);
      this.ws.onerror = (event) => this.handleError(event);
      this.ws.onclose = (event) => this.handleClose(event);

      return true;
    } catch (error) {
      console.error("❌ Error connecting to WebSocket:", error);
      this.config.onError(
        error instanceof Error ? error : new Error(String(error))
      );
      return false;
    }
  }

  /**
   * Handle WebSocket open event
   */
  private handleOpen(): void {
    console.log("✅ WebSocket connected!");
    this.reconnectAttempts = 0;
    this.config.onConnect();
  }

  /**
   * Handle incoming messages with type whitelisting
   */
  private handleMessage(event: MessageEvent): void {
    try {
      const message = JSON.parse(event.data) as ServerMessage;

      // Whitelist check
      if (!this.isWhitelistedMessage(message)) {
        console.warn("⚠️ Ignoring non-whitelisted message type:", message);
        return;
      }

      console.log("📨 Received message:", message);

      // Call general message handler
      this.config.onMessage(message);

      // Call specific handlers
      if (message.type === "tool-execution") {
        this.config.onToolExecution(message);
      }
    } catch (error) {
      console.error("❌ Error parsing message:", error);
      this.config.onError(
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  /**
   * Check if message type is whitelisted
   */
  private isWhitelistedMessage(message: unknown): message is ServerMessage {
    if (!message || typeof message !== "object") {
      return false;
    }

    const msg = message as { type?: string };
    const whitelistedTypes: readonly string[] = WHITELISTED_MESSAGE_TYPES;

    return whitelistedTypes.includes(msg.type || "");
  }

  /**
   * Handle WebSocket error
   */
  private handleError(event: Event): void {
    console.error("❌ WebSocket error:", event);
    this.config.onError(new Error("WebSocket error"));
  }

  /**
   * Handle WebSocket close event
   */
  private handleClose(event: CloseEvent): void {
    console.log(`🔌 WebSocket disconnected: ${event.code} - ${event.reason}`);
    this.config.onDisconnect();

    // Attempt to reconnect unless it was intentional
    if (!this.isIntentionalClose) {
      this.attemptReconnect();
    }
  }

  /**
   * Attempt to reconnect with exponential backoff
   */
  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.config.maxReconnectAttempts) {
      console.error("❌ Max reconnection attempts reached");
      this.config.onError(new Error("Max reconnection attempts reached"));
      return;
    }

    this.reconnectAttempts++;
    const delay = this.config.reconnectInterval * this.reconnectAttempts;

    console.log(
      `🔄 Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.config.maxReconnectAttempts})`
    );

    this.reconnectTimeoutId = setTimeout(() => {
      this.connectViaWebSocket();
    }, delay) as unknown as number;
  }

  /**
   * Send a message to the server
   */
  send(message: object): boolean {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.error("❌ Cannot send message: WebSocket not connected");
      return false;
    }

    try {
      this.ws.send(JSON.stringify(message));
      return true;
    } catch (error) {
      console.error("❌ Error sending message:", error);
      this.config.onError(
        error instanceof Error ? error : new Error(String(error))
      );
      return false;
    }
  }

  /**
   * Disconnect from the WebSocket server
   */
  disconnect(): void {
    this.isIntentionalClose = true;

    // Clear reconnect timeout
    if (this.reconnectTimeoutId !== null) {
      clearTimeout(this.reconnectTimeoutId);
      this.reconnectTimeoutId = null;
    }

    // Close WebSocket
    if (this.ws) {
      this.ws.close(1000, "Client disconnecting");
      this.ws = null;
    }

    console.log("🔌 Disconnected");
  }

  /**
   * Get connection status
   */
  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  /**
   * Get current browserId
   */
  getBrowserIdSync(): string | null {
    return this.browserId;
  }
}
