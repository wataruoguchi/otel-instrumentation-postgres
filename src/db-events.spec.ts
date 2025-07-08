import { EventEmitter } from "node:events";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createDbEventEmitter,
  getDbEventEmitter,
  type Logger,
} from "./db-events.js";

describe("db-events", () => {
  let mockLogger: Logger;

  beforeEach(() => {
    mockLogger = {
      debug: vi.fn(),
    };
  });

  describe("createDbEventEmitter", () => {
    it("should create an EventEmitter instance", () => {
      const emitter = createDbEventEmitter(mockLogger);
      expect(emitter).toBeInstanceOf(EventEmitter);
    });

    it("should log when emitter is created", () => {
      createDbEventEmitter(mockLogger);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        "[DB-EVENTS] Event emitter created, instance ID:",
        0,
      );
    });

    it("should log when db:query events are emitted", () => {
      const emitter = createDbEventEmitter(mockLogger);
      const testEvent = { sql: "SELECT 1", params: [], durationMs: 10 };

      emitter.emit("db:query", testEvent);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        "[DB-EVENTS] Emitting db:query event with",
        1,
        "arguments",
      );
    });

    it("should log when listeners are added", () => {
      const emitter = createDbEventEmitter(mockLogger);
      const listener = vi.fn();

      emitter.on("db:query", listener);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        "[DB-EVENTS] Adding listener for db:query event",
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        "[DB-EVENTS] Listener count before:",
        0,
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        "[DB-EVENTS] Listener count after:",
        1,
      );
    });

    it("should work without logger", () => {
      const emitter = createDbEventEmitter();
      expect(emitter).toBeInstanceOf(EventEmitter);

      // Should not throw when emitting events without logger
      expect(() => {
        emitter.emit("db:query", {
          sql: "SELECT 1",
          params: [],
          durationMs: 10,
        });
      }).not.toThrow();
    });
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
      expect(mockLogger.debug).toHaveBeenCalledWith(
        "[DB-EVENTS] Using existing event emitter from global scope",
      );
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
      expect(logger2.debug).toHaveBeenCalledWith(
        "[DB-EVENTS] Using existing event emitter from global scope",
      );
    });
  });
});
