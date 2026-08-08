"use client";

/**
 * Öğrenci detayındaki temel iletişim/kişisel alanları düzenler — bu turdan
 * önce yalnız termType (StudentTermTypeEditor) ve paket/ödeme profili
 * (StudentPaymentProfileEditor) düzenlenebiliyordu; veli/telefon/adres/
 * doğum bilgisi/okul-meslek yalnız oluşturma anında girilip sonra HİÇ
 * değiştirilemiyordu. Aynı `updateStudentProfileTool` (SCHOOL_ADMIN/
 * SUPER_ADMIN RBAC'ı) üzerinden — ikinci bir yazma yolu yok. T.C. kimlik
 * BU bileşende YOK (ayrı, mevcut şifreleme/audit akışı — bkz. öğrenci
 * create formu deseni).
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Input, Label } from "@/components/ui";
import { actionUpdateStudentProfile } from "@/lib/actions";

export function StudentProfileEditor({
  studentId,
  initial,
}: {
  studentId: string;
  initial: {
    phone: string;
    parentName: string;
    parentPhone: string;
    address?: string;
    birthDate?: string;
    birthPlace?: string;
    schoolOrOccupation?: string;
    communicationOptOut?: boolean;
  };
}) {
  const router = useRouter();
  const [phone, setPhone] = useState(initial.phone);
  const [parentName, setParentName] = useState(initial.parentName);
  const [parentPhone, setParentPhone] = useState(initial.parentPhone);
  const [address, setAddress] = useState(initial.address ?? "");
  const [birthDate, setBirthDate] = useState(initial.birthDate?.slice(0, 10) ?? "");
  const [birthPlace, setBirthPlace] = useState(initial.birthPlace ?? "");
  const [schoolOrOccupation, setSchoolOrOccupation] = useState(initial.schoolOrOccupation ?? "");
  const [communicationOptOut, setCommunicationOptOut] = useState(!!initial.communicationOptOut);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function onSave() {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await actionUpdateStudentProfile({
        studentId,
        phone,
        parentName,
        parentPhone,
        address: address || undefined,
        birthDate: birthDate || undefined,
        birthPlace: birthPlace || undefined,
        schoolOrOccupation: schoolOrOccupation || undefined,
        communicationOptOut,
      });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setSaved(true);
      router.refresh();
    });
  }

  return (
    <div className="space-y-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label>Öğrenci telefonu</Label>
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="05xx xxx xxxx" />
        </div>
        <div>
          <Label>Doğum tarihi</Label>
          <Input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label>Veli adı</Label>
          <Input value={parentName} onChange={(e) => setParentName(e.target.value)} />
        </div>
        <div>
          <Label>Veli telefonu</Label>
          <Input value={parentPhone} onChange={(e) => setParentPhone(e.target.value)} placeholder="05xx xxx xxxx" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label>Doğum yeri</Label>
          <Input value={birthPlace} onChange={(e) => setBirthPlace(e.target.value)} />
        </div>
        <div>
          <Label>Okulu / mesleği</Label>
          <Input value={schoolOrOccupation} onChange={(e) => setSchoolOrOccupation(e.target.value)} />
        </div>
      </div>
      <div>
        <Label>Ev adresi</Label>
        <Input value={address} onChange={(e) => setAddress(e.target.value)} />
      </div>
      <label className="flex items-center gap-2 text-xs text-[var(--color-text)]">
        <input
          type="checkbox"
          checked={communicationOptOut}
          onChange={(e) => setCommunicationOptOut(e.target.checked)}
          className="h-3.5 w-3.5"
        />
        Otomatik tahsilat hatırlatma mesajlarından çıkarılsın (manuel iletişimi engellemez)
      </label>

      <Button type="button" variant="secondary" disabled={pending} onClick={onSave}>
        {pending ? "Kaydediliyor…" : "İletişim/kişisel bilgileri kaydet"}
      </Button>
      {error ? <p className="text-xs font-medium text-rose-600">{error}</p> : null}
      {saved ? <p className="text-xs font-medium text-emerald-600">Kaydedildi.</p> : null}
    </div>
  );
}
