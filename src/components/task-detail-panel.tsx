"use client";

/**
 * İş Takip görev detay paneli — hem `/panel/is-takip/[taskId]` (admin, tam
 * düzenleme) hem `/ogretmen/is-takip/[taskId]` (öğretmen, kısıtlı) tarafından
 * kullanılır. RBAC her aksiyonda zaten sunucu tarafında (tools.ts) kesin
 * olarak uygulanır — `isAdmin` prop'u yalnızca HANGİ kontrollerin
 * gösterileceğini belirler (ikinci, UI katmanı savunması).
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  actionChangeTaskStatus,
  actionAddTaskChecklistItem,
  actionSetTaskChecklistItemCompleted,
  actionArchiveTaskChecklistItem,
  actionAddTaskComment,
  actionUpdateTask,
} from "@/lib/actions";
import { Badge, Button, Input } from "@/components/ui";
import { formatDateTime } from "@/lib/utils";
import type { Task, TaskChecklistItem, TaskComment, TaskActivity, TaskStatus } from "@/lib/types";

const STATUS_LABEL: Record<TaskStatus, string> = {
  TODO: "Yapılacak",
  IN_PROGRESS: "Devam Ediyor",
  BLOCKED: "Engellendi",
  COMPLETED: "Tamamlandı",
  CANCELLED: "İptal Edildi",
  ARCHIVED: "Arşivlendi",
};

const ACTIVITY_LABEL: Record<string, string> = {
  created: "Oluşturuldu",
  field_updated: "Alan güncellendi",
  status_changed: "Durum değişti",
  priority_changed: "Öncelik değişti",
  category_changed: "Kategori değişti",
  assignee_changed: "Sorumlu değişti",
  follower_added: "Takipçi eklendi",
  follower_removed: "Takipçi çıkarıldı",
  date_changed: "Tarih değişti",
  checklist_added: "Checklist eklendi",
  checklist_updated: "Checklist güncellendi",
  checklist_removed: "Checklist kaldırıldı",
  comment_added: "Yorum eklendi",
  comment_updated: "Yorum düzenlendi",
  completed: "Tamamlandı",
  cancelled: "İptal edildi",
  archived: "Arşivlendi",
  reopened: "Yeniden açıldı",
};

export function TaskDetailPanel({
  task,
  checklist,
  comments,
  activity,
  isAdmin,
  assigneeLabel,
}: {
  task: Task;
  checklist: TaskChecklistItem[];
  comments: TaskComment[];
  activity: TaskActivity[];
  /** Admin: durum/öncelik/kategori/sorumlu/tarih tam düzenleme + iptal/arşiv/yeniden-aç. TEACHER: yalnızca izinli statü + checklist + yorum. */
  isAdmin: boolean;
  assigneeLabel?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [newChecklistTitle, setNewChecklistTitle] = useState("");
  const [newComment, setNewComment] = useState("");
  const [confirmAction, setConfirmAction] = useState<"cancel" | "archive" | null>(null);

  function run(fn: () => Promise<{ ok: boolean; message?: string }>) {
    setError(null);
    startTransition(async () => {
      const result = await fn();
      if (!result.ok) {
        setError(result.message ?? "İşlem başarısız.");
        return;
      }
      router.refresh();
    });
  }

  const canSetStatus = (status: TaskStatus) => isAdmin || (status !== "CANCELLED" && status !== "ARCHIVED");
  const activeChecklist = checklist.filter((c) => !c.archivedAt);
  const completedCount = activeChecklist.filter((c) => c.isCompleted).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold text-[var(--color-text)]">{task.title}</h1>
          {task.description ? (
            <p className="mt-1 text-sm text-[var(--color-text-muted)]">{task.description}</p>
          ) : null}
        </div>
        <Badge status={task.status === "COMPLETED" ? "paid" : task.status === "CANCELLED" || task.status === "ARCHIVED" ? "cancelled" : "pending"}>
          {STATUS_LABEL[task.status]}
        </Badge>
      </div>

      {error ? (
        <p className="rounded-md bg-[#f8ecec] px-3 py-2 text-xs font-medium text-[#6b2424]" role="alert">
          {error}
        </p>
      ) : null}

      <div className="grid gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-3 text-sm sm:grid-cols-2">
        <div>
          <span className="text-[var(--color-text-muted)]">Öncelik:</span> {task.priority}
        </div>
        <div>
          <span className="text-[var(--color-text-muted)]">Kategori:</span> {task.category}
        </div>
        <div>
          <span className="text-[var(--color-text-muted)]">Sorumlu:</span> {assigneeLabel ?? task.assigneeId ?? "Atanmadı"}
        </div>
        <div>
          <span className="text-[var(--color-text-muted)]">İlerleme:</span> {task.progressPercent}%
        </div>
        <div>
          <span className="text-[var(--color-text-muted)]">Başlangıç:</span>{" "}
          {task.startDate ? formatDateTime(task.startDate) : "—"}
        </div>
        <div>
          <span className="text-[var(--color-text-muted)]">Son tarih:</span>{" "}
          {task.dueDate ? formatDateTime(task.dueDate) : "—"}
        </div>
      </div>

      {task.studentId || task.teacherId || task.branchId || task.lessonId || task.paymentId || task.documentId ? (
        <div className="flex flex-wrap gap-2">
          {task.studentId ? (
            <a
              href={`/panel/ogrenciler/${task.studentId}`}
              className="rounded-md border border-[var(--color-border)] px-2.5 py-1 text-xs font-medium text-[var(--color-primary)] hover:underline"
            >
              Öğrenciye git →
            </a>
          ) : null}
          {task.teacherId ? (
            <a
              href={`/panel/ogretmenler/${task.teacherId}`}
              className="rounded-md border border-[var(--color-border)] px-2.5 py-1 text-xs font-medium text-[var(--color-primary)] hover:underline"
            >
              Öğretmene git →
            </a>
          ) : null}
          {task.paymentId ? (
            <a
              href={task.studentId ? `/panel/odemeler/${task.studentId}` : "/panel/odemeler"}
              className="rounded-md border border-[var(--color-border)] px-2.5 py-1 text-xs font-medium text-[var(--color-primary)] hover:underline"
            >
              Ödemeye git →
            </a>
          ) : null}
          {task.lessonId ? (
            <a
              href="/panel/program"
              className="rounded-md border border-[var(--color-border)] px-2.5 py-1 text-xs font-medium text-[var(--color-primary)] hover:underline"
            >
              Programa git →
            </a>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {task.status !== "COMPLETED" && canSetStatus("COMPLETED") ? (
          <Button
            type="button"
            variant="secondary"
            disabled={pending}
            onClick={() => run(() => actionChangeTaskStatus({ taskId: task.id, action: "complete" }))}
          >
            Tamamla
          </Button>
        ) : null}
        {task.status !== "IN_PROGRESS" && task.status !== "COMPLETED" ? (
          <Button
            type="button"
            variant="secondary"
            disabled={pending}
            onClick={() =>
              run(() => actionChangeTaskStatus({ taskId: task.id, action: "set_status", status: "IN_PROGRESS" }))
            }
          >
            Devam ediyor olarak işaretle
          </Button>
        ) : null}
        {task.status !== "BLOCKED" && task.status !== "COMPLETED" ? (
          <Button
            type="button"
            variant="secondary"
            disabled={pending}
            onClick={() =>
              run(() => actionChangeTaskStatus({ taskId: task.id, action: "set_status", status: "BLOCKED" }))
            }
          >
            Engellendi olarak işaretle
          </Button>
        ) : null}
        {(task.status === "COMPLETED" || task.status === "CANCELLED" || task.status === "ARCHIVED") ? (
          <Button
            type="button"
            variant="secondary"
            disabled={pending}
            onClick={() => run(() => actionChangeTaskStatus({ taskId: task.id, action: "reopen" }))}
          >
            Yeniden Aç
          </Button>
        ) : null}
        {isAdmin && task.status !== "CANCELLED" ? (
          <Button type="button" variant="danger" disabled={pending} onClick={() => setConfirmAction("cancel")}>
            İptal Et
          </Button>
        ) : null}
        {isAdmin && task.status !== "ARCHIVED" ? (
          <Button type="button" variant="secondary" disabled={pending} onClick={() => setConfirmAction("archive")}>
            Arşivle
          </Button>
        ) : null}
      </div>

      {confirmAction ? (
        <div role="alertdialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-xl">
            <h3 className="text-base font-semibold text-[var(--color-text)]">
              Görev {confirmAction === "cancel" ? "iptal edilsin" : "arşivlensin"} mi?
            </h3>
            <p className="mt-2 text-sm text-[var(--color-text-muted)]">
              Görev silinmez, istediğiniz zaman &quot;Yeniden Aç&quot; ile geri getirebilirsiniz.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setConfirmAction(null)} disabled={pending}>
                Vazgeç
              </Button>
              <Button
                type="button"
                variant="danger"
                disabled={pending}
                onClick={() => {
                  const action = confirmAction;
                  setConfirmAction(null);
                  run(() => actionChangeTaskStatus({ taskId: task.id, action }));
                }}
              >
                Onayla
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {isAdmin ? (
        <details className="rounded-lg border border-[var(--color-border)] p-3">
          <summary className="cursor-pointer text-sm font-semibold text-[var(--color-text)]">İlerleme yüzdesini elle güncelle</summary>
          <form
            className="mt-2 flex items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const form = e.currentTarget;
              const value = Number((form.elements.namedItem("progressPercent") as HTMLInputElement).value);
              run(() => actionUpdateTask({ taskId: task.id, progressPercent: value }));
            }}
          >
            <Input name="progressPercent" type="number" min={0} max={100} defaultValue={task.progressPercent} className="!w-24" />
            <Button type="submit" variant="secondary" disabled={pending}>
              Kaydet
            </Button>
          </form>
        </details>
      ) : null}

      <section>
        <h2 className="mb-2 text-sm font-semibold text-[var(--color-text)]">
          Checklist {activeChecklist.length > 0 ? `(${completedCount}/${activeChecklist.length})` : ""}
        </h2>
        <div className="space-y-1.5">
          {activeChecklist.map((item) => (
            <div key={item.id} className="flex items-center gap-2 rounded-md border border-[var(--color-border)] px-2.5 py-1.5">
              <input
                type="checkbox"
                checked={item.isCompleted}
                disabled={pending}
                onChange={(e) =>
                  run(() =>
                    actionSetTaskChecklistItemCompleted({
                      taskId: task.id,
                      itemId: item.id,
                      isCompleted: e.target.checked,
                    })
                  )
                }
              />
              <span className={item.isCompleted ? "flex-1 text-sm text-[var(--color-text-muted)] line-through" : "flex-1 text-sm text-[var(--color-text)]"}>
                {item.title}
              </span>
              <button
                type="button"
                disabled={pending}
                onClick={() => run(() => actionArchiveTaskChecklistItem({ taskId: task.id, itemId: item.id }))}
                className="text-xs text-[var(--color-text-muted)] hover:text-rose-600"
              >
                Kaldır
              </button>
            </div>
          ))}
        </div>
        <form
          className="mt-2 flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!newChecklistTitle.trim()) return;
            run(async () => {
              const res = await actionAddTaskChecklistItem({ taskId: task.id, title: newChecklistTitle.trim() });
              if (res.ok) setNewChecklistTitle("");
              return res;
            });
          }}
        >
          <Input
            value={newChecklistTitle}
            onChange={(e) => setNewChecklistTitle(e.target.value)}
            placeholder="Yeni checklist maddesi…"
            className="flex-1"
          />
          <Button type="submit" variant="secondary" disabled={pending || !newChecklistTitle.trim()}>
            Ekle
          </Button>
        </form>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-[var(--color-text)]">Yorumlar</h2>
        <div className="space-y-2">
          {comments.length === 0 ? (
            <p className="text-xs text-[var(--color-text-muted)]">Henüz yorum yok.</p>
          ) : (
            comments.map((c) => (
              <div key={c.id} className="rounded-md bg-[var(--color-bg)] p-2 text-sm">
                <p className="text-[var(--color-text)]">{c.body}</p>
                <p className="mt-1 text-[11px] text-[var(--color-text-muted)]">{formatDateTime(c.createdAt)}</p>
              </div>
            ))
          )}
        </div>
        <form
          className="mt-2 flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!newComment.trim()) return;
            run(async () => {
              const res = await actionAddTaskComment({ taskId: task.id, body: newComment.trim() });
              if (res.ok) setNewComment("");
              return res;
            });
          }}
        >
          <Input value={newComment} onChange={(e) => setNewComment(e.target.value)} placeholder="Yorum yaz…" className="flex-1" />
          <Button type="submit" variant="secondary" disabled={pending || !newComment.trim()}>
            Gönder
          </Button>
        </form>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-[var(--color-text)]">Aktivite Geçmişi</h2>
        <div className="space-y-1.5">
          {activity.map((a) => (
            <div key={a.id} className="flex items-center justify-between gap-2 text-xs text-[var(--color-text-muted)]">
              <span>
                <strong className="text-[var(--color-text)]">{ACTIVITY_LABEL[a.action] ?? a.action}</strong> — {a.summary}
              </span>
              <span>{formatDateTime(a.createdAt)}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
