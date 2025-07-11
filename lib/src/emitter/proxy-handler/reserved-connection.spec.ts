import { EventEmitter } from "node:events";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getDbEventEmitter } from "../../db-events.js";
import { createEventEmittingReservedConnection } from "./reserved-connection.js";

// Mock the db-events module
vi.mock("../../db-events.js", () => ({
  getDbEventEmitter: vi.fn(),
}));

describe("reserved-connection", () => {
  let mockDbEventEmitter: EventEmitter;
  let mockLogger: {
    debug: ReturnType<typeof vi.fn>;
    info: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    mockLogger = {
      debug: vi.fn(),
      info: vi.fn(),
    };

    mockDbEventEmitter = new EventEmitter();
    vi.mocked(getDbEventEmitter).mockReturnValue(mockDbEventEmitter);
  });

  const createTestConnection = (
    connectionId: string = "test-connection-id",
  ) => {
    const connectionIds = new Map();
    return { connectionIds, connectionId };
  };

  describe("createEventEmittingReservedConnection", () => {
    it("should create an event emitting reserved connection", () => {
      const mockReservedConnection = {
        query: vi.fn().mockResolvedValue({ rows: [] }),
        release: vi.fn().mockResolvedValue(undefined),
      };
      const { connectionIds, connectionId } = createTestConnection();

      const result = createEventEmittingReservedConnection(
        mockReservedConnection,
        connectionId,
        connectionIds,
        mockLogger,
      );

      expect(result).not.toBe(mockReservedConnection);
      expect(typeof result.query).toBe("function");
      expect(typeof result.release).toBe("function");
    });

    it("should intercept query calls on reserved connection", async () => {
      const mockQuery = vi.fn().mockResolvedValue({ rows: [{ id: 1 }] });
      const mockReservedConnection = {
        query: mockQuery,
        release: vi.fn().mockResolvedValue(undefined),
      };
      const { connectionIds, connectionId } = createTestConnection();

      const eventEmittingConnection = createEventEmittingReservedConnection(
        mockReservedConnection,
        connectionId,
        connectionIds,
        mockLogger,
      );

      const querySpy = vi.spyOn(mockDbEventEmitter, "emit");

      const result = await eventEmittingConnection.query(
        "SELECT * FROM users WHERE id = ?",
        [1],
      );

      expect(mockQuery).toHaveBeenCalledWith(
        "SELECT * FROM users WHERE id = ?",
        [1],
      );
      expect(result).toEqual({ rows: [{ id: 1 }] });
      expect(querySpy).toHaveBeenCalledWith(
        "db:query",
        expect.objectContaining({
          sql: "SELECT * FROM users WHERE id = ?",
          params: [1],
          result: { rows: [{ id: 1 }] },
          durationMs: expect.any(Number),
        }),
      );
    });

    it("should intercept failed query calls on reserved connection", async () => {
      const mockError = new Error("Database error");
      const mockQuery = vi.fn().mockRejectedValue(mockError);
      const mockReservedConnection = {
        query: mockQuery,
        release: vi.fn().mockResolvedValue(undefined),
      };
      const { connectionIds, connectionId } = createTestConnection();

      const eventEmittingConnection = createEventEmittingReservedConnection(
        mockReservedConnection,
        connectionId,
        connectionIds,
        mockLogger,
      );

      const querySpy = vi.spyOn(mockDbEventEmitter, "emit");

      await expect(
        eventEmittingConnection.query("SELECT * FROM users WHERE id = ?", [1]),
      ).rejects.toThrow("Database error");

      expect(mockQuery).toHaveBeenCalledWith(
        "SELECT * FROM users WHERE id = ?",
        [1],
      );
      expect(querySpy).toHaveBeenCalledWith(
        "db:query",
        expect.objectContaining({
          sql: "SELECT * FROM users WHERE id = ?",
          params: [1],
          error: mockError,
          durationMs: expect.any(Number),
        }),
      );
    });

    it("should intercept release calls and emit disconnect event", async () => {
      const mockRelease = vi.fn().mockResolvedValue(undefined);
      const mockReservedConnection = {
        query: vi.fn().mockResolvedValue({ rows: [] }),
        release: mockRelease,
      };
      const { connectionIds, connectionId } = createTestConnection();

      const eventEmittingConnection = createEventEmittingReservedConnection(
        mockReservedConnection,
        connectionId,
        connectionIds,
        mockLogger,
      );

      const connectionSpy = vi.spyOn(mockDbEventEmitter, "emit");

      await eventEmittingConnection.release();

      expect(mockRelease).toHaveBeenCalled();
      expect(connectionSpy).toHaveBeenCalledWith(
        "db:connection",
        expect.objectContaining({
          type: "disconnect",
          timestamp: expect.any(Number),
          connectionId: expect.any(String),
        }),
      );
    });

    it("should handle failed release calls", async () => {
      const mockError = new Error("Release failed");
      const mockRelease = vi.fn().mockRejectedValue(mockError);
      const mockReservedConnection = {
        query: vi.fn().mockResolvedValue({ rows: [] }),
        release: mockRelease,
      };
      const { connectionIds, connectionId } = createTestConnection();

      const eventEmittingConnection = createEventEmittingReservedConnection(
        mockReservedConnection,
        connectionId,
        connectionIds,
        mockLogger,
      );

      const connectionSpy = vi.spyOn(mockDbEventEmitter, "emit");

      await expect(eventEmittingConnection.release()).rejects.toThrow(
        "Release failed",
      );

      expect(mockRelease).toHaveBeenCalled();
      expect(connectionSpy).toHaveBeenCalledWith(
        "db:connection",
        expect.objectContaining({
          type: "disconnect",
          timestamp: expect.any(Number),
          connectionId: expect.any(String),
        }),
      );
    });

    it("should handle queries without parameters", async () => {
      const mockQuery = vi.fn().mockResolvedValue({ rows: [] });
      const mockReservedConnection = {
        query: mockQuery,
        release: vi.fn().mockResolvedValue(undefined),
      };
      const { connectionIds, connectionId } = createTestConnection();

      const eventEmittingConnection = createEventEmittingReservedConnection(
        mockReservedConnection,
        connectionId,
        connectionIds,
        mockLogger,
      );

      const querySpy = vi.spyOn(mockDbEventEmitter, "emit");

      await eventEmittingConnection.query("SELECT * FROM users");

      expect(mockQuery).toHaveBeenCalledWith("SELECT * FROM users");
      expect(querySpy).toHaveBeenCalledWith(
        "db:query",
        expect.objectContaining({
          sql: "SELECT * FROM users",
          params: [],
          result: { rows: [] },
          durationMs: expect.any(Number),
        }),
      );
    });

    it("should calculate duration correctly for queries", async () => {
      const mockQuery = vi.fn().mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return { rows: [] };
      });
      const mockReservedConnection = {
        query: mockQuery,
        release: vi.fn().mockResolvedValue(undefined),
      };
      const { connectionIds, connectionId } = createTestConnection();

      const eventEmittingConnection = createEventEmittingReservedConnection(
        mockReservedConnection,
        connectionId,
        connectionIds,
        mockLogger,
      );

      const querySpy = vi.spyOn(mockDbEventEmitter, "emit");

      await eventEmittingConnection.query("SELECT * FROM users");

      const emittedEvent = querySpy.mock.calls[0][1];
      expect(emittedEvent.durationMs).toBeGreaterThanOrEqual(10);
      expect(emittedEvent.durationMs).toBeLessThan(50); // Allow some tolerance
    });

    it("should log debug information when logger is provided", async () => {
      const mockQuery = vi.fn().mockResolvedValue({ rows: [] });
      const mockReservedConnection = {
        query: mockQuery,
        release: vi.fn().mockResolvedValue(undefined),
      };
      const { connectionIds, connectionId } = createTestConnection();

      const eventEmittingConnection = createEventEmittingReservedConnection(
        mockReservedConnection,
        connectionId,
        connectionIds,
        mockLogger,
      );

      await eventEmittingConnection.query("SELECT * FROM users");

      expect(mockLogger.debug).toHaveBeenCalledWith(
        "[DB-QUERY-SENDER] Creating event-emitting reserved connection",
      );
    });

    it("should work without logger", async () => {
      const mockQuery = vi.fn().mockResolvedValue({ rows: [] });
      const mockReservedConnection = {
        query: mockQuery,
        release: vi.fn().mockResolvedValue(undefined),
      };
      const { connectionIds, connectionId } = createTestConnection();

      const eventEmittingConnection = createEventEmittingReservedConnection(
        mockReservedConnection,
        connectionId,
        connectionIds,
      );

      const querySpy = vi.spyOn(mockDbEventEmitter, "emit");

      await eventEmittingConnection.query("SELECT * FROM users");

      expect(querySpy).toHaveBeenCalledWith(
        "db:query",
        expect.objectContaining({
          sql: "SELECT * FROM users",
          durationMs: expect.any(Number),
        }),
      );
    });

    it("should generate unique connection IDs", () => {
      const mockReservedConnection1 = {
        query: vi.fn().mockResolvedValue({ rows: [] }),
        release: vi.fn().mockResolvedValue(undefined),
      };
      const mockReservedConnection2 = {
        query: vi.fn().mockResolvedValue({ rows: [] }),
        release: vi.fn().mockResolvedValue(undefined),
      };

      const connection1 = createEventEmittingReservedConnection(
        mockReservedConnection1,
        "connection-1",
        new Map(),
        mockLogger,
      );
      const connection2 = createEventEmittingReservedConnection(
        mockReservedConnection2,
        "connection-2",
        new Map(),
        mockLogger,
      );

      // The connections should be different objects
      expect(connection1).not.toBe(connection2);
    });

    it("should handle non-string first argument gracefully", async () => {
      const mockQuery = vi.fn().mockResolvedValue({ rows: [] });
      const mockReservedConnection = {
        query: mockQuery,
        release: vi.fn().mockResolvedValue(undefined),
      };
      const { connectionIds, connectionId } = createTestConnection();

      const eventEmittingConnection = createEventEmittingReservedConnection(
        mockReservedConnection,
        connectionId,
        connectionIds,
        mockLogger,
      );

      const querySpy = vi.spyOn(mockDbEventEmitter, "emit");
      const nonStringArg = 123;

      await eventEmittingConnection.query(nonStringArg);

      // Non-SQL queries should not emit events, they should just call the original function
      expect(mockQuery).toHaveBeenCalledWith(nonStringArg);
      expect(querySpy).not.toHaveBeenCalled();
    });

    it("should handle undefined parameters", async () => {
      const mockQuery = vi.fn().mockResolvedValue({ rows: [] });
      const mockReservedConnection = {
        query: mockQuery,
        release: vi.fn().mockResolvedValue(undefined),
      };
      const { connectionIds, connectionId } = createTestConnection();

      const eventEmittingConnection = createEventEmittingReservedConnection(
        mockReservedConnection,
        connectionId,
        connectionIds,
        mockLogger,
      );

      const querySpy = vi.spyOn(mockDbEventEmitter, "emit");

      await eventEmittingConnection.query("SELECT * FROM users", undefined);

      expect(querySpy).toHaveBeenCalledWith(
        "db:query",
        expect.objectContaining({
          sql: "SELECT * FROM users",
          params: [],
          durationMs: expect.any(Number),
        }),
      );
    });

    it("should preserve function context for query calls", async () => {
      const mockQuery = vi.fn().mockResolvedValue({ rows: [] });
      const mockReservedConnection = {
        query: mockQuery,
        release: vi.fn().mockResolvedValue(undefined),
        context: "test context",
      };
      const { connectionIds, connectionId } = createTestConnection();

      const eventEmittingConnection = createEventEmittingReservedConnection(
        mockReservedConnection,
        connectionId,
        connectionIds,
        mockLogger,
      );

      await eventEmittingConnection.query.call(
        mockReservedConnection,
        "SELECT * FROM users",
      );
      expect(mockQuery).toHaveBeenCalledWith("SELECT * FROM users");
    });

    it("should preserve function context for release calls", async () => {
      const mockRelease = vi.fn().mockResolvedValue(undefined);
      const mockReservedConnection = {
        query: vi.fn().mockResolvedValue({ rows: [] }),
        release: mockRelease,
        context: "test context",
      };
      const { connectionIds, connectionId } = createTestConnection();

      const eventEmittingConnection = createEventEmittingReservedConnection(
        mockReservedConnection,
        connectionId,
        connectionIds,
        mockLogger,
      );

      await eventEmittingConnection.release.call(mockReservedConnection);
      expect(mockRelease).toHaveBeenCalled();
    });
  });

  describe("non-function reserved objects", () => {
    it("should return null as-is", () => {
      const result = createEventEmittingReservedConnection(
        null,
        "conn-1",
        new Map(),
        mockLogger,
      );
      expect(result).toBe(null);
    });

    it("should return undefined as-is", () => {
      const result = createEventEmittingReservedConnection(
        undefined,
        "conn-1",
        new Map(),
        mockLogger,
      );
      expect(result).toBe(undefined);
    });

    it("should return primitive values as-is", () => {
      const result = createEventEmittingReservedConnection(
        "string",
        "conn-1",
        new Map(),
        mockLogger,
      );
      expect(result).toBe("string");
    });

    it("should return numbers as-is", () => {
      const result = createEventEmittingReservedConnection(
        42,
        "conn-1",
        new Map(),
        mockLogger,
      );
      expect(result).toBe(42);
    });

    it("should return booleans as-is", () => {
      const result = createEventEmittingReservedConnection(
        true,
        "conn-1",
        new Map(),
        mockLogger,
      );
      expect(result).toBe(true);
    });
  });

  describe("object with non-function properties", () => {
    it("should return non-function properties as-is", () => {
      const reserved = {
        id: 123,
        name: "test-connection",
        config: { host: "localhost" },
        query: vi.fn().mockResolvedValue("result"),
      };

      const result = createEventEmittingReservedConnection(
        reserved,
        "conn-1",
        new Map(),
        mockLogger,
      );

      expect(result.id).toBe(123);
      expect(result.name).toBe("test-connection");
      expect(result.config).toEqual({ host: "localhost" });
    });

    it("should handle symbols as property names", () => {
      const symbol = Symbol("test");
      const reserved = {
        [symbol]: "symbol-value",
        query: vi.fn().mockResolvedValue("result"),
      };

      const result = createEventEmittingReservedConnection(
        reserved,
        "conn-1",
        new Map(),
        mockLogger,
      );

      expect(result[symbol]).toBe("symbol-value");
    });

    it("should handle getters and setters", () => {
      const reserved = {
        _value: 0,
        get value() {
          return this._value;
        },
        set value(val: number) {
          this._value = val;
        },
        query: vi.fn().mockResolvedValue("result"),
      };

      const result = createEventEmittingReservedConnection(
        reserved,
        "conn-1",
        new Map(),
        mockLogger,
      );

      expect(result.value).toBe(0);
      result.value = 42;
      expect(result.value).toBe(42);
    });
  });

  describe("function with properties edge cases", () => {
    it("should handle function with null/undefined properties", () => {
      const reserved = vi.fn().mockResolvedValue("result");
      (reserved as any).nullProp = null;
      (reserved as any).undefinedProp = undefined;

      const result = createEventEmittingReservedConnection(
        reserved,
        "conn-1",
        new Map(),
        mockLogger,
      );

      expect(result.nullProp).toBe(undefined);
      expect(result.undefinedProp).toBe(undefined);
    });

    it("should handle function with array properties", () => {
      const reserved = vi.fn().mockResolvedValue("result");
      (reserved as any).arrayProp = [1, 2, 3];

      const result = createEventEmittingReservedConnection(
        reserved,
        "conn-1",
        new Map(),
        mockLogger,
      );

      expect(result.arrayProp).toBe(undefined);
    });

    it("should handle function with object properties", () => {
      const reserved = vi.fn().mockResolvedValue("result");
      (reserved as any).objectProp = { key: "value" };

      const result = createEventEmittingReservedConnection(
        reserved,
        "conn-1",
        new Map(),
        mockLogger,
      );

      expect(result.objectProp).toBe(undefined);
    });
  });

  describe("SQL detection edge cases", () => {
    it("should handle non-string first arguments", () => {
      const reserved = vi.fn().mockResolvedValue("result");
      const args = [123, []];

      const result = createEventEmittingReservedConnection(
        reserved,
        "conn-1",
        new Map(),
        mockLogger,
      );

      const promise = result.apply({}, args);
      expect(promise).resolves.toBe("result");
    });

    it("should handle empty string as first argument", () => {
      const reserved = vi.fn().mockResolvedValue("result");
      const args = ["", []];

      const result = createEventEmittingReservedConnection(
        reserved,
        "conn-1",
        new Map(),
        mockLogger,
      );

      const promise = result.apply({}, args);
      expect(promise).resolves.toBe("result");
    });

    it("should handle non-SQL strings", () => {
      const reserved = vi.fn().mockResolvedValue("result");
      const args = ["not a sql query", []];

      const result = createEventEmittingReservedConnection(
        reserved,
        "conn-1",
        new Map(),
        mockLogger,
      );

      const promise = result.apply({}, args);
      expect(promise).resolves.toBe("result");
    });

    it("should handle SQL with leading whitespace", () => {
      const reserved = vi.fn().mockResolvedValue("result");
      const args = ["  SELECT * FROM users", []];

      const result = createEventEmittingReservedConnection(
        reserved,
        "conn-1",
        new Map(),
        mockLogger,
      );

      const promise = result.apply({}, args);
      expect(promise).resolves.toBe("result");
    });

    it("should handle SQL with leading comments", () => {
      const reserved = vi.fn().mockResolvedValue("result");
      const args = ["-- comment\nSELECT * FROM users", []];

      const result = createEventEmittingReservedConnection(
        reserved,
        "conn-1",
        new Map(),
        mockLogger,
      );

      const promise = result.apply({}, args);
      expect(promise).resolves.toBe("result");
    });
  });

  describe("method property edge cases", () => {
    it("should handle constructor property", () => {
      const reserved = {
        constructor: vi.fn().mockResolvedValue("result"),
        query: vi.fn().mockResolvedValue("result"),
      };

      const result = createEventEmittingReservedConnection(
        reserved,
        "conn-1",
        new Map(),
        mockLogger,
      );

      const promise = result.constructor("SELECT * FROM users", []);
      expect(promise).resolves.toBe("result");
    });

    it("should handle non-query methods with SQL-like arguments", () => {
      const reserved = {
        execute: vi.fn().mockResolvedValue("result"),
        query: vi.fn().mockResolvedValue("result"),
      };

      const result = createEventEmittingReservedConnection(
        reserved,
        "conn-1",
        new Map(),
        mockLogger,
      );

      const promise = result.execute("SELECT * FROM users", []);
      expect(promise).resolves.toBe("result");
    });

    it("should handle methods with non-string first arguments", () => {
      const reserved = {
        query: vi.fn().mockResolvedValue("result"),
      };

      const result = createEventEmittingReservedConnection(
        reserved,
        "conn-1",
        new Map(),
        mockLogger,
      );

      const promise = result.query(123, []);
      expect(promise).resolves.toBe("result");
    });

    it("should handle methods with empty string first arguments", () => {
      const reserved = {
        query: vi.fn().mockResolvedValue("result"),
      };

      const result = createEventEmittingReservedConnection(
        reserved,
        "conn-1",
        new Map(),
        mockLogger,
      );

      const promise = result.query("", []);
      expect(promise).resolves.toBe("result");
    });
  });

  describe("connection management edge cases", () => {
    it("should handle release without connectionId", () => {
      const reserved = {
        release: vi.fn().mockResolvedValue("released"),
        query: vi.fn().mockResolvedValue("result"),
      };

      const result = createEventEmittingReservedConnection(
        reserved,
        "",
        new Map(),
        mockLogger,
      );

      const promise = result.release();
      expect(promise).resolves.toBe("released");
    });

    it("should handle release without connectionIds map", () => {
      const reserved = {
        release: vi.fn().mockResolvedValue("released"),
        query: vi.fn().mockResolvedValue("result"),
      };

      const result = createEventEmittingReservedConnection(
        reserved,
        "conn-1",
        undefined as any,
        mockLogger,
      );

      const promise = result.release();
      expect(promise).resolves.toBe("released");
    });

    it("should handle release with null connectionIds map", () => {
      const reserved = {
        release: vi.fn().mockResolvedValue("released"),
        query: vi.fn().mockResolvedValue("result"),
      };

      const result = createEventEmittingReservedConnection(
        reserved,
        "conn-1",
        null as any,
        mockLogger,
      );

      const promise = result.release();
      expect(promise).resolves.toBe("released");
    });
  });
});
