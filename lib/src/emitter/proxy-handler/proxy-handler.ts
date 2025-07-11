import { PG_CONNECTION_EVENT_NAME } from "../../constants.js";
import { getDbEventEmitter } from "../../db-events.js";
import type { Logger } from "../../logger.js";
import type { PostgresClient } from "../postgres-client.js";
import { emitAndRunQuery } from "./query-executor.js";
import { createEventEmittingReservedConnection } from "./reserved-connection.js";

const LOG_PREFIX = "[DB-QUERY-SENDER]";

export function createProxyHandler(
  connectionIds: Map<unknown, string>,
  logger?: Logger,
) {
  return {
    get(target: PostgresClient, prop: string | symbol, receiver: unknown) {
      logger?.debug?.(`${LOG_PREFIX} Proxy get called for prop:`, String(prop));
      const value = Reflect.get(target, prop, receiver);

      if (prop === "reserve" && typeof value === "function") {
        logger?.debug?.(`${LOG_PREFIX} Intercepting reserve method`);
        return async function (this: unknown, ...args: unknown[]) {
          logger?.debug?.(`${LOG_PREFIX} Reserve method called`);
          const reserved = await value.apply(this, args);

          // Generate connection ID
          const connectionId = Math.random().toString(36).substring(2, 15);
          connectionIds.set(reserved, connectionId);

          // Emit connection event when a connection is reserved
          logger?.debug?.(`${LOG_PREFIX} Emitting connection event`);
          getDbEventEmitter(logger).emit(PG_CONNECTION_EVENT_NAME, {
            type: "connect",
            timestamp: Date.now(),
            connectionId,
          });

          return createEventEmittingReservedConnection(
            reserved,
            connectionId,
            connectionIds,
            logger,
          );
        };
      }

      if (typeof value === "function") {
        logger?.debug?.(`${LOG_PREFIX} Intercepting function:`, String(prop));
        return function (this: unknown, ...args: unknown[]) {
          logger?.debug?.(`${LOG_PREFIX} Function called:`, String(prop));

          // Check if this looks like a query method
          if (
            args[0] &&
            typeof args[0] === "string" &&
            /^(SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP)/i.test(args[0])
          ) {
            logger?.debug?.(`${LOG_PREFIX} SQL detected in function call!`);
            return emitAndRunQuery(value, this, args, logger);
          }

          return value.apply(this, args);
        };
      }

      return value;
    },

    apply(target: PostgresClient, thisArg: unknown, argArray: unknown[]) {
      logger?.debug?.(`${LOG_PREFIX} Proxy apply called`);
      return emitAndRunQuery(target, thisArg, argArray, logger);
    },
  };
}
