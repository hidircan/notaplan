/**
 * Görünüm tercihi kimlik doğrulama/kurum kapsamından tamamen bağımsızdır —
 * yalnızca görsel bir tercihtir, hiçbir yetki/kurum/veri kararını etkilemez.
 * Kullanıcının kişisel tercihi olarak saklanır (kurum genelini değiştirmez).
 *
 * Kasıtlı olarak dark mode YOK (`@custom-variant dark` hiçbir yerde tetiklenmez,
 * bkz. globals.css) — ANCAK "obsidian" bir TEMA PROFİLİ olarak gerçekten koyu
 * render edilir (token bazlı, Tailwind dark: varyantından bağımsız). Cookie
 * ADLARI ("notaplan_...") teknik/uyumluluk identifier'ıdır, marka geçişinden
 * ETKİLENMEZ — bkz. src/lib/brand.ts.
 */
export type ThemeProfile = "gold" | "obsidian" | "navy" | "forest" | "burgundy" | "ocean" | "lavender";
export type FontChoice = "roboto_serif" | "playfair_display" | "inter" | "noto_sans";

export const THEME_PROFILE_COOKIE = "notaplan_theme_profile";
export const FONT_COOKIE = "notaplan_font";

export const THEME_PROFILE_VALUES: readonly ThemeProfile[] = [
  "gold",
  "obsidian",
  "navy",
  "forest",
  "burgundy",
  "ocean",
  "lavender",
];
export const FONT_VALUES: readonly FontChoice[] = ["roboto_serif", "playfair_display", "inter", "noto_sans"];

export const THEME_PROFILE_LABELS: Record<ThemeProfile, string> = {
  gold: "Kurumsal Altın",
  obsidian: "Gece Obsidyen",
  navy: "Lacivert Kurumsal",
  forest: "Orman Yeşili",
  burgundy: "Bordo Klasik",
  ocean: "Okyanus Mavisi",
  lavender: "Lavanta Grafit",
};

export const FONT_LABELS: Record<FontChoice, string> = {
  roboto_serif: "Roboto Serif",
  playfair_display: "Playfair Display",
  inter: "Inter",
  noto_sans: "Noto Sans",
};

export const DEFAULT_THEME_PROFILE: ThemeProfile = "gold";
export const DEFAULT_FONT_CHOICE: FontChoice = "inter";

/** Bilinmeyen/eksik bir cookie değerini güvenle varsayılana indirger — asla hata fırlatmaz. */
export function normalizeThemeProfile(value: string | undefined | null): ThemeProfile {
  return (THEME_PROFILE_VALUES as readonly string[]).includes(value ?? "")
    ? (value as ThemeProfile)
    : DEFAULT_THEME_PROFILE;
}

export function normalizeFontChoice(value: string | undefined | null): FontChoice {
  return (FONT_VALUES as readonly string[]).includes(value ?? "") ? (value as FontChoice) : DEFAULT_FONT_CHOICE;
}
