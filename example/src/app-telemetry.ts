import { createLogger } from "./infrastructure/logger.js";
import { runOnce } from "./utils/run-once.js";
import { createTelemetryInstance } from "./utils/telemetry.js";

// Use runOnce to ensure telemetry is only initialized once across all bundle contexts
runOnce(
  "/tmp/telemetry-lock",
  () => createTelemetryInstance(createLogger("app-telemetry")).start(),
  createLogger("app-telemetry"),
);
