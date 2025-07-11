import type postgres from "postgres";

// Type for the postgres client
export type PostgresClient = ReturnType<typeof postgres>;
