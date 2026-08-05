import { describe, it, expect } from "vitest";
import {
  normalizeThemeProfile,
  normalizeFontChoice,
  THEME_PROFILE_VALUES,
  FONT_VALUES,
  THEME_PROFILE_COOKIE,
  FONT_COOKIE,
  DEFAULT_THEME_PROFILE,
  DEFAULT_FONT_CHOICE,
} from "../theme";

describe("normalizeThemeProfile — varsayılan Kurumsal Altın", () => {
  it("cookie yoksa/geçersizse 'gold'a düşer, asla hata fırlatmaz", () => {
    expect(normalizeThemeProfile(undefined)).toBe("gold");
    expect(normalizeThemeProfile(null)).toBe("gold");
    expect(normalizeThemeProfile("")).toBe("gold");
    expect(normalizeThemeProfile("neon-purple")).toBe("gold");
  });

  it("geçerli dört profili aynen korur", () => {
    for (const p of THEME_PROFILE_VALUES) {
      expect(normalizeThemeProfile(p)).toBe(p);
    }
  });
});

describe("normalizeFontChoice — varsayılan Kurumsal Sans", () => {
  it("cookie yoksa/geçersizse 'corporate'a düşer", () => {
    expect(normalizeFontChoice(undefined)).toBe("corporate");
    expect(normalizeFontChoice("comic-sans")).toBe("corporate");
  });

  it("geçerli üç font seçeneğini aynen korur", () => {
    for (const f of FONT_VALUES) {
      expect(normalizeFontChoice(f)).toBe(f);
    }
  });
});

describe("Sabitler", () => {
  it("THEME_PROFILE_VALUES tam olarak dört profili içerir", () => {
    expect(THEME_PROFILE_VALUES).toEqual(["gold", "navy", "forest", "burgundy"]);
  });

  it("FONT_VALUES tam olarak üç fontu içerir", () => {
    expect(FONT_VALUES).toEqual(["corporate", "modern", "classic"]);
  });

  it("cookie isimleri kurum/oturum cookie'leriyle çakışmaz", () => {
    expect(THEME_PROFILE_COOKIE).toBe("notaplan_theme_profile");
    expect(FONT_COOKIE).toBe("notaplan_font");
  });

  it("varsayılanlar Kurumsal Altın + Kurumsal Sans'tır", () => {
    expect(DEFAULT_THEME_PROFILE).toBe("gold");
    expect(DEFAULT_FONT_CHOICE).toBe("corporate");
  });
});

describe("Görünüm tercihi kurum/yetki kararlarından bağımsızdır", () => {
  it("normalizeThemeProfile/normalizeFontChoice hiçbir rol, tenant veya oturum parametresi almaz", () => {
    expect(normalizeThemeProfile.length).toBe(1);
    expect(normalizeFontChoice.length).toBe(1);
  });
});
