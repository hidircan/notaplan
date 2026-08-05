/**
 * PRODUCT_BACKLOG §2.1 — tahsilat vade pencereleri.
 * Kredi kartı: ayın 1–5’i; nakit/havale: en geç ayın 20’si.
 */

import type { StudentPaymentMethod, StudentType } from "./types";
import { isMebStudentType } from "./types";

export type DueWindow = { minDay: number; maxDay: number; label: string };

export function dueWindowForPaymentMethod(method: StudentPaymentMethod | undefined): DueWindow {
  if (method === "credit_card") {
    return { minDay: 1, maxDay: 5, label: "Kredi kartı vadesi: ayın 1–5’i" };
  }
  // cash, transfer, unknown → nakit/havale kuralı
  return { minDay: 1, maxDay: 20, label: "Nakit/havale vadesi: en geç ayın 20’si" };
}

export function isValidDueDay(method: StudentPaymentMethod | undefined, day: number): boolean {
  const w = dueWindowForPaymentMethod(method);
  return Number.isInteger(day) && day >= w.minDay && day <= w.maxDay;
}

/**
 * PRODUCT_BACKLOG §2.2 — MEB → VakıfBank, diğer → Halkbank.
 */
export type BankIbanKey = "vakifbank" | "halkbank";

export function bankForStudentType(studentType: StudentType | undefined): BankIbanKey {
  return isMebStudentType(studentType) ? "vakifbank" : "halkbank";
}

export function resolveCollectionsIban(
  studentType: StudentType | undefined,
  settings: { vakifbankIban?: string; halkbankIban?: string }
): { bank: BankIbanKey; iban: string | undefined; bankLabel: string } {
  const bank = bankForStudentType(studentType);
  if (bank === "vakifbank") {
    return { bank, iban: settings.vakifbankIban, bankLabel: "VakıfBank" };
  }
  return { bank, iban: settings.halkbankIban, bankLabel: "Halkbank" };
}
