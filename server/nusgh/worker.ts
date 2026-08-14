import { claimJob, completeJob, failOrRetryJob, stopJobForReview } from "./queue";
import { providerRegistry } from "./providers";
import { findDueJobs, requestInitialVideoReview } from "./repository";

export function pipelineInitializeReviewReason(jobType: string, videoId?: number | null) {
  if (jobType !== "pipeline.initialize") return "هذه الدالة مخصصة لمهمة pipeline.initialize فقط.";
  if (!videoId) return "مهمة بدء خط الإنتاج لا تحتوي على معرف فيديو صالح.";
  return "تم إنشاء الفكرة والفيديو؛ ينتظران اعتماد المالك قبل بدء البحث والإنتاج.";
}

export async function executePipelineInitializeJob(jobId: number) {
  const job = await claimJob(jobId);
  if (!job) return { state: "not_claimed" as const };
  const reason = pipelineInitializeReviewReason(job.jobType, job.videoId);
  if (job.jobType !== "pipeline.initialize" || !job.videoId) {
    const state = await failOrRetryJob(job, reason);
    return { state, reason };
  }
  await requestInitialVideoReview({ projectId: job.projectId, videoId: job.videoId, requestedBy: "pipeline.initialize" });
  await stopJobForReview(job.id, reason);
  return { state: "requires_review" as const, reason };
}

export async function executeProviderJob(jobId: number) {
  const job = await claimJob(jobId);
  if (!job) return { state: "not_claimed" as const };
  if (!job.providerAdapterKey) {
    const state = await failOrRetryJob(job, "المهمة لا تحدد موصل مزود.");
    return { state };
  }
  const adapter = providerRegistry.get(job.providerAdapterKey);
  if (!adapter) {
    const state = await failOrRetryJob(job, `الموصل ${job.providerAdapterKey} غير مسجل.`);
    return { state };
  }

  const result = await adapter.execute({ projectId: job.projectId, videoId: job.videoId ?? undefined, jobId: job.id, input: job.payload ?? {} });
  if (result.requiresHumanReview) {
    await stopJobForReview(job.id, result.error ?? "يتطلب ناتج المزود مراجعة بشرية.", result.output);
    return { state: "requires_review" as const, result };
  }
  if (!result.ok) {
    const state = await failOrRetryJob(job, result.error ?? "فشل تنفيذ المزود.");
    return { state, result };
  }
  await completeJob(job.id, result.output);
  return { state: "completed" as const, result };
}

export async function runDueJobsManually(projectId: number, limit = 5) {
  const dueJobs = (await findDueJobs(projectId)).slice(0, Math.max(1, Math.min(limit, 10)));
  const outcomes: Array<{ jobId: number; state: string }> = [];
  for (const job of dueJobs) {
    const outcome = job.jobType === "pipeline.initialize" ? await executePipelineInitializeJob(job.id) : await executeProviderJob(job.id);
    outcomes.push({ jobId: job.id, state: outcome.state });
  }
  return { scanned: dueJobs.length, outcomes, executionMode: "manual_on_demand" as const };
}
