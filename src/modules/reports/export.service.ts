import * as XLSX from "xlsx";

export class ExportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ExportError";
  }
}

export function exportToExcel(
  reportData: Record<string, unknown>[],
  filename: string,
): void {
  if (reportData.length === 0)
    throw new ExportError("Tidak ada data untuk diekspor");
  const ws = XLSX.utils.json_to_sheet(reportData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Laporan");
  const outputName = filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`;
  XLSX.writeFile(wb, outputName);
}

export function printReport(): void {
  window.print();
}
