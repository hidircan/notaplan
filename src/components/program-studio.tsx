"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, Loader2, Sparkles, X } from "lucide-react";
import { addMinutes, differenceInMinutes, format, isSameDay, parseISO, startOfDay } from "date-fns";
import { tr } from "date-fns/locale";
import {
  actionAddLesson,
  actionCancelLesson,
  actionSuggestLessonSlots,
  actionUpdateLessonSchedule,
} from "@/lib/actions";
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

const SLOT_MINUTES = 30;
const SLOT_HEIGHT_PX = 28;

function toDatetimeLocalValue(iso: string) {
  return format(parseISO(iso), "yyyy-MM-dd'T'HH:mm");
}

function parseHm(hm: string) {
  const [h, m] = hm.split(":").map(Number);
  return h * 60 + m;
}

function formatMinutes(min: number) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function slotStarts(workingHours: { start: string; end: string }) {
  const startMin = parseHm(workingHours.start);
  const endMin = parseHm(workingHours.end);
  const slots: number[] = [];
  for (let t = startMin; t < endMin; t += SLOT_MINUTES) slots.push(t);
  return slots;
}

/** Sadece normal (telafi olmayan), planlanmış ve gelecekteki dersler taşınabilir/resize edilebilir. */
function canMoveOrResize(lesson: Lesson, now: Date) {
  return lesson.type === "regular" && lesson.status === "scheduled" && parseISO(lesson.startAt) > now;
}

/** İptal, geçmiş dersler için de mümkündür — yalnızca tür ve durum şartı aranır. */
function canCancel(lesson: Lesson) {
  return lesson.type === "regular" && lesson.status === "scheduled";
}

function ineligibilityReason(lesson: Lesson, now: Date): string | null {
  if (lesson.type !== "regular") return "Telafi dersleri bu ekrandan taşınamaz, süresi değiştirilemez veya iptal edilemez.";
  if (lesson.status !== "scheduled") return "Bu ders zaten tamamlanmış veya iptal edilmiş.";
  if (!(parseISO(lesson.startAt) > now)) return "Geçmiş bir ders taşınamaz veya süresi değiştirilemez, ancak iptal edilebilir.";
  return null;
}

/** Aynı gün çakışan (farklı öğretmen/oda) dersler için basit "lane" ataması — greedy interval scheduling. */
function assignLanes(dayLessons: Lesson[]): { laneOf: Map<string, number>; laneCount: number } {
  const sorted = [...dayLessons].sort((a, b) => a.startAt.localeCompare(b.startAt));
  const laneEndTimes: number[] = [];
  const laneOf = new Map<string, number>();
  for (const lesson of sorted) {
    const start = parseISO(lesson.startAt).getTime();
    const end = parseISO(lesson.endAt).getTime();
    let lane = laneEndTimes.findIndex((endTime) => endTime <= start);
    if (lane === -1) {
      lane = laneEndTimes.length;
      laneEndTimes.push(end);
    } else {
      laneEndTimes[lane] = end;
    }
    laneOf.set(lesson.id, lane);
  }
  return { laneOf, laneCount: Math.max(laneEndTimes.length, 1) };
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
  const now = parseISO(todayIso);
  const slots = slotStarts(workingHours);
  const windowStartMin = slots[0] ?? 0;

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

  const [gridError, setGridError] = useState<string | null>(null);
  const [draggingLessonId, setDraggingLessonId] = useState<string | null>(null);
  const [dragOverKey, setDragOverKey] = useState<string | null>(null);
  const [resizePreview, setResizePreview] = useState<{ lessonId: string; duration: number } | null>(null);
  const resizeRef = useRef<{
    lessonId: string;
    startY: number;
    initialDuration: number;
    currentDuration: number;
  } | null>(null);

  const [detailLesson, setDetailLesson] = useState<Lesson | null>(null);
  const [detailMoveOpen, setDetailMoveOpen] = useState(false);
  const [detailMoveStartAt, setDetailMoveStartAt] = useState("");
  const [detailError, setDetailError] = useState<string | null>(null);
  const [detailSubmitting, setDetailSubmitting] = useState(false);

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

  function openPlannerAtSlot(dayIso: string, slotMin: number) {
    const day = parseISO(dayIso);
    const dt = addMinutes(startOfDay(day), slotMin);
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

  function openDetail(lesson: Lesson) {
    setDetailLesson(lesson);
    setDetailMoveOpen(false);
    setDetailError(null);
  }

  function closeDetail() {
    setDetailLesson(null);
    setDetailMoveOpen(false);
    setDetailError(null);
  }

  function openDetailMove() {
    if (!detailLesson) return;
    setDetailMoveStartAt(toDatetimeLocalValue(detailLesson.startAt));
    setDetailMoveOpen(true);
    setDetailError(null);
  }

  async function submitDetailMove(e: FormEvent) {
    e.preventDefault();
    if (!detailLesson) return;
    setDetailSubmitting(true);
    setDetailError(null);
    const result = await actionUpdateLessonSchedule({
      lessonId: detailLesson.id,
      startAt: new Date(detailMoveStartAt).toISOString(),
    });
    setDetailSubmitting(false);
    if (!result.ok) {
      setDetailError(result.message);
      return;
    }
    closeDetail();
    router.refresh();
  }

  async function submitDetailCancel() {
    if (!detailLesson) return;
    if (!window.confirm("Bu dersi iptal etmek istediğinize emin misiniz?")) return;
    setDetailSubmitting(true);
    setDetailError(null);
    const result = await actionCancelLesson({ lessonId: detailLesson.id });
    setDetailSubmitting(false);
    if (!result.ok) {
      setDetailError(result.message);
      return;
    }
    closeDetail();
    router.refresh();
  }

  async function performMove(lessonId: string, newStartAtIso: string) {
    setGridError(null);
    const result = await actionUpdateLessonSchedule({ lessonId, startAt: newStartAtIso });
    if (!result.ok) {
      setGridError(result.message);
      return;
    }
    router.refresh();
  }

  function handleDrop(dayIso: string, slotMin: number) {
    setDragOverKey(null);
    const lessonId = draggingLessonId;
    setDraggingLessonId(null);
    if (!lessonId) return;
    const day = parseISO(dayIso);
    const dt = addMinutes(startOfDay(day), slotMin);
    void performMove(lessonId, dt.toISOString());
  }

  function startResize(e: React.MouseEvent, lesson: Lesson) {
    e.preventDefault();
    e.stopPropagation();
    const duration = differenceInMinutes(parseISO(lesson.endAt), parseISO(lesson.startAt));
    resizeRef.current = { lessonId: lesson.id, startY: e.clientY, initialDuration: duration, currentDuration: duration };
    setResizePreview({ lessonId: lesson.id, duration });

    function onMove(ev: MouseEvent) {
      const ref = resizeRef.current;
      if (!ref) return;
      const deltaY = ev.clientY - ref.startY;
      const deltaSlots = Math.round(deltaY / SLOT_HEIGHT_PX);
      const newDuration = Math.max(SLOT_MINUTES, ref.initialDuration + deltaSlots * SLOT_MINUTES);
      ref.currentDuration = newDuration;
      setResizePreview({ lessonId: ref.lessonId, duration: newDuration });
    }

    async function onUp() {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      const ref = resizeRef.current;
      resizeRef.current = null;
      setResizePreview(null);
      if (!ref) return;
      if (ref.currentDuration === ref.initialDuration) return;
      setGridError(null);
      const result = await actionUpdateLessonSchedule({
        lessonId: ref.lessonId,
        durationMinutes: ref.currentDuration,
      });
      if (!result.ok) {
        setGridError(result.message);
        return;
      }
      router.refresh();
    }

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
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

      {detailLesson ? (
        <DetailPanel
          lesson={detailLesson}
          student={students.find((s) => s.id === detailLesson.studentId)}
          teacher={teachers.find((t) => t.id === detailLesson.teacherId)}
          room={rooms.find((r) => r.id === detailLesson.roomId)}
          branchName={branchNames[detailLesson.branchId]}
          now={now}
          moveOpen={detailMoveOpen}
          moveStartAt={detailMoveStartAt}
          submitting={detailSubmitting}
          error={detailError}
          onClose={closeDetail}
          onOpenMove={openDetailMove}
          onChangeMoveStartAt={setDetailMoveStartAt}
          onSubmitMove={submitDetailMove}
          onCancelLesson={submitDetailCancel}
        />
      ) : null}

      {gridError ? (
        <div className="mb-4 flex items-center justify-between rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700">
          <span>{gridError}</span>
          <button type="button" onClick={() => setGridError(null)} aria-label="Kapat">
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : null}

      <div className="hidden overflow-x-auto lg:block">
        <div className="flex">
          <div className="w-14 shrink-0" />
          {days.map((dayIso) => {
            const day = parseISO(dayIso);
            const today = isSameDay(day, now);
            return (
              <div
                key={dayIso}
                className={`flex-1 border-b border-slate-100 p-2 text-xs font-semibold ${
                  today ? "bg-violet-50 text-violet-700" : "text-slate-600"
                }`}
              >
                {format(day, "EEEE", { locale: tr })}
                <span className="ml-1 font-normal text-slate-400">{format(day, "d MMM")}</span>
              </div>
            );
          })}
        </div>

        <div className="flex">
          <div className="w-14 shrink-0">
            {slots.map((min) => (
              <div key={min} className="border-r border-slate-50 pr-2 text-right text-[11px] text-slate-400" style={{ height: SLOT_HEIGHT_PX }}>
                {min % 60 === 0 ? formatMinutes(min) : ""}
              </div>
            ))}
          </div>

          {days.map((dayIso) => {
            const day = parseISO(dayIso);
            const today = isSameDay(day, now);
            const dayLessons = weekLessons.filter((l) => isSameDay(parseISO(l.startAt), day));
            const { laneOf, laneCount } = assignLanes(dayLessons);
            const totalHeight = slots.length * SLOT_HEIGHT_PX;

            return (
              <div
                key={dayIso}
                className={`relative flex-1 border-l border-slate-100 ${today ? "bg-violet-50/20" : ""}`}
                style={{ height: totalHeight }}
              >
                {slots.map((min, i) => {
                  const key = `${dayIso}|${min}`;
                  const isDragOver = dragOverKey === key;
                  return (
                    <button
                      key={min}
                      type="button"
                      onClick={() => openPlannerAtSlot(dayIso, min)}
                      onDragOver={(e) => {
                        if (draggingLessonId) e.preventDefault();
                        setDragOverKey(key);
                      }}
                      onDragLeave={() => setDragOverKey((k) => (k === key ? null : k))}
                      onDrop={(e) => {
                        e.preventDefault();
                        handleDrop(dayIso, min);
                      }}
                      className={`absolute left-0 right-0 border-b border-dashed text-[10px] text-transparent hover:border-violet-300 hover:text-violet-500 ${
                        isDragOver ? "border-violet-400 bg-violet-100/60" : "border-slate-50"
                      }`}
                      style={{ top: i * SLOT_HEIGHT_PX, height: SLOT_HEIGHT_PX }}
                      aria-label={`${format(day, "d MMM")} ${formatMinutes(min)} — ders planla`}
                    >
                      +
                    </button>
                  );
                })}

                {dayLessons.map((lesson) => {
                  const student = students.find((s) => s.id === lesson.studentId);
                  const teacher = teachers.find((t) => t.id === lesson.teacherId);
                  const room = rooms.find((r) => r.id === lesson.roomId);
                  const startMin =
                    parseISO(lesson.startAt).getHours() * 60 + parseISO(lesson.startAt).getMinutes();
                  const duration =
                    resizePreview?.lessonId === lesson.id
                      ? resizePreview.duration
                      : differenceInMinutes(parseISO(lesson.endAt), parseISO(lesson.startAt));
                  const top = ((startMin - windowStartMin) / SLOT_MINUTES) * SLOT_HEIGHT_PX;
                  const height = Math.max((duration / SLOT_MINUTES) * SLOT_HEIGHT_PX - 2, SLOT_HEIGHT_PX - 2);
                  const lane = laneOf.get(lesson.id) ?? 0;
                  const widthPct = 100 / laneCount;
                  const editable = canMoveOrResize(lesson, now);

                  return (
                    <div
                      key={lesson.id}
                      draggable={editable}
                      onDragStart={() => setDraggingLessonId(lesson.id)}
                      onDragEnd={() => {
                        setDraggingLessonId(null);
                        setDragOverKey(null);
                      }}
                      onClick={() => openDetail(lesson)}
                      className={`absolute z-10 overflow-hidden rounded-lg border border-slate-200 bg-white p-1 text-[10px] shadow-sm ${
                        editable ? "cursor-grab active:cursor-grabbing" : "cursor-pointer opacity-90"
                      }`}
                      style={{
                        top,
                        height,
                        left: `${lane * widthPct}%`,
                        width: `calc(${widthPct}% - 2px)`,
                        borderLeft: `3px solid ${teacher?.color ?? "#7c3aed"}`,
                      }}
                    >
                      <p className="truncate font-semibold text-slate-800">
                        {format(parseISO(lesson.startAt), "HH:mm")} {lesson.instrument}
                      </p>
                      <p className="truncate text-slate-600">{student?.name}</p>
                      <p className="truncate text-slate-400">
                        {teacher?.name} · {room?.name}
                      </p>
                      <Badge status={lesson.type === "makeup" ? "makeup" : lesson.status} />
                      {editable ? (
                        <div
                          onMouseDown={(e) => startResize(e, lesson)}
                          className="absolute bottom-0 left-0 right-0 h-1.5 cursor-ns-resize bg-slate-200/0 hover:bg-violet-300/70"
                          aria-label="Süreyi değiştir"
                        />
                      ) : null}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid gap-3 lg:hidden">
        {days.map((dayIso) => {
          const day = parseISO(dayIso);
          const today = isSameDay(day, now);
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
                      <button
                        key={lesson.id}
                        type="button"
                        onClick={() => openDetail(lesson)}
                        className="block w-full rounded-lg border border-slate-100 bg-slate-50 p-2 text-left text-xs hover:border-violet-200"
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
                      </button>
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

function DetailPanel({
  lesson,
  student,
  teacher,
  room,
  branchName,
  now,
  moveOpen,
  moveStartAt,
  submitting,
  error,
  onClose,
  onOpenMove,
  onChangeMoveStartAt,
  onSubmitMove,
  onCancelLesson,
}: {
  lesson: Lesson;
  student?: Student;
  teacher?: Teacher;
  room?: Room;
  branchName?: string;
  now: Date;
  moveOpen: boolean;
  moveStartAt: string;
  submitting: boolean;
  error: string | null;
  onClose: () => void;
  onOpenMove: () => void;
  onChangeMoveStartAt: (value: string) => void;
  onSubmitMove: (e: FormEvent) => void;
  onCancelLesson: () => void;
}) {
  const canMove = canMoveOrResize(lesson, now);
  const canCancelLesson = canCancel(lesson);
  const reason = ineligibilityReason(lesson, now);

  return (
    <Card className="mb-6 border-slate-300">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-semibold text-slate-900">Ders detayı</h3>
        <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-700" aria-label="Kapat">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="mb-3 text-sm text-slate-700">
        <p className="font-medium text-slate-900">
          {format(parseISO(lesson.startAt), "d MMMM yyyy · HH:mm", { locale: tr })} — {lesson.instrument}
        </p>
        <p className="mt-1 text-slate-500">
          {student?.name} · {teacher?.name} · {room?.name}
          {branchName ? ` · ${branchName}` : ""}
        </p>
        <div className="mt-2">
          <Badge status={lesson.type === "makeup" ? "makeup" : lesson.status} />
        </div>
      </div>

      {reason ? <p className="mb-3 text-xs text-amber-600">{reason}</p> : null}

      <div className="flex flex-wrap gap-2">
        {canMove ? (
          <Button variant="secondary" onClick={onOpenMove} disabled={submitting}>
            Bu dersi taşı
          </Button>
        ) : null}
        {canCancelLesson ? (
          <Button variant="danger" onClick={onCancelLesson} disabled={submitting}>
            Bu dersi iptal et
          </Button>
        ) : null}
      </div>

      {moveOpen ? (
        <form onSubmit={onSubmitMove} className="mt-4 flex flex-wrap items-end gap-2 border-t border-slate-100 pt-4">
          <div>
            <Label>Yeni tarih/saat</Label>
            <Input
              type="datetime-local"
              value={moveStartAt}
              onChange={(e) => onChangeMoveStartAt(e.target.value)}
              required
            />
          </div>
          <Button type="submit" disabled={submitting}>
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Taşı
          </Button>
        </form>
      ) : null}

      {error ? <p className="mt-3 text-sm text-rose-600">{error}</p> : null}
    </Card>
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
