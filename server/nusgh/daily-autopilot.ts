import type { Request, Response } from "express";
import { eq } from "drizzle-orm";
import { schedules } from "../../drizzle/schema";
import { getDb } from "../db";
import { sdk } from "../_core/sdk";
import { fetchDailyTrendCandidates, nextInternalPublishingSlot } from "./conservative-intelligence";
import { createConservativeIdeaReview, getConservativeAutopilotSettings } from "./repository";
import { sendConservativeDailyReport } from "./telegram";
import { syncChannelAnalytics } from "./youtube-analytics";

export function canRunScheduledAutopilot(user: { isCron?: boolean; taskUid?: string }) {
  return Boolean(user.isCron && user.taskUid);
}

export function conservativeAutopilotSkipReason(settings: { enabled: boolean; killSwitch: boolean }) {
  if (settings.killSwitch) return "kill_switch" as const;
  if (!settings.enabled) return "disabled" as const;
  return null;
}

export async function runConservativeDailyAutopilot(projectId: number, now = new Date()) {
  const settings = await getConservativeAutopilotSettings(projectId);
  const skipped = conservativeAutopilotSkipReason(settings);
  if (skipped) return { mode: "conservative_review_gated" as const, skipped, created: [], candidateCount: 0 };
  const candidates = await fetchDailyTrendCandidates();
  const created = [] as Array<{ ideaId: number; videoId: number; score: number; scheduledFor: string }>;
  for (const candidate of candidates.slice(0, settings.dailyIdeaLimit)) {
    const result = await createConservativeIdeaReview({ projectId, candidate, scheduledFor: nextInternalPublishingSlot(now, settings.internalPublishingHours, settings.timezone) });
    if (result.created) created.push({ ideaId: result.idea.id, videoId: result.video.id, score: candidate.score, scheduledFor: result.video.scheduledFor?.toISOString() ?? "" });
  }
  return { mode: "conservative_review_gated" as const, created, candidateCount: candidates.length, settings: { dailyIdeaLimit: settings.dailyIdeaLimit, timezone: settings.timezone } };
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
    const result = await runConservativeDailyAutopilot(schedule.projectId);
    let analyticsStatus = "غير متاحة أو تحتاج إعادة ربط YouTube";
    try { await syncChannelAnalytics(schedule.projectId, 28); analyticsStatus = "تمت مزامنة قراءة فقط"; } catch { /* التحليلات ليست سببًا لإيقاف طابور المراجعة */ }
    await db.update(schedules).set({ lastRunAt: new Date() }).where(eq(schedules.id, schedule.id));
    const ownerChatId = Number(process.env.TELEGRAM_OWNER_USER_ID);
    let reportDelivery = "not_configured";
    if (Number.isSafeInteger(ownerChatId) && ownerChatId > 0) {
      try { await sendConservativeDailyReport(ownerChatId, { ...result, analyticsStatus }); reportDelivery = "sent"; } catch { reportDelivery = "failed"; }
    }
    return res.json({ ok: true, mode: "conservative_review_gated", result: { ...result, analyticsStatus }, reportDelivery });
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : "daily_autopilot_failed", timestamp: new Date().toISOString() });
  }
}
