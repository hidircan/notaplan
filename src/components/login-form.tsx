"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Input, Label } from "@/components/ui";

export function LoginForm({ nextPath }: { nextPath?: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("admin@niluferacar.com.tr");
  const [password, setPassword] = useState("demo-admin");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
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

  return (
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
  );
}
