import { describe, it, expect } from "vitest";
import {
  ageFromBirthDate,
  decryptNationalId,
  encryptNationalId,
  isValidTurkishNationalId,
  maskNationalId,
  normalizeNationalId,
} from "../pii/tc-identity";
import { canViewFullNationalId } from "../pii";

/** Bilinen geçerli T.C. örneği (algoritmik). */
const VALID_TC = "10000000146";

describe("isValidTurkishNationalId", () => {
  it("geçerli 11 haneyi kabul eder", () => {
    expect(isValidTurkishNationalId(VALID_TC)).toBe(true);
  });

  it("yanlış checksum reddedilir", () => {
    expect(isValidTurkishNationalId("10000000147")).toBe(false);
  });

  it("10 hane reddedilir", () => {
    expect(isValidTurkishNationalId("1000000014")).toBe(false);
  });
});

describe("encrypt/decrypt round-trip", () => {
  it("şifreler ve çözer", () => {
    const { cipher, last2 } = encryptNationalId(VALID_TC);
    expect(last2).toBe("46");
    expect(cipher).not.toContain(VALID_TC);
    expect(decryptNationalId(cipher)).toBe(VALID_TC);
  });

  it("geçersiz id encrypt fırlatır", () => {
    expect(() => encryptNationalId("123")).toThrow();
  });
});

describe("maskNationalId", () => {
  it("son 2 haneyi gösterir", () => {
    expect(maskNationalId("46")).toBe("*********46");
  });
});

describe("ageFromBirthDate", () => {
  it("yaşı hesaplar", () => {
    const now = new Date("2026-08-05");
    expect(ageFromBirthDate("2010-08-05", now)).toBe(16);
    expect(ageFromBirthDate("2010-08-06", now)).toBe(15);
  });
});

describe("canViewFullNationalId", () => {
  it("yalnız admin", () => {
    expect(canViewFullNationalId("SUPER_ADMIN")).toBe(true);
    expect(canViewFullNationalId("SCHOOL_ADMIN")).toBe(true);
    expect(canViewFullNationalId("TEACHER")).toBe(false);
    expect(canViewFullNationalId("PARENT")).toBe(false);
  });
});

describe("normalizeNationalId", () => {
  it("boşluk ve tire temizler", () => {
    expect(normalizeNationalId("100 0000 0146")).toBe("10000000146");
  });
});
