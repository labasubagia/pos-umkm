import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { registerAppServiceWorker } from "./registerServiceWorker";

describe("registerAppServiceWorker", () => {
  const originalServiceWorker = Object.getOwnPropertyDescriptor(
    navigator,
    "serviceWorker",
  );

  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.stubEnv("MODE", "test");
    delete (window as Window & { __MSW_ENABLED__?: boolean }).__MSW_ENABLED__;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();

    if (originalServiceWorker) {
      Object.defineProperty(navigator, "serviceWorker", originalServiceWorker);
      return;
    }

    Reflect.deleteProperty(navigator, "serviceWorker");
  });

  it("skips registration outside production mode", async () => {
    const register = vi.fn();

    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: { register },
    });

    await expect(registerAppServiceWorker()).resolves.toBeUndefined();
    expect(register).not.toHaveBeenCalled();
  });

  it("registers the generated service worker in production", async () => {
    const registration = { scope: "/pos-umkm/" } as ServiceWorkerRegistration;
    const register = vi.fn().mockResolvedValue(registration);
    const expectedUrl = `${import.meta.env.BASE_URL}sw.js`;

    vi.stubEnv("MODE", "production");
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: { register },
    });

    await expect(registerAppServiceWorker()).resolves.toBe(registration);
    expect(register).toHaveBeenCalledWith(expectedUrl);
  });

  it("skips registration when the mock worker flag is enabled", async () => {
    const register = vi.fn();

    vi.stubEnv("MODE", "production");
    (window as Window & { __MSW_ENABLED__?: boolean }).__MSW_ENABLED__ = true;
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: { register },
    });

    await expect(registerAppServiceWorker()).resolves.toBeUndefined();
    expect(register).not.toHaveBeenCalled();
  });
});
