/**
 * Workflow Registry — recurring autonomous jobs.
 * Every step uses Agent Runtime (executeAgentTool) only.
 */

import type { WorkflowDefinition, WorkflowId } from "./types";
import { runWorkflowTool } from "./runtime";

/** Known demo student/teacher IDs from seed (no direct DB) */
const STUDENTS = ["s1", "s2", "s3", "s4", "s5", "s6", "s7", "s8"];
const TEACHERS = ["t1", "t2", "t3", "t4", "t5"];
const MAKEUP_REQUESTS = ["m1", "m2", "m3"];
const LESSONS = ["l8", "l9", "l10", "l11"];

export const WORKFLOW_REGISTRY: Record<WorkflowId, WorkflowDefinition> = {
  payment_reminders: {
    id: "payment_reminders",
    name: "Ödeme hatırlatmaları",
    description: "Öğrenci bakiyelerini kontrol eder; gecikenler için veli mesajı hazırlar.",
    intervalMinutes: 60 * 24,
    defaultEnabled: true,
    async run(ctx) {
      const steps = [];
      for (const studentId of STUDENTS.slice(0, 4)) {
        const bal = await runWorkflowTool(ctx, "getParentBalance", { studentId });
        steps.push(bal);
        const outstanding =
          bal.ok && bal.data && typeof bal.data === "object" && "outstanding" in bal.data
            ? Number((bal.data as { outstanding: number }).outstanding)
            : 0;
        if (outstanding > 0) {
          steps.push(
            await runWorkflowTool(ctx, "sendParentMessage", {
              studentId,
              kind: "makeup_created",
            })
          );
        }
      }
      return steps;
    },
  },

  lesson_reminders: {
    id: "lesson_reminders",
    name: "Ders hatırlatmaları",
    description: "Yaklaşan ders programlarını öğrenci bazında çeker.",
    intervalMinutes: 60 * 12,
    defaultEnabled: true,
    async run(ctx) {
      const steps = [];
      for (const studentId of ["s1", "s2", "s5"]) {
        steps.push(await runWorkflowTool(ctx, "getStudentSchedule", { studentId }));
      }
      return steps;
    },
  },

  attendance_followup: {
    id: "attendance_followup",
    name: "Yoklama takibi",
    description: "Seçili dersler için yoklama durumunu günceller / takip eder.",
    intervalMinutes: 60 * 6,
    defaultEnabled: false,
    async run(ctx) {
      const steps = [];
      // Read-only style: mark present for a scheduled lesson only if needed — use present as soft check
      for (const lessonId of LESSONS.slice(0, 2)) {
        steps.push(
          await runWorkflowTool(ctx, "markAttendance", {
            lessonId,
            status: "present",
            reason: "workflow:attendance_followup",
          })
        );
      }
      return steps;
    },
  },

  weekly_reports: {
    id: "weekly_reports",
    name: "Haftalık rapor",
    description: "Öğrenci programları + bakiyelerden özet veri toplar.",
    intervalMinutes: 60 * 24 * 7,
    defaultEnabled: true,
    async run(ctx) {
      const steps = [];
      steps.push(await runWorkflowTool(ctx, "getStudentSchedule", { studentId: "s1" }));
      steps.push(await runWorkflowTool(ctx, "getParentBalance", { studentId: "s1" }));
      steps.push(await runWorkflowTool(ctx, "getTeacherSchedule", { teacherId: "t2" }));
      steps.push(await runWorkflowTool(ctx, "findAvailableTeachers", {}));
      return steps;
    },
  },

  teacher_utilization: {
    id: "teacher_utilization",
    name: "Öğretmen doluluk",
    description: "Öğretmen programlarını çekerek doluluk analizi için veri üretir.",
    intervalMinutes: 60 * 24,
    defaultEnabled: true,
    async run(ctx) {
      const steps = [];
      for (const teacherId of TEACHERS) {
        steps.push(await runWorkflowTool(ctx, "getTeacherSchedule", { teacherId }));
      }
      steps.push(await runWorkflowTool(ctx, "findAvailableTeachers", {}));
      return steps;
    },
  },

  makeup_suggestions: {
    id: "makeup_suggestions",
    name: "Telafi slot önerileri",
    description: "Açık telafi talepleri için Agent Runtime ile slot önerir.",
    intervalMinutes: 60 * 6,
    defaultEnabled: true,
    async run(ctx) {
      const steps = [];
      for (const requestId of MAKEUP_REQUESTS) {
        steps.push(await runWorkflowTool(ctx, "findAvailableSlots", { requestId }));
      }
      return steps;
    },
  },
};

export function listWorkflowDefinitions() {
  return Object.values(WORKFLOW_REGISTRY);
}

export function getWorkflowDefinition(id: string) {
  return WORKFLOW_REGISTRY[id as WorkflowId];
}
