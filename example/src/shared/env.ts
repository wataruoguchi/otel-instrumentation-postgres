import { z } from "zod";

const envSchema = z.object({
  PGHOST: z.string(),
  PGPORT: z.coerce.number(),
  PGDATABASE: z.string(),
  PGUSER: z.string(),
  PGPASSWORD: z.string(),
  PORT: z.coerce.number(),
  PROMETHEUS_PORT: z.coerce.number().optional(),
});

export const getEnv = () => envSchema.parse(process.env);

export type Env = z.infer<typeof envSchema>;
