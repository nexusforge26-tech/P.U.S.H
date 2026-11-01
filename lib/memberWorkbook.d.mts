export type WorkbookCell = string | number | boolean | Date | null | undefined;

export interface WorkbookColumn {
  key: string;
  header: string;
  width?: number;
}

export interface WorkbookSheet {
  name: string;
  title: string;
  subtitle?: string;
  columns: WorkbookColumn[];
  rows: Array<Record<string, WorkbookCell>>;
}

export declare function createXlsxWorkbook(
  sheets: WorkbookSheet[],
  generatedAt?: Date
): Promise<Buffer>;
