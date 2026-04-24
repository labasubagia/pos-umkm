import { describe, expect, it } from "vitest";
import { generateId } from "./uuid";

describe("uuid", () => {
  it("generateId returns a valid UUID v4 format string", () => {
    const id = generateId();
    // UUID v4 format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
    expect(id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });

  it("two calls return different values", () => {
    const a = generateId();
    const b = generateId();
    expect(a).not.toBe(b);
  });
});
