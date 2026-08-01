import { describe, it, expect } from "vitest";
import { createSeedData } from "../seed";
import {
  buildReceiptReference,
  buildReceiptViewModel,
  canViewReceipt,
  receiptIneligibleReason,
} from "../receipt";

const data = createSeedData();

describe("canViewReceipt", () => {
  it("yalnızca status === 'paid' için true döner", () => {
    expect(canViewReceipt({ status: "paid" })).toBe(true);
    expect(canViewReceipt({ status: "pending" })).toBe(false);
    expect(canViewReceipt({ status: "overdue" })).toBe(false);
    expect(canViewReceipt({ status: "partial" })).toBe(false);
  });
});

describe("receiptIneligibleReason", () => {
  it("ödenmemiş ödeme için nedeni açık biçimde döner", () => {
    expect(receiptIneligibleReason({ status: "pending" })).toMatch(/tahsil edilmediği/);
    expect(receiptIneligibleReason({ status: "overdue" })).toMatch(/gecikmiş/);
    expect(receiptIneligibleReason({ status: "partial" })).toMatch(/kısmi/);
  });

  it("ödenmiş ödeme için null döner", () => {
    expect(receiptIneligibleReason({ status: "paid" })).toBeNull();
  });
});

describe("buildReceiptReference", () => {
  it("aynı paymentId için her zaman aynı referansı üretir (deterministik)", () => {
    const first = buildReceiptReference("p1");
    const second = buildReceiptReference("p1");
    expect(first).toBe(second);
  });

  it("farklı paymentId'ler için MKB- önekli farklı referanslar üretir", () => {
    const a = buildReceiptReference("p1");
    const b = buildReceiptReference("p2");
    expect(a).toMatch(/^MKB-[0-9A-Z]{8}$/);
    expect(b).toMatch(/^MKB-[0-9A-Z]{8}$/);
    expect(a).not.toBe(b);
  });
});

describe("buildReceiptViewModel", () => {
  // p1: s1 (Zeynep Arslan), amount 3200, paidAmount 3200, status paid, paidAt set
  const payment = data.payments.find((p) => p.id === "p1")!;
  const student = data.students.find((s) => s.id === "s1")!;
  const branch = data.settings.branches.find((b) => b.id === student.branchId);

  it("öğrenci, tutar, açıklama ve ödeme tarihi doğru gösterilir", () => {
    const model = buildReceiptViewModel(payment, student, data.settings, branch);
    expect(model.studentName).toBe("Zeynep Arslan");
    expect(model.amount).toBe(payment.paidAmount);
    expect(model.description).toBe(payment.description);
    expect(model.paymentDateIso).toBe(payment.paidAt);
  });

  it("aynı ödeme için tekrar üretilen model temel verilerde değişmez", () => {
    const first = buildReceiptViewModel(payment, student, data.settings, branch);
    const second = buildReceiptViewModel(payment, student, data.settings, branch);
    expect(second.reference).toBe(first.reference);
    expect(second.studentName).toBe(first.studentName);
    expect(second.amount).toBe(first.amount);
    expect(second.description).toBe(first.description);
    expect(second.paymentDateIso).toBe(first.paymentDateIso);
  });

  it("veli adı doluysa parentLine oluşturur", () => {
    const model = buildReceiptViewModel(payment, student, data.settings, branch);
    expect(model.parentLine).toContain(student.parentName);
  });

  it("veli adı boşsa parentLine alanını hiç göstermez (uydurma veri yok)", () => {
    const studentNoParent = { ...student, parentName: "", parentPhone: "" };
    const model = buildReceiptViewModel(payment, studentNoParent, data.settings, branch);
    expect(model.parentLine).toBeUndefined();
  });

  it("şube bulunamazsa branchName/branchContact alanlarını uydurmaz", () => {
    const model = buildReceiptViewModel(payment, student, data.settings, undefined);
    expect(model.branchName).toBeUndefined();
    expect(model.branchContact).toBeUndefined();
  });

  it("kurum adı settings.name'den gelir", () => {
    const model = buildReceiptViewModel(payment, student, data.settings, branch);
    expect(model.institutionName).toBe(data.settings.name);
  });
});
