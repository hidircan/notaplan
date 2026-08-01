export type ImportRowError = {
  row: number;
  field: string;
  message: string;
};

export type ImportPreview<T> = {
  totalRows: number;
  validCount: number;
  errorCount: number;
  errors: ImportRowError[];
  valid: T[];
};
