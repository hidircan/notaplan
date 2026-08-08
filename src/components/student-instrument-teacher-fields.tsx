"use client";

/**
 * MT-003 — öğrenci oluşturma formunda enstrümana göre öğretmen filtresi.
 * Native `<select name="instrument">`/`<select name="teacherId">` olarak
 * KALIR (form submit'i `actionAddStudent`'ın beklediği düz FormData alanları
 * — hiçbir gizli JSON kablolaması yok); yalnızca hangi `<option>`'ların
 * gösterileceği istemcide anlık filtrelenir. Gerçek yetki/uyumluluk
 * doğrulaması SUNUCUDA (createStudentTool) AYRICA yapılır — bu filtre
 * yalnızca UX kolaylığı, güvenlik sınırı DEĞİL.
 */

import { useState } from "react";
import { Label, Select } from "@/components/ui";

export type TeacherOption = { id: string; name: string; active: boolean; instruments: string[] };

export function StudentInstrumentTeacherFields({
  instrumentOptions,
  teachers,
  defaultInstrument,
  defaultTeacherId,
}: {
  instrumentOptions: string[];
  teachers: TeacherOption[];
  defaultInstrument?: string;
  defaultTeacherId?: string;
}) {
  const [instrument, setInstrument] = useState(defaultInstrument || instrumentOptions[0] || "");

  // Enstrüman boşsa (kural 2) mevcut güvenli davranış: aktif öğretmen
  // listesini daraltma, hepsini göster.
  const activeTeachers = teachers.filter((t) => t.active);
  const filteredTeachers = instrument
    ? activeTeachers.filter((t) => t.instruments.includes(instrument))
    : activeTeachers;

  return (
    <>
      <div>
        <Label>Enstrüman</Label>
        <Select name="instrument" value={instrument} onChange={(e) => setInstrument(e.target.value)}>
          {instrumentOptions.map((i) => (
            <option key={i} value={i}>
              {i}
            </option>
          ))}
        </Select>
      </div>
      <div>
        <Label>Öğretmen</Label>
        {filteredTeachers.length === 0 ? (
          <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
            &quot;{instrument}&quot; öğretebilen aktif bir öğretmen yok. Önce Öğretmenler ekranından bu enstrümanı
            ekleyin/aktif edin.
          </p>
        ) : (
          <Select name="teacherId" defaultValue={defaultTeacherId} key={instrument}>
            {filteredTeachers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} ({t.instruments.join(", ")})
              </option>
            ))}
          </Select>
        )}
      </div>
    </>
  );
}
