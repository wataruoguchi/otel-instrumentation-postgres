import { EventEmitter } from "node:events";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getDbEventEmitter } from "../../db-events.js";
import { emitAndRunQuery } from "./query-executor.js";

// Mock the db-events module
vi.mock("../../db-events.js", () => ({
  getDbEventEmitter: vi.fn(),
}));

describe("query-executor", () => {
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

  describe("emitAndRunQuery", () => {
    it("should emit query event for successful query", async () => {
      const mockQuery = vi.fn().mockResolvedValue({ rows: [{ id: 1 }] });
      const target = mockQuery;
      const sql = "SELECT * FROM users WHERE id = ?";
      const params = [1];

      const querySpy = vi.spyOn(mockDbEventEmitter, "emit");

      const result = await emitAndRunQuery(
        target,
        target,
        [sql, params],
        mockLogger,
      );

      expect(mockQuery).toHaveBeenCalledWith(sql, params);
      expect(result).toEqual({ rows: [{ id: 1 }] });
      expect(querySpy).toHaveBeenCalledWith(
        "db:query",
        expect.objectContaining({
          sql,
          params,
          result: { rows: [{ id: 1 }] },
          durationMs: expect.any(Number),
        }),
      );
    });

    it("should emit query event for failed query", async () => {
      const mockError = new Error("Database error");
      const mockQuery = vi.fn().mockRejectedValue(mockError);
      const target = mockQuery;
      const sql = "SELECT * FROM users WHERE id = ?";
      const params = [1];

      const querySpy = vi.spyOn(mockDbEventEmitter, "emit");

      await expect(
        emitAndRunQuery(target, target, [sql, params], mockLogger),
      ).rejects.toThrow("Database error");

      expect(mockQuery).toHaveBeenCalledWith(sql, params);
      expect(querySpy).toHaveBeenCalledWith(
        "db:query",
        expect.objectContaining({
          sql,
          params,
          error: mockError,
          durationMs: expect.any(Number),
        }),
      );
    });

    it("should handle queries without parameters", async () => {
      const mockQuery = vi.fn().mockResolvedValue({ rows: [] });
      const target = mockQuery;
      const sql = "SELECT * FROM users";

      const querySpy = vi.spyOn(mockDbEventEmitter, "emit");

      await emitAndRunQuery(target, target, [sql], mockLogger);

      expect(mockQuery).toHaveBeenCalledWith(sql);
      expect(querySpy).toHaveBeenCalledWith(
        "db:query",
        expect.objectContaining({
          sql,
          params: [],
          result: { rows: [] },
          durationMs: expect.any(Number),
        }),
      );
    });

    it("should extract database name from client options", async () => {
      const mockQuery = vi.fn().mockResolvedValue({ rows: [] });
      const target = mockQuery;
      const thisArg = { options: { database: "testdb" } };
      const sql = "SELECT * FROM users";

      const querySpy = vi.spyOn(mockDbEventEmitter, "emit");

      await emitAndRunQuery(target, thisArg, [sql], mockLogger);

      expect(querySpy).toHaveBeenCalledWith(
        "db:query",
        expect.objectContaining({
          sql,
          databaseName: "testdb",
          durationMs: expect.any(Number),
        }),
      );
    });

    it("should extract database name from thisArg if target doesn't have it", async () => {
      const mockQuery = vi.fn().mockResolvedValue({ rows: [] });
      const target = mockQuery;
      const thisArg = { options: { database: "testdb" } };
      const sql = "SELECT * FROM users";

      const querySpy = vi.spyOn(mockDbEventEmitter, "emit");

      await emitAndRunQuery(target, thisArg, [sql], mockLogger);

      expect(querySpy).toHaveBeenCalledWith(
        "db:query",
        expect.objectContaining({
          sql,
          databaseName: "testdb",
          durationMs: expect.any(Number),
        }),
      );
    });

    it("should handle missing database name gracefully", async () => {
      const mockQuery = vi.fn().mockResolvedValue({ rows: [] });
      const target = mockQuery;
      const sql = "SELECT * FROM users";

      const querySpy = vi.spyOn(mockDbEventEmitter, "emit");

      await emitAndRunQuery(target, target, [sql], mockLogger);

      expect(querySpy).toHaveBeenCalledWith(
        "db:query",
        expect.objectContaining({
          sql,
          databaseName: undefined,
          durationMs: expect.any(Number),
        }),
      );
    });

    it("should calculate duration correctly", async () => {
      const mockQuery = vi.fn().mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return { rows: [] };
      });
      const target = mockQuery;
      const sql = "SELECT * FROM users";

      const querySpy = vi.spyOn(mockDbEventEmitter, "emit");

      await emitAndRunQuery(target, target, [sql], mockLogger);

      const emittedEvent = querySpy.mock.calls[0][1];
      expect(emittedEvent.durationMs).toBeGreaterThanOrEqual(10);
      expect(emittedEvent.durationMs).toBeLessThan(50); // Allow some tolerance
    });

    it("should log debug information when logger is provided", async () => {
      const mockQuery = vi.fn().mockResolvedValue({ rows: [] });
      const target = mockQuery;
      const sql = "SELECT * FROM users";

      await emitAndRunQuery(target, target, [sql], mockLogger);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        "[DB-QUERY-SENDER] Intercepted query:",
        `${sql.substring(0, 100)}...`,
        "",
      );
    });

    it("should work without logger", async () => {
      const mockQuery = vi.fn().mockResolvedValue({ rows: [] });
      const target = mockQuery;
      const sql = "SELECT * FROM users";

      const querySpy = vi.spyOn(mockDbEventEmitter, "emit");

      await emitAndRunQuery(target, target, [sql]);

      expect(querySpy).toHaveBeenCalledWith(
        "db:query",
        expect.objectContaining({
          sql,
          durationMs: expect.any(Number),
        }),
      );
    });

    it("should handle non-string first argument gracefully", async () => {
      const mockQuery = vi.fn().mockResolvedValue({ rows: [] });
      const target = mockQuery;
      const nonStringArg = 123;

      const querySpy = vi.spyOn(mockDbEventEmitter, "emit");

      await emitAndRunQuery(target, target, [nonStringArg], mockLogger);

      expect(querySpy).toHaveBeenCalledWith(
        "db:query",
        expect.objectContaining({
          sql: 123,
          params: [],
          durationMs: expect.any(Number),
        }),
      );
    });

    it("should handle undefined parameters", async () => {
      const mockQuery = vi.fn().mockResolvedValue({ rows: [] });
      const target = mockQuery;
      const sql = "SELECT * FROM users";

      const querySpy = vi.spyOn(mockDbEventEmitter, "emit");

      await emitAndRunQuery(target, target, [sql, undefined], mockLogger);

      expect(querySpy).toHaveBeenCalledWith(
        "db:query",
        expect.objectContaining({
          sql,
          params: [],
          durationMs: expect.any(Number),
        }),
      );
    });
  });

  describe("database name extraction", () => {
    it("should extract database name from thisArg options", async () => {
      const mockTarget = vi.fn().mockResolvedValue("result");
      const mockThisArg = {
        options: {
          database: "testdb",
        },
      };
      const args = ["SELECT * FROM users", []];

      const result = await emitAndRunQuery(
        mockTarget,
        mockThisArg,
        args,
        mockLogger,
      );

      expect(result).toBe("result");
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining("Intercepted query:"),
        expect.stringContaining("SELECT * FROM users"),
        "(database: testdb)",
      );
    });

    it("should extract database name from target options when thisArg has no options", async () => {
      const mockTarget = {
        apply: vi.fn().mockResolvedValue("result"),
        options: {
          database: "targetdb",
        },
      };
      const mockThisArg = {};
      const args = ["SELECT * FROM users", []];

      const result = await emitAndRunQuery(
        mockTarget,
        mockThisArg,
        args,
        mockLogger,
      );

      expect(result).toBe("result");
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining("Intercepted query:"),
        expect.stringContaining("SELECT * FROM users"),
        "(database: targetdb)",
      );
    });

    it("should handle missing database name gracefully", async () => {
      const mockTarget = vi.fn().mockResolvedValue("result");
      const mockThisArg = {};
      const args = ["SELECT * FROM users", []];

      const result = await emitAndRunQuery(
        mockTarget,
        mockThisArg,
        args,
        mockLogger,
      );

      expect(result).toBe("result");
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining("Intercepted query:"),
        expect.stringContaining("SELECT * FROM users"),
        "",
      );
    });

    it("should handle thisArg with options but no database", async () => {
      const mockTarget = vi.fn().mockResolvedValue("result");
      const mockThisArg = {
        options: {
          host: "localhost",
        },
      };
      const args = ["SELECT * FROM users", []];

      const result = await emitAndRunQuery(
        mockTarget,
        mockThisArg,
        args,
        mockLogger,
      );

      expect(result).toBe("result");
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining("Intercepted query:"),
        expect.stringContaining("SELECT * FROM users"),
        "",
      );
    });

    it("should handle target with options but no database", async () => {
      const mockTarget = {
        apply: vi.fn().mockResolvedValue("result"),
        options: {
          host: "localhost",
        },
      };
      const mockThisArg = {};
      const args = ["SELECT * FROM users", []];

      const result = await emitAndRunQuery(
        mockTarget,
        mockThisArg,
        args,
        mockLogger,
      );

      expect(result).toBe("result");
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining("Intercepted query:"),
        expect.stringContaining("SELECT * FROM users"),
        "",
      );
    });
  });

  describe("error handling", () => {
    it("should emit error event and re-throw when query fails", async () => {
      const mockError = new Error("Database error");
      const mockTarget = vi.fn().mockRejectedValue(mockError);
      const args = ["SELECT * FROM users", []];

      await expect(
        emitAndRunQuery(mockTarget, {}, args, mockLogger),
      ).rejects.toThrow("Database error");

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining("Intercepted query:"),
        expect.stringContaining("SELECT * FROM users"),
        "",
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining("Emitting error event:"),
        expect.stringMatching(/\d+ms/),
        "",
      );
    });

    it("should handle non-Error exceptions", async () => {
      const mockTarget = vi.fn().mockRejectedValue("String error");
      const args = ["SELECT * FROM users", []];

      await expect(
        emitAndRunQuery(mockTarget, {}, args, mockLogger),
      ).rejects.toBe("String error");

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining("Emitting error event:"),
        expect.stringMatching(/\d+ms/),
        "",
      );
    });

    it("should handle null/undefined exceptions", async () => {
      const mockTarget = vi.fn().mockRejectedValue(null);
      const args = ["SELECT * FROM users", []];

      await expect(
        emitAndRunQuery(mockTarget, {}, args, mockLogger),
      ).rejects.toBeNull();

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining("Emitting error event:"),
        expect.stringMatching(/\d+ms/),
        "",
      );
    });
  });

  describe("parameter handling", () => {
    it("should handle undefined parameters", async () => {
      const mockTarget = vi.fn().mockResolvedValue("result");
      const args = ["SELECT * FROM users", undefined];

      const result = await emitAndRunQuery(mockTarget, {}, args, mockLogger);

      expect(result).toBe("result");
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining("Intercepted query:"),
        expect.stringContaining("SELECT * FROM users"),
        "",
      );
    });

    it("should handle null parameters", async () => {
      const mockTarget = vi.fn().mockResolvedValue("result");
      const args = ["SELECT * FROM users", null];

      const result = await emitAndRunQuery(mockTarget, {}, args, mockLogger);

      expect(result).toBe("result");
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining("Intercepted query:"),
        expect.stringContaining("SELECT * FROM users"),
        "",
      );
    });

    it("should handle empty parameters array", async () => {
      const mockTarget = vi.fn().mockResolvedValue("result");
      const args = ["SELECT * FROM users", []];

      const result = await emitAndRunQuery(mockTarget, {}, args, mockLogger);

      expect(result).toBe("result");
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining("Intercepted query:"),
        expect.stringContaining("SELECT * FROM users"),
        "",
      );
    });
  });

  describe("SQL truncation", () => {
    it("should truncate long SQL queries in debug logs", async () => {
      const mockTarget = vi.fn().mockResolvedValue("result");
      const longSql = "SELECT * FROM users WHERE " + "a".repeat(200);
      const args = [longSql, []];

      const result = await emitAndRunQuery(mockTarget, {}, args, mockLogger);

      expect(result).toBe("result");
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining("Intercepted query:"),
        expect.stringMatching(/^.{100}\.\.\.$/),
        "",
      );
    });

    it("should not truncate short SQL queries", async () => {
      const mockTarget = vi.fn().mockResolvedValue("result");
      const shortSql = "SELECT * FROM users";
      const args = [shortSql, []];

      const result = await emitAndRunQuery(mockTarget, {}, args, mockLogger);

      expect(result).toBe("result");
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining("Intercepted query:"),
        expect.stringContaining(shortSql),
        "",
      );
    });
  });
});
