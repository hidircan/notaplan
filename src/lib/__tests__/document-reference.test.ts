import { describe, it, expect } from "vitest";
import { buildDocumentReference } from "../document-reference";
import { buildReceiptReference } from "../receipt";

describe("document reference", () => {
  it("aynı instanceId için deterministik", () => {
    const a = buildDocumentReference("student_enrollment_contract", "doc_abc");
    const b = buildDocumentReference("student_enrollment_contract", "doc_abc");
    expect(a).toBe(b);
    expect(a).toMatch(/^NP-/);
  });

  it("farklı id farklı referans", () => {
    const a = buildDocumentReference("kvkk", "id1");
    const b = buildDocumentReference("kvkk", "id2");
    expect(a).not.toBe(b);
  });

  it("makbuz referansı hâlâ çalışır (ortak aile)", () => {
    expect(buildReceiptReference("pay_1")).toBeTruthy();
  });
});
