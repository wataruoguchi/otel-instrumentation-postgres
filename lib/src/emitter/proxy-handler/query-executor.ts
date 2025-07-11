import { PG_EVENT_NAME } from "../../constants.js";
import { type DbQueryEvent, getDbEventEmitter } from "../../db-events.js";
import type { Logger } from "../../logger.js";

const LOG_PREFIX = "[DB-QUERY-SENDER]";

export async function emitAndRunQuery(
  target: unknown,
  thisArg: unknown,
  argArray: unknown[],
  logger?: Logger,
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
