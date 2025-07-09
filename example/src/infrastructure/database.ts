import { Kysely } from "kysely";
import { PostgresJSDialect } from "kysely-postgres-js";
import { createOTELEmitter } from "otel-instrumentation-postgres";
import postgres from "postgres";
import { getEnv } from "../shared/env.js";
import type { DB } from "./db.d.ts";
import { createLogger } from "./logger.js";

const logger = createLogger("database");

export function connectDb(name?: string): DBClient {
  const {
    PGHOST: host,
    PGPORT: port,
    PGDATABASE: database,
    PGUSER: username,
    PGPASSWORD: password,
  } = getEnv();

  // Create the base postgres client
  const basePostgres = postgres({
    host,
    port,
    database: name ?? database,
    username,
    password,
  });

  // Wrap it with the emitter to capture query events
  const instrumentedPostgres = createOTELEmitter(basePostgres, logger);

  return new Kysely<DB>({
    dialect: new PostgresJSDialect({
      postgres: instrumentedPostgres,
    }),
  });
}
export type DBClient = Kysely<DB>;

const db = connectDb();
export const getDb = (): DBClient => db;
