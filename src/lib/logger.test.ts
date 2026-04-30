import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { logger } from "./logger";

/**
 * The logger module reads import.meta.env.MODE at call time, so vi.stubEnv
 * can change behaviour within the same test run without module reloads.
 *
 * Default Vitest environment: MODE = 'test'  → warn + error only.
 * Stubbed to 'development'                   → all levels.
 */
describe("logger", () => {
  let spyDebug: ReturnType<typeof vi.spyOn>;
  let spyInfo: ReturnType<typeof vi.spyOn>;
  let spyLog: ReturnType<typeof vi.spyOn>;
  let spyWarn: ReturnType<typeof vi.spyOn>;
  let spyError: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    spyDebug = vi.spyOn(console, "debug").mockImplementation(() => {});
    spyInfo = vi.spyOn(console, "info").mockImplementation(() => {});
    spyLog = vi.spyOn(console, "log").mockImplementation(() => {});
    spyWarn = vi.spyOn(console, "warn").mockImplementation(() => {});
    spyError = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  describe("in test mode (MODE=test — default)", () => {
    it("suppresses debug", () => {
      logger.debug("test-debug");
      expect(spyDebug).not.toHaveBeenCalled();
    });

    it("suppresses info", () => {
      logger.info("test-info");
      expect(spyInfo).not.toHaveBeenCalled();
    });

    it("suppresses log", () => {
      logger.log("test-log");
      expect(spyLog).not.toHaveBeenCalled();
    });

    it("passes warn through", () => {
      logger.warn("test-warn");
      expect(spyWarn).toHaveBeenCalledWith("test-warn");
    });

    it("passes error through", () => {
      logger.error("test-error");
      expect(spyError).toHaveBeenCalledWith("test-error");
    });
  });

  describe("in development mode (MODE=development)", () => {
    beforeEach(() => {
      vi.stubEnv("MODE", "development");
    });

    it("passes debug through", () => {
      logger.debug("dev-debug");
      expect(spyDebug).toHaveBeenCalledWith("dev-debug");
    });

    it("passes info through", () => {
      logger.info("dev-info");
      expect(spyInfo).toHaveBeenCalledWith("dev-info");
    });

    it("passes log through", () => {
      logger.log("dev-log");
      expect(spyLog).toHaveBeenCalledWith("dev-log");
    });

    it("passes warn through", () => {
      logger.warn("dev-warn");
      expect(spyWarn).toHaveBeenCalledWith("dev-warn");
    });

    it("passes error through", () => {
      logger.error("dev-error");
      expect(spyError).toHaveBeenCalledWith("dev-error");
    });
  });

  describe("in production mode (MODE=production)", () => {
    beforeEach(() => {
      vi.stubEnv("MODE", "production");
    });

    it("suppresses debug", () => {
      logger.debug("prod-debug");
      expect(spyDebug).not.toHaveBeenCalled();
    });

    it("suppresses info", () => {
      logger.info("prod-info");
      expect(spyInfo).not.toHaveBeenCalled();
    });

    it("suppresses log", () => {
      logger.log("prod-log");
      expect(spyLog).not.toHaveBeenCalled();
    });

    it("passes warn through", () => {
      logger.warn("prod-warn");
      expect(spyWarn).toHaveBeenCalledWith("prod-warn");
    });

    it("passes error through", () => {
      logger.error("prod-error");
      expect(spyError).toHaveBeenCalledWith("prod-error");
    });
  });

  it("forwards multiple arguments", () => {
    logger.error("msg", { key: "value" }, 42);
    expect(spyError).toHaveBeenCalledWith("msg", { key: "value" }, 42);
  });
});
