/**
 * Görünüm tercihi kimlik doğrulama/kurum kapsamından tamamen bağımsızdır —
 * yalnızca görsel bir tercihtir, hiçbir yetki/kurum/veri kararını etkilemez.
 * Kullanıcının kişisel tercihi olarak saklanır (kurum genelini değiştirmez).
 *
 * Kasıtlı olarak dark mode YOK — her profil AÇIK bir zemin üzerine kurulu
 * "Tema Profili"dir (renk + tipografi birlikte), yalnız bir açık/koyu
 * anahtarı değil.
 */
export type ThemeProfile = "gold" | "navy" | "forest" | "burgundy";
export type FontChoice = "corporate" | "modern" | "classic";

export const THEME_PROFILE_COOKIE = "notaplan_theme_profile";
export const FONT_COOKIE = "notaplan_font";

export const THEME_PROFILE_VALUES: readonly ThemeProfile[] = ["gold", "navy", "forest", "burgundy"];
export const FONT_VALUES: readonly FontChoice[] = ["corporate", "modern", "classic"];

export const THEME_PROFILE_LABELS: Record<ThemeProfile, string> = {
  gold: "Kurumsal Altın",
  navy: "Lacivert Kurumsal",
  forest: "Orman Yeşili",
  burgundy: "Bordo Klasik",
};

export const FONT_LABELS: Record<FontChoice, string> = {
  corporate: "Kurumsal Sans",
  modern: "Modern Sans",
  classic: "Klasik Sans",
};

export const DEFAULT_THEME_PROFILE: ThemeProfile = "gold";
export const DEFAULT_FONT_CHOICE: FontChoice = "corporate";

/** Bilinmeyen/eksik bir cookie değerini güvenle varsayılana indirger — asla hata fırlatmaz. */
export function normalizeThemeProfile(value: string | undefined | null): ThemeProfile {
  return (THEME_PROFILE_VALUES as readonly string[]).includes(value ?? "")
    ? (value as ThemeProfile)
    : DEFAULT_THEME_PROFILE;
}

export function normalizeFontChoice(value: string | undefined | null): FontChoice {
  return (FONT_VALUES as readonly string[]).includes(value ?? "") ? (value as FontChoice) : DEFAULT_FONT_CHOICE;
}
