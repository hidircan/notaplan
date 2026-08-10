import type { AppData } from "../types";

/**
 * Deterministic per-student absenteeism risk — NO AI/LLM in the level
 * itself (only an optional narration layer on top, via the
 * `attendanceRiskAssessment` AI capability). Based only on attendance
 * records that already happened, ordered by the lesson's actual date.
 */
export type AttendanceRiskLevel = "low" | "medium" | "high";

export type StudentAttendanceRisk = {
  studentId: string;
  riskLevel: AttendanceRiskLevel;
  gradedLessonCount: number;
  absentCount: number;
  lateCount: number;
  /** Most recent consecutive absences (present/late resets the streak). */
  consecutiveAbsences: number;
};

const MIN_GRADED_LESSONS_FOR_RISK = 3;

export function computeStudentAttendanceRisk(data: AppData, studentId: string): StudentAttendanceRisk {
  const lessonsById = new Map(data.lessons.map((l) => [l.id, l]));
  const graded = data.attendances
    .filter((a) => a.studentId === studentId)
    .map((a) => ({ a, lesson: lessonsById.get(a.lessonId) }))
    .filter((row): row is { a: (typeof data.attendances)[number]; lesson: NonNullable<(typeof row)["lesson"]> } =>
      Boolean(row.lesson)
    )
    .sort((x, y) => x.lesson.startAt.localeCompare(y.lesson.startAt));

  const absentCount = graded.filter((r) => r.a.status === "absent").length;
  const lateCount = graded.filter((r) => r.a.status === "late").length;
  const gradedLessonCount = graded.length;

  let consecutiveAbsences = 0;
  for (let i = graded.length - 1; i >= 0; i--) {
    if (graded[i].a.status === "absent") consecutiveAbsences += 1;
    else break;
  }

  let riskLevel: AttendanceRiskLevel = "low";
  if (gradedLessonCount >= MIN_GRADED_LESSONS_FOR_RISK) {
    const absentRate = absentCount / gradedLessonCount;
    if (consecutiveAbsences >= 3 || absentRate > 0.3) {
      riskLevel = "high";
    } else if (consecutiveAbsences >= 2 || absentRate > 0.15) {
      riskLevel = "medium";
    }
  }

  return { studentId, riskLevel, gradedLessonCount, absentCount, lateCount, consecutiveAbsences };
}

export function computeAllStudentAttendanceRisks(data: AppData): StudentAttendanceRisk[] {
  return data.students.map((s) => computeStudentAttendanceRisk(data, s.id));
}
