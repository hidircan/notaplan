import { describe, expect, it } from "vitest";
import { validateUploadedFile, base64ByteSize, MAX_UPLOAD_BYTES } from "../file-upload-validation";

describe("validateUploadedFile", () => {
  it("dosya hiç gönderilmemişse geçerlidir (opsiyonel)", () => {
    expect(validateUploadedFile({})).toEqual({ ok: true });
  });

  it("üç alandan yalnızca biri gönderilirse reddeder", () => {
    const res = validateUploadedFile({ fileName: "a.png" });
    expect(res.ok).toBe(false);
  });

  it("desteklenmeyen mime tipini reddeder", () => {
    const res = validateUploadedFile({
      fileName: "a.exe",
      fileMimeType: "application/x-msdownload",
      fileData: "AAAA",
    });
    expect(res.ok).toBe(false);
  });

  it("geçerli bir jpeg dosyasını kabul eder", () => {
    const res = validateUploadedFile({
      fileName: "a.jpg",
      fileMimeType: "image/jpeg",
      fileData: Buffer.from("hello world").toString("base64"),
    });
    expect(res.ok).toBe(true);
  });

  it("8MB'ı aşan dosyayı reddeder", () => {
    const big = Buffer.alloc(MAX_UPLOAD_BYTES + 1024).toString("base64");
    const res = validateUploadedFile({ fileName: "a.mp4", fileMimeType: "video/mp4", fileData: big });
    expect(res.ok).toBe(false);
  });

  it("boş içerikli dosyayı reddeder", () => {
    const res = validateUploadedFile({ fileName: "a.png", fileMimeType: "image/png", fileData: "" });
    expect(res.ok).toBe(false);
  });
});

describe("base64ByteSize", () => {
  it("bilinen bir string için doğru boyutu hesaplar", () => {
    const base64 = Buffer.from("hello world").toString("base64"); // 11 bayt
    expect(base64ByteSize(base64)).toBe(11);
  });

  it("data URI önekini atlayarak hesaplar", () => {
    const base64 = Buffer.from("hello").toString("base64");
    expect(base64ByteSize(`data:image/png;base64,${base64}`)).toBe(5);
  });
});
