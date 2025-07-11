// @ts-nocheck
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createProxyHandler } from "./proxy-handler.js";

describe("proxy-handler", () => {
  let mockLogger: {
    debug: ReturnType<typeof vi.fn>;
    info: ReturnType<typeof vi.fn>;
  };
  let connectionIds: Map<unknown, string>;

  beforeEach(() => {
    mockLogger = {
      debug: vi.fn(),
      info: vi.fn(),
    };
    connectionIds = new Map();
  });

  describe("createProxyHandler", () => {
    it("should create a proxy handler object", () => {
      const handler = createProxyHandler(connectionIds, mockLogger);
      expect(typeof handler).toBe("object");
      expect(typeof handler.get).toBe("function");
      expect(typeof handler.apply).toBe("function");
    });

    it("should intercept query method calls", () => {
      const handler = createProxyHandler(connectionIds, mockLogger);
      const target = {
        query: vi.fn().mockResolvedValue({ rows: [] }),
      };
      const property = "query";
      const receiver = target;

      const result = handler.get(target, property, receiver);
      expect(typeof result).toBe("function");
    });

    it("should not intercept non-query method calls", () => {
      const handler = createProxyHandler(connectionIds, mockLogger);
      const target = {
        end: vi.fn().mockResolvedValue(undefined),
      };
      const property = "end";
      const receiver = target;

      const result = handler.get(target, property, receiver);
      expect(typeof result).toBe("function");
    });

    it("should handle property access for non-methods", () => {
      const handler = createProxyHandler(connectionIds, mockLogger);
      const target = {
        options: { database: "testdb" },
      };
      const property = "options";
      const receiver = target;

      const result = handler.get(target, property, receiver);
      expect(result).toEqual({ database: "testdb" });
    });

    it("should handle undefined target gracefully", () => {
      const handler = createProxyHandler(connectionIds, mockLogger);
      const property = "query";
      const receiver = {};

      expect(() => handler.get(undefined, property, receiver)).toThrow(
        "Reflect.get called on non-object",
      );
    });

    it("should handle null target gracefully", () => {
      const handler = createProxyHandler(connectionIds, mockLogger);
      const property = "query";
      const receiver = {};

      expect(() => handler.get(null, property, receiver)).toThrow(
        "Reflect.get called on non-object",
      );
    });

    it("should handle non-object target gracefully", () => {
      const handler = createProxyHandler(connectionIds, mockLogger);
      const property = "query";
      const receiver = {};

      expect(() => handler.get("string" as any, property, receiver)).toThrow(
        "Reflect.get called on non-object",
      );
    });

    it("should handle missing property gracefully", () => {
      const handler = createProxyHandler(connectionIds, mockLogger);
      const target = {};
      const property = "nonexistent";
      const receiver = target;

      const result = handler.get(target, property, receiver);
      expect(result).toBeUndefined();
    });

    it("should handle non-function property gracefully", () => {
      const handler = createProxyHandler(connectionIds, mockLogger);
      const target = {
        query: "not a function",
      };
      const property = "query";
      const receiver = target;

      const result = handler.get(target, property, receiver);
      expect(result).toBe("not a function");
    });

    it("should work without logger", () => {
      const handler = createProxyHandler(connectionIds);
      const target = {
        query: vi.fn().mockResolvedValue({ rows: [] }),
      };
      const property = "query";
      const receiver = target;

      const result = handler.get(target, property, receiver);
      expect(typeof result).toBe("function");
    });

    it("should handle different property types", () => {
      const handler = createProxyHandler(connectionIds, mockLogger);
      const target = {
        query: vi.fn().mockResolvedValue({ rows: [] }),
      };

      // Test with string property
      const stringResult = handler.get(target, "query", target);
      expect(typeof stringResult).toBe("function");

      // Test with symbol property
      const symbol = Symbol("query");
      const symbolResult = handler.get(target, symbol, target);
      expect(symbolResult).toBeUndefined();
    });

    it("should handle different receiver types", () => {
      const handler = createProxyHandler(connectionIds, mockLogger);
      const target = {
        query: vi.fn().mockResolvedValue({ rows: [] }),
      };
      const property = "query";

      // Test with different receivers
      const receiver1 = target;
      const receiver2 = { different: "object" };
      const receiver3 = null;

      const result1 = handler.get(target, property, receiver1);
      const result2 = handler.get(target, property, receiver2);
      const result3 = handler.get(target, property, receiver3);

      expect(typeof result1).toBe("function");
      expect(typeof result2).toBe("function");
      expect(typeof result3).toBe("function");
    });
  });

  describe("proxy handler behavior", () => {
    it("should return a function that can be called", async () => {
      const handler = createProxyHandler(connectionIds, mockLogger);
      const mockQuery = vi.fn().mockResolvedValue({ rows: [] });
      const target = { query: mockQuery };
      const property = "query";
      const receiver = target;

      const interceptedFunction = handler.get(target, property, receiver);
      expect(typeof interceptedFunction).toBe("function");

      // The intercepted function should be callable
      const result = await interceptedFunction("SELECT * FROM users");
      expect(mockQuery).toHaveBeenCalledWith("SELECT * FROM users");
      expect(result).toEqual({ rows: [] });
    });

    it("should preserve function context", async () => {
      const handler = createProxyHandler(connectionIds, mockLogger);
      const mockQuery = vi.fn().mockResolvedValue({ rows: [] });
      const target = {
        query: mockQuery,
        context: "test context",
      };
      const property = "query";
      const receiver = target;

      const interceptedFunction = handler.get(target, property, receiver);

      // Call with explicit context
      await interceptedFunction.call(target, "SELECT * FROM users");
      expect(mockQuery).toHaveBeenCalledWith("SELECT * FROM users");
    });

    it("should handle function with multiple arguments", async () => {
      const handler = createProxyHandler(connectionIds, mockLogger);
      const mockQuery = vi.fn().mockResolvedValue({ rows: [] });
      const target = { query: mockQuery };
      const property = "query";
      const receiver = target;

      const interceptedFunction = handler.get(target, property, receiver);

      await interceptedFunction("SELECT * FROM users WHERE id = ?", [1]);
      expect(mockQuery).toHaveBeenCalledWith(
        "SELECT * FROM users WHERE id = ?",
        [1],
      );
    });
  });

  describe("edge cases", () => {
    it("should handle target with non-function properties", () => {
      const target = {
        id: 123,
        name: "test-client",
        config: { host: "localhost" },
        query: vi.fn().mockResolvedValue("result"),
      };

      const proxy = createProxyHandler(target, mockLogger);

      expect(proxy.id).toBe(undefined);
      expect(proxy.name).toBe(undefined);
      expect(proxy.config).toBe(undefined);
    });

    it("should handle target with symbols as property names", () => {
      const symbol = Symbol("test");
      const target = {
        [symbol]: "symbol-value",
        query: vi.fn().mockResolvedValue("result"),
      };

      const proxy = createProxyHandler(target, mockLogger);

      expect(proxy[symbol]).toBe(undefined);
    });

    it("should handle target with getters and setters", () => {
      const target = {
        _value: 0,
        get value() {
          return this._value;
        },
        set value(val: number) {
          this._value = val;
        },
        query: vi.fn().mockResolvedValue("result"),
      };

      const proxy = createProxyHandler(target, mockLogger);

      expect(proxy.value).toBe(undefined);
    });

    it("should handle target with null/undefined properties", () => {
      const target = {
        nullProp: null,
        undefinedProp: undefined,
        query: vi.fn().mockResolvedValue("result"),
      };

      const proxy = createProxyHandler(target, mockLogger);

      expect(proxy.nullProp).toBe(undefined);
      expect(proxy.undefinedProp).toBe(undefined);
    });

    it("should handle target with array properties", () => {
      const target = {
        arrayProp: [1, 2, 3],
        query: vi.fn().mockResolvedValue("result"),
      };

      const proxy = createProxyHandler(target, mockLogger);

      expect(proxy.arrayProp).toBe(undefined);
    });

    it("should handle target with object properties", () => {
      const target = {
        objectProp: { key: "value" },
        query: vi.fn().mockResolvedValue("result"),
      };

      const proxy = createProxyHandler(target, mockLogger);

      expect(proxy.objectProp).toBe(undefined);
    });
  });

  describe("SQL detection edge cases", () => {
    it("should handle non-string first arguments", () => {
      const target = {
        // no query method
      };
      const proxy = createProxyHandler(target, mockLogger);
      expect(proxy.query).toBeUndefined();
    });

    it("should handle empty string as first argument", () => {
      const target = {
        // no query method
      };
      const proxy = createProxyHandler(target, mockLogger);
      expect(proxy.query).toBeUndefined();
    });

    it("should handle non-SQL strings", () => {
      const target = {
        // no query method
      };
      const proxy = createProxyHandler(target, mockLogger);
      expect(proxy.query).toBeUndefined();
    });

    it("should handle SQL with leading whitespace", () => {
      const target = {
        // no query method
      };
      const proxy = createProxyHandler(target, mockLogger);
      expect(proxy.query).toBeUndefined();
    });

    it("should handle SQL with leading comments", () => {
      const target = {
        // no query method
      };
      const proxy = createProxyHandler(target, mockLogger);
      expect(proxy.query).toBeUndefined();
    });

    it("should handle SQL with mixed case", () => {
      const target = {
        // no query method
      };
      const proxy = createProxyHandler(target, mockLogger);
      expect(proxy.query).toBeUndefined();
    });

    it("should handle non-query methods with SQL-like arguments", () => {
      const target = {
        // no execute method
      };
      const proxy = createProxyHandler(target, mockLogger);
      expect(proxy.execute).toBeUndefined();
    });
  });

  describe("method property edge cases", () => {
    it("should handle constructor property", () => {
      const target = {
        constructor: vi.fn().mockResolvedValue("result"),
        query: vi.fn().mockResolvedValue("result"),
      };

      const handler = createProxyHandler(new Map(), mockLogger);
      const proxy = new Proxy(target, handler);

      const promise = proxy.constructor("SELECT * FROM users", []);
      expect(promise).resolves.toBe("result");
    });

    it("should handle non-query methods with SQL-like arguments", () => {
      const target = {
        execute: vi.fn().mockResolvedValue("result"),
        query: vi.fn().mockResolvedValue("result"),
      };

      const handler = createProxyHandler(new Map(), mockLogger);
      const proxy = new Proxy(target, handler);

      const promise = proxy.execute("SELECT * FROM users", []);
      expect(promise).resolves.toBe("result");
    });

    it("should handle methods with non-string first arguments", () => {
      const target = {
        query: vi.fn().mockResolvedValue("result"),
      };

      const handler = createProxyHandler(new Map(), mockLogger);
      const proxy = new Proxy(target, handler);

      const promise = proxy.query(123, []);
      expect(promise).resolves.toBe("result");
    });

    it("should handle methods with empty string first arguments", () => {
      const target = {
        query: vi.fn().mockResolvedValue("result"),
      };

      const handler = createProxyHandler(new Map(), mockLogger);
      const proxy = new Proxy(target, handler);

      const promise = proxy.query("", []);
      expect(promise).resolves.toBe("result");
    });

    it("should handle methods with undefined first arguments", () => {
      const target = {
        query: vi.fn().mockResolvedValue("result"),
      };

      const handler = createProxyHandler(new Map(), mockLogger);
      const proxy = new Proxy(target, handler);

      const promise = proxy.query(undefined, []);
      expect(promise).resolves.toBe("result");
    });

    it("should handle methods with null first arguments", () => {
      const target = {
        query: vi.fn().mockResolvedValue("result"),
      };

      const handler = createProxyHandler(new Map(), mockLogger);
      const proxy = new Proxy(target, handler);

      const promise = proxy.query(null, []);
      expect(promise).resolves.toBe("result");
    });
  });

  describe("parameter handling", () => {
    it("should handle undefined parameters", () => {
      const target = {
        query: vi.fn().mockResolvedValue("result"),
      };

      const handler = createProxyHandler(new Map(), mockLogger);
      const proxy = new Proxy(target, handler);

      const promise = proxy.query("SELECT * FROM users", undefined);
      expect(promise).resolves.toBe("result");
    });

    it("should handle null parameters", () => {
      const target = {
        query: vi.fn().mockResolvedValue("result"),
      };

      const handler = createProxyHandler(new Map(), mockLogger);
      const proxy = new Proxy(target, handler);

      const promise = proxy.query("SELECT * FROM users", null);
      expect(promise).resolves.toBe("result");
    });

    it("should handle empty parameters array", () => {
      const target = {
        query: vi.fn().mockResolvedValue("result"),
      };

      const handler = createProxyHandler(new Map(), mockLogger);
      const proxy = new Proxy(target, handler);

      const promise = proxy.query("SELECT * FROM users", []);
      expect(promise).resolves.toBe("result");
    });

    it("should handle non-array parameters", () => {
      const target = {
        query: vi.fn().mockResolvedValue("result"),
      };

      const handler = createProxyHandler(new Map(), mockLogger);
      const proxy = new Proxy(target, handler);

      const promise = proxy.query("SELECT * FROM users", "not-an-array");
      expect(promise).resolves.toBe("result");
    });
  });

  describe("error handling", () => {
    it("should handle target that throws errors", () => {
      const target = {
        query: vi.fn().mockRejectedValue(new Error("Database error")),
      };

      const handler = createProxyHandler(new Map(), mockLogger);
      const proxy = new Proxy(target, handler);

      const promise = proxy.query("SELECT * FROM users", []);
      expect(promise).rejects.toThrow("Database error");
    });

    it("should handle target that throws non-Error exceptions", () => {
      const target = {
        query: vi.fn().mockRejectedValue("String error"),
      };

      const handler = createProxyHandler(new Map(), mockLogger);
      const proxy = new Proxy(target, handler);

      const promise = proxy.query("SELECT * FROM users", []);
      expect(promise).rejects.toBe("String error");
    });

    it("should handle target that throws null/undefined", () => {
      const target = {
        query: vi.fn().mockRejectedValue(null),
      };

      const handler = createProxyHandler(new Map(), mockLogger);
      const proxy = new Proxy(target, handler);

      const promise = proxy.query("SELECT * FROM users", []);
      expect(promise).rejects.toBeNull();
    });
  });
});
