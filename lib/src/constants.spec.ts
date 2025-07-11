import { describe, expect, it } from "vitest";
import {
  PG_COMPLEXITY,
  PG_CONNECTION_EVENT_NAME,
  PG_DB_DURATION_MS,
  PG_DB_DURATION_SECONDS,
  PG_DB_PARAMETER_COUNT,
  PG_DB_QUERY_COMPLEXITY,
  PG_DB_QUERY_ESTIMATED_ROWS,
  PG_DB_QUERY_HAS_JOIN,
  PG_DB_QUERY_HAS_LIMIT,
  PG_DB_QUERY_HAS_ORDER_BY,
  PG_DB_QUERY_HAS_WHERE,
  PG_DB_QUERY_PARAMETER_PREFIX,
  PG_DB_QUERY_TYPE,
  PG_DB_RESULT_ROW_COUNT,
  PG_DEFAULT_HISTOGRAM_BUCKETS,
  PG_EVENT_NAME,
  PG_METRIC_ATTR_ERROR_TYPE,
  PG_METRIC_CONNECTION_DURATION,
  PG_METRIC_CONNECTIONS,
  PG_METRIC_ERRORS,
  PG_METRIC_REQUESTS,
  PG_QUERY_TYPE,
  PG_SERVER_ADDRESS,
  PG_SERVER_PORT,
  PG_TRACER_NAME,
  PG_TRACER_VERSION,
} from "./constants.js";

describe("constants", () => {
  describe("tracer constants", () => {
    it("should export tracer name", () => {
      expect(PG_TRACER_NAME).toBe("otel-instrumentation-postgres");
    });

    it("should export tracer version", () => {
      expect(PG_TRACER_VERSION).toBe("1.0.0");
    });
  });

  describe("server constants", () => {
    it("should export server address constant", () => {
      expect(PG_SERVER_ADDRESS).toBe("net.peer.name");
    });

    it("should export server port constant", () => {
      expect(PG_SERVER_PORT).toBe("net.peer.port");
    });
  });

  describe("database attribute constants", () => {
    it("should export parameter count constant", () => {
      expect(PG_DB_PARAMETER_COUNT).toBe("db.parameter_count");
    });

    it("should export duration constants", () => {
      expect(PG_DB_DURATION_MS).toBe("db.duration_ms");
      expect(PG_DB_DURATION_SECONDS).toBe("db.duration_seconds");
    });

    it("should export query analysis constants", () => {
      expect(PG_DB_QUERY_HAS_WHERE).toBe("db.query.has_where");
      expect(PG_DB_QUERY_HAS_JOIN).toBe("db.query.has_join");
      expect(PG_DB_QUERY_HAS_ORDER_BY).toBe("db.query.has_order_by");
      expect(PG_DB_QUERY_HAS_LIMIT).toBe("db.query.has_limit");
      expect(PG_DB_QUERY_COMPLEXITY).toBe("db.query.complexity");
      expect(PG_DB_QUERY_TYPE).toBe("db.query.type");
      expect(PG_DB_QUERY_ESTIMATED_ROWS).toBe("db.query.estimated_rows");
      expect(PG_DB_QUERY_PARAMETER_PREFIX).toBe("db.query.parameter.");
    });

    it("should export result constants", () => {
      expect(PG_DB_RESULT_ROW_COUNT).toBe("db.result.row_count");
    });
  });

  describe("metric constants", () => {
    it("should export metric names", () => {
      expect(PG_METRIC_REQUESTS).toBe("db.client.requests");
      expect(PG_METRIC_ERRORS).toBe("db.client.errors");
      expect(PG_METRIC_CONNECTIONS).toBe("db.client.connections");
      expect(PG_METRIC_CONNECTION_DURATION).toBe(
        "db.client.connections.duration",
      );
    });

    it("should export metric attribute constants", () => {
      expect(PG_METRIC_ATTR_ERROR_TYPE).toBe("db.error.type");
    });
  });

  describe("query type enum", () => {
    it("should have correct query type values", () => {
      expect(PG_QUERY_TYPE.READ).toBe("read");
      expect(PG_QUERY_TYPE.WRITE).toBe("write");
      expect(PG_QUERY_TYPE.SCHEMA).toBe("schema");
      expect(PG_QUERY_TYPE.UNKNOWN).toBe("unknown");
    });

    it("should have all expected query types", () => {
      const expectedTypes = ["read", "write", "schema", "unknown"];
      const actualTypes = Object.values(PG_QUERY_TYPE);
      expect(actualTypes).toEqual(expect.arrayContaining(expectedTypes));
    });
  });

  describe("complexity enum", () => {
    it("should have correct complexity values", () => {
      expect(PG_COMPLEXITY.LOW).toBe("low");
      expect(PG_COMPLEXITY.MEDIUM).toBe("medium");
      expect(PG_COMPLEXITY.HIGH).toBe("high");
    });

    it("should have all expected complexity levels", () => {
      const expectedLevels = ["low", "medium", "high"];
      const actualLevels = Object.values(PG_COMPLEXITY);
      expect(actualLevels).toEqual(expect.arrayContaining(expectedLevels));
    });
  });

  describe("default histogram buckets", () => {
    it("should export default histogram buckets", () => {
      expect(PG_DEFAULT_HISTOGRAM_BUCKETS).toBeInstanceOf(Array);
      expect(PG_DEFAULT_HISTOGRAM_BUCKETS.length).toBeGreaterThan(0);
    });

    it("should have ascending bucket values", () => {
      const buckets = [...PG_DEFAULT_HISTOGRAM_BUCKETS];
      for (let i = 1; i < buckets.length; i++) {
        expect(buckets[i]).toBeGreaterThan(buckets[i - 1]);
      }
    });

    it("should have reasonable bucket values", () => {
      expect(PG_DEFAULT_HISTOGRAM_BUCKETS[0]).toBe(0.001); // 1ms
      expect(PG_DEFAULT_HISTOGRAM_BUCKETS).toContain(1); // 1s
      expect(PG_DEFAULT_HISTOGRAM_BUCKETS).toContain(60); // 1min
    });
  });

  describe("event names", () => {
    it("should export event names", () => {
      expect(PG_EVENT_NAME).toBe("db:query");
      expect(PG_CONNECTION_EVENT_NAME).toBe("db:connection");
    });

    it("should have consistent event naming", () => {
      expect(PG_EVENT_NAME).toMatch(/^db:/);
      expect(PG_CONNECTION_EVENT_NAME).toMatch(/^db:/);
    });
  });
});
