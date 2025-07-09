import { EventEmitter } from "node:events";
import { PG_EVENT_NAME } from "./constants.js";
import type { Logger } from "./logger.js";

// Log prefix constant
const LOG_PREFIX = "[DB-EVENTS]";

export type DbQueryEvent = {
  sql: string;
  params: unknown[];
  result?: unknown;
  error?: unknown;
  durationMs: number;
  context?: unknown; // for future extensibility (e.g., trace context)
};

const GLOBAL_KEY = "__db_event_emitter_singleton__";

export function getDbEventEmitter(logger?: Logger): EventEmitter {
  // Check if we already have an instance in global scope
  if ((global as unknown as Record<string, unknown>)[GLOBAL_KEY]) {
    logger?.debug?.(
      `${LOG_PREFIX} Using existing event emitter from global scope`,
    );
    return (global as unknown as Record<string, unknown>)[
      GLOBAL_KEY
    ] as EventEmitter;
  } else {
    logger?.debug?.(`${LOG_PREFIX} Creating new event emitter singleton`);
    const dbEventEmitter = createDbEventEmitter(logger);
    (global as unknown as Record<string, unknown>)[GLOBAL_KEY] = dbEventEmitter;
    return dbEventEmitter;
  }
}
/**
 * Creates a new event emitter instance with debugging capabilities
 * This function is testable and doesn't rely on global state
 */
export function createDbEventEmitter(logger?: Logger): EventEmitter {
  const eventEmitter = new EventEmitter();

  // Add debugging for event emission
  const originalEmit = eventEmitter.emit.bind(eventEmitter);
  eventEmitter.emit = (event: string, ...args: unknown[]) => {
    if (event === PG_EVENT_NAME) {
      logger?.debug?.(
        `${LOG_PREFIX} Emitting ${PG_EVENT_NAME} event with`,
        args.length,
        "arguments",
      );
      logger?.debug?.(
        `${LOG_PREFIX} Event emitter instance ID:`,
        eventEmitter.listenerCount(PG_EVENT_NAME),
      );
      logger?.debug?.(
        `${LOG_PREFIX} Current listeners count:`,
        eventEmitter.listenerCount(PG_EVENT_NAME),
      );
    }
    return originalEmit(event, ...args);
  };

  // Add debugging for event listeners
  const originalOn = eventEmitter.on.bind(eventEmitter);
  eventEmitter.on = (event: string, listener: (...args: unknown[]) => void) => {
    if (event === PG_EVENT_NAME) {
      logger?.debug?.(
        `${LOG_PREFIX} Adding listener for ${PG_EVENT_NAME} event`,
      );
      logger?.debug?.(
        `${LOG_PREFIX} Listener count before:`,
        eventEmitter.listenerCount(PG_EVENT_NAME),
      );
    }
    const result = originalOn(event, listener);
    if (event === PG_EVENT_NAME) {
      logger?.debug?.(
        `${LOG_PREFIX} Listener count after:`,
        eventEmitter.listenerCount(PG_EVENT_NAME),
      );
    }
    return result;
  };

  // Log when the emitter is created
  logger?.debug?.(
    `${LOG_PREFIX} Event emitter created, instance ID:`,
    eventEmitter.listenerCount(PG_EVENT_NAME),
  );

  return eventEmitter;
}
