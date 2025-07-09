import type postgres from "postgres";
import { PG_CONNECTION_EVENT_NAME, PG_EVENT_NAME } from "./constants.js";
import { type DbQueryEvent, getDbEventEmitter } from "./db-events.js";
import type { Logger } from "./logger.js";

const LOG_PREFIX = "[DB-QUERY-SENDER]";

// Type for the postgres client
export type PostgresClient = ReturnType<typeof postgres>;

// Type for reserved connection functions that may have properties
type ReservedFunction = {
  (this: unknown, ...args: unknown[]): Promise<unknown>;
  release?: () => Promise<unknown>;
  [key: string | symbol]: unknown;
};

// Wraps a postgres.js client to emit events on every query
export function createOTELEmitter(
  client: PostgresClient,
  logger?: Logger,
): PostgresClient {
  logger?.info?.(`${LOG_PREFIX} Creating event-emitting postgres client`);

  // Track connection IDs for disconnect events
  const connectionIds = new Map<unknown, string>();

  // Proxy to intercept reserved connections and direct calls
  const handler: ProxyHandler<PostgresClient> = {
    get(target, prop, receiver) {
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

          return createEventEmittingReservedConnection(reserved, connectionId);
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
            return emitAndRunQuery(value, this, args);
          }

          return value.apply(this, args);
        };
      }
      return value;
    },
    apply(target, thisArg, argArray) {
      logger?.debug?.(`${LOG_PREFIX} Proxy apply called`);
      return emitAndRunQuery(target, thisArg, argArray);
    },
  };

  function createEventEmittingReservedConnection(
    reserved: unknown,
    connectionId: string,
  ) {
    logger?.debug?.(
      `${LOG_PREFIX} Creating event-emitting reserved connection`,
    );

    // If it's a function, check if it has properties (like release)
    if (typeof reserved === "function") {
      logger?.debug?.(
        `${LOG_PREFIX} Reserved is a function, checking for properties`,
      );
      const reservedFunc = reserved as ReservedFunction;

      // Check if the function has a release property
      if (reservedFunc.release) {
        logger?.debug?.(
          `${LOG_PREFIX} Function has release property, treating as object with methods`,
        );

        // Create a proxy that wraps the function and its properties
        return new Proxy(reservedFunc, {
          apply(
            target: ReservedFunction,
            thisArg: unknown,
            argArray: unknown[],
          ) {
            logger?.debug?.(
              `${LOG_PREFIX} Reserved function called directly with args:`,
              argArray,
            );

            // Check if first argument looks like SQL
            if (
              argArray[0] &&
              typeof argArray[0] === "string" &&
              /^(SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP)/i.test(
                argArray[0],
              )
            ) {
              logger?.debug?.(
                `${LOG_PREFIX} SQL detected in direct function call!`,
              );
              return emitAndRunQuery(target, thisArg, argArray);
            }

            return target.apply(thisArg, argArray);
          },
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          get(
            target: ReservedFunction,
            prop: string | symbol,
            _receiver: unknown,
          ) {
            const value = target[prop];

            if (typeof value === "function") {
              return function (this: unknown, ...args: unknown[]) {
                logger?.debug?.(
                  `${LOG_PREFIX} Reserved function property called:`,
                  String(prop),
                  "with args:",
                  args,
                );

                // Handle release method to emit disconnect event
                if (prop === "release" && connectionId && connectionIds) {
                  logger?.debug?.(
                    `${LOG_PREFIX} Release method called, emitting disconnect event`,
                  );
                  getDbEventEmitter(logger).emit(PG_CONNECTION_EVENT_NAME, {
                    type: "disconnect",
                    timestamp: Date.now(),
                    connectionId,
                  });
                  connectionIds.delete(reserved);
                }

                // Check if this looks like a query method (not release, etc.)
                if (
                  prop !== "release" &&
                  prop !== "constructor" &&
                  args[0] &&
                  typeof args[0] === "string" &&
                  /^(SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP)/i.test(
                    args[0],
                  )
                ) {
                  logger?.debug?.(
                    `${LOG_PREFIX} SQL detected in property method call for prop:`,
                    String(prop),
                  );
                  return emitAndRunQuery(value, this, args);
                }

                return value.apply(this, args);
              };
            }

            return value;
          },
        });
      } else {
        logger?.debug?.(
          `${LOG_PREFIX} Function has no release property, treating as simple function`,
        );
        // Simple function wrapper
        return function (this: unknown, ...args: unknown[]) {
          logger?.debug?.(
            `${LOG_PREFIX} Reserved function called with args:`,
            args,
          );

          if (
            args[0] &&
            typeof args[0] === "string" &&
            /^(SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP)/i.test(args[0])
          ) {
            logger?.debug?.(`${LOG_PREFIX} SQL detected in function call!`);
            return emitAndRunQuery(reservedFunc, this, args);
          }

          return reservedFunc.apply(this, args);
        };
      }
    }

    if (typeof reserved !== "object" || reserved === null) {
      logger?.debug?.(
        `${LOG_PREFIX} Reserved is not an object or function, returning as-is`,
      );
      return reserved;
    }

    logger?.debug?.(
      `${LOG_PREFIX} Wrapping reserved connection object with proxy`,
    );

    // Return a proxy that wraps the reserved connection object
    return new Proxy(reserved, {
      get(target: unknown, prop: string | symbol, receiver: unknown) {
        const value = Reflect.get(target as object, prop, receiver);

        // If it's a function, wrap it to emit events
        if (typeof value === "function") {
          return function (this: unknown, ...args: unknown[]) {
            logger?.debug?.(
              `${LOG_PREFIX} Reserved connection method called:`,
              String(prop),
              "with args:",
              args,
            );

            // Handle release method to emit disconnect event
            if (prop === "release" && connectionId && connectionIds) {
              logger?.debug?.(
                `${LOG_PREFIX} Release method called, emitting disconnect event`,
              );
              getDbEventEmitter(logger).emit(PG_CONNECTION_EVENT_NAME, {
                type: "disconnect",
                timestamp: Date.now(),
                connectionId,
              });
              connectionIds.delete(reserved);
            }

            // Check if this looks like a query method (not release, etc.)
            if (
              prop !== "release" &&
              prop !== "constructor" &&
              args[0] &&
              typeof args[0] === "string" &&
              /^(SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP)/i.test(args[0])
            ) {
              logger?.debug?.(
                `${LOG_PREFIX} SQL detected in method call for prop:`,
                String(prop),
              );
              return emitAndRunQuery(value, this, args);
            }

            // For non-query methods (like release), just call the original
            return value.apply(this, args);
          };
        }

        // For non-function properties, return as-is
        return value;
      },
    });
  }

  async function emitAndRunQuery(
    target: unknown,
    thisArg: unknown,
    argArray: unknown[],
  ) {
    const sql = argArray[0] as string;
    const params = (argArray[1] as unknown[]) || [];
    const start = Date.now();

    logger?.debug?.(
      `${LOG_PREFIX} Intercepted query:`,
      `${sql.substring(0, 100)}...`,
    );

    try {
      const result = await (target as (...args: unknown[]) => unknown).apply(
        thisArg,
        argArray,
      );
      const event = {
        sql,
        params,
        result,
        durationMs: Date.now() - start,
      } as DbQueryEvent;

      logger?.debug?.(
        `${LOG_PREFIX} Emitting success event:`,
        `${event.durationMs}ms`,
      );
      getDbEventEmitter(logger).emit(PG_EVENT_NAME, event);
      return result;
    } catch (error) {
      const event = {
        sql,
        params,
        error,
        durationMs: Date.now() - start,
      } as DbQueryEvent;

      logger?.debug?.(
        `${LOG_PREFIX} Emitting error event:`,
        `${event.durationMs}ms`,
      );
      getDbEventEmitter(logger).emit(PG_EVENT_NAME, event);
      throw error;
    }
  }

  return new Proxy(client, handler);
}
