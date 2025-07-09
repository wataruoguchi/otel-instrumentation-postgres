import { EventEmitter } from "node:events";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getDbEventEmitter } from "./db-events.js";
import { createOTELEmitter, type PostgresClient } from "./emitter.js";

// Mock the db-events module
vi.mock("./db-events.js", () => ({
  getDbEventEmitter: vi.fn(),
}));

// Test helper type for the EventEmitting client
type EventEmittingClient = PostgresClient & {
  query: (...args: unknown[]) => Promise<unknown>;
  reserve?: () => Promise<EventEmittingReservedConnection>;
  end?: () => Promise<unknown>;
  close?: () => Promise<unknown>;
};

// Test helper type for reserved connections
type EventEmittingReservedConnection = {
  query: (...args: unknown[]) => Promise<unknown>;
  release: () => Promise<unknown>;
};

// Test helper function to create properly typed EventEmitting client
function createTestEventEmittingClient(
  mockClient: Record<string, unknown>,
  logger?: { debug: ReturnType<typeof vi.fn>; info: ReturnType<typeof vi.fn> },
): EventEmittingClient {
  return createOTELEmitter(
    mockClient as unknown as PostgresClient,
    logger,
  ) as EventEmittingClient;
}

describe("emitter", () => {
  let mockLogger: {
    debug: ReturnType<typeof vi.fn>;
    info: ReturnType<typeof vi.fn>;
  };
  let mockDbEventEmitter: EventEmitter;
  let mockPostgresClient: PostgresClient;

  beforeEach(() => {
    mockLogger = {
      debug: vi.fn(),
      info: vi.fn(),
    };

    mockDbEventEmitter = new EventEmitter();
    vi.mocked(getDbEventEmitter).mockReturnValue(mockDbEventEmitter);

    // Create a mock postgres client
    mockPostgresClient = {
      // Basic query method
      query: vi.fn(),
      // Reserve method that returns a function with release property
      reserve: vi.fn().mockResolvedValue({
        query: vi.fn(),
        release: vi.fn(),
      }),
      // Other properties that might exist
      end: vi.fn(),
      close: vi.fn(),
    } as unknown as PostgresClient;
  });

  describe("createOTELEmitter", () => {
    it("should create a proxy around the postgres client", () => {
      const result = createOTELEmitter(mockPostgresClient, mockLogger);
      expect(result).not.toBe(mockPostgresClient);
      expect(typeof result).toBe("object");
    });

    it("should log when creating the emitter", () => {
      createOTELEmitter(mockPostgresClient, mockLogger);
      expect(mockLogger.info).toHaveBeenCalledWith(
        "[DB-QUERY-SENDER] Creating event-emitting postgres client",
      );
    });

    it("should work without logger", () => {
      expect(() => {
        createOTELEmitter(mockPostgresClient);
      }).not.toThrow();
    });
  });

  describe("query interception", () => {
    it("should intercept and emit events for successful queries", async () => {
      const mockResult = { rows: [{ id: 1 }] };
      const mockQuery = vi.fn().mockResolvedValue(mockResult);

      const EventEmittingClient = createTestEventEmittingClient(
        {
          ...mockPostgresClient,
          query: mockQuery,
        },
        mockLogger,
      );

      const querySpy = vi.spyOn(mockDbEventEmitter, "emit");

      await EventEmittingClient.query("SELECT * FROM users WHERE id = ?", [1]);

      expect(mockQuery).toHaveBeenCalledWith(
        "SELECT * FROM users WHERE id = ?",
        [1],
      );
      expect(querySpy).toHaveBeenCalledWith(
        "db:query",
        expect.objectContaining({
          sql: "SELECT * FROM users WHERE id = ?",
          params: [1],
          result: mockResult,
          durationMs: expect.any(Number),
        }),
      );
    });

    it("should intercept and emit events for failed queries", async () => {
      const mockError = new Error("Database error");
      const mockQuery = vi.fn().mockRejectedValue(mockError);

      const EventEmittingClient = createTestEventEmittingClient(
        {
          ...mockPostgresClient,
          query: mockQuery,
        },
        mockLogger,
      );

      const querySpy = vi.spyOn(mockDbEventEmitter, "emit");

      await expect(
        EventEmittingClient.query("SELECT * FROM users WHERE id = ?", [1]),
      ).rejects.toThrow("Database error");

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

    it("should not intercept non-SQL function calls", async () => {
      const mockEnd = vi.fn().mockResolvedValue(undefined);

      const EventEmittingClient = createTestEventEmittingClient(
        { ...mockPostgresClient, end: mockEnd },
        mockLogger,
      );

      const querySpy = vi.spyOn(mockDbEventEmitter, "emit");

      await EventEmittingClient.end();

      expect(mockEnd).toHaveBeenCalled();
      expect(querySpy).not.toHaveBeenCalled();
    });
  });

  describe("reserve method interception", () => {
    it("should intercept reserve method and return EventEmitting connection", async () => {
      const mockReservedConnection = {
        query: vi.fn().mockResolvedValue({ rows: [] }),
        release: vi.fn(),
      };

      const mockReserve = vi.fn().mockResolvedValue(mockReservedConnection);

      const EventEmittingClient = createTestEventEmittingClient(
        {
          ...mockPostgresClient,
          reserve: mockReserve,
        },
        mockLogger,
      );

      const reserved = await EventEmittingClient.reserve();

      expect(mockReserve).toHaveBeenCalled();
      expect(reserved).not.toBe(mockReservedConnection);
      expect(
        typeof (reserved as unknown as EventEmittingReservedConnection).query,
      ).toBe("function");
      expect(
        typeof (reserved as unknown as EventEmittingReservedConnection).release,
      ).toBe("function");
    });

    it("should emit events for queries on reserved connections", async () => {
      const mockReservedConnection = {
        query: vi.fn().mockResolvedValue({ rows: [] }),
        release: vi.fn(),
      };

      const mockReserve = vi.fn().mockResolvedValue(mockReservedConnection);

      const EventEmittingClient = createTestEventEmittingClient(
        {
          ...mockPostgresClient,
          reserve: mockReserve,
        },
        mockLogger,
      );

      const reserved = await EventEmittingClient.reserve();
      const querySpy = vi.spyOn(mockDbEventEmitter, "emit");

      await (reserved as unknown as EventEmittingReservedConnection).query(
        "SELECT * FROM users",
      );

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

    it("should emit disconnect event for release method on reserved connections", async () => {
      const mockReservedConnection = {
        query: vi.fn().mockResolvedValue({ rows: [] }),
        release: vi.fn(),
      };

      const mockReserve = vi.fn().mockResolvedValue(mockReservedConnection);

      const EventEmittingClient = createTestEventEmittingClient(
        {
          ...mockPostgresClient,
          reserve: mockReserve,
        },
        mockLogger,
      );

      const reserved = await EventEmittingClient.reserve();
      const querySpy = vi.spyOn(mockDbEventEmitter, "emit");

      await reserved.release();

      expect(querySpy).toHaveBeenCalledWith(
        "db:connection",
        expect.objectContaining({
          type: "disconnect",
          timestamp: expect.any(Number),
          connectionId: expect.any(String),
        }),
      );
    });
  });

  describe("SQL detection", () => {
    it("should detect SELECT queries", async () => {
      const mockQuery = vi.fn().mockResolvedValue({ rows: [] });
      const EventEmittingClient = createTestEventEmittingClient(
        {
          ...mockPostgresClient,
          query: mockQuery,
        },
        mockLogger,
      );

      const querySpy = vi.spyOn(mockDbEventEmitter, "emit");

      await EventEmittingClient.query("SELECT * FROM users");

      expect(querySpy).toHaveBeenCalled();
    });

    it("should detect INSERT queries", async () => {
      const mockQuery = vi.fn().mockResolvedValue({ rows: [] });
      const EventEmittingClient = createTestEventEmittingClient(
        {
          ...mockPostgresClient,
          query: mockQuery,
        },
        mockLogger,
      );

      const querySpy = vi.spyOn(mockDbEventEmitter, "emit");

      await EventEmittingClient.query("INSERT INTO users (name) VALUES (?)", [
        "John",
      ]);

      expect(querySpy).toHaveBeenCalled();
    });

    it("should detect UPDATE queries", async () => {
      const mockQuery = vi.fn().mockResolvedValue({ rows: [] });
      const EventEmittingClient = createTestEventEmittingClient(
        {
          ...mockPostgresClient,
          query: mockQuery,
        },
        mockLogger,
      );

      const querySpy = vi.spyOn(mockDbEventEmitter, "emit");

      await EventEmittingClient.query(
        "UPDATE users SET name = ? WHERE id = ?",
        ["John", 1],
      );

      expect(querySpy).toHaveBeenCalled();
    });

    it("should detect DELETE queries", async () => {
      const mockQuery = vi.fn().mockResolvedValue({ rows: [] });
      const EventEmittingClient = createTestEventEmittingClient(
        {
          ...mockPostgresClient,
          query: mockQuery,
        },
        mockLogger,
      );

      const querySpy = vi.spyOn(mockDbEventEmitter, "emit");

      await EventEmittingClient.query("DELETE FROM users WHERE id = ?", [1]);

      expect(querySpy).toHaveBeenCalled();
    });

    it("should not emit events for non-SQL function calls", async () => {
      const mockQuery = vi.fn().mockResolvedValue({ rows: [] });
      const EventEmittingClient = createTestEventEmittingClient(
        {
          ...mockPostgresClient,
          query: mockQuery,
        },
        mockLogger,
      );

      const querySpy = vi.spyOn(mockDbEventEmitter, "emit");

      // Call with non-SQL string
      await EventEmittingClient.query("not a sql query");

      expect(querySpy).not.toHaveBeenCalled();
    });
  });

  describe("duration calculation", () => {
    it("should calculate duration for successful queries", async () => {
      const mockQuery = vi.fn().mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return { rows: [] };
      });

      const EventEmittingClient = createTestEventEmittingClient(
        {
          ...mockPostgresClient,
          query: mockQuery,
        },
        mockLogger,
      );

      const querySpy = vi.spyOn(mockDbEventEmitter, "emit");

      await EventEmittingClient.query("SELECT * FROM users");

      expect(querySpy).toHaveBeenCalledWith(
        "db:query",
        expect.objectContaining({
          durationMs: expect.any(Number),
        }),
      );

      const emittedEvent = querySpy.mock.calls[0]?.[1];
      if (emittedEvent) {
        expect(emittedEvent.durationMs).toBeGreaterThanOrEqual(10);
      }
    });

    it("should calculate duration for failed queries", async () => {
      const mockQuery = vi.fn().mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        throw new Error("Database error");
      });

      const EventEmittingClient = createTestEventEmittingClient(
        {
          ...mockPostgresClient,
          query: mockQuery,
        },
        mockLogger,
      );

      const querySpy = vi.spyOn(mockDbEventEmitter, "emit");

      await expect(
        EventEmittingClient.query("SELECT * FROM users"),
      ).rejects.toThrow("Database error");

      const emittedEvent = querySpy.mock.calls[0]?.[1];
      if (emittedEvent) {
        expect(emittedEvent.durationMs).toBeGreaterThanOrEqual(10);
      }
    });
  });
});
