// Span and tracer names
export const PG_SPAN_NAME = "db.query";
export const PG_TRACER_NAME = "postgres-query";
export const PG_TRACER_VERSION = "1.0.0";

// Event names
export const PG_EVENT_NAME = "db:query";
export const PG_CONNECTION_EVENT_NAME = "db:connection";

// Database semantic attribute names (OpenTelemetry conventions)
// Using string literals for semantic conventions to avoid external dependencies
export const PG_DB_SYSTEM = "db.system";
export const PG_DB_STATEMENT = "db.statement";
export const PG_DB_OPERATION = "db.operation";
export const PG_DB_NAME = "db.name";
export const PG_DB_SQL_TABLE = "db.sql.table";
export const PG_ERROR_TYPE = "exception.type";
export const PG_SERVER_ADDRESS = "network.peer.address";
export const PG_SERVER_PORT = "network.peer.port";

// Custom attributes (not in semantic conventions)
export const PG_SERVICE_NAME = "service.name";
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
export const PG_DB_RESULT_TYPE = "db.result.type";
export const PG_DB_RESULT_ROW_COUNT = "db.result.row_count";

// Database name value
export const PG_DB_NAME_POSTGRES = "postgres"; // TODO: Isn't this dynamic?

// Metric names
export const PG_METRIC_DURATION = "db.client.requests.duration";
export const PG_METRIC_REQUESTS = "db.client.requests";
export const PG_METRIC_ERRORS = "db.client.errors";
export const PG_METRIC_CONNECTIONS = "db.client.connections";
export const PG_METRIC_CONNECTION_DURATION = "db.client.connections.duration";

// Metric attribute names
export const PG_METRIC_ATTR_DB_SYSTEM = "db_system";
export const PG_METRIC_ATTR_DB_OPERATION = "db_operation";
export const PG_METRIC_ATTR_DB_TABLE = "db_table";
export const PG_METRIC_ATTR_DB_QUERY_COMPLEXITY = "db_query_complexity";
export const PG_METRIC_ATTR_DB_QUERY_TYPE = "db_query_type";
export const PG_METRIC_ATTR_SERVICE_NAME = "service_name";
export const PG_METRIC_ATTR_ERROR_TYPE = "error_type";

// Query types
export const PG_QUERY_TYPE_READ = "read";
export const PG_QUERY_TYPE_WRITE = "write";
export const PG_QUERY_TYPE_SCHEMA = "schema";
export const PG_QUERY_TYPE_UNKNOWN = "unknown";

// Complexity levels
export const PG_COMPLEXITY_LOW = "low";
export const PG_COMPLEXITY_MEDIUM = "medium";
export const PG_COMPLEXITY_HIGH = "high";

// Default values
export const PG_DEFAULT_SERVER_ADDRESS = "localhost";
export const PG_DEFAULT_SERVER_PORT = 5432;
export const PG_DEFAULT_HISTOGRAM_BUCKETS = [
  0.001, 0.01, 0.1, 0.5, 1, 2, 5, 10, 30, 60, 120, 300, 600,
];
