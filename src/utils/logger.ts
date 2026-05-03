/**
 * Application logger.
 *
 * Console output is filtered by environment to remove noise:
 *   - development : all levels pass through
 *   - test        : debug / info / log are suppressed; warn and error pass through
 *   - production  : debug / info / log are suppressed; warn and error pass through
 *
 * `import.meta.env.MODE` is read at every call so that `vi.stubEnv('MODE', …)`
 * works in unit tests without reloading the module.
 */

const LEVELS = { debug: 0, info: 1, log: 2, warn: 3, error: 4 } as const;
type Level = keyof typeof LEVELS;

/** Returns the minimum level index that should be emitted for the current env. */
function minLevel(): number {
  if (import.meta.env.MODE === "development") return LEVELS.debug;
  return LEVELS.warn; // 'test' | 'production' → suppress verbose levels
}

function emit(level: Level, ...args: unknown[]): void {
  if (LEVELS[level] >= minLevel()) {
    // eslint-disable-next-line no-console
    console[level](...args);
  }
}

export const logger = {
  debug: (...args: unknown[]) => emit("debug", ...args),
  info: (...args: unknown[]) => emit("info", ...args),
  log: (...args: unknown[]) => emit("log", ...args),
  warn: (...args: unknown[]) => emit("warn", ...args),
  error: (...args: unknown[]) => emit("error", ...args),
} as const;
