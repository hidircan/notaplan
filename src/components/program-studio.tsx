"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, Loader2, Sparkles, X } from "lucide-react";
import { format, parseISO, isSameDay, setHours, setMinutes } from "date-fns";
import { tr } from "date-fns/locale";
import { actionAddLesson, actionSuggestLessonSlots } from "@/lib/actions";
import type { LessonCommunicationMessage } from "@/lib/whatsapp-templates";
import type { LessonSlotSuggestion } from "@/lib/lesson-scheduling";
import { Badge, Button, Card, Input, Label, Select } from "@/components/ui";
import { INSTRUMENTS, type Instrument, type Lesson, type Room, type Student, type Teacher } from "@/lib/types";

type ProgramStudioProps = {
  students: Student[];
  teachers: Teacher[];
  rooms: Room[];
  branchNames: Record<string, string>;
  lessonDurationMinutes: number;
  workingHours: { start: string; end: string };
  days: string[];
  weekLessons: Lesson[];
  todayIso: string;
};

function toDatetimeLocalValue(iso: string) {
  return format(parseISO(iso), "yyyy-MM-dd'T'HH:mm");
}

function hourRange(workingHours: { start: string; end: string }) {
  const [startH] = workingHours.start.split(":").map(Number);
  const [endH, endM] = workingHours.end.split(":").map(Number);
  const lastHour = endM > 0 ? endH : endH - 1;
  const hours: number[] = [];
  for (let h = startH; h <= lastHour; h++) hours.push(h);
  return hours;
}

export function ProgramStudio({
  students,
  teachers,
  rooms,
  branchNames,
  lessonDurationMinutes,
  workingHours,
  days,
  weekLessons,
  todayIso,
}: ProgramStudioProps) {
  const router = useRouter();
  const hours = hourRange(workingHours);

  const [panelOpen, setPanelOpen] = useState(false);
  const [studentId, setStudentId] = useState("");
  const [teacherId, setTeacherId] = useState("");
  const [roomId, setRoomId] = useState("");
  const [instrument, setInstrument] = useState<Instrument>("Piyano");
  const [startAt, setStartAt] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [lastCreated, setLastCreated] = useState<{
    parent: LessonCommunicationMessage;
    teacher: LessonCommunicationMessage;
  } | null>(null);

  const [suggestLoading, setSuggestLoading] = useState(false);
  const [suggestError, setSuggestError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<LessonSlotSuggestion[] | null>(null);
  const [suggestLimit, setSuggestLimit] = useState(8);

  const selectedStudent = students.find((s) => s.id === studentId);
  const selectedTeacher = teachers.find((t) => t.id === teacherId);

  const instrumentOptions = selectedStudent?.instruments.length
    ? selectedStudent.instruments
    : INSTRUMENTS;

  const teacherOptions = [...teachers.filter((t) => t.active && t.instruments.includes(instrument))].sort(
    (a, b) => {
      if (selectedStudent) {
        if (a.id === selectedStudent.teacherId) return -1;
        if (b.id === selectedStudent.teacherId) return 1;
        if (a.branchId === selectedStudent.branchId && b.branchId !== selectedStudent.branchId) return -1;
        if (b.branchId === selectedStudent.branchId && a.branchId !== selectedStudent.branchId) return 1;
      }
      return a.name.localeCompare(b.name, "tr");
    }
  );

  const roomOptions = rooms.filter(
    (r) => r.instruments.includes(instrument) && (!selectedTeacher || r.branchId === selectedTeacher.branchId)
  );

  function resetPanelState() {
    setFormError(null);
    setSuggestions(null);
    setSuggestError(null);
  }

  function openPlanner(prefillStartAt?: string) {
    resetPanelState();
    setPanelOpen(true);
    if (prefillStartAt) setStartAt(prefillStartAt);
  }

  function openPlannerAtCell(dayIso: string, hour: number) {
    const day = parseISO(dayIso);
    const dt = setMinutes(setHours(day, hour), 0);
    openPlanner(format(dt, "yyyy-MM-dd'T'HH:mm"));
  }

  function selectStudent(id: string) {
    setStudentId(id);
    const student = students.find((s) => s.id === id);
    if (student) {
      setInstrument(student.instruments[0] ?? "Piyano");
      setTeacherId(student.teacherId);
    }
  }

  function selectInstrument(value: string) {
    setInstrument(value as Instrument);
    setRoomId("");
  }

  function selectTeacher(id: string) {
    setTeacherId(id);
    setRoomId("");
  }

  async function handleFindSlots() {
    setSuggestError(null);
    if (!studentId) {
      setSuggestError("Uygun saat aramak için önce öğrenci seçin.");
      return;
    }
    setSuggestLoading(true);
    const result = await actionSuggestLessonSlots({
      studentId,
      instrument,
      teacherId: teacherId || undefined,
      maxSlots: suggestLimit,
    });
    setSuggestLoading(false);
    if (!result.ok) {
      setSuggestError(result.message);
      return;
    }
    setSuggestions(result.suggestions);
  }

  function applySuggestion(s: LessonSlotSuggestion) {
    setTeacherId(s.teacherId);
    setRoomId(s.roomId);
    setStartAt(toDatetimeLocalValue(s.startAt));
    setSuggestions(null);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!studentId || !teacherId || !roomId || !startAt) {
      setFormError("Öğrenci, öğretmen, oda ve tarih/saat seçimi zorunludur.");
      return;
    }
    setSubmitting(true);
    const fd = new FormData();
    fd.set("studentId", studentId);
    fd.set("teacherId", teacherId);
    fd.set("roomId", roomId);
    fd.set("instrument", instrument);
    fd.set("startAt", startAt);
    const result = await actionAddLesson(fd);
    setSubmitting(false);
    if (!result.ok) {
      setFormError(result.message);
      return;
    }
    if (result.communication) setLastCreated(result.communication);
    setPanelOpen(false);
    setSuggestions(null);
    router.refresh();
  }

  return (
    <div>
      {lastCreated ? (
        <Card className="mb-4 border-emerald-200 bg-emerald-50/50">
          <div className="mb-3 flex items-center justify-between">
            <p className="font-semibold text-emerald-900">Ders planlandı. İletişim taslakları hazır.</p>
            <button
              type="button"
              onClick={() => setLastCreated(null)}
              className="text-emerald-700 hover:text-emerald-900"
              aria-label="Kapat"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <p className="mb-3 text-xs text-emerald-800">
            Hiçbir mesaj otomatik gönderilmedi. Aşağıdaki taslakları inceleyip isterseniz WhatsApp&apos;ta açabilirsiniz.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <CommunicationDraftCard label="Veliye taslak" msg={lastCreated.parent} />
            <CommunicationDraftCard label="Öğretmene taslak" msg={lastCreated.teacher} />
          </div>
        </Card>
      ) : null}

      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold text-slate-900">Haftalık program</h2>
        <Button onClick={() => openPlanner()}>Yeni ders planla</Button>
      </div>

      {panelOpen ? (
        <Card className="mb-6 border-violet-200">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-semibold text-slate-900">Ders planla</h3>
            <button
              type="button"
              onClick={() => setPanelOpen(false)}
              className="text-slate-400 hover:text-slate-700"
              aria-label="Kapat"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <Label>Öğrenci</Label>
              <Select value={studentId} onChange={(e) => selectStudent(e.target.value)} required>
                <option value="">Seçin…</option>
                {students
                  .filter((s) => s.active)
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
              </Select>
            </div>
            <div>
              <Label>Enstrüman</Label>
              <Select value={instrument} onChange={(e) => selectInstrument(e.target.value)}>
                {instrumentOptions.map((i) => (
                  <option key={i} value={i}>
                    {i}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Öğretmen</Label>
              <Select value={teacherId} onChange={(e) => selectTeacher(e.target.value)} required>
                <option value="">Seçin…</option>
                {teacherOptions.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                    {selectedStudent?.teacherId === t.id ? " · mevcut öğretmen" : ""}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Oda</Label>
              <Select value={roomId} onChange={(e) => setRoomId(e.target.value)} required>
                <option value="">Seçin…</option>
                {roomOptions.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Başlangıç tarihi/saati</Label>
              <Input
                type="datetime-local"
                value={startAt}
                onChange={(e) => setStartAt(e.target.value)}
                required
              />
              <p className="mt-1 text-[11px] text-slate-400">
                Süre: {lessonDurationMinutes} dk (okul ayarından otomatik, bitiş saati elle girilmez)
              </p>
            </div>
            <div className="flex items-end gap-2">
              <Button type="button" variant="secondary" onClick={handleFindSlots} disabled={suggestLoading}>
                {suggestLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                Uygun saatleri bul
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Dersi planla
              </Button>
            </div>

            {formError ? (
              <p className="sm:col-span-2 lg:col-span-3 text-sm text-rose-600">{formError}</p>
            ) : null}
          </form>

          {suggestError ? <p className="mt-3 text-sm text-rose-600">{suggestError}</p> : null}

          {suggestions ? (
            <div className="mt-4 border-t border-slate-100 pt-4">
              <p className="mb-3 text-sm font-medium text-slate-700">
                Uygun saatler {suggestions.length === 0 ? "bulunamadı" : `(${suggestions.length})`}
              </p>
              {suggestions.length === 0 ? (
                <p className="text-sm text-slate-500">
                  Önümüzdeki günlerde bu öğrenci/enstrüman için boş bir saat bulunamadı.
                </p>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  {suggestions.map((s) => {
                    const teacher = teachers.find((t) => t.id === s.teacherId);
                    const room = rooms.find((r) => r.id === s.roomId);
                    return (
                      <button
                        key={`${s.startAt}-${s.teacherId}-${s.roomId}`}
                        type="button"
                        onClick={() => applySuggestion(s)}
                        className="rounded-xl border border-slate-200 bg-white p-3 text-left text-xs hover:border-violet-300 hover:bg-violet-50"
                      >
                        <p className="font-semibold text-slate-900">
                          {format(parseISO(s.startAt), "d MMM, EEEE", { locale: tr })}
                        </p>
                        <p className="text-slate-600">{format(parseISO(s.startAt), "HH:mm")}</p>
                        <p className="mt-1 text-slate-500">
                          {teacher?.name} · {room?.name}
                        </p>
                        <p className="mt-1 text-[11px] text-violet-600">{s.reasons.join(" · ")}</p>
                      </button>
                    );
                  })}
                </div>
              )}
              <button
                type="button"
                onClick={() => {
                  setSuggestLimit((n) => n + 8);
                  void handleFindSlots();
                }}
                className="mt-3 text-xs font-medium text-violet-600 hover:text-violet-700"
              >
                Daha fazla göster
              </button>
            </div>
          ) : null}
        </Card>
      ) : null}

      <div className="hidden overflow-x-auto lg:block">
        <table className="w-full border-separate border-spacing-0 text-xs">
          <thead>
            <tr>
              <th className="w-16 border-b border-slate-100 bg-white p-2 text-left font-medium text-slate-400"></th>
              {days.map((dayIso) => {
                const day = parseISO(dayIso);
                const today = isSameDay(day, parseISO(todayIso));
                return (
                  <th
                    key={dayIso}
                    className={`border-b border-slate-100 p-2 text-left font-semibold ${
                      today ? "bg-violet-50 text-violet-700" : "text-slate-600"
                    }`}
                  >
                    {format(day, "EEEE", { locale: tr })}
                    <span className="ml-1 font-normal text-slate-400">{format(day, "d MMM")}</span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {hours.map((hour) => (
              <tr key={hour}>
                <td className="border-b border-slate-50 p-2 align-top font-medium text-slate-400">
                  {String(hour).padStart(2, "0")}:00
                </td>
                {days.map((dayIso) => {
                  const day = parseISO(dayIso);
                  const today = isSameDay(day, parseISO(todayIso));
                  const cellLessons = weekLessons.filter((l) => {
                    const start = parseISO(l.startAt);
                    return isSameDay(start, day) && start.getHours() === hour;
                  });
                  return (
                    <td
                      key={dayIso}
                      className={`min-w-[140px] border-b border-slate-50 p-1 align-top ${
                        today ? "bg-violet-50/30" : ""
                      }`}
                    >
                      <div className="space-y-1">
                        {cellLessons.map((lesson) => {
                          const student = students.find((s) => s.id === lesson.studentId);
                          const teacher = teachers.find((t) => t.id === lesson.teacherId);
                          const room = rooms.find((r) => r.id === lesson.roomId);
                          return (
                            <div
                              key={lesson.id}
                              className="rounded-lg border border-slate-100 bg-slate-50 p-1.5"
                              style={{ borderLeft: `3px solid ${teacher?.color ?? "#7c3aed"}` }}
                            >
                              <p className="font-semibold text-slate-800">
                                {format(parseISO(lesson.startAt), "HH:mm")} {lesson.instrument}
                              </p>
                              <p className="text-slate-600">{student?.name}</p>
                              <p className="text-slate-400">
                                {teacher?.name} · {room?.name}
                              </p>
                              <Badge status={lesson.type === "makeup" ? "makeup" : lesson.status} />
                            </div>
                          );
                        })}
                        <button
                          type="button"
                          onClick={() => openPlannerAtCell(dayIso, hour)}
                          className="w-full rounded-lg border border-dashed border-slate-200 py-1 text-[11px] text-slate-400 hover:border-violet-300 hover:text-violet-600"
                        >
                          + Ders planla
                        </button>
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid gap-3 lg:hidden">
        {days.map((dayIso) => {
          const day = parseISO(dayIso);
          const today = isSameDay(day, parseISO(todayIso));
          const dayLessons = weekLessons
            .filter((l) => isSameDay(parseISO(l.startAt), day))
            .sort((a, b) => a.startAt.localeCompare(b.startAt));
          return (
            <Card key={dayIso} className={today ? "border-violet-200 bg-violet-50/30" : undefined}>
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-900">
                  {format(day, "EEEE d MMM", { locale: tr })}
                </p>
                {today ? <Badge status="scheduled">Bugün</Badge> : null}
              </div>
              {dayLessons.length === 0 ? (
                <p className="text-xs text-slate-400">Boş</p>
              ) : (
                <div className="space-y-2">
                  {dayLessons.map((lesson) => {
                    const student = students.find((s) => s.id === lesson.studentId);
                    const teacher = teachers.find((t) => t.id === lesson.teacherId);
                    const room = rooms.find((r) => r.id === lesson.roomId);
                    return (
                      <div
                        key={lesson.id}
                        className="rounded-lg border border-slate-100 bg-slate-50 p-2 text-xs"
                        style={{ borderLeft: `3px solid ${teacher?.color ?? "#7c3aed"}` }}
                      >
                        <p className="font-semibold text-slate-800">
                          {format(parseISO(lesson.startAt), "HH:mm")} {lesson.instrument}
                        </p>
                        <p className="text-slate-600">{student?.name}</p>
                        <p className="text-slate-400">
                          {teacher?.name} · {room?.name}
                          {branchNames[lesson.branchId] ? ` · ${branchNames[lesson.branchId]}` : ""}
                        </p>
                        <div className="mt-1">
                          <Badge status={lesson.type === "makeup" ? "makeup" : lesson.status} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function CommunicationDraftCard({ label, msg }: { label: string; msg: LessonCommunicationMessage }) {
  const [markedSent, setMarkedSent] = useState(false);
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-sm font-medium text-slate-900">
        {msg.toName}
        {msg.toPhone ? ` · ${msg.toPhone}` : ""}
      </p>
      <pre className="mt-2 max-h-40 overflow-y-auto whitespace-pre-wrap rounded-lg bg-slate-50 p-2 text-[11px] leading-relaxed text-slate-700">
        {msg.body}
      </pre>
      {msg.waLink ? (
        <a href={msg.waLink} target="_blank" rel="noreferrer">
          <Button className="mt-2 bg-emerald-600 !py-1.5 text-xs hover:bg-emerald-700">
            <ExternalLink className="h-3.5 w-3.5" />
            WhatsApp&apos;ta aç
          </Button>
        </a>
      ) : (
        <p className="mt-2 text-xs text-rose-600">{msg.missingPhoneReason ?? "Telefon numarası eksik."}</p>
      )}
      <label className="mt-2 flex items-center gap-2 text-[11px] text-slate-500">
        <input
          type="checkbox"
          checked={markedSent}
          onChange={(e) => setMarkedSent(e.target.checked)}
        />
        Sistemde gönderildi olarak işaretle
      </label>
      {markedSent ? (
        <p className="mt-1 text-[10px] text-amber-600">
          Bu yalnızca bilgi amaçlıdır — WhatsApp üzerinden gerçekten gönderildiğinin kanıtı değildir.
        </p>
      ) : null}
    </div>
  );
}
