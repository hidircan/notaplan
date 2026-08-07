"use client";

/**
 * ÖNCELİK 4 (devam) — Yönetilebilir Enstrüman Kataloğu ekranı. Sabit temel
 * liste salt-okunur gösterilir (asla pasife alınamaz — TS tipinin
 * güvencesidir); kurumun eklediği ek enstrümanlar burada yönetilir.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { actionCreateInstrument, actionUpdateInstrument } from "@/lib/actions";
import { Badge, Button, Card, Input, Label } from "@/components/ui";
import type { InstrumentCatalogEntry } from "@/lib/types";

export function InstrumentCatalogManager({
  entries,
  staticInstruments,
  canWrite,
}: {
  entries: InstrumentCatalogEntry[];
  staticInstruments: string[];
  canWrite: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  async function onCreate(formData: FormData) {
    setFormError(null);
    startTransition(async () => {
      const result = await actionCreateInstrument(formData);
      if (!result.ok) {
        setFormError(result.message);
        return;
      }
      router.refresh();
    });
  }

  function toggleStatus(entry: InstrumentCatalogEntry) {
    startTransition(async () => {
      const result = await actionUpdateInstrument({
        entryId: entry.id,
        status: entry.status === "active" ? "archived" : "active",
      });
      if (!result.ok) {
        setFormError(result.message);
        return;
      }
      router.refresh();
    });
  }

  function saveRename(entry: InstrumentCatalogEntry) {
    startTransition(async () => {
      const result = await actionUpdateInstrument({ entryId: entry.id, name: editName });
      if (!result.ok) {
        setFormError(result.message);
        return;
      }
      setEditingId(null);
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      {!canWrite ? (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Bu ekranı yalnızca yöneticiler düzenleyebilir.
        </p>
      ) : null}

      <Card>
        <h2 className="mb-3 font-semibold text-[var(--color-text)]">Temel enstrümanlar (sabit)</h2>
        <div className="flex flex-wrap gap-2">
          {staticInstruments.map((i) => (
            <Badge key={i}>{i}</Badge>
          ))}
        </div>
        <p className="mt-2 text-[11px] text-[var(--color-text-muted)]">
          Bu liste sistemin temelidir ve buradan pasife alınamaz. Kuruma özel ek enstrümanları aşağıda yönetin.
        </p>
      </Card>

      <Card>
        <h2 className="mb-3 font-semibold text-[var(--color-text)]">Kuruma özel enstrümanlar</h2>
        {entries.length === 0 ? (
          <p className="text-sm text-[var(--color-text-muted)]">Henüz ek enstrüman tanımlanmamış.</p>
        ) : (
          <div className="space-y-2">
            {entries.map((entry) => (
              <div
                key={entry.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--color-border)] p-2.5"
              >
                {editingId === entry.id ? (
                  <div className="flex flex-1 items-center gap-2">
                    <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="!w-auto flex-1" />
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => saveRename(entry)}
                      className="rounded-md border border-stone-300 bg-white px-2.5 py-1 text-xs font-semibold text-stone-800 hover:border-[#A56A00] hover:bg-[#fbf6ee]"
                    >
                      Kaydet
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      className="rounded-md border border-stone-300 bg-white px-2.5 py-1 text-xs font-semibold text-stone-800"
                    >
                      Vazgeç
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-[var(--color-text)]">{entry.name}</span>
                    <Badge status={entry.status === "active" ? "confirmed" : "archived"}>
                      {entry.status === "active" ? "Aktif" : "Pasif"}
                    </Badge>
                  </div>
                )}
                {canWrite && editingId !== entry.id ? (
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(entry.id);
                        setEditName(entry.name);
                      }}
                      className="rounded-md border border-stone-300 bg-white px-2.5 py-1 text-xs font-semibold text-stone-800 hover:border-[#A56A00] hover:bg-[#fbf6ee]"
                    >
                      Düzenle
                    </button>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => toggleStatus(entry)}
                      className="rounded-md border border-stone-300 bg-white px-2.5 py-1 text-xs font-semibold text-stone-800 hover:border-[#A56A00] hover:bg-[#fbf6ee] disabled:opacity-50"
                    >
                      {entry.status === "active" ? "Pasife Al" : "Aktifleştir"}
                    </button>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </Card>

      {canWrite ? (
        <Card>
          <h2 className="mb-3 font-semibold text-[var(--color-text)]">Yeni enstrüman ekle</h2>
          <form action={onCreate} className="flex flex-wrap items-end gap-2">
            <div className="flex-1">
              <Label>Enstrüman adı</Label>
              <Input name="name" required placeholder="Örn. Ukulele" />
            </div>
            {formError ? <p className="w-full text-xs font-medium text-[#8b3a3a]">{formError}</p> : null}
            <Button type="submit" disabled={pending}>
              {pending ? "Ekleniyor…" : "Ekle"}
            </Button>
          </form>
        </Card>
      ) : null}
    </div>
  );
}
