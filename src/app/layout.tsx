import type { Metadata } from "next";
import { cookies } from "next/headers";
import "./globals.css";
import { THEME_PROFILE_COOKIE, FONT_COOKIE, normalizeThemeProfile, normalizeFontChoice } from "@/lib/theme";
import { AssistantProvider } from "@/components/ai/assistant-context";
import { GlobalAssistant } from "@/components/ai/global-assistant";

export const metadata: Metadata = {
  title: "NotaPlan — Müzik Okulu Yönetimi",
  description:
    "Nilüfer Acar Müzik Akademisi ve tüm müzik okulları için telafi planlama, program, yoklama ve ödeme SaaS.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const jar = await cookies();
  const themeProfile = normalizeThemeProfile(jar.get(THEME_PROFILE_COOKIE)?.value);
  const font = normalizeFontChoice(jar.get(FONT_COOKIE)?.value);

  return (
    <html lang="tr" className="h-full antialiased" data-theme-profile={themeProfile} data-font={font}>
      <body className="min-h-full">
        <AssistantProvider>
          {children}
          <GlobalAssistant />
        </AssistantProvider>
      </body>
    </html>
  );
}
