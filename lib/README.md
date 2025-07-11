# OpenTelemetry PostgreSQL Instrumentation

A [OpenTelemetry](https://opentelemetry.io/) instrumentation library for the [`Postgres.js`](https://github.com/porsager/postgres) that provides observability for PostgreSQL database operations.

## What This Library Measures

This instrumentation captures:

### 📊 **Database Query Metrics**

- **Query Duration**: Histogram of query execution times
- **Query Count**: Total number of queries executed
- **Error Count**: Number of failed queries
- **Connection Count**: Number of database connections established
- **Connection Duration**: How long connections remain active

### 🔍 **Query Analysis**

- **Operation Type**: SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, DROP
- **Table Names**: Extracted from SQL queries
- **Query Complexity**: Low/Medium/High based on query structure
- **Query Characteristics**: Presence of WHERE, JOIN, ORDER BY, LIMIT clauses
- **Parameter Count**: Number of query parameters used

### 📈 **Performance Insights**

- **Query Duration Distribution**: Histogram with configurable buckets
- **Slow Query Detection**: Built-in support for identifying performance issues
- **Connection Pool Monitoring**: Track connection lifecycle events

## Installation

```bash
npm install otel-instrumentation-postgres
```

## Quick Start

### 1. Set up OpenTelemetry SDK

```typescript
import { NodeSDK } from "@opentelemetry/sdk-node";
import { ConsoleSpanExporter } from "@opentelemetry/sdk-trace-node";
import { ConsoleMetricExporter, PeriodicExportingMetricReader } from "@opentelemetry/sdk-metrics";
import { PostgresInstrumentation } from "otel-instrumentation-postgres";

const sdk = new NodeSDK({
  traceExporter: new ConsoleSpanExporter(),
  metricReader: new PeriodicExportingMetricReader({
    exporter: new ConsoleMetricExporter(),
  }),
  instrumentations: [
    new PostgresInstrumentation({
      serviceName: "my-app",
      collectQueryParameters: true
    }),
  ],
});

sdk.start();
```

### 2. Wrap your postgres.js client

```typescript
import postgres from "postgres";
import { createOTELEmitter } from "otel-instrumentation-postgres";

// Create your postgres client
const sql = postgres(process.env.DATABASE_URL);

// Wrap it with telemetry
const instrumentedSql = createOTELEmitter(sql);

// Use the instrumented client - all queries are now tracked
const users = await instrumentedSql`SELECT * FROM users WHERE active = ${true}`;
```

## Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `serviceName` | `string` | - | Service name for telemetry attributes |
| `enableHistogram` | `boolean` | `true` | Enable query duration histogram metrics |
| `histogramBuckets` | `number[]` | `[0.001, 0.01, 0.1, 0.5, 1, 2, 5, 10, 30, 60, 120, 300, 600]` | Duration buckets in seconds |
| `collectQueryParameters` | `boolean` | `false` | Include query parameters in spans |
| `serverAddress` | `string` | `process.env.PGHOST` | Database server address |
| `serverPort` | `number` | `process.env.PGPORT` | Database server port |
| `databaseName` | `string` | `process.env.PGDATABASE` | Database name |
| `parameterSanitizer` | `Function` | Built-in sanitizer | Custom parameter sanitization |
| `beforeSpan` | `Function` | - | Hook called before span creation |
| `afterSpan` | `Function` | - | Hook called after span completion |
| `responseHook` | `Function` | - | Hook called with query result |

## Generated Telemetry Data

### Spans (Traces)

Each database query generates a span with rich attributes:

#### Standard OpenTelemetry Attributes

- `db.system.name`: `"postgresql"`
- `db.query.text`: Sanitized SQL query
- `db.operation.name`: SQL operation (SELECT, INSERT, etc.)
- `db.namespace`: Database name
- `db.collection.name`: Extracted table name
- `net.peer.name`: Database server address
- `net.peer.port`: Database server port
- `exception.type`: Error type for failed queries
- `service.name`: Service name (when configured)

#### Custom Attributes

- `db.parameter_count`: Number of query parameters
- `db.duration_ms`: Query duration in milliseconds
- `db.duration_seconds`: Query duration in seconds
- `db.query.has_where`: Whether query has WHERE clause
- `db.query.has_join`: Whether query has JOIN clauses
- `db.query.has_order_by`: Whether query has ORDER BY
- `db.query.has_limit`: Whether query has LIMIT
- `db.query.complexity`: Estimated complexity (low/medium/high)
- `db.query.type`: Query type (read/write/schema/unknown)
- `db.result.row_count`: Number of rows returned (for arrays)

#### Query Parameters (when enabled)

- `db.query.parameter.0`, `db.query.parameter.1`, etc.: Individual query parameters (sanitized)

### Metrics

#### Query Duration Histogram

- **Name**: `db.client.requests.duration` (from semantic conventions)
- **Unit**: Seconds
- **Description**: Distribution of query execution times
- **Attributes**: `db_system`, `db_operation`, `db_collection_name`, `db_query_complexity`, `db_query_type`, `service_name`

#### Query Counter

- **Name**: `db.client.requests`
- **Description**: Total number of database queries
- **Attributes**: `db_system`, `db_operation`, `db_collection_name`, `db_query_complexity`, `db_query_type`, `service_name`

#### Error Counter

- **Name**: `db.client.errors`
- **Description**: Number of database query errors
- **Attributes**: `db_system`, `db_operation`, `db_collection_name`, `db_error_type`, `service_name`

#### Connection Metrics

- **Name**: `db.client.connections`
- **Description**: Number of database connections established
- **Attributes**: `db_system`, `service_name`

- **Name**: `db.client.connections.duration`
- **Description**: Duration of database connections
- **Attributes**: `db_system`, `service_name`

## Advanced Usage

### Custom Hooks

```typescript
const instrumentation = new PostgresInstrumentation({
  serviceName: "user-service",
  collectQueryParameters: true,
  
  // Add custom attributes before span creation
  beforeSpan: (span, event) => {
    span.setAttribute("user.id", getCurrentUserId());
    span.setAttribute("request.id", getRequestId());
  },
  
  // Monitor slow queries
  afterSpan: (span, event) => {
    if (event.durationMs > 1000) {
      console.warn(`Slow query detected: ${event.sql} (${event.durationMs}ms)`);
    }
  },
  
  // Analyze query results
  responseHook: (span, result) => {
    if (Array.isArray(result)) {
      span.setAttribute("db.result.count", result.length);
      
      if (result.length === 0) {
        span.setAttribute("db.result.empty", true);
      }
    }
  },
});
```

### Custom Parameter Sanitization

```typescript
const instrumentation = new PostgresInstrumentation({
  parameterSanitizer: (param, index) => {
    // Redact sensitive data
    if (typeof param === "string") {
      if (param.match(/^\d{4}-\d{4}-\d{4}-\d{4}$/)) {
        return "****-****-****-" + param.slice(-4); // Credit card
      }
      if (param.includes("@")) {
        return "[EMAIL]"; // Email addresses
      }
    }
    
    // Truncate long values
    const str = String(param);
    return str.length > 50 ? str.substring(0, 50) + "..." : str;
  },
});
```

### Query Analysis Examples

The library automatically analyzes your SQL queries:

```typescript
// This query will generate:
// - operation: "SELECT"
// - table: "users"
// - has_where: true
// - has_order_by: true
// - has_limit: true
// - complexity: "medium"
// - type: "read"
const users = await instrumentedSql`
  SELECT * FROM users
  WHERE active = ${true}
  ORDER BY created_at DESC
  LIMIT 10
`;

// This query will generate:
// - operation: "INSERT"
// - table: "users"
// - has_where: false
// - complexity: "low"
// - type: "write"
await instrumentedSql`
  INSERT INTO users (name, email)
  VALUES (${name}, ${email})
`;
```
