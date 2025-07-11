// Span and tracer names
export const PG_TRACER_NAME = "otel-instrumentation-postgres";
export const PG_TRACER_VERSION = "1.0.0";

// Database semantic attribute names (deprecated in OTEL's semantic conventions)
export const PG_SERVER_ADDRESS = "net.peer.name";
export const PG_SERVER_PORT = "net.peer.port";

/**
 * Custom attributes (not in semantic conventions)
 */
export const PG_DB_PARAMETER_COUNT = "db.parameter_count";
export const PG_DB_DURATION_MS = "db.duration_ms";
export const PG_DB_DURATION_SECONDS = "db.duration_seconds";
// Query analysis attributes
export const PG_DB_QUERY_HAS_WHERE = "db.query.has_where";
export const PG_DB_QUERY_HAS_JOIN = "db.query.has_join";
export const PG_DB_QUERY_HAS_ORDER_BY = "db.query.has_order_by";
export const PG_DB_QUERY_HAS_LIMIT = "db.query.has_limit";
export const PG_DB_QUERY_COMPLEXITY = "db.query.complexity";
export const PG_DB_QUERY_TYPE = "db.query.type";
export const PG_DB_QUERY_ESTIMATED_ROWS = "db.query.estimated_rows";
export const PG_DB_QUERY_PARAMETER_PREFIX = "db.query.parameter.";
// Result attributes
export const PG_DB_RESULT_ROW_COUNT = "db.result.row_count";
// Custom metric names
export const PG_METRIC_REQUESTS = "db.client.requests";
export const PG_METRIC_ERRORS = "db.client.errors";
export const PG_METRIC_CONNECTIONS = "db.client.connections";
export const PG_METRIC_CONNECTION_DURATION = "db.client.connections.duration";
export const PG_METRIC_ATTR_ERROR_TYPE = "db.error.type";

/**
 * Custom values
 */
// Query types
export enum PG_QUERY_TYPE {
  READ = "read",
  WRITE = "write",
  SCHEMA = "schema",
  UNKNOWN = "unknown",
}

// Complexity levels
export enum PG_COMPLEXITY {
  LOW = "low",
  MEDIUM = "medium",
  HIGH = "high",
}

// Default values
export const PG_DEFAULT_HISTOGRAM_BUCKETS = [
  0.001, 0.01, 0.1, 0.5, 1, 2, 5, 10, 30, 60, 120, 300, 600,
];

/**
 * Event Emitter's event names
 */
export const PG_EVENT_NAME = "db:query";
export const PG_CONNECTION_EVENT_NAME = "db:connection";
