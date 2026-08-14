import type { Request, Response } from "express";
import { eq } from "drizzle-orm";
import { schedules } from "../../drizzle/schema";
import { getDb } from "../db";
import { sdk } from "../_core/sdk";
import { runDueJobsManually } from "./worker";

export function canRunScheduledAutopilot(user: { isCron?: boolean; taskUid?: string }) {
  return Boolean(user.isCron && user.taskUid);
}

export async function dailyAutopilotHandler(req: Request, res: Response) {
  try {
    let user: { isCron?: boolean; taskUid?: string };
    try {
      user = await sdk.authenticateRequest(req);
    } catch {
      return res.status(403).json({ error: "cron_only" });
    }
    if (!canRunScheduledAutopilot(user)) return res.status(403).json({ error: "cron_only" });
    const db = await getDb();
    if (!db) throw new Error("قاعدة البيانات غير متاحة.");
    const schedule = (await db.select().from(schedules).where(eq(schedules.scheduleCronTaskUid, user.taskUid!)).limit(1))[0];
    if (!schedule) return res.json({ ok: true, skipped: "orphan" });
    if (!schedule.isEnabled) return res.json({ ok: true, skipped: "disabled" });
    const limitValue = schedule.configuration?.batchLimit;
    const limit = typeof limitValue === "number" ? Math.max(1, Math.min(10, Math.floor(limitValue))) : 5;
    const result = await runDueJobsManually(schedule.projectId, limit);
    await db.update(schedules).set({ lastRunAt: new Date() }).where(eq(schedules.id, schedule.id));
    return res.json({ ok: true, mode: "queue_only_review_gated", result });
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : "daily_autopilot_failed", timestamp: new Date().toISOString() });
  }
}
