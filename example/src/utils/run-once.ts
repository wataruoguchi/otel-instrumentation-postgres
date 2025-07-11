import fs from "node:fs";
import type { Logger } from "otel-instrumentation-postgres";

// Use a file-based flag to ensure persistence across all bundle contexts
const FLAG_FILE = "/tmp/.telemetry-initialized";

export function runOnce(
  _lockDir: string, // Keep parameter for backward compatibility
  functionRunsOnce: () => void,
  logger?: Logger,
): void {
  // Check file-based flag first
  if (fs.existsSync(FLAG_FILE)) return;

  logger?.debug?.("[RUN-ONCE] No flag file found, running function");

  try {
    functionRunsOnce();
    // Create flag file to mark initialization
    fs.writeFileSync(FLAG_FILE, Date.now().toString());
    logger?.debug?.(
      `[RUN-ONCE] Function executed successfully and flag file created`,
    );
  } catch (error) {
    logger?.error?.(`Failed to run function: ${error}`);
    throw error;
  }
}
