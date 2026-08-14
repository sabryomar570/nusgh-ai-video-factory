import { beforeEach, describe, expect, it, vi } from "vitest";

const queueMocks = vi.hoisted(() => ({ claimJob: vi.fn(), completeJob: vi.fn(), failOrRetryJob: vi.fn(), stopJobForReview: vi.fn() }));
vi.mock("./queue", () => queueMocks);

import { providerRegistry } from "./providers";
import { executeProviderJob, pipelineInitializeReviewReason } from "./worker";

describe("provider job worker", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    providerRegistry.register({ key: "reviewing-tts", type: "tts", displayName: "Review TTS", healthCheck: async () => ({ status: "available" as const }), execute: async () => ({ ok: true, requiresHumanReview: true, error: "حقوق الاستخدام تحتاج مراجعة", output: { storageKey: "audio/narration.mp3", durationMs: 1234 } }) });
  });
  it("stops an audio job for review instead of failing the worker", async () => {
    queueMocks.claimJob.mockResolvedValue({ id: 4, projectId: 1, videoId: 2, providerAdapterKey: "reviewing-tts", payload: {} });
    const outcome = await executeProviderJob(4);
    expect(outcome.state).toBe("requires_review");
    expect(queueMocks.stopJobForReview).toHaveBeenCalledWith(4, "حقوق الاستخدام تحتاج مراجعة", { storageKey: "audio/narration.mp3", durationMs: 1234 });
    expect(queueMocks.completeJob).not.toHaveBeenCalled();
  });
  it("requires a valid video and owner review at pipeline initialization", () => {
    expect(pipelineInitializeReviewReason("pipeline.initialize", 7)).toContain("ينتظران اعتماد المالك");
    expect(pipelineInitializeReviewReason("pipeline.initialize")).toContain("معرف فيديو");
  });
});
