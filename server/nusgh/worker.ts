import { claimJob, completeJob, failOrRetryJob, stopJobForReview } from "./queue";
import { providerRegistry } from "./providers";

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
    await stopJobForReview(job.id, result.error ?? "يتطلب ناتج المزود مراجعة بشرية.");
    return { state: "requires_review" as const, result };
  }
  if (!result.ok) {
    const state = await failOrRetryJob(job, result.error ?? "فشل تنفيذ المزود.");
    return { state, result };
  }
  await completeJob(job.id, result.output);
  return { state: "completed" as const, result };
}
