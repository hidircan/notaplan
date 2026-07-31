import { describe, it, beforeEach } from "vitest";
import { expect } from "vitest";
import { promises as fs } from "fs";
import {
  WORKFLOWS_FILE,
  listWorkflowRuns,
  recordWorkflowRun,
} from "../workflows/state";
import type { WorkflowId, WorkflowRunResult } from "../workflows/types";

beforeEach(async () => {
  await fs.rm(WORKFLOWS_FILE, { force: true });
});

function makeRun(
  workflowId: WorkflowId,
  tenantId: string,
  startedAt: string
): WorkflowRunResult {
  return {
    workflowId,
    tenantId,
    startedAt,
    finishedAt: startedAt,
    durationMs: 5,
    success: true,
    steps: [],
  };
}

describe("workflow run store (file mode)", () => {
  it("listWorkflowRuns diğer tenant'ın run'larını görmez", async () => {
    await recordWorkflowRun(
      makeRun("payment_reminders", "tenant-a", "2026-01-01T00:00:00.000Z")
    );
    await recordWorkflowRun(
      makeRun("lesson_reminders", "tenant-a", "2026-01-01T00:00:01.000Z")
    );

    const runs = await listWorkflowRuns("tenant-b", 50);
    expect(runs).toHaveLength(0);
  });

  it("yalnızca kendi tenant'ının run'larını en yeni önce döndürür", async () => {
    await recordWorkflowRun(
      makeRun("payment_reminders", "tenant-isolation", "2026-01-01T00:00:00.000Z")
    );
    await recordWorkflowRun(
      makeRun("payment_reminders", "tenant-isolation", "2026-01-01T00:00:01.000Z")
    );
    await recordWorkflowRun(
      makeRun("weekly_reports", "tenant-other", "2026-01-01T00:00:02.000Z")
    );

    const runs = await listWorkflowRuns("tenant-isolation", 50);
    expect(runs.every((r) => r.tenantId === "tenant-isolation")).toBe(true);
    expect(runs.some((r) => r.workflowId === "weekly_reports")).toBe(false);
    expect(runs[0].startedAt).toBe("2026-01-01T00:00:01.000Z");
  });

  it("limit uygulanır", async () => {
    await recordWorkflowRun(
      makeRun("payment_reminders", "tenant-limit", "2026-01-01T00:00:00.000Z")
    );
    await recordWorkflowRun(
      makeRun("payment_reminders", "tenant-limit", "2026-01-01T00:00:01.000Z")
    );

    const runs = await listWorkflowRuns("tenant-limit", 1);
    expect(runs).toHaveLength(1);
    expect(runs[0].startedAt).toBe("2026-01-01T00:00:01.000Z");
  });
});
