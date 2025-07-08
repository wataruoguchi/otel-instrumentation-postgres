import { SpanStatusCode, trace } from "@opentelemetry/api";
import {
  InstrumentationBase,
  type InstrumentationConfig,
  type InstrumentationNodeModuleDefinition,
} from "@opentelemetry/instrumentation";
import { type DbQueryEvent, getDbEventEmitter } from "./db-events.js";
import { analyzeQuery } from "./query-analysis.js";

type Logger = {
  debug: (msg: string, ...args: unknown[]) => void;
  info: (msg: string, ...args: unknown[]) => void;
};

export interface PostgresInstrumentationConfig extends InstrumentationConfig {
  serviceName?: string;
  logger?: Logger;
}

export class PostgresInstrumentation extends InstrumentationBase {
  private customLogger: Logger | undefined;
  private serviceName: string | undefined;
  private listener: ((event: DbQueryEvent) => void) | undefined;

  constructor(config: PostgresInstrumentationConfig = {}) {
    super("postgres-instrumentation", "1.0.0", config);
    this.customLogger = config.logger;
    this.serviceName = config.serviceName;
  }

  protected override init(): InstrumentationNodeModuleDefinition[] {
    // This method is called when the instrumentation is enabled
    this.customLogger?.info(
      "[POSTGRES-INSTRUMENTATION] Initializing postgres instrumentation",
    );

    // Return an empty array since we're not instrumenting a specific module
    // Instead, we're using event-based instrumentation
    return [];
  }

  override enable(): void {
    this.customLogger?.debug("[POSTGRES-INSTRUMENTATION] Enable method called");
    super.enable();
    this.customLogger?.info(
      "[POSTGRES-INSTRUMENTATION] Enabling postgres instrumentation",
    );
    this.setupEventListeners();
    this.customLogger?.debug(
      "[POSTGRES-INSTRUMENTATION] Enable method completed",
    );
  }

  override disable(): void {
    super.disable();
    this.customLogger?.info(
      "[POSTGRES-INSTRUMENTATION] Disabling postgres instrumentation",
    );
    this.removeEventListeners();
  }

  private setupEventListeners(): void {
    if (this.listener) {
      // Remove existing listener if any
      this.removeEventListeners();
    }

    this.customLogger?.info(
      "[POSTGRES-INSTRUMENTATION] Setting up event listeners for db:query events",
    );

    this.listener = (event: DbQueryEvent) => {
      this.customLogger?.debug(
        "[POSTGRES-INSTRUMENTATION] Received event:",
        `${event.durationMs}ms`,
        "SQL:",
        `${event.sql.substring(0, 100)}...`,
      );

      const tracer = trace.getTracer("postgres-query");
      const queryAnalysis = analyzeQuery(event.sql);

      const span = tracer.startSpan("postgres.query", {
        attributes: {
          "db.system": "postgresql",
          "db.statement": event.sql,
          "db.operation": queryAnalysis.operation,
          "db.table": queryAnalysis.table || "",
          "db.parameter_count": event.params.length,
          "db.query_has_where": queryAnalysis.hasWhere,
          "db.query_has_join": queryAnalysis.hasJoin,
          "db.query_has_order_by": queryAnalysis.hasOrderBy,
          "db.query_has_limit": queryAnalysis.hasLimit,
          "db.query_complexity": queryAnalysis.estimatedComplexity,
          "db.duration_ms": event.durationMs,
          ...(this.serviceName && { "service.name": this.serviceName }),
        },
      });

      if (event.error) {
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: String(event.error),
        });
        span.recordException(String(event.error));
      } else {
        span.setStatus({ code: SpanStatusCode.OK });
      }

      span.end();

      this.customLogger?.debug(
        "[POSTGRES-INSTRUMENTATION] Created span for query:",
        `${event.sql.substring(0, 50)}...`,
      );
    };

    getDbEventEmitter(this.customLogger).on("db:query", this.listener);

    this.customLogger?.info(
      "[POSTGRES-INSTRUMENTATION] Event listener registered successfully",
    );
  }

  private removeEventListeners(): void {
    if (this.listener) {
      getDbEventEmitter(this.customLogger).off("db:query", this.listener);
      this.listener = undefined;
    }
  }

  // Legacy function for backward compatibility
  static registerDbQueryReceiver(
    options: { serviceName?: string } = {},
    logger?: Logger,
  ): PostgresInstrumentation {
    const instrumentation = new PostgresInstrumentation({
      serviceName: options.serviceName,
      logger,
    } as PostgresInstrumentationConfig);
    instrumentation.enable();
    return instrumentation;
  }
}

// Export the legacy function for backward compatibility
export const registerDbQueryReceiver =
  PostgresInstrumentation.registerDbQueryReceiver;
