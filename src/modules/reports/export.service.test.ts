import { describe, expect, it, vi } from "vitest";
import { printReport } from "./export.service";

describe("printReport", () => {
  it("calls window.print", () => {
    const printSpy = vi.spyOn(window, "print").mockImplementation(() => {});
    printReport();
    expect(printSpy).toHaveBeenCalledOnce();
    printSpy.mockRestore();
  });
});
