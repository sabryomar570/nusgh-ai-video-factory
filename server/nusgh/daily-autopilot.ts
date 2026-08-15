import type { Request, Response } from "express";
import { eq } from "drizzle-orm";
import { schedules } from "../../drizzle/schema";
import { getDb } from "../db";
import { sdk } from "../_core/sdk";
import { fetchDailyTrendCandidates, nextInternalPublishingSlot, scheduledGenerationSlot } from "./conservative-intelligence";
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

export async function runConservativeDailyAutopilot(projectId: number, now = new Date(), limitOverride?: number) {
  const settings = await getConservativeAutopilotSettings(projectId);
  const skipped = conservativeAutopilotSkipReason(settings);
  if (skipped) return { mode: "conservative_review_gated" as const, skipped, created: [], candidateCount: 0 };
  if (!settings.stages.research) return { mode: "conservative_review_gated" as const, skipped: "research_disabled" as const, created: [], candidateCount: 0 };
  const candidates = await fetchDailyTrendCandidates();
  const created = [] as Array<{ ideaId: number; videoId: number; score: number; scheduledFor: string }>;
  for (const candidate of candidates.slice(0, limitOverride ?? settings.dailyIdeaLimit)) {
    const result = await createConservativeIdeaReview({ projectId, candidate, scheduledFor: nextInternalPublishingSlot(now, settings.internalPublishingHours, settings.timezone) });
    if (result.created) created.push({ ideaId: result.idea.id, videoId: result.video.id, score: candidate.score, scheduledFor: result.video.scheduledFor?.toISOString() ?? "" });
  }
  return { mode: "conservative_review_gated" as const, created, candidateCount: candidates.length, settings: { dailyIdeaLimit: settings.dailyIdeaLimit, timezone: settings.timezone } };
}

export function evaluateScheduledProductionTick(input: { now: Date; configuration?: Record<string, unknown>; settings: { dailyVideoLimit: number; generationTimes: string[]; timezone: string } }) {
  const slot = scheduledGenerationSlot(input.now, input.settings.generationTimes, input.settings.timezone);
  if (!slot) return { run: false as const, skipped: "not_generation_time" as const };
  const configuration = input.configuration ?? {};
  if (configuration.lastGenerationSlotKey === slot.slotKey) return { run: false as const, skipped: "slot_already_processed" as const, slot };
  const completedForDate = configuration.generationDate === slot.dateKey && typeof configuration.generatedCount === "number" ? configuration.generatedCount : 0;
  if (completedForDate >= input.settings.dailyVideoLimit) return { run: false as const, skipped: "daily_video_limit_reached" as const, slot };
  return { run: true as const, slot, completedForDate };
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
    const settings = await getConservativeAutopilotSettings(schedule.projectId);
    const tick = evaluateScheduledProductionTick({ now: new Date(), configuration: schedule.configuration ?? {}, settings });
    if (!tick.run) return res.json({ ok: true, skipped: tick.skipped, mode: "scheduled_production" });
    const result = await runConservativeDailyAutopilot(schedule.projectId, new Date(), 1);
    let analyticsStatus = "غير متاحة أو تحتاج إعادة ربط YouTube";
    try { await syncChannelAnalytics(schedule.projectId, 28); analyticsStatus = "تمت مزامنة قراءة فقط"; } catch { /* التحليلات ليست سببًا لإيقاف طابور المراجعة */ }
    await db.update(schedules).set({ lastRunAt: new Date(), configuration: { ...(schedule.configuration ?? {}), lastGenerationSlotKey: tick.slot.slotKey, generationDate: tick.slot.dateKey, generatedCount: tick.completedForDate + result.created.length, generationTimes: settings.generationTimes, dailyVideoLimit: settings.dailyVideoLimit, timezone: settings.timezone } }).where(eq(schedules.id, schedule.id));
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
