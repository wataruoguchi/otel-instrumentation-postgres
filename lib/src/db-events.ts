import { EventEmitter } from "node:events";
import type { Logger } from "./logger.js";

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
    return (global as unknown as Record<string, unknown>)[
      GLOBAL_KEY
    ] as EventEmitter;
  } else {
    logger?.debug?.("[DB-EVENTS] Creating new event emitter singleton");
    const dbEventEmitter = new EventEmitter();
    (global as unknown as Record<string, unknown>)[GLOBAL_KEY] = dbEventEmitter;
    return dbEventEmitter;
  }
}
