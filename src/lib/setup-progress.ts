import type { AppData } from "./types";

export type SetupStepId = "school" | "teachers" | "rooms" | "students" | "firstLesson";

export type SetupStep = {
  id: SetupStepId;
  label: string;
  description: string;
  done: boolean;
};

export type SetupProgress = {
  steps: SetupStep[];
  completedCount: number;
  totalCount: number;
  isReady: boolean;
  hasPayment: boolean;
};

/**
 * Kurulum Merkezi için saf, veriden hesaplanan ilerleme durumu.
 * Beş temel adım: şube, aktif öğretmen, oda, aktif öğrenci, gelecekteki
 * planlı ders. Ödeme kaydı isteğe bağlıdır — `hasPayment` ayrı takip edilir,
 * `completedCount`/`isReady` hesabına katılmaz.
 */
export function computeSetupProgress(data: AppData, now: Date = new Date()): SetupProgress {
  const hasBranch = data.settings.branches.length > 0;
  const hasActiveTeacher = data.teachers.some((t) => t.active);
  const hasRoom = data.rooms.length > 0;
  const hasActiveStudent = data.students.some((s) => s.active);
  const hasFutureLesson = data.lessons.some(
    (l) => l.status === "scheduled" && new Date(l.startAt).getTime() > now.getTime()
  );
  const hasPayment = data.payments.length > 0;

  const steps: SetupStep[] = [
    {
      id: "school",
      label: "Okul ve şube bilgileri",
      description: "En az bir şube tanımlı olmalı.",
      done: hasBranch,
    },
    {
      id: "teachers",
      label: "Öğretmenler",
      description: "En az bir aktif öğretmen eklenmeli.",
      done: hasActiveTeacher,
    },
    {
      id: "rooms",
      label: "Odalar",
      description: "En az bir stüdyo/oda tanımlı olmalı.",
      done: hasRoom,
    },
    {
      id: "students",
      label: "Öğrenciler",
      description: "En az bir aktif öğrenci kaydı olmalı.",
      done: hasActiveStudent,
    },
    {
      id: "firstLesson",
      label: "İlk ders",
      description: "Programda gelecekte planlı en az bir ders olmalı.",
      done: hasFutureLesson,
    },
  ];

  const completedCount = steps.filter((s) => s.done).length;

  return {
    steps,
    completedCount,
    totalCount: steps.length,
    isReady: completedCount === steps.length,
    hasPayment,
  };
}
