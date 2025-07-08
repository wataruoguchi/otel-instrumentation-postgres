import { describe, expect, it } from "vitest";
import { analyzeQuery } from "./query-analysis.js";

describe("query-analysis", () => {
  describe("analyzeQuery", () => {
    describe("operation detection", () => {
      it("should detect SELECT operations", () => {
        const result = analyzeQuery("SELECT * FROM users");
        expect(result.operation).toBe("SELECT");
      });

      it("should detect INSERT operations", () => {
        const result = analyzeQuery("INSERT INTO users (name) VALUES (?)");
        expect(result.operation).toBe("INSERT");
      });

      it("should detect UPDATE operations", () => {
        const result = analyzeQuery("UPDATE users SET name = ? WHERE id = ?");
        expect(result.operation).toBe("UPDATE");
      });

      it("should detect DELETE operations", () => {
        const result = analyzeQuery("DELETE FROM users WHERE id = ?");
        expect(result.operation).toBe("DELETE");
      });

      it("should detect CREATE operations", () => {
        const result = analyzeQuery("CREATE TABLE users (id INT)");
        expect(result.operation).toBe("CREATE");
      });

      it("should detect ALTER operations", () => {
        const result = analyzeQuery(
          "ALTER TABLE users ADD COLUMN name VARCHAR(255)",
        );
        expect(result.operation).toBe("ALTER");
      });

      it("should detect DROP operations", () => {
        const result = analyzeQuery("DROP TABLE users");
        expect(result.operation).toBe("DROP");
      });

      it("should return UNKNOWN for unrecognized operations", () => {
        const result = analyzeQuery("EXECUTE PROCEDURE test()");
        expect(result.operation).toBe("UNKNOWN");
      });
    });

    describe("table name extraction", () => {
      it("should extract table name from SELECT", () => {
        const result = analyzeQuery("SELECT * FROM users WHERE id = ?");
        expect(result.table).toBe("users");
      });

      it("should extract table name from INSERT", () => {
        const result = analyzeQuery("INSERT INTO users (name) VALUES (?)");
        expect(result.table).toBe("users");
      });

      it("should extract table name from UPDATE", () => {
        const result = analyzeQuery("UPDATE users SET name = ? WHERE id = ?");
        expect(result.table).toBe("users");
      });

      it("should handle quoted table names", () => {
        const result = analyzeQuery('SELECT * FROM "users" WHERE id = ?');
        expect(result.table).toBe("users");
      });

      it("should handle backtick table names", () => {
        const result = analyzeQuery("SELECT * FROM `users` WHERE id = ?");
        expect(result.table).toBe("users");
      });

      it("should return undefined when no table found", () => {
        const result = analyzeQuery("SELECT 1");
        expect(result.table).toBeUndefined();
      });
    });

    describe("query characteristics", () => {
      it("should detect WHERE clauses", () => {
        const result = analyzeQuery("SELECT * FROM users WHERE id = ?");
        expect(result.hasWhere).toBe(true);
      });

      it("should detect JOIN clauses", () => {
        const result = analyzeQuery(
          "SELECT * FROM users JOIN posts ON users.id = posts.user_id",
        );
        expect(result.hasJoin).toBe(true);
      });

      it("should detect ORDER BY clauses", () => {
        const result = analyzeQuery("SELECT * FROM users ORDER BY name");
        expect(result.hasOrderBy).toBe(true);
      });

      it("should detect LIMIT clauses", () => {
        const result = analyzeQuery("SELECT * FROM users LIMIT 10");
        expect(result.hasLimit).toBe(true);
      });

      it("should handle multiple characteristics", () => {
        const result = analyzeQuery(
          "SELECT * FROM users JOIN posts ON users.id = posts.user_id WHERE posts.published = ? ORDER BY posts.created_at LIMIT 10",
        );
        expect(result.hasWhere).toBe(true);
        expect(result.hasJoin).toBe(true);
        expect(result.hasOrderBy).toBe(true);
        expect(result.hasLimit).toBe(true);
      });
    });

    describe("parameter counting", () => {
      it("should count single parameter", () => {
        const result = analyzeQuery("SELECT * FROM users WHERE id = ?");
        expect(result.parameterCount).toBe(1);
      });

      it("should count multiple parameters", () => {
        const result = analyzeQuery(
          "INSERT INTO users (name, email) VALUES (?, ?)",
        );
        expect(result.parameterCount).toBe(2);
      });

      it("should return 0 for no parameters", () => {
        const result = analyzeQuery("SELECT * FROM users");
        expect(result.parameterCount).toBe(0);
      });

      it("should handle complex parameter patterns", () => {
        const result = analyzeQuery(
          "SELECT * FROM users WHERE id IN (?, ?, ?) AND name = ?",
        );
        expect(result.parameterCount).toBe(4);
      });
    });

    describe("complexity estimation", () => {
      it("should classify simple queries as low complexity", () => {
        const result = analyzeQuery("SELECT * FROM users");
        expect(result.estimatedComplexity).toBe("low");
      });

      it("should classify queries with JOIN as medium complexity", () => {
        const result = analyzeQuery(
          "SELECT * FROM users JOIN posts ON users.id = posts.user_id",
        );
        expect(result.estimatedComplexity).toBe("medium");
      });

      it("should classify queries with ORDER BY as medium complexity", () => {
        const result = analyzeQuery("SELECT * FROM users ORDER BY name");
        expect(result.estimatedComplexity).toBe("medium");
      });

      it("should classify queries with many parameters as medium complexity", () => {
        const result = analyzeQuery(
          "INSERT INTO users (a, b, c, d, e, f) VALUES (?, ?, ?, ?, ?, ?)",
        );
        expect(result.estimatedComplexity).toBe("medium");
      });

      it("should classify complex queries as high complexity", () => {
        const result = analyzeQuery(
          "SELECT * FROM users JOIN posts ON users.id = posts.user_id WHERE posts.published = ? AND users.active = ? ORDER BY posts.created_at LIMIT 10",
        );
        expect(result.estimatedComplexity).toBe("high");
      });
    });

    describe("edge cases", () => {
      it("should handle case insensitive SQL", () => {
        const result = analyzeQuery("select * from users where id = ?");
        expect(result.operation).toBe("SELECT");
        expect(result.table).toBe("users");
        expect(result.hasWhere).toBe(true);
      });

      it("should handle extra whitespace", () => {
        const result = analyzeQuery(
          "  SELECT  *  FROM  users  WHERE  id  =  ?  ",
        );
        expect(result.operation).toBe("SELECT");
        expect(result.table).toBe("users");
        expect(result.hasWhere).toBe(true);
      });

      it("should handle empty string", () => {
        const result = analyzeQuery("");
        expect(result.operation).toBe("UNKNOWN");
        expect(result.table).toBeUndefined();
        expect(result.hasWhere).toBe(false);
        expect(result.hasJoin).toBe(false);
        expect(result.hasOrderBy).toBe(false);
        expect(result.hasLimit).toBe(false);
        expect(result.parameterCount).toBe(0);
        expect(result.estimatedComplexity).toBe("low");
      });

      it("should handle SQL with comments", () => {
        const result = analyzeQuery(
          "-- This is a comment\nSELECT * FROM users WHERE id = ?",
        );
        expect(result.operation).toBe("SELECT");
        expect(result.table).toBe("users");
        expect(result.hasWhere).toBe(true);
      });
    });
  });
});
