import { EventEmitter } from "node:events";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getDbEventEmitter } from "./db-events.js";

describe("db-events", () => {
  let mockLogger: { debug: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockLogger = {
      debug: vi.fn(),
    };
  });

  describe("getDbEventEmitter", () => {
    beforeEach(() => {
      // Clear global singleton between tests
      delete (global as Record<string, unknown>).__db_event_emitter_singleton__;
    });

    it("should create new emitter on first call", () => {
      const emitter = getDbEventEmitter(mockLogger);
      expect(emitter).toBeInstanceOf(EventEmitter);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        "[DB-EVENTS] Creating new event emitter singleton",
      );
    });

    it("should return same emitter on subsequent calls", () => {
      const emitter1 = getDbEventEmitter(mockLogger);
      const emitter2 = getDbEventEmitter(mockLogger);

      expect(emitter1).toBe(emitter2);
      // No debug log on subsequent calls since we removed that logging
    });

    it("should work without logger", () => {
      const emitter1 = getDbEventEmitter();
      const emitter2 = getDbEventEmitter();

      expect(emitter1).toBeInstanceOf(EventEmitter);
      expect(emitter1).toBe(emitter2);
    });

    it("should maintain singleton behavior across different logger instances", () => {
      const logger1 = { debug: vi.fn() };
      const logger2 = { debug: vi.fn() };

      const emitter1 = getDbEventEmitter(logger1);
      const emitter2 = getDbEventEmitter(logger2);

      expect(emitter1).toBe(emitter2);
      expect(logger1.debug).toHaveBeenCalledWith(
        "[DB-EVENTS] Creating new event emitter singleton",
      );
      // No debug log on subsequent calls since we removed that logging
    });

    it("should be able to emit and listen to events", () => {
      const emitter = getDbEventEmitter(mockLogger);
      const listener = vi.fn();
      const testEvent = { sql: "SELECT 1", params: [], durationMs: 10 };

      emitter.on("db:query", listener);
      emitter.emit("db:query", testEvent);

      expect(listener).toHaveBeenCalledWith(testEvent);
    });
  });
});
