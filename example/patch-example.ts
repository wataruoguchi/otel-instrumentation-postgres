import { PostgresInstrumentation } from "../lib/src/instrumentation.js";

// Example of using the patch-based PostgreSQL instrumentation

// 1. Create and enable the instrumentation
// The patch mechanism will automatically handle all OpenTelemetry setup internally:
// - Creates spans using trace.getTracer()
// - Records metrics using metrics.getMeter()
// - No manual tracer/meter setup required
const instrumentation = new PostgresInstrumentation({
  serviceName: "my-postgres-app",
  enableHistogram: true,
  logger: {
    debug: (msg, ...args) => console.log("[DEBUG]", msg, ...args),
    info: (msg, ...args) => console.log("[INFO]", msg, ...args),
  },
});

// 2. Enable the instrumentation (this will patch the postgres module)
instrumentation.enable();

// 3. Now when you import and use the postgres module, it will be automatically instrumented
// The instrumentation will:
// - Create spans for each query using internal tracer
// - Record query duration in histograms using internal meter
// - Add query analysis attributes
// - Handle errors and exceptions

console.log("PostgreSQL instrumentation enabled!");
console.log(
  "Any postgres instances created after this point will be automatically instrumented.",
);

// Example usage (this would be in your actual application code):
/*
import postgres from 'postgres';

const sql = postgres({
  host: 'localhost',
  port: 5432,
  database: 'testdb',
  user: 'testuser',
  password: 'testpass',
});

// This query will be automatically instrumented
const result = await sql`SELECT * FROM users WHERE id = ${1}`;

// The instrumentation will:
// - Create a span named "postgres.query" using internal tracer
// - Add attributes like db.statement, db.operation, db.table, etc.
// - Record the query duration in histogram using internal meter
// - Handle any errors that occur

await sql.end();
*/
