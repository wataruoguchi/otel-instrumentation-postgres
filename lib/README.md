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

#### Custom Attributes

- `otel.instrumentation.postgres.query.duration_ms`: Query duration in milliseconds
- `otel.instrumentation.postgres.query.duration_seconds`: Query duration in seconds
- `otel.instrumentation.postgres.query.parameter_count`: Number of query parameters
- `otel.instrumentation.postgres.query.has_where`: Whether query has WHERE clause
- `otel.instrumentation.postgres.query.has_join`: Whether query has JOIN clause
- `otel.instrumentation.postgres.query.has_order_by`: Whether query has ORDER BY clause
- `otel.instrumentation.postgres.query.has_limit`: Whether query has LIMIT clause
- `otel.instrumentation.postgres.query.complexity`: Estimated query complexity (low/medium/high)
- `otel.instrumentation.postgres.query.type`: Query type (read/write)

### Metrics

- `db.client.operations.duration`: Histogram of query durations
- `otel.instrumentation.postgres.requests`: Counter of total queries
- `otel.instrumentation.postgres.errors`: Counter of failed queries
- `otel.instrumentation.postgres.connections`: Counter of database connections
- `otel.instrumentation.postgres.connection.duration`: Histogram of connection durations

## Advanced Usage

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

## Development

### Prerequisites

- Node.js 18+
- npm

### Setup

```bash
# Clone the repository
git clone https://github.com/wataruoguchi/otel-instrumentation-postgres.git
cd otel-instrumentation-postgres

# Install dependencies
cd lib && npm install
cd ../example && npm install

# Run tests
cd ../lib && npm test

# Build the package
npm run build
```

### Project Structure

```
otel-instrumentation-postgres/
├── lib/                    # Main library
│   ├── src/               # Source code
│   ├── package.json       # Library package.json
│   └── README.md          # Library documentation
├── example/               # Example application
│   ├── src/              # Example source code
│   ├── docker-compose.yml # Example infrastructure
│   └── package.json      # Example package.json
└── README.md             # This file
```

## CI/CD

This project uses GitHub Actions for continuous integration and deployment:

### Workflows

- **CI** (`ci.yml`): Runs tests and linting on every push/PR (excludes example directory)
- **Release** (`release.yml`): Complete release pipeline - tests, builds, publishes to npm, and creates GitHub releases on version tags

### Important Notes

- **Example directory changes do NOT trigger pipelines** - The example is for demonstration only
- **Only changes to the main library code** will trigger CI workflows
- **Version tags trigger the complete release process** regardless of what files changed

### Release Process

1. **Create a version tag**: `git tag v1.0.0`
2. **Push the tag**: `git push origin v1.0.0`
3. **Automated release**: The workflow will:
   - Run all tests
   - Build the package
   - Publish to npm
   - Create a GitHub release

### Required Secrets

- `NPM_TOKEN`: Your npm authentication token for publishing

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes
4. Run tests: `npm test`
5. Commit your changes: `git commit -m 'Add amazing feature'`
6. Push to the branch: `git push origin feature/amazing-feature`
7. Open a Pull Request

## License

This project is licensed under the Apache License 2.0 - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- [Postgres.js](https://github.com/porsager/postgres) - The excellent PostgreSQL client
- [OpenTelemetry](https://opentelemetry.io/) - The observability framework
- [Kysely](https://github.com/kysely-org/kysely) - Type-safe SQL query builder used in examples
