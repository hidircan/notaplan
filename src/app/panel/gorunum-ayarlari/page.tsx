import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { requireSessionContext } from "@/lib/auth/session";
import { THEME_PROFILE_COOKIE, FONT_COOKIE, normalizeThemeProfile, normalizeFontChoice } from "@/lib/theme";
import { PageHeader } from "@/components/ui";
import { ThemePreferencesForm } from "@/components/theme-preferences-form";

export const dynamic = "force-dynamic";

/** Kişisel görünüm tercihi — kurum genelini değiştirmez, yalnızca bu tarayıcı/kullanıcıya aittir. */
export default async function AppearanceSettingsPage() {
  try {
    await requireSessionContext();
  } catch {
    redirect("/login?next=/panel/gorunum-ayarlari");
  }

  const jar = await cookies();
  const profile = normalizeThemeProfile(jar.get(THEME_PROFILE_COOKIE)?.value);
  const font = normalizeFontChoice(jar.get(FONT_COOKIE)?.value);

  return (
    <div>
      <PageHeader
        title="Görünüm Ayarları"
        description="Renk teması ve yazı tipini kişisel tercihinize göre seçin — canlı önizleme ile."
      />
      <ThemePreferencesForm initialProfile={profile} initialFont={font} />
    </div>
  );
}
