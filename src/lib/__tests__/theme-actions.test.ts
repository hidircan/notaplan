import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * actionSetThemeProfile/actionSetFont/actionResetThemePreferences oturum
 * GEREKTİRMEMELİDİR (login ekranında da çalışsın diye) ve hiçbir kurum/
 * yetki modülüne dokunmamalıdır.
 */
const setCalls: { name: string; value: string }[] = [];
const deleteCalls: string[] = [];

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: () => undefined,
    set: (name: string, value: string) => {
      setCalls.push({ name, value });
    },
    delete: (name: string) => {
      deleteCalls.push(name);
    },
  }),
}));

vi.mock("next/cache", () => ({
  revalidatePath: () => {},
}));

const actions = await import("../actions");

beforeEach(() => {
  setCalls.length = 0;
  deleteCalls.length = 0;
});

describe("actionSetThemeProfile — oturumdan/kurumdan bağımsız", () => {
  it("oturum olmadan çalışır ve geçerli profili kaydeder", async () => {
    await expect(actions.actionSetThemeProfile("navy")).resolves.toBeUndefined();
    expect(setCalls).toHaveLength(1);
    expect(setCalls[0]).toEqual({ name: "notaplan_theme_profile", value: "navy" });
  });

  it("geçersiz bir değer sessizce 'gold'a normalize edilir", async () => {
    await actions.actionSetThemeProfile("neon-glow");
    expect(setCalls.at(-1)).toEqual({ name: "notaplan_theme_profile", value: "gold" });
  });
});

describe("actionSetFont — oturumdan/kurumdan bağımsız", () => {
  it("geçerli dört fontu aynen kaydeder", async () => {
    await actions.actionSetFont("playfair_display");
    expect(setCalls.at(-1)).toEqual({ name: "notaplan_font", value: "playfair_display" });
    await actions.actionSetFont("roboto_serif");
    expect(setCalls.at(-1)).toEqual({ name: "notaplan_font", value: "roboto_serif" });
    await actions.actionSetFont("noto_sans");
    expect(setCalls.at(-1)).toEqual({ name: "notaplan_font", value: "noto_sans" });
  });

  it("geçersiz bir değer sessizce 'inter'e normalize edilir", async () => {
    await actions.actionSetFont("comic-sans");
    expect(setCalls.at(-1)).toEqual({ name: "notaplan_font", value: "inter" });
  });
});

describe("actionResetThemePreferences", () => {
  it("her iki cookie'yi de siler", async () => {
    await actions.actionResetThemePreferences();
    expect(deleteCalls).toEqual(["notaplan_theme_profile", "notaplan_font"]);
  });
});
