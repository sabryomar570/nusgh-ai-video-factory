import { and, eq, inArray, sql } from "drizzle-orm";
import { jobLogs, jobs, type Job } from "../../drizzle/schema";
import { SAFETY_STOP_REASONS, type SafetyStopReason } from "../../shared/nusgh";
import { getDb } from "../db";

export type EnqueueJobInput = {
  projectId: number;
  videoId?: number;
  jobType: string;
  payload?: Record<string, unknown>;
  priority?: number;
  providerAdapterKey?: string;
  maxAttempts?: number;
  timeoutSeconds?: number;
};

export function calculateBackoffMs(attempt: number): number {
  return Math.min(15 * 60 * 1000, 15_000 * 2 ** Math.max(0, attempt - 1));
}

export function isSafetyStopReason(value: string): value is SafetyStopReason {
  return (SAFETY_STOP_REASONS as readonly string[]).includes(value);
}

async function logJob(jobId: number, level: "info" | "warn" | "error", message: string, context?: Record<string, unknown>) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا.");
  await db.insert(jobLogs).values({ jobId, level, message, context });
}

export async function enqueueJob(input: EnqueueJobInput) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا.");
  await db.insert(jobs).values({
    ...input,
    priority: input.priority ?? 0,
    maxAttempts: input.maxAttempts ?? 3,
    timeoutSeconds: input.timeoutSeconds ?? 120,
    status: "queued",
  });
  const created = await db.select().from(jobs).where(eq(jobs.projectId, input.projectId)).orderBy(sql`${jobs.id} desc`).limit(1);
  const job = created[0];
  if (!job) throw new Error("تعذر إضافة المهمة إلى الطابور.");
  await logJob(job.id, "info", "تمت إضافة المهمة إلى الطابور.");
  return job;
}

export async function claimJob(jobId: number): Promise<Job | null> {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا.");
  const result = await db
    .update(jobs)
    .set({ status: "running", startedAt: new Date(), attemptCount: sql`${jobs.attemptCount} + 1` })
    .where(and(eq(jobs.id, jobId), inQueueState()));
  if ((result as unknown as { affectedRows?: number }).affectedRows === 0) return null;
  const row = await db.select().from(jobs).where(eq(jobs.id, jobId)).limit(1);
  if (!row[0]) return null;
  await logJob(jobId, "info", "بدأ تنفيذ المهمة.");
  return row[0];
}

function inQueueState() {
  return inArray(jobs.status, ["queued", "retrying"]);
}

export async function completeJob(jobId: number, result?: Record<string, unknown>) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا.");
  await db.update(jobs).set({ status: "completed", result, completedAt: new Date() }).where(eq(jobs.id, jobId));
  await logJob(jobId, "info", "اكتمل تنفيذ المهمة.");
}

export async function stopJobForReview(jobId: number, reason: string, result?: Record<string, unknown>) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا.");
  await db
    .update(jobs)
    .set({ status: "requires_review", requiresHumanReview: true, failureReason: reason, result })
    .where(eq(jobs.id, jobId));
  await logJob(jobId, "warn", "توقفت المهمة للمراجعة البشرية.", { reason });
}

export async function failOrRetryJob(job: Job, reason: string, safetyReason?: string) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا.");
  if (safetyReason && isSafetyStopReason(safetyReason)) {
    await stopJobForReview(job.id, reason);
    return "requires_review" as const;
  }
  const nextAttempt = job.attemptCount + 1;
  if (nextAttempt >= job.maxAttempts) {
    await db.update(jobs).set({ status: "failed", failureReason: reason, completedAt: new Date() }).where(eq(jobs.id, job.id));
    await logJob(job.id, "error", "فشلت المهمة بعد استنفاد محاولات إعادة التشغيل.", { reason });
    return "failed" as const;
  }
  const availableAt = new Date(Date.now() + calculateBackoffMs(nextAttempt));
  await db
    .update(jobs)
    .set({ status: "retrying", failureReason: reason, attemptCount: nextAttempt, availableAt })
    .where(eq(jobs.id, job.id));
  await logJob(job.id, "warn", "ستعاد محاولة المهمة بعد تأخير تزايدي.", { reason, nextAttempt, availableAt: availableAt.toISOString() });
  return "retrying" as const;
}
