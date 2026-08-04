"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import type { AnnouncementStatus } from "@/lib/types";

export function AnnouncementStatusButton({
  announcementId,
  targetStatus,
  label,
}: {
  announcementId: string;
  targetStatus: AnnouncementStatus;
  label: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function onClick() {
    setBusy(true);
    await fetch("/api/v1/announcements/manage", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ announcementId, status: targetStatus }),
    });
    setBusy(false);
    router.refresh();
  }

  return (
    <Button type="button" variant="secondary" disabled={busy} onClick={() => void onClick()}>
      {busy ? "..." : label}
    </Button>
  );
}
