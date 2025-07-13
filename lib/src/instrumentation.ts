/** biome-ignore-all assist/source/organizeImports: TODO: My editor doesn't support this. */
import {
  context,
  type Counter,
  type Histogram,
  type Span,
  SpanStatusCode,
  trace,
  ValueType,
} from "@opentelemetry/api";
import {
  InstrumentationBase,
  type InstrumentationConfig,
  type InstrumentationNodeModuleDefinition,
} from "@opentelemetry/instrumentation";
import {
  ATTR_DB_COLLECTION_NAME,
  ATTR_DB_NAMESPACE,
  ATTR_DB_OPERATION_NAME,
  ATTR_DB_QUERY_TEXT,
  ATTR_DB_SYSTEM_NAME,
  ATTR_EXCEPTION_TYPE,
  ATTR_SERVICE_NAME,
  DB_SYSTEM_NAME_VALUE_POSTGRESQL,
  METRIC_DB_CLIENT_OPERATION_DURATION,
} from "@opentelemetry/semantic-conventions";
import {
  PG_CONNECTION_EVENT_NAME,
  PG_DB_DURATION_MS,
  PG_DB_DURATION_SECONDS,
  PG_DB_PARAMETER_COUNT,
  PG_DB_QUERY_COMPLEXITY,
  PG_DB_QUERY_HAS_JOIN,
  PG_DB_QUERY_HAS_LIMIT,
  PG_DB_QUERY_HAS_ORDER_BY,
  PG_DB_QUERY_HAS_WHERE,
  PG_DB_QUERY_PARAMETER_PREFIX,
  PG_DB_QUERY_TYPE,
  PG_DB_RESULT_ROW_COUNT,
  PG_DEFAULT_HISTOGRAM_BUCKETS,
  PG_EVENT_NAME,
  PG_METRIC_ATTR_ERROR_TYPE,
  PG_METRIC_CONNECTION_DURATION,
  PG_METRIC_CONNECTIONS,
  PG_METRIC_ERRORS,
  PG_METRIC_REQUESTS,
  PG_QUERY_TYPE,
  PG_SERVER_ADDRESS,
  PG_SERVER_PORT,
  PG_TRACER_NAME,
  PG_TRACER_VERSION,
} from "./constants.js";
import { type DbQueryEvent, getDbEventEmitter } from "./db-events.js";
import type { Logger } from "./logger.js";
import { analyzeQuery } from "./query-analysis.js";

const LOG_PREFIX = "[POSTGRES-INSTRUMENTATION]";

type ParameterSanitizer = (param: unknown) => string;
type BeforeSpanHook = (span: Span, event: DbQueryEvent) => void;
type AfterSpanHook = (span: Span, event: DbQueryEvent) => void;
type ResponseHook = (span: Span, result: unknown) => void;

export interface PostgresInstrumentationConfig extends InstrumentationConfig {
  serviceName?: string;
  logger?: Logger;
  enableHistogram?: boolean;
  histogramBuckets?: number[];
  collectQueryParameters?: boolean;
  serverAddress?: string;
  serverPort?: number;
  databaseName?: string;
  parameterSanitizer?: ParameterSanitizer;
  beforeSpan?: BeforeSpanHook;
  afterSpan?: AfterSpanHook;
  responseHook?: ResponseHook;
}

export class PostgresInstrumentation extends InstrumentationBase {
  private customLogger: Logger | undefined;
  private serviceName: string | undefined;
  private listener: ((event: DbQueryEvent) => void) | undefined;
  private enableHistogram: boolean;
  private histogramBuckets: number[];
  private collectQueryParameters: boolean;
  private serverAddress: string | undefined;
  private serverPort: number | undefined;
  private databaseName: string | undefined;
  private parameterSanitizer: ParameterSanitizer;
  private beforeSpan?: BeforeSpanHook;
  private afterSpan?: AfterSpanHook;
  private responseHook?: ResponseHook;
  private queryDurationHistogram: Histogram | undefined;
  private queryCounter: Counter | undefined;
  private errorCounter: Counter | undefined;
  private connectionCounter: Counter | undefined;
  private connectionDurationHistogram: Histogram | undefined;
  private connectionStartTimes: Map<string, number> = new Map();

  constructor(config: PostgresInstrumentationConfig = {}) {
    super("postgres-instrumentation", "1.0.0", config);
    this.customLogger = config.logger;
    this.serviceName = config.serviceName;
    this.enableHistogram = config.enableHistogram ?? true;
    this.histogramBuckets =
      config.histogramBuckets ?? PG_DEFAULT_HISTOGRAM_BUCKETS;
    this.collectQueryParameters = config.collectQueryParameters ?? false;
    this.serverAddress =
      config.serverAddress ?? process.env.PGHOST ?? undefined;
    this.serverPort =
      config.serverPort ??
      (process.env.PGPORT ? Number(process.env.PGPORT) : undefined);
    this.databaseName =
      config.databaseName ?? process.env.PGDATABASE ?? undefined;
    this.parameterSanitizer =
      config.parameterSanitizer ?? this.defaultParameterSanitizer;
    this.beforeSpan = config.beforeSpan;
    this.afterSpan = config.afterSpan;
    this.responseHook = config.responseHook;

    // Only log once per instance creation, not on every constructor call
    this.customLogger?.info?.(`${LOG_PREFIX} Postgres instrumentation created`);
  }

  protected override init(): InstrumentationNodeModuleDefinition[] {
    this.customLogger?.info?.(
      `${LOG_PREFIX} Initializing postgres instrumentation`,
    );
    return [];
  }

  protected onMeterInitialized() {
    this.initializeMetrics();
  }

  private initializeMetrics(): void {
    try {
      if (!this.meter) {
        this.customLogger?.debug?.(
          `${LOG_PREFIX} Meter not available, skipping metric initialization`,
        );
        return;
      }

      if (this.enableHistogram) {
        try {
          this.queryDurationHistogram = this.meter.createHistogram(
            METRIC_DB_CLIENT_OPERATION_DURATION,
            {
              description: "Duration of PostgreSQL database queries in seconds",
              unit: "s",
              valueType: ValueType.DOUBLE,
              advice: {
                explicitBucketBoundaries: this.histogramBuckets,
              },
            },
          );
        } catch (histogramError) {
          this.customLogger?.debug?.(
            `${LOG_PREFIX} Failed to create histogram:`,
            histogramError,
          );
        }
      }

      this.queryCounter = this.meter.createCounter(PG_METRIC_REQUESTS, {
        description: "Number of PostgreSQL database queries executed",
        valueType: ValueType.INT,
      });

      this.errorCounter = this.meter.createCounter(PG_METRIC_ERRORS, {
        description: "Number of PostgreSQL database query errors",
        valueType: ValueType.INT,
      });

      this.connectionCounter = this.meter.createCounter(PG_METRIC_CONNECTIONS, {
        description: "Number of PostgreSQL database connections established",
        valueType: ValueType.INT,
      });

      this.connectionDurationHistogram = this.meter.createHistogram(
        PG_METRIC_CONNECTION_DURATION,
        {
          description: "Duration of PostgreSQL database connections in seconds",
          unit: "s",
          valueType: ValueType.DOUBLE,
          advice: {
            explicitBucketBoundaries: this.histogramBuckets,
          },
        },
      );

      this.customLogger?.info?.(
        `${LOG_PREFIX} Metrics initialized successfully`,
      );
    } catch (error) {
      this.customLogger?.debug?.(
        `${LOG_PREFIX} Failed to initialize metrics:`,
        error,
      );
    }
  }

  override enable(): void {
    super.enable();
    this.customLogger?.debug?.(`${LOG_PREFIX} Enable method called`);
    this.customLogger?.info?.(
      `${LOG_PREFIX} Enabling postgres instrumentation`,
    );
    this.setupEventListeners();
    this.customLogger?.debug?.(`${LOG_PREFIX} Enable method completed`);
  }

  override disable(): void {
    super.disable();
    this.customLogger?.info?.(
      `${LOG_PREFIX} Disabling postgres instrumentation`,
    );
    this.removeEventListeners();
  }

  private setupEventListeners(): void {
    if (this.listener) {
      this.removeEventListeners();
    }
    this.customLogger?.info?.(`${LOG_PREFIX} Setting up event listeners`);
    this.listener = (event: DbQueryEvent) => {
      this.handleQueryEvent(event);
    };
    getDbEventEmitter(this.customLogger).on(PG_EVENT_NAME, this.listener);

    // Add connection event listener
    getDbEventEmitter(this.customLogger).on(
      PG_CONNECTION_EVENT_NAME,
      (event) => {
        this.handleConnectionEvent(event);
      },
    );
  }

  private removeEventListeners(): void {
    if (this.listener) {
      getDbEventEmitter(this.customLogger).off(PG_EVENT_NAME, this.listener);
      this.listener = undefined;
    }
  }

  private handleQueryEvent(event: DbQueryEvent): void {
    this.customLogger?.debug?.(
      `${LOG_PREFIX} Processing query:`,
      `${event.durationMs}ms`,
    );
    const tracer = trace.getTracer(PG_TRACER_NAME, PG_TRACER_VERSION);
    const queryAnalysis = analyzeQuery(event.sql);

    const span = tracer.startSpan(
      queryAnalysis.operation,
      {
        attributes: {
          ...(this.serviceName && { [ATTR_SERVICE_NAME]: this.serviceName }),
          [PG_SERVER_ADDRESS]: this.serverAddress,
          [PG_SERVER_PORT]: this.serverPort,
          [ATTR_DB_SYSTEM_NAME]: DB_SYSTEM_NAME_VALUE_POSTGRESQL,
          [ATTR_DB_NAMESPACE]: event.databaseName || this.databaseName,
          [ATTR_DB_QUERY_TEXT]: this.sanitizeQuery(event.sql),
          [PG_DB_QUERY_TYPE]: this.getQueryType(queryAnalysis.operation),
          [ATTR_DB_OPERATION_NAME]: queryAnalysis.operation,
          [ATTR_DB_COLLECTION_NAME]: queryAnalysis.table || "unknown",
          [PG_DB_PARAMETER_COUNT]: event.params.length,
          [PG_DB_QUERY_HAS_WHERE]: queryAnalysis.hasWhere,
          [PG_DB_QUERY_HAS_JOIN]: queryAnalysis.hasJoin,
          [PG_DB_QUERY_HAS_ORDER_BY]: queryAnalysis.hasOrderBy,
          [PG_DB_QUERY_HAS_LIMIT]: queryAnalysis.hasLimit,
          [PG_DB_QUERY_COMPLEXITY]: queryAnalysis.estimatedComplexity,
          [PG_DB_DURATION_MS]: event.durationMs,
          [PG_DB_DURATION_SECONDS]: event.durationMs / 1000,
        },
      },
      context.active(),
    );
    // beforeSpan hook
    if (this.beforeSpan) {
      this.beforeSpan(span, event);
    }
    if (this.collectQueryParameters && event.params.length > 0) {
      this.addQueryParameters(span, event.params);
    }
    this.recordMetrics(event, queryAnalysis);
    if (event.error) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: String(event.error),
      });
      span.recordException(event.error as Error);
      span.setAttribute(ATTR_EXCEPTION_TYPE, this.getErrorType(event.error));
      this.customLogger?.debug?.(`${LOG_PREFIX} Query failed:`, event.error);
    } else {
      span.setStatus({ code: SpanStatusCode.OK });
      if (event.result) {
        if (Array.isArray(event.result)) {
          span.setAttribute(PG_DB_RESULT_ROW_COUNT, event.result.length);
        }
        // responseHook
        if (this.responseHook) {
          this.responseHook(span, event.result);
        }
      }
    }
    // afterSpan hook
    if (this.afterSpan) {
      this.afterSpan(span, event);
    }
    span.end();
  }

  private handleConnectionEvent(event: {
    type: string;
    timestamp: number;
    connectionId: string;
  }): void {
    this.customLogger?.debug?.(`${LOG_PREFIX} Connection event:`, event.type);

    if (this.connectionCounter) {
      const attributes = {
        [ATTR_DB_SYSTEM_NAME]: DB_SYSTEM_NAME_VALUE_POSTGRESQL,
        ...(this.serviceName && {
          [ATTR_SERVICE_NAME]: this.serviceName,
        }),
      };

      this.connectionCounter.add(1, attributes);
    }

    // Track connection start time for duration calculation
    if (event.type === "connect") {
      this.connectionStartTimes.set(event.connectionId, event.timestamp);
    } else if (event.type === "disconnect") {
      const startTime = this.connectionStartTimes.get(event.connectionId);
      if (startTime && this.connectionDurationHistogram) {
        const durationMs = event.timestamp - startTime;
        const durationSeconds = durationMs / 1000;

        const attributes = {
          [ATTR_DB_SYSTEM_NAME]: DB_SYSTEM_NAME_VALUE_POSTGRESQL,
          ...(this.serviceName && {
            [ATTR_SERVICE_NAME]: this.serviceName,
          }),
        };

        this.connectionDurationHistogram.record(durationSeconds, attributes);
        this.connectionStartTimes.delete(event.connectionId);
      }
    }
  }

  private sanitizeQuery(sql: string): string {
    return sql.replace(/password\s*=\s*['"][^'"]*['"]/gi, "password=***");
  }

  private addQueryParameters(span: Span, params: unknown[]): void {
    params.forEach((param, index) => {
      const paramKey = `${PG_DB_QUERY_PARAMETER_PREFIX}${index}`;
      const paramValue = this.parameterSanitizer(param);
      span.setAttribute(paramKey, paramValue);
    });
  }

  private defaultParameterSanitizer(param: unknown): string {
    if (typeof param === "string" && param.length > 100) {
      return `${param.substring(0, 100)}...`;
    }
    // Redact common sensitive fields
    if (typeof param === "string" && /password|token|secret/i.test(param)) {
      return "[REDACTED]";
    }
    return String(param);
  }

  private getErrorType(error: unknown): string {
    if (error instanceof Error) {
      return error.constructor.name;
    }
    return "_OTHER";
  }

  private recordMetrics(
    event: DbQueryEvent,
    queryAnalysis: ReturnType<typeof analyzeQuery>,
  ): void {
    try {
      const durationInSeconds = event.durationMs / 1000;
      const attributes = {
        [ATTR_DB_SYSTEM_NAME]: DB_SYSTEM_NAME_VALUE_POSTGRESQL,
        [ATTR_DB_OPERATION_NAME]: queryAnalysis.operation,
        [ATTR_DB_COLLECTION_NAME]: queryAnalysis.table || "unknown",
        [PG_DB_QUERY_COMPLEXITY]: queryAnalysis.estimatedComplexity,
        [PG_DB_QUERY_TYPE]: this.getQueryType(queryAnalysis.operation),
        ...(this.serviceName && {
          [ATTR_SERVICE_NAME]: this.serviceName,
        }),
      };

      // Try to initialize metrics if histogram is not available
      if (!this.queryDurationHistogram && this.enableHistogram) {
        this.initializeMetrics();
      }

      if (this.queryDurationHistogram) {
        this.queryDurationHistogram.record(durationInSeconds, attributes);
      }

      if (this.queryCounter) {
        this.queryCounter.add(1, attributes);
      }

      if (event.error && this.errorCounter) {
        this.errorCounter.add(1, {
          ...attributes,
          [PG_METRIC_ATTR_ERROR_TYPE]: this.getErrorType(event.error),
        });
      }
    } catch (error) {
      this.customLogger?.debug?.(
        `${LOG_PREFIX} Failed to record metrics:`,
        error,
      );
    }
  }

  private getQueryType(operation: string): string {
    switch (operation.toUpperCase()) {
      case "SELECT":
        return PG_QUERY_TYPE.READ;
      case "INSERT":
        return PG_QUERY_TYPE.WRITE;
      case "UPDATE":
        return PG_QUERY_TYPE.WRITE;
      case "DELETE":
        return PG_QUERY_TYPE.WRITE;
      case "CREATE":
        return PG_QUERY_TYPE.SCHEMA;
      case "ALTER":
        return PG_QUERY_TYPE.SCHEMA;
      case "DROP":
        return PG_QUERY_TYPE.SCHEMA;
      default:
        return PG_QUERY_TYPE.UNKNOWN;
    }
  }

  static registerDbQueryReceiver(
    options: {
      serviceName?: string;
      enableHistogram?: boolean;
      collectQueryParameters?: boolean;
      serverAddress?: string;
      serverPort?: number;
      parameterSanitizer?: ParameterSanitizer;
      beforeSpan?: BeforeSpanHook;
      afterSpan?: AfterSpanHook;
      responseHook?: ResponseHook;
    } = {},
    logger?: Logger,
  ): PostgresInstrumentation {
    const instrumentation = new PostgresInstrumentation({
      serviceName: options.serviceName,
      logger,
      enableHistogram: options.enableHistogram,
      collectQueryParameters: options.collectQueryParameters,
      serverAddress: options.serverAddress,
      serverPort: options.serverPort,
      parameterSanitizer: options.parameterSanitizer,
      beforeSpan: options.beforeSpan,
      afterSpan: options.afterSpan,
      responseHook: options.responseHook,
    } as PostgresInstrumentationConfig);
    instrumentation.enable();
    return instrumentation;
  }
}

export const registerDbQueryReceiver =
  PostgresInstrumentation.registerDbQueryReceiver;
