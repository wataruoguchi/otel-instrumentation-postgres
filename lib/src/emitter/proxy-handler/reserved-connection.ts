import { PG_CONNECTION_EVENT_NAME } from "../../constants.js";
import { getDbEventEmitter } from "../../db-events.js";
import type { Logger } from "../../logger.js";
import { emitAndRunQuery } from "./query-executor.js";

export type ReservedFunction = {
  (this: unknown, ...args: unknown[]): Promise<unknown>;
  release?: () => Promise<unknown>;
  [key: string | symbol]: unknown;
};

const LOG_PREFIX = "[DB-QUERY-SENDER]";

const sqlRegex = /^(SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP)/i;

export function createEventEmittingReservedConnection(
  reserved: unknown,
  connectionId: string,
  connectionIds: Map<unknown, string>,
  logger?: Logger,
) {
  logger?.debug?.(`${LOG_PREFIX} Creating event-emitting reserved connection`);

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
        apply(target: ReservedFunction, thisArg: unknown, argArray: unknown[]) {
          logger?.debug?.(
            `${LOG_PREFIX} Reserved function called directly with args:`,
            argArray,
          );

          // Check if first argument looks like SQL
          if (
            argArray[0] &&
            typeof argArray[0] === "string" &&
            sqlRegex.test(argArray[0])
          ) {
            logger?.debug?.(
              `${LOG_PREFIX} SQL detected in direct function call!`,
            );
            return emitAndRunQuery(target, thisArg, argArray, logger);
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
                sqlRegex.test(args[0])
              ) {
                logger?.debug?.(
                  `${LOG_PREFIX} SQL detected in property method call for prop:`,
                  String(prop),
                );
                return emitAndRunQuery(value, this, args, logger);
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

        if (args[0] && typeof args[0] === "string" && sqlRegex.test(args[0])) {
          logger?.debug?.(`${LOG_PREFIX} SQL detected in function call!`);
          return emitAndRunQuery(reservedFunc, this, args, logger);
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
            sqlRegex.test(args[0])
          ) {
            logger?.debug?.(
              `${LOG_PREFIX} SQL detected in method call for prop:`,
              String(prop),
            );
            return emitAndRunQuery(value, this, args, logger);
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
