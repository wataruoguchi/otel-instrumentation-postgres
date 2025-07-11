import { describe, expect, it } from "vitest";
import type { Logger } from "./logger.js";

describe("Logger type", () => {
  it("should allow optional debug method", () => {
    const logger: Logger = {
      debug: (msg: string, ...args: unknown[]) => {
        expect(msg).toBe("test");
        expect(args).toEqual(["arg1", "arg2"]);
      },
    };
    logger.debug?.("test", "arg1", "arg2");
  });

  it("should allow optional info method", () => {
    const logger: Logger = {
      info: (msg: string, ...args: unknown[]) => {
        expect(msg).toBe("test");
        expect(args).toEqual(["arg1", "arg2"]);
      },
    };
    logger.info?.("test", "arg1", "arg2");
  });

  it("should allow optional error method", () => {
    const logger: Logger = {
      error: (msg: string, ...args: unknown[]) => {
        expect(msg).toBe("test");
        expect(args).toEqual(["arg1", "arg2"]);
      },
    };
    logger.error?.("test", "arg1", "arg2");
  });

  it("should allow empty logger", () => {
    const logger: Logger = {};
    expect(logger).toBeDefined();
    expect(logger.debug).toBeUndefined();
    expect(logger.info).toBeUndefined();
    expect(logger.error).toBeUndefined();
  });

  it("should allow partial logger", () => {
    const logger: Logger = {
      debug: () => {},
    };
    expect(logger.debug).toBeDefined();
    expect(logger.info).toBeUndefined();
    expect(logger.error).toBeUndefined();
  });
});
