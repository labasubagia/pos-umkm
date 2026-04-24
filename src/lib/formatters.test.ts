import { describe, expect, it } from "vitest";
import { formatIDR } from "./formatIDR";
import {
  formatDate,
  formatDateTime,
  formatIDRStrict,
  nowUTC,
  parseIDR,
} from "./formatters";

describe("formatIDR (from formatIDR.ts)", () => {
  it('formatIDR(15000) returns "Rp 15.000"', () => {
    expect(formatIDR(15000)).toBe("Rp 15.000");
  });

  it('formatIDR(0) returns "Rp 0"', () => {
    expect(formatIDR(0)).toBe("Rp 0");
  });

  it('formatIDR(1000000) returns "Rp 1.000.000"', () => {
    expect(formatIDR(1000000)).toBe("Rp 1.000.000");
  });
});

describe("formatIDRStrict (validates input)", () => {
  it("throws on negative number", () => {
    expect(() => formatIDRStrict(-1)).toThrow(RangeError);
  });

  it("throws on non-integer (float) input", () => {
    expect(() => formatIDRStrict(1.5)).toThrow(TypeError);
  });
});

describe("formatDate", () => {
  it("returns DD/MM/YYYY in WIB timezone (Asia/Jakarta)", () => {
    // 2026-04-18T10:00:00Z = 2026-04-18T17:00:00+07:00 → 18/04/2026 in WIB
    const result = formatDate("2026-04-18T10:00:00.000Z", "Asia/Jakarta");
    expect(result).toBe("18/04/2026");
  });

  it("returns DD/MM/YYYY in WIT timezone (Asia/Jayapura)", () => {
    // 2026-04-18T14:00:00Z = 18/04/2026 23:00 in WIT (UTC+9)
    const result = formatDate("2026-04-18T14:00:00.000Z", "Asia/Jayapura");
    expect(result).toBe("18/04/2026");
  });
});

describe("formatDateTime", () => {
  it("returns DD/MM/YYYY HH:mm in WIB timezone", () => {
    // 2026-04-18T05:30:00Z = 18/04/2026 12:30 in WIB (UTC+7)
    const result = formatDateTime("2026-04-18T05:30:00.000Z", "Asia/Jakarta");
    expect(result).toBe("18/04/2026 12:30");
  });
});

describe("nowUTC", () => {
  it("returns a valid ISO 8601 UTC string", () => {
    const result = nowUTC();
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });
});

describe("parseIDR", () => {
  it('parseIDR("Rp 15.000") returns 15000', () => {
    expect(parseIDR("Rp 15.000")).toBe(15000);
  });

  it('parseIDR("Rp 1.000.000") returns 1000000', () => {
    expect(parseIDR("Rp 1.000.000")).toBe(1000000);
  });

  it("throws on malformed string", () => {
    expect(() => parseIDR("not-a-number")).toThrow();
  });
});
