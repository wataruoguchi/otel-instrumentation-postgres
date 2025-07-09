# OpenTelemetry PostgreSQL Instrumentation

A production-grade OpenTelemetry instrumentation library for the `postgres.js` module, designed with functional programming principles and event-driven architecture.

## Features

- **Event-Driven Architecture**: Uses emitter pattern instead of module patching for better testability
- **Comprehensive Telemetry**: Spans, metrics, and rich attributes for PostgreSQL operations
- **Production Ready**: Configurable hooks, parameter sanitization, and error handling
- **Zero Dependencies**: No external dependencies beyond OpenTelemetry core
- **TypeScript Support**: Full TypeScript support with comprehensive type definitions
- **Testable Design**: Functional programming approach with minimal mocking requirements
- **Official Semantic Conventions**: Follows OpenTelemetry semantic conventions using standard attribute names

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

const telemetry = new NodeSDK({
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

telemetry.start();
```

### 2. Wrap your postgres.js client

```typescript
import postgres from "postgres";
import { createOTELEmitter } from "otel-instrumentation-postgres";

// Create your postgres client
const sql = postgres(process.env.DATABASE_URL);

// Wrap it with telemetry
const instrumentedSql = createOTELEmitter(sql);

// Use the instrumented client
const users = await instrumentedSql`SELECT * FROM users WHERE active = ${true}`;
```

## Configuration

### PostgresInstrumentation Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `serviceName` | `string` | - | Service name for telemetry attributes |
| `logger` | `Logger` | - | Custom logger for debugging |
| `enableHistogram` | `boolean` | `true` | Enable query duration histogram metrics |
| `histogramBuckets` | `number[]` | `[0.001, 0.01, 0.1, 0.5, 1, 2, 5, 10, 30, 60, 120, 300, 600]` | Histogram bucket boundaries in seconds |
| `collectQueryParameters` | `boolean` | `false` | Include query parameters in spans |
| `serverAddress` | `string` | `process.env.PGHOST \|\| "localhost"` | Database server address |
| `serverPort` | `number` | `Number(process.env.PGPORT) \|\| 5432` | Database server port |
| `parameterSanitizer` | `Function` | Built-in sanitizer | Custom parameter sanitization function |
| `beforeSpan` | `Function` | - | Hook called before span creation |
| `afterSpan` | `Function` | - | Hook called after span completion |
| `responseHook` | `Function` | - | Hook called with query result |

### Advanced Configuration Example

```typescript
import { PostgresInstrumentation } from "otel-instrumentation-postgres";

const instrumentation = new PostgresInstrumentation({
  serviceName: "user-service",
  enableHistogram: true,
  histogramBuckets: [0.001, 0.01, 0.1, 0.5, 1, 2, 5],
  collectQueryParameters: true,
  serverAddress: "my-db.example.com",
  serverPort: 5432,
  
  // Custom parameter sanitizer
  parameterSanitizer: (param, index) => {
    if (typeof param === "string" && param.includes("password")) {
      return "[REDACTED]";
    }
    return String(param).substring(0, 50);
  },
  
  // Before span hook
  beforeSpan: (span, event) => {
    span.setAttribute("custom.user_id", getCurrentUserId());
    span.setAttribute("custom.query_source", "user_api");
  },
  
  // After span hook
  afterSpan: (span, event) => {
    if (event.durationMs > 1000) {
      console.warn(`Slow query detected: ${event.sql}`);
    }
  },
  
  // Response hook
  responseHook: (span, result) => {
    if (Array.isArray(result)) {
      span.setAttribute("db.result.size", result.length);
    }
  },
});
```

## Generated Telemetry

### Spans

Each database query generates a span with the following attributes:

#### Standard OpenTelemetry Attributes
The following attributes follow the [OpenTelemetry Semantic Conventions](https://opentelemetry.io/docs/specs/semconv/):

- `db.system`: `"postgresql"` (standard semantic convention)
- `db.statement`: Sanitized SQL query (standard semantic convention)
- `db.operation`: SQL operation (SELECT, INSERT, etc.) (standard semantic convention)
- `db.name`: `"postgres"` (standard semantic convention)
- `db.sql.table`: Extracted table name (standard semantic convention)
- `network.peer.address`: Database server address (standard semantic convention)
- `network.peer.port`: Database server port (standard semantic convention)
- `exception.type`: Error type for failed queries (standard semantic convention)

#### Custom Attributes
- `db.parameter_count`: Number of query parameters
- `service.name`: Service name (when configured)

#### Query Analysis Attributes
- `db.query.has_where`: Whether query has WHERE clause
- `db.query.has_join`: Whether query has JOIN clauses
- `db.query.has_order_by`: Whether query has ORDER BY
- `db.query.has_limit`: Whether query has LIMIT
- `db.query.complexity`: Estimated complexity (low/medium/high)
- `db.query.type`: Query type (read/write/schema/unknown)
- `db.query.estimated_rows`: Estimated row count

#### Performance Attributes
- `db.duration_ms`: Query duration in milliseconds
- `db.duration_seconds`: Query duration in seconds

#### Result Attributes
- `db.result.type`: Type of result (array, object, etc.)
- `db.result.row_count`: Number of rows returned (for arrays)

### Metrics

#### Query Duration Histogram
- **Name**: `db.client.requests.duration`
- **Unit**: Seconds
- **Description**: Duration of database client requests
- **Attributes**: `db_system`, `db_operation`, `db_table`, `db_query_complexity`, `db_query_type`, `service_name`

#### Query Counter
- **Name**: `db.client.requests`
- **Description**: Number of database client requests
- **Attributes**: `db_system`, `db_operation`, `db_table`, `db_query_complexity`, `db_query_type`, `service_name`

#### Error Counter
- **Name**: `db.client.errors`
- **Description**: Number of database client errors
- **Attributes**: `db_system`, `db_operation`, `db_table`, `error_type`, `service_name`

## Hooks System

### BeforeSpan Hook

Called before span creation, allowing you to add custom attributes:

```typescript
beforeSpan: (span, event) => {
  span.setAttribute("user.id", getCurrentUserId());
  span.setAttribute("request.id", getRequestId());
  span.setAttribute("custom.business_context", "user_registration");
}
```

### AfterSpan Hook

Called after span completion, useful for logging or alerting:

```typescript
afterSpan: (span, event) => {
  if (event.durationMs > 5000) {
    alertSlowQuery(event.sql, event.durationMs);
  }
  
  if (event.error) {
    logDatabaseError(event.error, event.sql);
  }
}
```

### ResponseHook

Called with the query result, useful for result analysis:

```typescript
responseHook: (span, result) => {
  if (Array.isArray(result)) {
    span.setAttribute("db.result.rows", result.length);
    
    if (result.length === 0) {
      span.setAttribute("db.result.empty", true);
    }
  }
  
  if (result && typeof result === "object" && "affectedRows" in result) {
    span.setAttribute("db.result.affected_rows", result.affectedRows);
  }
}
```

## Query Analysis

The library automatically analyzes SQL queries to extract:

- **Operation Type**: SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, DROP
- **Table Name**: Extracted from FROM, INTO, or UPDATE clauses
- **Query Characteristics**: WHERE, JOIN, ORDER BY, LIMIT presence
- **Complexity Estimation**: Based on query structure
- **Parameter Count**: Number of placeholders

## Parameter Sanitization

### Default Sanitizer

The default sanitizer:
- Truncates strings longer than 100 characters
- Redacts parameters containing "password", "token", or "secret"
- Converts all parameters to strings

### Custom Sanitizer

```typescript
parameterSanitizer: (param, index) => {
  // Redact sensitive data
  if (typeof param === "string") {
    if (param.match(/^\d{4}-\d{4}-\d{4}-\d{4}$/)) {
      return "****-****-****-" + param.slice(-4);
    }
    if (param.includes("@")) {
      return "[EMAIL]";
    }
  }
  
  // Truncate long values
  const str = String(param);
  return str.length > 50 ? str.substring(0, 50) + "..." : str;
}
```

## Error Handling

The library automatically:
- Sets span status to ERROR for failed queries
- Records exceptions with error details
- Adds error type attributes
- Increments error counters
- Preserves original error for re-throwing

## Testing

The event-driven architecture makes testing straightforward:

```typescript
import { createOTELEmitter } from "otel-instrumentation-postgres";
import { getDbEventEmitter } from "otel-instrumentation-postgres";

// Test setup
const mockSql = jest.fn();
const instrumentedSql = createOTELEmitter(mockSql);

// Listen for events
const events: DbQueryEvent[] = [];
getDbEventEmitter().on("db:query", (event) => {
  events.push(event);
});

// Test query
await instrumentedSql`SELECT * FROM users`;

// Assertions
expect(events).toHaveLength(1);
expect(events[0].sql).toBe("SELECT * FROM users");
expect(events[0].durationMs).toBeGreaterThan(0);
```

## Comparison with Official Instrumentation

This library provides several advantages over the official OpenTelemetry PostgreSQL instrumentation:

| Feature | This Library | Official Instrumentation |
|---------|-------------|-------------------------|
| **Architecture** | Event-driven | Module patching |
| **Testability** | High (no mocking needed) | Low (requires mocking) |
| **Customization** | Extensive hooks system | Limited configuration |
| **Parameter Control** | Configurable sanitization | Basic redaction |
| **Query Analysis** | Built-in analysis | Basic operation detection |
| **Error Handling** | Comprehensive | Standard |
| **Metrics** | Histograms + counters | Basic metrics |

## Examples

### Basic Usage

```typescript
// app-telemetry.ts
import { NodeSDK } from "@opentelemetry/sdk-node";
import { PostgresInstrumentation } from "otel-instrumentation-postgres";

const telemetry = new NodeSDK({
  instrumentations: [
    new PostgresInstrumentation({ serviceName: "my-app" }),
  ],
});

telemetry.start();
```

```typescript
// database.ts
import postgres from "postgres";
import { createOTELEmitter } from "otel-instrumentation-postgres";

const sql = createOTELEmitter(postgres(process.env.DATABASE_URL));

export { sql };
```

### Advanced Usage with Hooks

```typescript
const instrumentation = new PostgresInstrumentation({
  serviceName: "ecommerce-api",
  collectQueryParameters: true,
  
  beforeSpan: (span, event) => {
    span.setAttribute("api.endpoint", getCurrentEndpoint());
    span.setAttribute("user.session_id", getSessionId());
  },
  
  afterSpan: (span, event) => {
    if (event.durationMs > 1000) {
      notifySlowQuery({
        sql: event.sql,
        duration: event.durationMs,
        user: getCurrentUser(),
      });
    }
  },
  
  responseHook: (span, result) => {
    if (Array.isArray(result)) {
      span.setAttribute("db.result.count", result.length);
      
      // Track large result sets
      if (result.length > 1000) {
        span.setAttribute("db.result.large", true);
      }
    }
  },
});
```

## License

MIT

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## Support

For issues and questions, please open an issue on GitHub. 