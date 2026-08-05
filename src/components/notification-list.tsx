"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, Check } from "lucide-react";
import { Card } from "@/components/ui";
import { formatDateTime } from "@/lib/utils";
import { actionMarkNotificationRead } from "@/lib/actions";
import type { Notification } from "@/lib/types";

export function NotificationList({ notifications }: { notifications: Notification[] }) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);

  async function onMarkRead(id: string) {
    setPendingId(id);
    await actionMarkNotificationRead(id);
    setPendingId(null);
    router.refresh();
  }

  if (notifications.length === 0) {
    return (
      <Card>
        <p className="text-sm text-slate-500 dark:text-slate-400">Henüz bildiriminiz yok.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      {notifications.map((n) => (
        <Card
          key={n.id}
          className={`!p-4 ${n.readAt ? "" : "border-amber-200 bg-amber-50/60 dark:border-amber-800 dark:bg-amber-950/30"}`}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-start gap-2">
              <Bell className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
              <div>
                <p className="text-sm font-medium text-slate-900 dark:text-slate-50">{n.title}</p>
                <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-400">{n.body}</p>
                <p className="mt-1 text-xs text-slate-400">{formatDateTime(n.createdAt)}</p>
              </div>
            </div>
            {!n.readAt ? (
              <button
                type="button"
                onClick={() => void onMarkRead(n.id)}
                disabled={pendingId === n.id}
                className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
              >
                <Check className="h-3 w-3" /> Okundu
              </button>
            ) : null}
          </div>
        </Card>
      ))}
    </div>
  );
}
