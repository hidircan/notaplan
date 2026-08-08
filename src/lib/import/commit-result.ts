import type { AppData } from "../types";

export type ImportCommitResult = {
  data: AppData;
  created: number;
  updated: number;
  /**
   * Ders programı importu gibi akışlarda: dosyada zaten var olan (aynı
   * öğretmen+oda+başlangıç saati) bir kayıtla BİREBİR eşleşen, bu yüzden
   * ne oluşturulan ne değiştirilen satır sayısı — idempotency (aynı CSV'nin
   * tekrar yüklenmesi kör duplicate üretmez). Diğer importer'lar bu alanı
   * hiç set etmez (opsiyonel, geriye dönük uyumlu).
   */
  skipped?: number;
};
