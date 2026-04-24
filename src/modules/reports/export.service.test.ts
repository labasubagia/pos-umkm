import { describe, it, expect, vi, beforeEach } from "vitest";
import { exportToExcel, ExportError } from "./export.service";

const mockWorksheet = {};
const mockWorkbook = {};
const mockWriteFile = vi.fn();
const mockJsonToSheet = vi.fn().mockReturnValue(mockWorksheet);
const mockBookNew = vi.fn().mockReturnValue(mockWorkbook);
const mockBookAppendSheet = vi.fn();

vi.mock("xlsx", () => ({
  utils: {
    json_to_sheet: (...args: unknown[]) => mockJsonToSheet(...args),
    book_new: () => mockBookNew(),
    book_append_sheet: (...args: unknown[]) => mockBookAppendSheet(...args),
  },
  writeFile: (...args: unknown[]) => mockWriteFile(...args),
}));

beforeEach(() => {
  vi.clearAllMocks();
  mockJsonToSheet.mockReturnValue(mockWorksheet);
  mockBookNew.mockReturnValue(mockWorkbook);
});

describe("exportToExcel", () => {
  const data = [{ ID: "tx-1", Total: 10000 }];

  it("calls SheetJS write with correct sheet data", () => {
    exportToExcel(data, "laporan");
    expect(mockJsonToSheet).toHaveBeenCalledWith(data);
    expect(mockWriteFile).toHaveBeenCalledOnce();
  });

  it("triggers file download with .xlsx extension", () => {
    exportToExcel(data, "laporan");
    const [, filename] = mockWriteFile.mock.calls[0];
    expect(filename).toMatch(/\.xlsx$/);
  });

  it("throws if reportData is empty", () => {
    expect(() => exportToExcel([], "laporan")).toThrow(ExportError);
  });
});
