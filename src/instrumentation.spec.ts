import { SpanStatusCode, type Tracer, trace } from "@opentelemetry/api";
import { EventEmitter } from "node:events";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
        expect(mockLogger.info).toHaveBeenCalledWith(
          "[POSTGRES-INSTRUMENTATION] Setting up event listeners for db:query events",
        );
        expect(mockLogger.info).toHaveBeenCalledWith(
          "[POSTGRES-INSTRUMENTATION] Event listener registered successfully",
        );
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
        };

        mockDbEventEmitter.emit("db:query", testEvent);

        expect(mockTracer.startSpan).toHaveBeenCalledWith("postgres.query", {
          attributes: {
            "db.system": "postgresql",
            "db.statement": testEvent.sql,
            "db.operation": "SELECT",
            "db.table": "users",
            "db.parameter_count": 1,
            "db.query_has_where": true,
            "db.query_has_join": false,
            "db.query_has_order_by": false,
            "db.query_has_limit": false,
            "db.query_complexity": "low",
            "db.duration_ms": 15,
            "service.name": "test-service",
          },
        });

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
        };

        mockDbEventEmitter.emit("db:query", testEvent);

        expect(mockSpan.setStatus).toHaveBeenCalledWith({
          code: SpanStatusCode.ERROR,
          message: "Error: Database connection failed",
        });
        expect(mockSpan.recordException).toHaveBeenCalledWith(
          "Error: Database connection failed",
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
        };

        mockDbEventEmitter.emit("db:query", testEvent);

        expect(mockTracer.startSpan).toHaveBeenCalledWith("postgres.query", {
          attributes: expect.objectContaining({
            "db.operation": "SELECT",
            "db.table": "users",
            "db.parameter_count": 1,
            "db.query_has_where": true,
            "db.query_has_join": true,
            "db.query_has_order_by": true,
            "db.query_has_limit": true,
            "db.query_complexity": "high",
            "db.duration_ms": 25,
          }),
        });
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
        };

        mockDbEventEmitter.emit("db:query", testEvent);

        expect(mockTracer.startSpan).toHaveBeenCalledWith("postgres.query", {
          attributes: expect.objectContaining({
            "db.table": "",
          }),
        });
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
