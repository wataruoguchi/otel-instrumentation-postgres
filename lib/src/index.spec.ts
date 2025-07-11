import { describe, expect, it } from "vitest";
import {
  createOTELEmitter,
  type Logger,
  PostgresInstrumentation,
} from "./index.js";

describe("index exports", () => {
  it("should export createOTELEmitter", () => {
    expect(createOTELEmitter).toBeDefined();
    expect(typeof createOTELEmitter).toBe("function");
  });

  it("should export PostgresInstrumentation", () => {
    expect(PostgresInstrumentation).toBeDefined();
    expect(typeof PostgresInstrumentation).toBe("function");
  });

  it("should export Logger type", () => {
    // TypeScript type check - this will fail at compile time if Logger is not exported
    const logger: Logger = {
      debug: () => {},
      info: () => {},
      error: () => {},
    };
    expect(logger).toBeDefined();
  });
});
