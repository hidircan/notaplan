"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Input, Label } from "@/components/ui";

type DemoPersona = {
  label: string;
  hint: string;
  email: string;
  password: string;
};

const DEMO_PERSONAS: DemoPersona[] = [
  {
    label: "Okul yöneticisi",
    hint: "Tüm paneli yönetir",
    email: "admin@niluferacar.com.tr",
    password: "demo-admin",
  },
  {
    label: "Öğretmen — Can Yılmaz",
    hint: "Bugünkü yoklamayı girer",
    email: "can@niluferacar.com.tr",
    password: "demo-teacher",
  },
  {
    label: "Veli — Zeynep'in velisi",
    hint: "Ödemesi güncel, açık aksiyon yok",
    email: "selin@email.com",
    password: "demo-parent",
  },
  {
    label: "Veli — Lara'nın velisi",
    hint: "Gecikmiş ödeme + açık telafi",
    email: "deniz@email.com",
    password: "demo-parent",
  },
  {
    label: "Veli — Ali'nin velisi",
    hint: "Kısmi ödeme + telafi",
    email: "mehmet@email.com",
    password: "demo-parent",
  },
];

export function LoginForm({ nextPath }: { nextPath?: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("admin@niluferacar.com.tr");
  const [password, setPassword] = useState("demo-admin");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function performLogin(loginEmail: string, loginPassword: string) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email: loginEmail, password: loginPassword }),
      });
      const json = (await res.json()) as {
        ok: boolean;
        data?: { user: { role: string } };
        error?: { message: string };
      };
      if (!json.ok) {
        setError(json.error?.message || "Giriş başarısız");
        setLoading(false);
        return;
      }

      const role = json.data?.user.role;
      let dest = nextPath || "/panel";
      if (!nextPath) {
        if (role === "TEACHER") dest = "/ogretmen";
        else if (role === "PARENT") dest = "/veli";
        else dest = "/panel";
      }
      router.replace(dest);
      router.refresh();
    } catch {
      setError("Bağlantı hatası");
      setLoading(false);
    }
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    void performLogin(email, password);
  }

  function onDemoSelect(persona: DemoPersona) {
    setEmail(persona.email);
    setPassword(persona.password);
    void performLogin(persona.email, persona.password);
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-violet-300">
          Demo ile giriş
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          {DEMO_PERSONAS.map((p) => (
            <button
              key={p.email}
              type="button"
              disabled={loading}
              onClick={() => onDemoSelect(p)}
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-left text-xs text-slate-200 hover:bg-white/10 disabled:opacity-50"
            >
              <span className="block font-medium text-white">{p.label}</span>
              <span className="block text-slate-400">{p.hint}</span>
            </button>
          ))}
        </div>
        <p className="mt-2 text-[11px] text-slate-500">
          Bu hızlı seçenekler yalnızca demo amaçlıdır; gerçek kullanıcılar kendi e-posta/şifresiyle giriş yapar.
        </p>
      </div>

      <div className="flex items-center gap-3 text-[11px] text-slate-500">
        <span className="h-px flex-1 bg-white/10" />
        veya e-posta / şifre ile
        <span className="h-px flex-1 bg-white/10" />
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <Label>E-posta</Label>
          <Input
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="border-white/10 bg-white/5 text-white"
          />
        </div>
        <div>
          <Label>Şifre</Label>
          <Input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="border-white/10 bg-white/5 text-white"
          />
        </div>
        {error ? (
          <p className="rounded-xl bg-rose-500/15 px-3 py-2 text-sm text-rose-200">{error}</p>
        ) : null}
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "Giriş yapılıyor…" : "Giriş yap"}
        </Button>
      </form>
    </div>
  );
}
