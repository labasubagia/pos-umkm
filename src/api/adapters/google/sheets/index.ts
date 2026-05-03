// Google Sheets API operations
export {
  batchInsert as batchAppendRows,
  batchUpdate as batchUpdateCells,
  getAll as getSheet,
  softDelete,
  writeHeaders,
} from "./sheets.ops";
export { SheetsApiError } from "./sheets.types";
