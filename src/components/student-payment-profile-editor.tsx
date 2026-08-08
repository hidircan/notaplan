"use client";

/**
 * Package C — öğrenci detayında paket/süre/indirim/ödeme günü/türü ve
 * (yalnızca yetkili yönetici) manuel nihai ücret override'ı. Yalnızca
 * SCHOOL_ADMIN/SUPER_ADMIN render edilir (çağıran taraftan); backend'de de
 * yalnız bu roller yazabilir (`updateStudentPaymentProfileTool` RBAC'ı) —
 * bu bileşen ikinci bir savunma katmanıdır, tek kaynak değildir. Canlı
 * önizleme aynı `computeMonthlyFee` helper'ını kullanır; kaydedilen değer
 * her zaman sunucuda yeniden hesaplanır.
 */

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Input, Label, Select } from "@/components/ui";
import { actionUpdateStudentPaymentProfile } from "@/lib/actions";
import { computeMonthlyFee } from "@/lib/packages";
import { LESSON_DURATION_OPTIONS } from "@/lib/lesson-duration";
import type { PricingPackageOption } from "./student-package-pricing-fields";

function formatTL(amount: number): string {
  return `${amount.toLocaleString("tr-TR")} TL`;
}

export function StudentPaymentProfileEditor({
  studentId,
  packages,
  initial,
}: {
  studentId: string;
  packages: PricingPackageOption[];
  initial: {
    packageId?: string;
    lessonDurationMinutes?: number;
    discountType?: "percent" | "amount";
    discountValue?: number;
    paymentMethod?: "cash" | "transfer" | "credit_card";
    paymentDueDay?: number;
    monthlyFee: number;
    monthlyFeeManualOverride?: boolean;
  };
}) {
  const router = useRouter();
  const [packageId, setPackageId] = useState(initial.packageId ?? "");
  const [duration, setDuration] = useState(initial.lessonDurationMinutes ?? 40);
  const [discountType, setDiscountType] = useState<"" | "percent" | "amount">(initial.discountType ?? "");
  const [discountValue, setDiscountValue] = useState(initial.discountValue ? String(initial.discountValue) : "");
  const [paymentMethod, setPaymentMethod] = useState<"" | "cash" | "transfer" | "credit_card">(
    initial.paymentMethod ?? ""
  );
  const [paymentDueDay, setPaymentDueDay] = useState(initial.paymentDueDay ? String(initial.paymentDueDay) : "");
  const [overrideAmount, setOverrideAmount] = useState("");
  const [overrideReason, setOverrideReason] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const selectedPackage = packages.find((p) => p.id === packageId);
  const computation = useMemo(() => {
    if (!selectedPackage) return null;
    const dv = discountType ? Number(discountValue) : undefined;
    return computeMonthlyFee({
      pkg: selectedPackage,
      durationMinutes: duration as 30 | 40 | 50,
      discountType: discountType || undefined,
      discountValue: dv && Number.isFinite(dv) && dv > 0 ? dv : undefined,
    });
  }, [selectedPackage, duration, discountType, discountValue]);

  function onSave() {
    setError(null);
    setSaved(false);
    const overrideNum = overrideAmount ? Number(overrideAmount) : undefined;
    startTransition(async () => {
      const result = await actionUpdateStudentPaymentProfile({
        studentId,
        packageId: packageId || undefined,
        lessonDurationMinutes: selectedPackage ? duration : undefined,
        discountType: selectedPackage && discountType ? discountType : undefined,
        discountValue:
          selectedPackage && discountType && discountValue ? Number(discountValue) : undefined,
        paymentMethod: paymentMethod || undefined,
        paymentDueDay: paymentDueDay ? Number(paymentDueDay) : undefined,
        monthlyFeeOverrideAmount: overrideNum,
        monthlyFeeOverrideReason: overrideReason || undefined,
      });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setSaved(true);
      setOverrideAmount("");
      setOverrideReason("");
      router.refresh();
    });
  }

  return (
    <div className="space-y-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
      <div>
        <Label>Paket</Label>
        <Select name="packageId" value={packageId} onChange={(e) => setPackageId(e.target.value)}>
          <option value="">Seçilmedi (serbest ücret)</option>
          {packages.map((p) => (
            <option key={p.id} value={p.id}>
              {p.title}
            </option>
          ))}
        </Select>
      </div>

      {selectedPackage ? (
        <>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Ders süresi</Label>
              <Select value={duration} onChange={(e) => setDuration(Number(e.target.value))}>
                {LESSON_DURATION_OPTIONS.map((d) => (
                  <option key={d} value={d}>
                    {d} dk
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label>İndirim türü</Label>
              <Select
                value={discountType}
                onChange={(e) => setDiscountType(e.target.value as "" | "percent" | "amount")}
              >
                <option value="">İndirim yok</option>
                <option value="percent">Yüzde (%)</option>
                <option value="amount">Tutar (TL)</option>
              </Select>
            </div>
          </div>
          {discountType ? (
            <div>
              <Label>İndirim değeri</Label>
              <Input
                type="number"
                min={0}
                value={discountValue}
                onChange={(e) => setDiscountValue(e.target.value)}
              />
            </div>
          ) : null}
          <div className="rounded-md bg-[var(--color-bg)] p-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-[var(--color-text-muted)]">Liste fiyatı</span>
              <span className="font-medium">{formatTL(computation?.baseMonthlyFee ?? 0)}</span>
            </div>
            {computation && computation.discountAmount > 0 ? (
              <div className="flex items-center justify-between text-emerald-700 dark:text-emerald-400">
                <span>İndirim</span>
                <span className="font-medium">−{formatTL(computation.discountAmount)}</span>
              </div>
            ) : null}
            <div className="mt-1 flex items-center justify-between border-t border-[var(--color-border)] pt-1 font-semibold">
              <span>Hesaplanan nihai ücret</span>
              <span>{formatTL(computation?.finalMonthlyFee ?? 0)}</span>
            </div>
          </div>
        </>
      ) : null}

      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label>Ödeme türü</Label>
          <Select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as typeof paymentMethod)}>
            <option value="">Belirtilmemiş</option>
            <option value="cash">Nakit</option>
            <option value="transfer">Havale</option>
            <option value="credit_card">Kredi Kartı</option>
          </Select>
        </div>
        <div>
          <Label>Ödeme günü (1–31)</Label>
          <Input
            type="number"
            min={1}
            max={31}
            value={paymentDueDay}
            onChange={(e) => setPaymentDueDay(e.target.value)}
          />
        </div>
      </div>

      <div className="rounded-md border border-amber-200 bg-amber-50/50 p-2 dark:border-amber-800 dark:bg-amber-950/20">
        <p className="mb-2 text-xs font-medium text-amber-800 dark:text-amber-300">
          Manuel nihai ücret (opsiyonel) — mevcut: {formatTL(initial.monthlyFee)}
          {initial.monthlyFeeManualOverride ? " (elle girilmiş)" : ""}
        </p>
        <div className="grid grid-cols-2 gap-2">
          <Input
            type="number"
            min={0}
            placeholder="Yeni tutar"
            value={overrideAmount}
            onChange={(e) => setOverrideAmount(e.target.value)}
          />
          <Input
            placeholder="Gerekçe (zorunlu)"
            value={overrideReason}
            onChange={(e) => setOverrideReason(e.target.value)}
          />
        </div>
      </div>

      <Button type="button" variant="secondary" disabled={pending} onClick={onSave}>
        {pending ? "Kaydediliyor…" : "Ödeme profilini kaydet"}
      </Button>
      {error ? <p className="text-xs font-medium text-rose-600">{error}</p> : null}
      {saved ? <p className="text-xs font-medium text-emerald-600">Kaydedildi.</p> : null}
    </div>
  );
}
