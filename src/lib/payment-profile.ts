import type { Payment } from "./types";

export type StudentPaymentSummary = {
  totalBilled: number;
  totalCollected: number;
  remaining: number;
  overdueRemaining: number;
  openCount: number;
};

/**
 * Öğrenci bazlı ödeme özeti. Tüm hesaplar tamsayı TL üzerinden yapılır
 * (Payment.amount/paidAmount zaten şemada integer); float yuvarlama riski yok.
 */
export function computeStudentPaymentSummary(payments: Payment[]): StudentPaymentSummary {
  let totalBilled = 0;
  let totalCollected = 0;
  let remaining = 0;
  let overdueRemaining = 0;
  let openCount = 0;

  for (const p of payments) {
    // "voided" (ders iptaliyle geri alınmış otomatik tahsilat) hiç borç/tahsilat
    // sayılmaz — özet toplamlarına hiç girmez, yalnızca geçmişte görünür kalır.
    if (p.status === "voided") continue;
    totalBilled += p.amount;
    totalCollected += p.paidAmount;
    const due = Math.max(p.amount - p.paidAmount, 0);
    remaining += due;
    if (p.status === "overdue") overdueRemaining += due;
    if (p.status !== "paid") openCount += 1;
  }

  return { totalBilled, totalCollected, remaining, overdueRemaining, openCount };
}

/** Ödeme geçmişi görünümü için sıralama: en yeni vade önce. */
export function sortPaymentsForProfile(payments: Payment[]): Payment[] {
  return [...payments].sort((a, b) => b.dueDate.localeCompare(a.dueDate));
}
