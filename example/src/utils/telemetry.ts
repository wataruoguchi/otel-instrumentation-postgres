import { PrometheusExporter } from "@opentelemetry/exporter-prometheus";
import { ZipkinExporter } from "@opentelemetry/exporter-zipkin";
import { HttpInstrumentation } from "@opentelemetry/instrumentation-http";
import { resourceFromAttributes } from "@opentelemetry/resources";
import {
  ConsoleMetricExporter,
  PeriodicExportingMetricReader,
} from "@opentelemetry/sdk-metrics";
import { NodeSDK } from "@opentelemetry/sdk-node";
import { ConsoleSpanExporter } from "@opentelemetry/sdk-trace-node";
import {
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
} from "@opentelemetry/semantic-conventions";
import {
  type Logger,
  PostgresInstrumentation,
} from "otel-instrumentation-postgres";

const serviceName = "my-example-app";

const resource = resourceFromAttributes({
  [ATTR_SERVICE_NAME]: serviceName,
  [ATTR_SERVICE_VERSION]: "1.0.0",
});

// Create PrometheusExporter as a MetricReader
const prometheusExporter = new PrometheusExporter({
  port: Number(process.env.PROMETHEUS_PORT),
  endpoint: "/metrics",
});

// Check if we're in debug mode (console export) or production mode (Zipkin export)
const isDebug =
  process.env.NODE_ENV === "development" &&
  process.env.DEBUG_TELEMETRY === "true";

export const createTelemetryInstance = (logger?: Logger) =>
  new NodeSDK({
    resource,
    traceExporter: isDebug
      ? new ConsoleSpanExporter()
      : (new ZipkinExporter({
          url: process.env.ZIPKIN_URL,
        }) as any), // Type assertion to bypass version compatibility issues
    metricReader: isDebug
      ? new PeriodicExportingMetricReader({
          exporter: new ConsoleMetricExporter(),
        })
      : prometheusExporter,
    instrumentations: [
      new PostgresInstrumentation({
        serviceName,
        ...(logger
          ? {
              logger,
            }
          : {}),
      }),
      new HttpInstrumentation(),
    ],
  });
