import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

/**
 * Messages sent FROM the server TO the browser
 */
export type ServerMessage = HelloMessage | ToolExecutionMessage | EchoMessage | ErrorMessage;

export type HelloMessage = {
  type: "hello";
  message: string;
  timestamp: number;
};

export type ToolExecutionMessage = {
  type: "tool-execution";
  requestId: string;
  tool: string;
  input: Record<string, unknown>;
};

export type EchoMessage = {
  type: "echo";
  originalMessage: unknown;
  receivedAt: number;
};

export type ErrorMessage = {
  type: "error";
  message: string;
};

/**
 * Messages sent FROM the browser TO the server
 */
export type BrowserMessage = ToolResponseMessage | PingMessage;

export type ToolResponseMessage = {
  type: "tool-response";
  requestId: string;
  result: CallToolResult;
};

export type PingMessage = {
  type: "ping";
  timestamp: number;
};

/**
 * Whitelisted message types that the browser will process
 */
export const WHITELISTED_MESSAGE_TYPES = [
  "hello",
  "tool-execution",
  "echo",
  "error",
] as const;

export type WhitelistedMessageType = typeof WHITELISTED_MESSAGE_TYPES[number];
