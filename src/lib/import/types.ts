export type ImportRowError = {
  row: number;
  field: string;
  message: string;
};

/** Önizlemede kullanıcıya gösterilen, dosyadan okunan satırın kısa özeti. */
export type ImportReadRow = {
  row: number;
  summary: string;
};

export const IMPORT_READ_ROWS_PREVIEW_LIMIT = 10;

export type ImportPreview<T> = {
  totalRows: number;
  validCount: number;
  errorCount: number;
  errors: ImportRowError[];
  valid: T[];
  /** Dosyadan okunan ilk satırların ("Satır 2 — Ad — Şube — ...") özeti. */
  readRows: ImportReadRow[];
};
