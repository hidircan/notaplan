/**
 * EPIC 7 (IMPLEMENTATION_PLAN.md) — öğretmen gelişim değerlendirme skorları.
 * Saf fonksiyonlar (I/O yok) — bölüm/genel ortalama ve 4 haftalık trend.
 */

import type { AssessmentScores, LessonAssessment } from "../types";

const SCORE_KEYS: (keyof AssessmentScores)[] = [
  "teknikBecerisi",
  "notaOkuma",
  "muzikalite",
  "ritimDuyusu",
  "calismaDuzeni",
  "evOdeviTamamlama",
  "dersKatilimi",
  "motivasyon",
  "genelIlerleme",
  "hedefeUlasma",
];

export const ASSESSMENT_SECTIONS = [
  { id: "A", label: "Teknik", items: ["teknikBecerisi", "notaOkuma"] as const },
  { id: "B", label: "Müzikalite", items: ["muzikalite", "ritimDuyusu"] as const },
  { id: "C", label: "Çalışma Disiplini", items: ["calismaDuzeni", "evOdeviTamamlama"] as const },
  { id: "D", label: "Katılım", items: ["dersKatilimi", "motivasyon"] as const },
  { id: "E", label: "Genel Gelişim", items: ["genelIlerleme", "hedefeUlasma"] as const },
] as const;

export const ASSESSMENT_ITEM_LABELS: Record<keyof AssessmentScores, string> = {
  teknikBecerisi: "Teknik beceri",
  notaOkuma: "Nota okuma",
  muzikalite: "Müzikalite",
  ritimDuyusu: "Ritim duyusu",
  calismaDuzeni: "Çalışma düzeni",
  evOdeviTamamlama: "Ev ödevi tamamlama",
  dersKatilimi: "Ders katılımı",
  motivasyon: "Motivasyon",
  genelIlerleme: "Genel ilerleme",
  hedefeUlasma: "Hedefe ulaşma",
};

export function computeOverallScore(scores: AssessmentScores): number {
  const values = SCORE_KEYS.map((k) => scores[k]);
  return values.reduce((s, v) => s + v, 0) / values.length;
}

export function computeSectionScore(
  scores: AssessmentScores,
  sectionId: (typeof ASSESSMENT_SECTIONS)[number]["id"]
): number {
  const section = ASSESSMENT_SECTIONS.find((s) => s.id === sectionId);
  if (!section) return 0;
  const values = section.items.map((item) => scores[item]);
  return values.reduce((s, v) => s + v, 0) / values.length;
}

export type AssessmentTrendPoint = {
  assessmentId: string;
  date: string;
  overallScore: number;
};

/** Son N değerlendirmeyi (tarihe göre artan) trend noktalarına çevirir — varsayılan 4 hafta. */
export function computeTrend(assessments: LessonAssessment[], limit = 4): AssessmentTrendPoint[] {
  return [...assessments]
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .slice(-limit)
    .map((a) => ({
      assessmentId: a.id,
      date: a.createdAt,
      overallScore: computeOverallScore(a),
    }));
}

/**
 * EPIC 6A'dan önce ayrı bir STUDENT rolü yok — bu yüzden `role` düz string
 * alır (AppRole'e sıkı bağlı değil, forward-compat). Bugün var olan tüm
 * roller (TEACHER/PARENT/admin'ler/AI_AGENT) notu her zaman görür; yalnızca
 * henüz var olmayan bir "STUDENT" rolü, öğretmen açıkça izin vermedikçe
 * (parentNoteVisibleToStudent) görmez.
 */
export function canViewParentPrivateNote(role: string, parentNoteVisibleToStudent: boolean): boolean {
  const alwaysAllowed = ["PARENT", "SCHOOL_ADMIN", "SUPER_ADMIN", "TEACHER", "AI_AGENT"];
  if (alwaysAllowed.includes(role)) return true;
  return parentNoteVisibleToStudent;
}

/** parentPrivateNote'u yanıttan TAMAMEN çıkarır (yalnızca UI'da gizlemez) — bkz. canViewParentPrivateNote. */
export function stripPrivateNoteForRecipient(
  assessment: LessonAssessment,
  role: string
): LessonAssessment {
  if (canViewParentPrivateNote(role, assessment.parentNoteVisibleToStudent)) return assessment;
  return { ...assessment, parentPrivateNote: undefined };
}
