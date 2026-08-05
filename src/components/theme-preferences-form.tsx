"use client";

import { useState, useTransition } from "react";
import {
  THEME_PROFILE_VALUES,
  FONT_VALUES,
  THEME_PROFILE_LABELS,
  FONT_LABELS,
  DEFAULT_THEME_PROFILE,
  DEFAULT_FONT_CHOICE,
  type ThemeProfile,
  type FontChoice,
} from "@/lib/theme";
import { actionSetThemeProfile, actionSetFont, actionResetThemePreferences } from "@/lib/actions";
import { Button, Card } from "@/components/ui";

const PROFILE_SWATCH: Record<ThemeProfile, string> = {
  gold: "#A56A00",
  navy: "#1e3a5f",
  forest: "#1f5c3f",
  burgundy: "#6b1f2b",
};

const FONT_PREVIEW_STYLE: Record<FontChoice, string> = {
  corporate: "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif",
  modern: "'Inter', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif",
  classic: "'Helvetica Neue', Helvetica, Arial, sans-serif",
};

export function ThemePreferencesForm({
  initialProfile,
  initialFont,
}: {
  initialProfile: ThemeProfile;
  initialFont: FontChoice;
}) {
  const [profile, setProfile] = useState<ThemeProfile>(initialProfile);
  const [font, setFont] = useState<FontChoice>(initialFont);
  const [, startTransition] = useTransition();

  function applyProfile(next: ThemeProfile) {
    setProfile(next);
    document.documentElement.setAttribute("data-theme-profile", next);
    startTransition(() => {
      void actionSetThemeProfile(next);
    });
  }

  function applyFont(next: FontChoice) {
    setFont(next);
    document.documentElement.setAttribute("data-font", next);
    startTransition(() => {
      void actionSetFont(next);
    });
  }

  function resetDefaults() {
    applyProfile(DEFAULT_THEME_PROFILE);
    applyFont(DEFAULT_FONT_CHOICE);
    startTransition(() => {
      void actionResetThemePreferences();
    });
  }

  return (
    <div className="space-y-6">
      <Card>
        <p className="mb-3 text-sm font-semibold text-[var(--color-text)]">Tema profili</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {THEME_PROFILE_VALUES.map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={profile === value}
              onClick={() => applyProfile(value)}
              className={`rounded-[var(--radius-lg)] border p-3 text-left transition ${
                profile === value
                  ? "border-[var(--color-primary)] ring-2 ring-[var(--color-focus-ring)]/30"
                  : "border-[var(--color-border-strong)] hover:border-[var(--color-primary)]"
              }`}
            >
              <span
                className="mb-2 block h-8 w-full rounded-[var(--radius-md)]"
                style={{ background: PROFILE_SWATCH[value] }}
                aria-hidden
              />
              <span className="text-sm font-medium text-[var(--color-text)]">{THEME_PROFILE_LABELS[value]}</span>
            </button>
          ))}
        </div>
      </Card>

      <Card>
        <p className="mb-3 text-sm font-semibold text-[var(--color-text)]">Yazı tipi</p>
        <div className="grid gap-3 sm:grid-cols-3">
          {FONT_VALUES.map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={font === value}
              onClick={() => applyFont(value)}
              className={`rounded-[var(--radius-lg)] border p-3 text-left transition ${
                font === value
                  ? "border-[var(--color-primary)] ring-2 ring-[var(--color-focus-ring)]/30"
                  : "border-[var(--color-border-strong)] hover:border-[var(--color-primary)]"
              }`}
            >
              <span className="block text-lg" style={{ fontFamily: FONT_PREVIEW_STYLE[value] }}>
                Aa Bb Cc
              </span>
              <span className="mt-1 block text-sm font-medium text-[var(--color-text)]">{FONT_LABELS[value]}</span>
            </button>
          ))}
        </div>
      </Card>

      <Button variant="secondary" onClick={resetDefaults}>
        Varsayılana Dön
      </Button>

      <p className="text-xs text-[var(--color-text-muted)]">
        Bu tercih yalnızca sizin oturumunuza aittir (tarayıcı cookie&apos;si) — kurum genelini veya diğer
        kullanıcıları etkilemez. Yetki, veri, rota ve filtre durumlarını değiştirmez.
      </p>
    </div>
  );
}
