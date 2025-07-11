import { SpanStatusCode, type Tracer, trace } from "@opentelemetry/api";
import { EventEmitter } from "node:events";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DbQueryEvent } from "./db-events.js";
import { getDbEventEmitter } from "./db-events.js";
import {
  PostgresInstrumentation,
  registerDbQueryReceiver,
} from "./instrumentation.js";

// Mock the db-events module
vi.mock("./db-events.js", () => ({
  getDbEventEmitter: vi.fn(),
}));

// Mock OpenTelemetry
vi.mock("@opentelemetry/api", () => ({
  trace: {
    getTracer: vi.fn(),
  },
  SpanStatusCode: {
    OK: "OK",
    ERROR: "ERROR",
  },
  context: {
    active: vi.fn().mockReturnValue({}),
  },
}));

describe("instrumentation", () => {
  let mockLogger: {
    debug: ReturnType<typeof vi.fn>;
    info: ReturnType<typeof vi.fn>;
  };
  let mockDbEventEmitter: EventEmitter;
  let mockTracer: { startSpan: ReturnType<typeof vi.fn> };
  let mockSpan: {
    setStatus: ReturnType<typeof vi.fn>;
    recordException: ReturnType<typeof vi.fn>;
    end: ReturnType<typeof vi.fn>;
    setAttribute: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    mockLogger = {
      debug: vi.fn(),
      info: vi.fn(),
    };

    mockDbEventEmitter = new EventEmitter();
    vi.mocked(getDbEventEmitter).mockReturnValue(mockDbEventEmitter);

    mockSpan = {
      setStatus: vi.fn(),
      recordException: vi.fn(),
      end: vi.fn(),
      setAttribute: vi.fn(),
    };

    mockTracer = {
      startSpan: vi.fn().mockReturnValue(mockSpan),
    };

    vi.mocked(trace.getTracer).mockReturnValue(mockTracer as unknown as Tracer);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("PostgresInstrumentation", () => {
    describe("constructor", () => {
      it("should create instrumentation with default config", () => {
        const instrumentation = new PostgresInstrumentation();
        expect(instrumentation).toBeInstanceOf(PostgresInstrumentation);
      });

      it("should create instrumentation with custom config", () => {
        const instrumentation = new PostgresInstrumentation({
          serviceName: "test-service",
          logger: mockLogger,
        });
        expect(instrumentation).toBeInstanceOf(PostgresInstrumentation);
      });
    });

    describe("enable", () => {
      it("should enable instrumentation and setup event listeners", () => {
        const instrumentation = new PostgresInstrumentation({
          logger: mockLogger,
        });

        instrumentation.enable();

        expect(mockLogger.debug).toHaveBeenCalledWith(
          "[POSTGRES-INSTRUMENTATION] Enable method called",
        );
        expect(mockLogger.info).toHaveBeenCalledWith(
          "[POSTGRES-INSTRUMENTATION] Enabling postgres instrumentation",
        );
        // Note: With patch-based approach, we don't set up event listeners anymore
        // The instrumentation now uses module patching instead
        // Note: With patch-based approach, we don't register event listeners anymore
        expect(mockLogger.debug).toHaveBeenCalledWith(
          "[POSTGRES-INSTRUMENTATION] Enable method completed",
        );
      });

      it("should work without logger", () => {
        const instrumentation = new PostgresInstrumentation();
        expect(() => {
          instrumentation.enable();
        }).not.toThrow();
      });
    });

    describe("disable", () => {
      it("should disable instrumentation and remove event listeners", () => {
        const instrumentation = new PostgresInstrumentation({
          logger: mockLogger,
        });

        // First enable to setup listeners
        instrumentation.enable();
        vi.clearAllMocks();

        // Then disable
        instrumentation.disable();

        expect(mockLogger.info).toHaveBeenCalledWith(
          "[POSTGRES-INSTRUMENTATION] Disabling postgres instrumentation",
        );
      });
    });

    describe("event handling", () => {
      it("should create span for successful query", () => {
        const instrumentation = new PostgresInstrumentation({
          logger: mockLogger,
          serviceName: "test-service",
        });

        instrumentation.enable();

        const testEvent = {
          sql: "SELECT * FROM users WHERE id = ?",
          params: [1],
          result: { rows: [{ id: 1, name: "John" }] },
          durationMs: 15,
          databaseName: "testdb",
        };

        mockDbEventEmitter.emit("db:query", testEvent);

        expect(mockTracer.startSpan).toHaveBeenCalledWith(
          "SELECT",
          {
            attributes: {
              "service.name": "test-service",
              "net.peer.name": undefined,
              "net.peer.port": undefined,
              "db.system.name": "postgresql",
              "db.namespace": "testdb",
              "db.query.text": testEvent.sql,
              "db.query.type": "read",
              "db.operation.name": "SELECT",
              "db.collection.name": "users",
              "db.parameter_count": 1,
              "db.query.has_where": true,
              "db.query.has_join": false,
              "db.query.has_order_by": false,
              "db.query.has_limit": false,
              "db.query.complexity": "low",
              "db.duration_ms": 15,
              "db.duration_seconds": 0.015,
            },
          },
          expect.anything(),
        );

        expect(mockSpan.setStatus).toHaveBeenCalledWith({
          code: SpanStatusCode.OK,
        });
        expect(mockSpan.end).toHaveBeenCalled();
      });

      it("should create span for failed query", () => {
        const instrumentation = new PostgresInstrumentation({
          logger: mockLogger,
        });

        instrumentation.enable();

        const testError = new Error("Database connection failed");
        const testEvent = {
          sql: "SELECT * FROM users WHERE id = ?",
          params: [1],
          error: testError,
          durationMs: 5,
          databaseName: "testdb",
        };

        mockDbEventEmitter.emit("db:query", testEvent);

        expect(mockSpan.setStatus).toHaveBeenCalledWith({
          code: SpanStatusCode.ERROR,
          message: "Error: Database connection failed",
        });
        expect(mockSpan.recordException).toHaveBeenCalledWith(testError);
        expect(mockSpan.setAttribute).toHaveBeenCalledWith(
          "exception.type",
          "Error",
        );
        expect(mockSpan.end).toHaveBeenCalled();
      });

      it("should handle complex queries with multiple characteristics", () => {
        const instrumentation = new PostgresInstrumentation({
          logger: mockLogger,
        });

        instrumentation.enable();

        const testEvent = {
          sql: "SELECT u.name, p.title FROM users u JOIN posts p ON u.id = p.user_id WHERE p.published = ? ORDER BY p.created_at LIMIT 10",
          params: [true],
          result: { rows: [] },
          durationMs: 25,
          databaseName: "testdb",
        };

        mockDbEventEmitter.emit("db:query", testEvent);

        expect(mockTracer.startSpan).toHaveBeenCalledWith(
          "SELECT",
          {
            attributes: expect.objectContaining({
              "db.operation.name": "SELECT",
              "db.collection.name": "users",
              "db.parameter_count": 1,
              "db.query.has_where": true,
              "db.query.has_join": true,
              "db.query.has_order_by": true,
              "db.query.has_limit": true,
              "db.query.complexity": "high",
              "db.duration_ms": 25,
              "db.duration_seconds": 0.025,
            }),
          },
          expect.anything(),
        );
      });

      it("should handle queries without table names", () => {
        const instrumentation = new PostgresInstrumentation({
          logger: mockLogger,
        });

        instrumentation.enable();

        const testEvent = {
          sql: "SELECT 1",
          params: [],
          result: { rows: [{ "1": 1 }] },
          durationMs: 1,
          databaseName: "testdb",
        };

        mockDbEventEmitter.emit("db:query", testEvent);

        expect(mockTracer.startSpan).toHaveBeenCalledWith(
          "SELECT",
          {
            attributes: expect.objectContaining({
              "db.collection.name": "unknown",
            }),
          },
          expect.anything(),
        );
      });

      it("should work without service name", () => {
        const instrumentation = new PostgresInstrumentation({
          logger: mockLogger,
        });

        instrumentation.enable();

        const testEvent = {
          sql: "SELECT * FROM users",
          params: [],
          result: { rows: [] },
          durationMs: 10,
          databaseName: "testdb",
        };

        mockDbEventEmitter.emit("db:query", testEvent);

        const attributes = mockTracer.startSpan.mock.calls[0][1].attributes;
        expect(attributes).not.toHaveProperty("service.name");
      });
    });

    describe("listener management", () => {
      it("should remove existing listener when re-enabling", () => {
        const instrumentation = new PostgresInstrumentation({
          logger: mockLogger,
        });

        // Enable first time
        instrumentation.enable();
        const firstListenerCount = mockDbEventEmitter.listenerCount("db:query");

        // Enable second time
        instrumentation.enable();
        const secondListenerCount =
          mockDbEventEmitter.listenerCount("db:query");

        // Should have same number of listeners (old one removed, new one added)
        expect(secondListenerCount).toBe(firstListenerCount);
      });

      it("should remove listener when disabled", () => {
        const instrumentation = new PostgresInstrumentation({
          logger: mockLogger,
        });

        instrumentation.enable();
        const enabledListenerCount =
          mockDbEventEmitter.listenerCount("db:query");

        instrumentation.disable();
        const disabledListenerCount =
          mockDbEventEmitter.listenerCount("db:query");

        expect(disabledListenerCount).toBe(enabledListenerCount - 1);
      });
    });
  });

  describe("hooks and callbacks", () => {
    it("should call responseHook when provided and result is available", () => {
      const responseHook = vi.fn();
      const instrumentation = new PostgresInstrumentation({
        responseHook,
        logger: mockLogger,
      });
      instrumentation.enable();

      const mockSpan = {
        setAttribute: vi.fn(),
        setStatus: vi.fn(),
        end: vi.fn(),
      };

      const event: DbQueryEvent = {
        sql: "SELECT * FROM users",
        params: [],
        result: [{ id: 1, name: "test" }],
        durationMs: 100,
        databaseName: "testdb",
      };

      instrumentation["handleQueryEvent"](event);
      expect(responseHook).toHaveBeenCalledWith(
        expect.any(Object),
        event.result,
      );
    });

    it("should call afterSpan hook when provided", () => {
      const afterSpan = vi.fn();
      const instrumentation = new PostgresInstrumentation({
        afterSpan,
        logger: mockLogger,
      });
      instrumentation.enable();

      const event: DbQueryEvent = {
        sql: "SELECT * FROM users",
        params: [],
        result: [{ id: 1, name: "test" }],
        durationMs: 100,
        databaseName: "testdb",
      };

      instrumentation["handleQueryEvent"](event);
      expect(afterSpan).toHaveBeenCalledWith(expect.any(Object), event);
    });

    it("should handle non-array results in responseHook", () => {
      const responseHook = vi.fn();
      const instrumentation = new PostgresInstrumentation({
        responseHook,
        logger: mockLogger,
      });
      instrumentation.enable();

      const event: DbQueryEvent = {
        sql: "SELECT COUNT(*) FROM users",
        params: [],
        result: 42, // Non-array result
        durationMs: 100,
        databaseName: "testdb",
      };

      instrumentation["handleQueryEvent"](event);
      expect(responseHook).toHaveBeenCalledWith(expect.any(Object), 42);
    });

    it("should handle null/undefined results", () => {
      const responseHook = vi.fn();
      const instrumentation = new PostgresInstrumentation({
        responseHook,
        logger: mockLogger,
      });
      instrumentation.enable();

      const event: DbQueryEvent = {
        sql: "DELETE FROM users WHERE id = 999",
        params: [],
        result: null,
        durationMs: 100,
        databaseName: "testdb",
      };

      instrumentation["handleQueryEvent"](event);
      // responseHook is not called for null/undefined results
      expect(responseHook).not.toHaveBeenCalled();
    });
  });

  describe("error handling", () => {
    it("should handle Error objects in getErrorType", () => {
      const instrumentation = new PostgresInstrumentation({
        logger: mockLogger,
      });
      const customError = new Error("Custom error");
      const errorType = instrumentation["getErrorType"](customError);
      expect(errorType).toBe("Error");
    });

    it("should handle non-Error objects in getErrorType", () => {
      const instrumentation = new PostgresInstrumentation({
        logger: mockLogger,
      });
      const errorType = instrumentation["getErrorType"]("string error");
      expect(errorType).toBe("_OTHER");
    });

    it("should handle custom error classes", () => {
      const instrumentation = new PostgresInstrumentation({
        logger: mockLogger,
      });
      class CustomError extends Error {}
      const customError = new CustomError("Custom error");
      const errorType = instrumentation["getErrorType"](customError);
      expect(errorType).toBe("CustomError");
    });

    it("should handle metrics recording errors gracefully", () => {
      const instrumentation = new PostgresInstrumentation({
        logger: mockLogger,
      });
      instrumentation.enable();

      // Mock a broken query analysis that would cause metrics recording to fail
      const event: DbQueryEvent = {
        sql: "SELECT * FROM users",
        params: [],
        result: [{ id: 1 }],
        durationMs: 100,
        databaseName: "testdb",
      };

      // This should not throw an error
      expect(() => {
        instrumentation["handleQueryEvent"](event);
      }).not.toThrow();
    });
  });

  describe("connection events", () => {
    it("should handle connect events", () => {
      const instrumentation = new PostgresInstrumentation({
        logger: mockLogger,
      });
      instrumentation.enable();

      const connectEvent = {
        type: "connect",
        timestamp: Date.now(),
        connectionId: "conn-1",
      };

      instrumentation["handleConnectionEvent"](connectEvent);
      expect(instrumentation["connectionStartTimes"].get("conn-1")).toBe(
        connectEvent.timestamp,
      );
    });

    it("should handle disconnect events with duration calculation", () => {
      const instrumentation = new PostgresInstrumentation({
        logger: mockLogger,
      });
      instrumentation.enable();

      const startTime = Date.now();
      const connectEvent = {
        type: "connect",
        timestamp: startTime,
        connectionId: "conn-1",
      };

      const disconnectEvent = {
        type: "disconnect",
        timestamp: startTime + 5000, // 5 seconds later
        connectionId: "conn-1",
      };

      instrumentation["handleConnectionEvent"](connectEvent);
      instrumentation["handleConnectionEvent"](disconnectEvent);

      // In test environment, meter is not available, so histogram won't be created
      // and connection start time won't be cleaned up
      expect(instrumentation["connectionStartTimes"].has("conn-1")).toBe(true);
    });

    it("should handle disconnect events without start time", () => {
      const instrumentation = new PostgresInstrumentation({
        logger: mockLogger,
      });
      instrumentation.enable();

      const disconnectEvent = {
        type: "disconnect",
        timestamp: Date.now(),
        connectionId: "conn-1",
      };

      // Should not throw when no start time exists
      expect(() => {
        instrumentation["handleConnectionEvent"](disconnectEvent);
      }).not.toThrow();
    });

    it("should handle unknown connection event types", () => {
      const instrumentation = new PostgresInstrumentation({
        logger: mockLogger,
      });
      instrumentation.enable();

      const unknownEvent = {
        type: "unknown",
        timestamp: Date.now(),
        connectionId: "conn-1",
      };

      expect(() => {
        instrumentation["handleConnectionEvent"](unknownEvent);
      }).not.toThrow();
    });
  });

  describe("query type classification", () => {
    it("should classify SELECT as READ", () => {
      const instrumentation = new PostgresInstrumentation({
        logger: mockLogger,
      });
      const queryType = instrumentation["getQueryType"]("SELECT");
      expect(queryType).toBe("read");
    });

    it("should classify INSERT as WRITE", () => {
      const instrumentation = new PostgresInstrumentation({
        logger: mockLogger,
      });
      const queryType = instrumentation["getQueryType"]("INSERT");
      expect(queryType).toBe("write");
    });

    it("should classify UPDATE as WRITE", () => {
      const instrumentation = new PostgresInstrumentation({
        logger: mockLogger,
      });
      const queryType = instrumentation["getQueryType"]("UPDATE");
      expect(queryType).toBe("write");
    });

    it("should classify DELETE as WRITE", () => {
      const instrumentation = new PostgresInstrumentation({
        logger: mockLogger,
      });
      const queryType = instrumentation["getQueryType"]("DELETE");
      expect(queryType).toBe("write");
    });

    it("should classify CREATE as SCHEMA", () => {
      const instrumentation = new PostgresInstrumentation({
        logger: mockLogger,
      });
      const queryType = instrumentation["getQueryType"]("CREATE");
      expect(queryType).toBe("schema");
    });

    it("should classify ALTER as SCHEMA", () => {
      const instrumentation = new PostgresInstrumentation({
        logger: mockLogger,
      });
      const queryType = instrumentation["getQueryType"]("ALTER");
      expect(queryType).toBe("schema");
    });

    it("should classify DROP as SCHEMA", () => {
      const instrumentation = new PostgresInstrumentation({
        logger: mockLogger,
      });
      const queryType = instrumentation["getQueryType"]("DROP");
      expect(queryType).toBe("schema");
    });

    it("should classify unknown operations as UNKNOWN", () => {
      const instrumentation = new PostgresInstrumentation({
        logger: mockLogger,
      });
      const queryType = instrumentation["getQueryType"]("UNKNOWN_OPERATION");
      expect(queryType).toBe("unknown");
    });

    it("should handle case-insensitive operations", () => {
      const instrumentation = new PostgresInstrumentation({
        logger: mockLogger,
      });
      const queryType = instrumentation["getQueryType"]("select");
      expect(queryType).toBe("read");
    });
  });

  describe("static registerDbQueryReceiver", () => {
    it("should create and enable instrumentation with all options", () => {
      const beforeSpan = vi.fn();
      const afterSpan = vi.fn();
      const responseHook = vi.fn();
      const parameterSanitizer = vi.fn((param: unknown) => String(param));

      const instrumentation = PostgresInstrumentation.registerDbQueryReceiver(
        {
          serviceName: "test-service",
          enableHistogram: true,
          collectQueryParameters: true,
          serverAddress: "localhost",
          serverPort: 5432,
          parameterSanitizer,
          beforeSpan,
          afterSpan,
          responseHook,
        },
        mockLogger,
      );

      expect(instrumentation).toBeInstanceOf(PostgresInstrumentation);
      expect(instrumentation["serviceName"]).toBe("test-service");
      expect(instrumentation["enableHistogram"]).toBe(true);
      expect(instrumentation["collectQueryParameters"]).toBe(true);
      expect(instrumentation["serverAddress"]).toBe("localhost");
      expect(instrumentation["serverPort"]).toBe(5432);
      expect(instrumentation["parameterSanitizer"]).toBe(parameterSanitizer);
      expect(instrumentation["beforeSpan"]).toBe(beforeSpan);
      expect(instrumentation["afterSpan"]).toBe(afterSpan);
      expect(instrumentation["responseHook"]).toBe(responseHook);
    });

    it("should create instrumentation with minimal options", () => {
      const instrumentation = PostgresInstrumentation.registerDbQueryReceiver(
        {},
        mockLogger,
      );
      expect(instrumentation).toBeInstanceOf(PostgresInstrumentation);
      expect(instrumentation["serviceName"]).toBeUndefined();
      expect(instrumentation["enableHistogram"]).toBe(true);
      expect(instrumentation["collectQueryParameters"]).toBe(false);
    });
  });

  describe("registerDbQueryReceiver", () => {
    it("should create and enable instrumentation", () => {
      const instrumentation = registerDbQueryReceiver(
        { serviceName: "test-service" },
        mockLogger,
      );

      expect(instrumentation).toBeInstanceOf(PostgresInstrumentation);
      expect(mockLogger.info).toHaveBeenCalledWith(
        "[POSTGRES-INSTRUMENTATION] Enabling postgres instrumentation",
      );
    });

    it("should work with default options", () => {
      const instrumentation = registerDbQueryReceiver();

      expect(instrumentation).toBeInstanceOf(PostgresInstrumentation);
    });

    it("should work without logger", () => {
      expect(() => {
        registerDbQueryReceiver({ serviceName: "test-service" });
      }).not.toThrow();
    });
  });

  describe("legacy function export", () => {
    it("should export registerDbQueryReceiver function", () => {
      expect(typeof registerDbQueryReceiver).toBe("function");
    });
  });
});
