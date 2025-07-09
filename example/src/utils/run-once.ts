import type { Logger } from "otel-instrumentation-postgres";
import lockfile from "proper-lockfile";

export async function runOnce(
  lockFileName: string,
  functionRunsOnce: () => void,
  logger?: Logger,
): Promise<void> {
  let release: (() => Promise<void>) | null = null;

  try {
    // Try to acquire the lock
    release = await lockfile.lock(lockFileName, {
      retries: 0, // Don't retry, just fail if already locked
      stale: 10000, // 10 second stale lock timeout
    });

    // Initialize telemetry (pure function)
    functionRunsOnce();
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "ELOCKED"
    ) {
      return;
    }

    logger?.error?.(`Failed to run function: ${error}`);
    throw error;
  } finally {
    if (release) {
      try {
        await release();
      } catch (_e) {
        // Ignore errors when releasing lock
      }
    }
  }
}
