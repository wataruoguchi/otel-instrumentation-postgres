import type { Logger } from "../logger.js";
import type { PostgresClient } from "./postgres-client.js";
import { createProxyHandler } from "./proxy-handler/proxy-handler.js";

const LOG_PREFIX = "[DB-QUERY-SENDER]";

// Wraps a postgres.js client to emit events on every query
export function createOTELEmitter(
  client: PostgresClient,
  logger?: Logger,
): PostgresClient {
  logger?.info?.(`${LOG_PREFIX} Creating event-emitting postgres client`);

  // Track connection IDs for disconnect events
  const connectionIds = new Map<unknown, string>();

  // Create proxy handler
  const handler = createProxyHandler(connectionIds, logger);

  return new Proxy(client, handler);
}
