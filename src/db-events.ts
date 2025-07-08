import { EventEmitter } from "node:events";

export type DbQueryEvent = {
  sql: string;
  params: unknown[];
  result?: unknown;
  error?: unknown;
  durationMs: number;
  context?: unknown; // for future extensibility (e.g., trace context)
};

export type Logger = {
  debug: (message: string, ...args: unknown[]) => void;
};

const GLOBAL_KEY = "__db_event_emitter_singleton__";

export function getDbEventEmitter(logger?: Logger): EventEmitter {
  // Check if we already have an instance in global scope
  if ((global as unknown as Record<string, unknown>)[GLOBAL_KEY]) {
    logger?.debug("[DB-EVENTS] Using existing event emitter from global scope");
    return (global as unknown as Record<string, unknown>)[
      GLOBAL_KEY
    ] as EventEmitter;
  } else {
    logger?.debug("[DB-EVENTS] Creating new event emitter singleton");
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
    if (event === "db:query") {
      logger?.debug(
        "[DB-EVENTS] Emitting db:query event with",
        args.length,
        "arguments",
      );
      logger?.debug(
        "[DB-EVENTS] Event emitter instance ID:",
        eventEmitter.listenerCount("db:query"),
      );
      logger?.debug(
        "[DB-EVENTS] Current listeners count:",
        eventEmitter.listenerCount("db:query"),
      );
    }
    return originalEmit(event, ...args);
  };

  // Add debugging for event listeners
  const originalOn = eventEmitter.on.bind(eventEmitter);
  eventEmitter.on = (event: string, listener: (...args: unknown[]) => void) => {
    if (event === "db:query") {
      logger?.debug("[DB-EVENTS] Adding listener for db:query event");
      logger?.debug(
        "[DB-EVENTS] Listener count before:",
        eventEmitter.listenerCount("db:query"),
      );
    }
    const result = originalOn(event, listener);
    if (event === "db:query") {
      logger?.debug(
        "[DB-EVENTS] Listener count after:",
        eventEmitter.listenerCount("db:query"),
      );
    }
    return result;
  };

  // Log when the emitter is created
  logger?.debug(
    "[DB-EVENTS] Event emitter created, instance ID:",
    eventEmitter.listenerCount("db:query"),
  );

  return eventEmitter;
}
