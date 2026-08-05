import { describe, it, expect } from "vitest";
import {
  bankForStudentType,
  dueWindowForPaymentMethod,
  isValidDueDay,
  resolveCollectionsIban,
} from "../collections-due";

describe("due windows", () => {
  it("kredi kartı 1–5", () => {
    const w = dueWindowForPaymentMethod("credit_card");
    expect(w.minDay).toBe(1);
    expect(w.maxDay).toBe(5);
    expect(isValidDueDay("credit_card", 5)).toBe(true);
    expect(isValidDueDay("credit_card", 6)).toBe(false);
  });

  it("nakit/havale en geç 20", () => {
    expect(isValidDueDay("cash", 20)).toBe(true);
    expect(isValidDueDay("transfer", 21)).toBe(false);
  });
});

describe("IBAN bank selection", () => {
  it("MEB → VakıfBank, diğer → Halkbank", () => {
    expect(bankForStudentType("MEB")).toBe("vakifbank");
    expect(bankForStudentType("Hobi")).toBe("halkbank");
    const r = resolveCollectionsIban("MEB", {
      vakifbankIban: "TR00VAKIF",
      halkbankIban: "TR00HALK",
    });
    expect(r.bankLabel).toBe("VakıfBank");
    expect(r.iban).toBe("TR00VAKIF");
  });
});
