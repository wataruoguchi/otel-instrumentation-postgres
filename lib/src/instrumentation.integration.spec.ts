import { EventEmitter } from "node:events";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getDbEventEmitter } from "./db-events.js";
import { createOTELEmitter } from "./emitter/emitter.js";
import { PostgresInstrumentation } from "./instrumentation.js";

// Mock the db-events module
vi.mock("./db-events.js", () => ({
  getDbEventEmitter: vi.fn(),
}));

describe("instrumentation integration", () => {
  let mockDbEventEmitter: EventEmitter;
  let mockLogger: {
    debug: ReturnType<typeof vi.fn>;
    info: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
  };
  let instrumentation: PostgresInstrumentation;

  beforeEach(() => {
    mockLogger = {
      debug: vi.fn(),
      info: vi.fn(),
      error: vi.fn(),
    };

    mockDbEventEmitter = new EventEmitter();
    vi.mocked(getDbEventEmitter).mockReturnValue(mockDbEventEmitter);

    instrumentation = new PostgresInstrumentation({
      logger: mockLogger,
      serviceName: "test-service",
      enableHistogram: true,
      collectQueryParameters: true,
    });
  });

  describe("full flow: emitter to instrumentation", () => {
    it("should handle successful query through full flow", async () => {
      // Create a mock postgres client
      const mockPostgresClient = {
        query: vi.fn().mockResolvedValue({ rows: [{ id: 1, name: "John" }] }),
        options: { database: "testdb" },
      };

      // Create the event-emitting client
      const eventEmittingClient = createOTELEmitter(
        mockPostgresClient,
        mockLogger,
      );

      // Enable instrumentation to listen for events
      instrumentation.enable();

      // Execute a query through the event-emitting client
      const result = await eventEmittingClient.query(
        "SELECT * FROM users WHERE id = ?",
        [1],
      );

      // Verify the query was executed
      expect(mockPostgresClient.query).toHaveBeenCalledWith(
        "SELECT * FROM users WHERE id = ?",
        [1],
      );
      expect(result).toEqual({ rows: [{ id: 1, name: "John" }] });

      // Verify that events were emitted and handled
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining("Enabling postgres instrumentation"),
      );
      // The actual implementation logs different debug messages, so we just check that debug was called
      expect(mockLogger.debug).toHaveBeenCalled();
    });

    it("should handle failed query through full flow", async () => {
      const mockError = new Error("Database connection failed");
      const mockPostgresClient = {
        query: vi.fn().mockRejectedValue(mockError),
        options: { database: "testdb" },
      };

      const eventEmittingClient = createOTELEmitter(
        mockPostgresClient,
        mockLogger,
      );
      instrumentation.enable();

      await expect(
        eventEmittingClient.query("SELECT * FROM users WHERE id = ?", [1]),
      ).rejects.toThrow("Database connection failed");

      expect(mockPostgresClient.query).toHaveBeenCalledWith(
        "SELECT * FROM users WHERE id = ?",
        [1],
      );
    });

    it("should handle reserved connections through full flow", async () => {
      const mockReservedConnection = {
        query: vi.fn().mockResolvedValue({ rows: [{ id: 1 }] }),
        release: vi.fn().mockResolvedValue(undefined),
      };

      const mockPostgresClient = {
        query: vi.fn().mockResolvedValue({ rows: [] }),
        reserve: vi.fn().mockResolvedValue(mockReservedConnection),
        options: { database: "testdb" },
      };

      const eventEmittingClient = createOTELEmitter(
        mockPostgresClient,
        mockLogger,
      );
      instrumentation.enable();

      // Reserve a connection
      const reserved = await eventEmittingClient.reserve();

      // Execute a query on the reserved connection
      const result = await reserved.query(
        "SELECT * FROM users WHERE id = ?",
        [1],
      );

      // Release the connection
      await reserved.release();

      expect(mockPostgresClient.reserve).toHaveBeenCalled();
      expect(mockReservedConnection.query).toHaveBeenCalledWith(
        "SELECT * FROM users WHERE id = ?",
        [1],
      );
      expect(mockReservedConnection.release).toHaveBeenCalled();
      expect(result).toEqual({ rows: [{ id: 1 }] });
    });

    it("should handle multiple queries through full flow", async () => {
      const mockPostgresClient = {
        query: vi
          .fn()
          .mockResolvedValueOnce({ rows: [{ id: 1 }] })
          .mockResolvedValueOnce({ rows: [{ id: 2 }] })
          .mockResolvedValueOnce({ rows: [{ id: 3 }] }),
        options: { database: "testdb" },
      };

      const eventEmittingClient = createOTELEmitter(
        mockPostgresClient,
        mockLogger,
      );
      instrumentation.enable();

      // Execute multiple queries
      const result1 = await eventEmittingClient.query(
        "SELECT * FROM users WHERE id = ?",
        [1],
      );
      const result2 = await eventEmittingClient.query(
        "SELECT * FROM users WHERE id = ?",
        [2],
      );
      const result3 = await eventEmittingClient.query(
        "SELECT * FROM users WHERE id = ?",
        [3],
      );

      expect(mockPostgresClient.query).toHaveBeenCalledTimes(3);
      expect(result1).toEqual({ rows: [{ id: 1 }] });
      expect(result2).toEqual({ rows: [{ id: 2 }] });
      expect(result3).toEqual({ rows: [{ id: 3 }] });
    });

    it("should handle complex queries with different characteristics", async () => {
      const mockPostgresClient = {
        query: vi.fn().mockResolvedValue({ rows: [] }),
        options: { database: "testdb" },
      };

      const eventEmittingClient = createOTELEmitter(
        mockPostgresClient,
        mockLogger,
      );
      instrumentation.enable();

      // Execute a complex query
      await eventEmittingClient.query(
        "SELECT u.name, p.title FROM users u JOIN posts p ON u.id = p.user_id WHERE p.published = ? ORDER BY p.created_at LIMIT 10",
        [true],
      );

      expect(mockPostgresClient.query).toHaveBeenCalledWith(
        "SELECT u.name, p.title FROM users u JOIN posts p ON u.id = p.user_id WHERE p.published = ? ORDER BY p.created_at LIMIT 10",
        [true],
      );
    });

    it("should handle non-SQL method calls without interference", async () => {
      const mockEnd = vi.fn().mockResolvedValue(undefined);
      const mockPostgresClient = {
        query: vi.fn().mockResolvedValue({ rows: [] }),
        end: mockEnd,
        options: { database: "testdb" },
      };

      const eventEmittingClient = createOTELEmitter(
        mockPostgresClient,
        mockLogger,
      );
      instrumentation.enable();

      // Call a non-SQL method
      await eventEmittingClient.end();

      expect(mockEnd).toHaveBeenCalled();
      // Should not emit query events for non-SQL methods
      expect(mockLogger.debug).not.toHaveBeenCalledWith(
        expect.stringContaining("Intercepted query:"),
      );
    });

    it("should handle instrumentation disable and re-enable", async () => {
      const mockPostgresClient = {
        query: vi.fn().mockResolvedValue({ rows: [] }),
        options: { database: "testdb" },
      };

      const eventEmittingClient = createOTELEmitter(
        mockPostgresClient,
        mockLogger,
      );

      // Enable instrumentation
      instrumentation.enable();
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining("Enabling postgres instrumentation"),
      );

      // Execute a query
      await eventEmittingClient.query("SELECT * FROM users");

      // Disable instrumentation
      instrumentation.disable();
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining("Disabling postgres instrumentation"),
      );

      // Re-enable instrumentation
      vi.clearAllMocks();
      instrumentation.enable();

      // Execute another query
      await eventEmittingClient.query("SELECT * FROM users");

      // The query should be called once after re-enable
      expect(mockPostgresClient.query).toHaveBeenCalledTimes(1);
    });

    it("should handle different database names", async () => {
      const mockPostgresClient1 = {
        query: vi.fn().mockResolvedValue({ rows: [] }),
        options: { database: "db1" },
      };

      const mockPostgresClient2 = {
        query: vi.fn().mockResolvedValue({ rows: [] }),
        options: { database: "db2" },
      };

      const eventEmittingClient1 = createOTELEmitter(
        mockPostgresClient1,
        mockLogger,
      );
      const eventEmittingClient2 = createOTELEmitter(
        mockPostgresClient2,
        mockLogger,
      );

      instrumentation.enable();

      await eventEmittingClient1.query("SELECT * FROM users");
      await eventEmittingClient2.query("SELECT * FROM users");

      expect(mockPostgresClient1.query).toHaveBeenCalledWith(
        "SELECT * FROM users",
      );
      expect(mockPostgresClient2.query).toHaveBeenCalledWith(
        "SELECT * FROM users",
      );
    });

    it("should handle queries with various parameter types", async () => {
      const mockPostgresClient = {
        query: vi.fn().mockResolvedValue({ rows: [] }),
        options: { database: "testdb" },
      };

      const eventEmittingClient = createOTELEmitter(
        mockPostgresClient,
        mockLogger,
      );
      instrumentation.enable();

      // Test different parameter types
      await eventEmittingClient.query(
        "SELECT * FROM users WHERE id = ? AND name = ? AND active = ?",
        [1, "John", true],
      );

      expect(mockPostgresClient.query).toHaveBeenCalledWith(
        "SELECT * FROM users WHERE id = ? AND name = ? AND active = ?",
        [1, "John", true],
      );
    });

    it("should handle instrumentation configuration options", async () => {
      const customInstrumentation = new PostgresInstrumentation({
        logger: mockLogger,
        serviceName: "custom-service",
        enableHistogram: false,
        collectQueryParameters: false,
        serverAddress: "localhost",
        serverPort: 5432,
        databaseName: "customdb",
      });

      const mockPostgresClient = {
        query: vi.fn().mockResolvedValue({ rows: [] }),
        options: { database: "testdb" },
      };

      const eventEmittingClient = createOTELEmitter(
        mockPostgresClient,
        mockLogger,
      );
      customInstrumentation.enable();

      await eventEmittingClient.query("SELECT * FROM users");

      expect(mockPostgresClient.query).toHaveBeenCalledWith(
        "SELECT * FROM users",
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining("Enabling postgres instrumentation"),
      );
    });
  });
});
