# Example App

This example demonstrates how to use the OpenTelemetry PostgreSQL instrumentation library with a real application. It shows both the event-driven and patch-based approaches to instrumenting PostgreSQL queries.

## What This Example Does

The example app is a simple Express.js application that:

1. **Sets up OpenTelemetry instrumentation** for both HTTP requests and PostgreSQL queries
2. **Creates an instrumented PostgreSQL client** using the `createOTELEmitter` function
3. **Provides REST endpoints** that trigger database queries
4. **Exports telemetry data** to the console for demonstration
5. **Shows real-time metrics and traces** as queries are executed

## Quick Start

### Prerequisites

- Docker and Docker Compose
- Node.js 18+ (if running locally)

### Running with Docker (Recommended)

1. **Start the application and database:**

```bash
cd example
docker-compose up --build
```

2. **Access the application:**

- Main app: http://localhost:3005
- Available endpoints:
  - `GET /products` - Fetches all products from the database
  - `GET /metrics` - Manually triggers metric export
  - `GET /health` - Health check endpoint

3. **View telemetry output:**

The application will output detailed OpenTelemetry spans, metrics, and logs to the console. You'll see:

- Database query spans with rich attributes
- HTTP request spans
- Query duration histograms
- Connection metrics
- Real-time logs showing the instrumentation process

### Running Locally

1. **Install dependencies:**

```bash
cd example
npm install
```

2. **Set up the database:**

```bash
docker-compose up db -d
```

3. **Start the application:**

```bash
npm run dev
```

4. **Access the application:**

- Main app: http://localhost:3005
- Available endpoints: same as above

## Log Example

Here's what you'll see in the console when the app runs:

```
app-1  | [21:51:17.646] DEBUG (app-telemetry/7): [RUN-ONCE] No flag file found, running function
app-1  | [21:51:17.649] INFO (app-telemetry/7): [POSTGRES-INSTRUMENTATION] Postgres instrumentation created
app-1  | [21:51:17.680] DEBUG (app-telemetry/7): [RUN-ONCE] Function executed successfully and flag file created
app-1  | Server is running on http://localhost:3005
app-1  | [21:51:17.647] DEBUG (app-telemetry/7): [RUN-ONCE] No flag file found, running function
app-1  | [21:51:17.651] INFO (app-telemetry/7): [POSTGRES-INSTRUMENTATION] Postgres instrumentation created
app-1  | [21:51:17.680] DEBUG (app-telemetry/7): [RUN-ONCE] Function executed successfully and flag file created
app-1  | [21:51:18.942] DEBUG (app-telemetry/7): [POSTGRES-INSTRUMENTATION] Connection event:
app-1  | [21:51:18.969] DEBUG (app-telemetry/7): [POSTGRES-INSTRUMENTATION] Processing query:
app-1  | [21:51:18.976] INFO (app-telemetry/7): [POSTGRES-INSTRUMENTATION] Metrics initialized successfully
app-1  | [21:51:18.981] DEBUG (app-telemetry/7): [POSTGRES-INSTRUMENTATION] Connection event:
app-1  | [21:51:18.415] INFO (database/7): [DB-QUERY-SENDER] Creating event-emitting postgres client
app-1  | [21:51:18.690] DEBUG (database/7): [DB-QUERY-SENDER] Proxy get called for prop:
app-1  | [21:51:18.690] DEBUG (database/7): [DB-QUERY-SENDER] Intercepting reserve method
app-1  | [21:51:18.691] DEBUG (database/7): [DB-QUERY-SENDER] Reserve method called
app-1  | [21:51:18.941] DEBUG (database/7): [DB-QUERY-SENDER] Emitting connection event
app-1  | [21:51:18.945] DEBUG (database/7): [DB-QUERY-SENDER] Creating event-emitting reserved connection
app-1  | [21:51:18.945] DEBUG (database/7): [DB-QUERY-SENDER] Reserved is a function, checking for properties
app-1  | [21:51:18.945] DEBUG (database/7): [DB-QUERY-SENDER] Function has release property, treating as object with methods
app-1  | [21:51:18.946] DEBUG (database/7): [DB-QUERY-SENDER] Reserved function property called:
app-1  | [21:51:18.946] DEBUG (database/7): [DB-QUERY-SENDER] SQL detected in property method call for prop:
app-1  | [21:51:18.957] DEBUG (database/7): [DB-QUERY-SENDER] Intercepted query:
app-1  | [21:51:18.968] DEBUG (database/7): [DB-QUERY-SENDER] Emitting success event:
app-1  | [21:51:18.981] DEBUG (database/7): [DB-QUERY-SENDER] Reserved function property called:
app-1  | [21:51:18.981] DEBUG (database/7): [DB-QUERY-SENDER] Release method called, emitting disconnect event
app-1  | {
app-1  |   resource: {
app-1  |     attributes: {
app-1  |       'host.name': 'c31c39e9a93e',
app-1  |       'host.arch': 'arm64',
app-1  |       'process.pid': 7,
app-1  |       'process.executable.name': 'node',
app-1  |       'process.executable.path': '/usr/local/bin/node',
app-1  |       'process.command_args': [ '/usr/local/bin/node', '/app/dist/index.js' ],
app-1  |       'process.runtime.version': '20.19.3',
app-1  |       'process.runtime.name': 'nodejs',
app-1  |       'process.runtime.description': 'Node.js',
app-1  |       'process.command': '/app/dist/index.js',
app-1  |       'process.owner': 'appuser',
app-1  |       'service.name': 'my-example-app',
app-1  |       'service.version': '1.0.0'
app-1  |     }
app-1  |   },
app-1  |   instrumentationScope: {
app-1  |     name: 'otel-instrumentation-postgres',
app-1  |     version: '1.0.0',
app-1  |     schemaUrl: undefined
app-1  |   },
app-1  |   traceId: 'f89f28a6ef7df58530a2b04e006353bf',
app-1  |   parentSpanContext: {
app-1  |     traceId: 'f89f28a6ef7df58530a2b04e006353bf',
app-1  |     spanId: '7ec4d4c5d502c8d5',
app-1  |     traceFlags: 1,
app-1  |     traceState: undefined
app-1  |   },
app-1  |   traceState: undefined,
app-1  |   name: 'SELECT',
app-1  |   id: 'a864bc6d99a9d3ae',
app-1  |   kind: 0,
app-1  |   timestamp: 1752270678972000,
app-1  |   duration: 7665.833,
app-1  |   attributes: {
app-1  |     'service.name': 'my-example-app',
app-1  |     'net.peer.name': 'db',
app-1  |     'net.peer.port': 5432,
app-1  |     'db.system.name': 'postgresql',
app-1  |     'db.namespace': 'postgres',
app-1  |     'db.query.text': 'select * from "products"',
app-1  |     'db.query.type': 'read',
app-1  |     'db.operation.name': 'SELECT',
app-1  |     'db.collection.name': 'products',
app-1  |     'db.parameter_count': 0,
app-1  |     'db.query.has_where': false,
app-1  |     'db.query.has_join': false,
app-1  |     'db.query.has_order_by': false,
app-1  |     'db.query.has_limit': false,
app-1  |     'db.query.complexity': 'low',
app-1  |     'db.duration_ms': 12,
app-1  |     'db.duration_seconds': 0.012,
app-1  |     'db.result.row_count': 300
app-1  |   },
app-1  |   status: { code: 1 },
app-1  |   events: [],
app-1  |   links: []
app-1  | }
app-1  | {
app-1  |   resource: {
app-1  |     attributes: {
app-1  |       'host.name': 'c31c39e9a93e',
app-1  |       'host.arch': 'arm64',
app-1  |       'process.pid': 7,
app-1  |       'process.executable.name': 'node',
app-1  |       'process.executable.path': '/usr/local/bin/node',
app-1  |       'process.command_args': [ '/usr/local/bin/node', '/app/dist/index.js' ],
app-1  |       'process.command': '/app/dist/index.js',
app-1  |       'process.owner': 'appuser',
app-1  |       'service.name': 'my-example-app',
app-1  |       'service.version': '1.0.0'
app-1  |     }
app-1  |   },
app-1  |   instrumentationScope: {
app-1  |     name: '@opentelemetry/instrumentation-http',
app-1  |     version: '0.202.0',
app-1  |     schemaUrl: undefined
app-1  |   },
app-1  |   traceId: 'f89f28a6ef7df58530a2b04e006353bf',
app-1  |   parentSpanContext: undefined,
app-1  |   traceState: undefined,
app-1  |   name: 'GET',
app-1  |   id: '7ec4d4c5d502c8d5',
app-1  |   kind: 1,
app-1  |   timestamp: 1752270678671000,
app-1  |   duration: 323650.709,
app-1  |   attributes: {
app-1  |     'http.url': 'http://localhost:3005/products',
app-1  |     'http.host': 'localhost:3005',
app-1  |     'net.host.name': 'localhost',
app-1  |     'http.method': 'GET',
app-1  |     'http.scheme': 'http',
app-1  |     'http.target': '/products',
app-1  |     'http.user_agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36',
app-1  |     'http.flavor': '1.1',
app-1  |     'net.transport': 'ip_tcp',
app-1  |     'net.host.ip': '::ffff:172.18.0.3',
app-1  |     'net.host.port': 3005,
app-1  |     'net.peer.ip': '::ffff:192.168.65.1',
app-1  |     'net.peer.port': 33712,
app-1  |     'http.status_code': 200,
app-1  |     'http.status_text': 'OK'
app-1  |   },
app-1  |   status: { code: 0 },
app-1  |   events: [],
app-1  |   links: []
app-1  | }
app-1  | {
app-1  |   descriptor: {
app-1  |     name: 'db.client.operation.duration',
app-1  |     type: 'HISTOGRAM',
app-1  |     description: 'Duration of PostgreSQL database queries in seconds',
app-1  |     unit: 's',
app-1  |     valueType: 1,
app-1  |     advice: {
app-1  |       explicitBucketBoundaries: [
app-1  |         0.001, 0.01, 0.1, 0.5,
app-1  |             1,    2,   5,  10,
app-1  |            30,   60, 120, 300,
app-1  |           600
app-1  |       ]
app-1  |     }
app-1  |   },
app-1  |   dataPointType: 0,
app-1  |   dataPoints: [
app-1  |     {
app-1  |       attributes: {
app-1  |         'db.system.name': 'postgresql',
app-1  |         'db.operation.name': 'SELECT',
app-1  |         'db.collection.name': 'products',
app-1  |         'db.query.complexity': 'low',
app-1  |         'db.query.type': 'read',
app-1  |         'service.name': 'my-example-app'
app-1  |       },
app-1  |       startTime: [ 1752270678, 977000000 ],
app-1  |       endTime: [ 1752270697, 685000000 ],
app-1  |       value: {
app-1  |         min: 0.012,
app-1  |         max: 0.012,
app-1  |         sum: 0.012,
app-1  |         buckets: {
app-1  |           boundaries: [
app-1  |             0.001, 0.01, 0.1, 0.5,
app-1  |                 1,    2,   5,  10,
app-1  |                30,   60, 120, 300,
app-1  |               600
app-1  |           ],
app-1  |           counts: [
app-1  |             0, 0, 1, 0, 0, 0,
app-1  |             0, 0, 0, 0, 0, 0,
app-1  |             0, 0
app-1  |           ]
app-1  |         },
app-1  |         count: 1
app-1  |       }
app-1  |     }
app-1  |   ]
app-1  | }
app-1  | {
app-1  |   descriptor: {
app-1  |     name: 'db.client.requests',
app-1  |     type: 'COUNTER',
app-1  |     description: 'Number of PostgreSQL database queries executed',
app-1  |     unit: '',
app-1  |     valueType: 0,
app-1  |     advice: {}
app-1  |   },
app-1  |   dataPointType: 3,
app-1  |   dataPoints: [
app-1  |     {
app-1  |       attributes: {
app-1  |         'db.system.name': 'postgresql',
app-1  |         'db.operation.name': 'SELECT',
app-1  |         'db.collection.name': 'products',
app-1  |         'db.query.complexity': 'low',
app-1  |         'db.query.type': 'read',
app-1  |         'service.name': 'my-example-app'
app-1  |       },
app-1  |       startTime: [ 1752270678, 979000000 ],
app-1  |       endTime: [ 1752270697, 685000000 ],
app-1  |       value: 1
app-1  |     }
app-1  |   ]
app-1  | }
app-1  | {
app-1  |   descriptor: {
app-1  |     name: 'db.client.connections',
app-1  |     type: 'COUNTER',
app-1  |     description: 'Number of PostgreSQL database connections established',
app-1  |     unit: '',
app-1  |     valueType: 0,
app-1  |     advice: {}
app-1  |   },
app-1  |   dataPointType: 3,
app-1  |   dataPoints: [
app-1  |     {
app-1  |       attributes: {
app-1  |         'db.system.name': 'postgresql',
app-1  |         'service.name': 'my-example-app'
app-1  |       },
app-1  |       startTime: [ 1752270678, 981000000 ],
app-1  |       endTime: [ 1752270697, 685000000 ],
app-1  |       value: 1
app-1  |     }
app-1  |   ]
app-1  | }
app-1  | {
app-1  |   descriptor: {
app-1  |     name: 'db.client.connections.duration',
app-1  |     type: 'HISTOGRAM',
app-1  |     description: 'Duration of PostgreSQL database connections in seconds',
app-1  |     unit: 's',
app-1  |     valueType: 1,
app-1  |     advice: {
app-1  |       explicitBucketBoundaries: [
app-1  |         0.001, 0.01, 0.1, 0.5,
app-1  |             1,    2,   5,  10,
app-1  |            30,   60, 120, 300,
app-1  |           600
app-1  |       ]
app-1  |     }
app-1  |   },
app-1  |   dataPointType: 0,
app-1  |   dataPoints: [
app-1  |     {
app-1  |       attributes: {
app-1  |         'db.system.name': 'postgresql',
app-1  |         'service.name': 'my-example-app'
app-1  |       },
app-1  |       startTime: [ 1752270678, 981000000 ],
app-1  |       endTime: [ 1752270697, 685000000 ],
app-1  |       value: {
app-1  |         min: 0.04,
app-1  |         max: 0.04,
app-1  |         sum: 0.04,
app-1  |         buckets: {
app-1  |           boundaries: [
app-1  |             0.001, 0.01, 0.1, 0.5,
app-1  |                 1,    2,   5,  10,
app-1  |                30,   60, 120, 300,
app-1  |               600
app-1  |           ],
app-1  |           counts: [
app-1  |             0, 0, 1, 0, 0, 0,
app-1  |             0, 0, 0, 0, 0, 0,
app-1  |             0, 0
app-1  |           ]
app-1  |         },
app-1  |         count: 1
app-1  |       }
app-1  |     }
app-1  |   ]
app-1  | }
app-1  | {
app-1  |   descriptor: {
app-1  |     name: 'http.server.duration',
app-1  |     type: 'HISTOGRAM',
app-1  |     description: 'Measures the duration of inbound HTTP requests.',
app-1  |     unit: 'ms',
app-1  |     valueType: 1,
app-1  |     advice: {}
app-1  |   },
app-1  |   dataPointType: 0,
app-1  |   dataPoints: [
app-1  |     {
app-1  |       attributes: {
app-1  |         'http.scheme': 'http',
app-1  |         'http.method': 'GET',
app-1  |         'net.host.name': 'localhost',
app-1  |         'http.flavor': '1.1',
app-1  |         'http.status_code': 200,
app-1  |         'net.host.port': 3005
app-1  |       },
app-1  |       startTime: [ 1752270678, 994000000 ],
app-1  |       endTime: [ 1752270697, 685000000 ],
app-1  |       value: {
app-1  |         min: 332.200084,
app-1  |         max: 332.200084,
app-1  |         sum: 332.200084,
app-1  |         buckets: {
app-1  |           boundaries: [
app-1  |                0,    5,    10,   25,
app-1  |               50,   75,   100,  250,
app-1  |              500,  750,  1000, 2500,
app-1  |             5000, 7500, 10000
app-1  |           ],
app-1  |           counts: [
app-1  |             0, 0, 0, 0, 0, 0,
app-1  |             0, 0, 1, 0, 0, 0,
app-1  |             0, 0, 0, 0
app-1  |           ]
app-1  |         },
app-1  |         count: 1
app-1  |       }
app-1  |     }
app-1  |   ]
app-1  | }