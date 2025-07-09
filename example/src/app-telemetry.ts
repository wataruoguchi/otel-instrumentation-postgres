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
import { createLogger } from "./infrastructure/logger.js";
import { runOnce } from "./utils/run-once.js";

// Initialize telemetry with lock protection
runOnce(
  ".telemetry.lock",
  () => initializeTelemetry(createLogger("app-telemetry")),
  createLogger("run-once"),
);

// Telemetry initialization function
function initializeTelemetry(logger?: Logger): void {
  logger?.info?.("Initializing telemetry...");

  const serviceName = "my-example-app";

  const resource = resourceFromAttributes({
    [ATTR_SERVICE_NAME]: serviceName,
    [ATTR_SERVICE_VERSION]: "1.0.0",
  });

  const telemetryInstance = new NodeSDK({
    resource,
    traceExporter: new ConsoleSpanExporter(),
    metricReader: new PeriodicExportingMetricReader({
      exporter: new ConsoleMetricExporter(),
    }),
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

  telemetryInstance.start();
  logger?.info?.("Telemetry initialization completed");
}
