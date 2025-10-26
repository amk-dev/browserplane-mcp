/**
 * Browser-Server WebSocket Protocol
 *
 * Uses JSON-RPC 2.0 format from MCP for consistency.
 * The DO acts as a passthrough, forwarding MCP JSON-RPC messages
 * between the MCP client and the browser extension via WebSocket.
 */

import type {
  JSONRPCRequest,
  JSONRPCResponse,
  JSONRPCError,
  JSONRPCMessage,
  RequestId,
} from "@modelcontextprotocol/sdk/types.js";

// Re-export MCP types for use in our protocol
export type {
  JSONRPCRequest,
  JSONRPCResponse,
  JSONRPCError,
  JSONRPCMessage,
  RequestId,
};

/**
 * Ping message to keep WebSocket connection alive
 */
export type PingMessage = {
  type: "ping";
};

/**
 * Pong response to ping
 */
export type PongMessage = {
  type: "pong";
};

/**
 * All possible messages sent from Durable Object to Extension
 * Mostly JSON-RPC requests for tool calls
 */
export type ServerMessage = JSONRPCRequest | PingMessage;

/**
 * All possible messages sent from Extension to Durable Object
 * Mostly JSON-RPC responses with tool results
 */
export type ClientMessage = JSONRPCResponse | JSONRPCError | PongMessage;
