import { pino } from "pino";

const logger = pino({
  level: "info",
  ...(process.env.NODE_ENV === "production"
    ? {
        transport: {
          target: "pino-pretty",
          options: {
            colorize: true,
          },
        },
      }
    : {
        transport: {
          target: "pino-pretty",
          options: {
            colorize: true,
          },
        },
        level: "debug",
      }),
});

export type Logger = ReturnType<typeof createLogger>;
export const createLogger = (name: string) => {
  return logger.child({
    name,
  });
};
