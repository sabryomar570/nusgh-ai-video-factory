import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getDb: vi.fn(), enqueueJob: vi.fn() }));

vi.mock("../db", () => ({ getDb: mocks.getDb }));
vi.mock("./queue", () => ({ enqueueJob: mocks.enqueueJob }));

import { prepareNarrationJob } from "./repository";

function limited(value: unknown) { return { limit: vi.fn().mockResolvedValue([value]) }; }

describe("approved narration queue integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("queues ElevenLabs narration only from an approved script and the configured fixed voice", async () => {
    const video = { id: 32, projectId: 4, status: "producing", requiresHumanReview: true };
    const script = { id: 91, videoId: 32, status: "approved", hook: "هل تعرف؟", body: "هذه الفكرة مثبتة.", takeaway: "جرّبها اليوم." };
    const provider = { configuration: { voiceId: "fixed-arabic-narrator" } };
    const existing = undefined;
    const select = vi.fn()
      .mockReturnValueOnce({ from: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue(limited(video)) }) })
      .mockReturnValueOnce({ from: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ orderBy: vi.fn().mockReturnValue(limited(script)) }) }) })
      .mockReturnValueOnce({ from: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue(limited(provider)) }) })
      .mockReturnValueOnce({ from: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ orderBy: vi.fn().mockReturnValue(limited(existing)) }) }) });
    const update = vi.fn().mockReturnValue({ set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }) });
    const insert = vi.fn().mockReturnValue({ values: vi.fn().mockResolvedValue(undefined) });
    mocks.getDb.mockResolvedValue({ select, update, insert });
    mocks.enqueueJob.mockResolvedValue({ id: 701, status: "queued" });

    const result = await prepareNarrationJob({ projectId: 4, videoId: 32, requestedBy: "telegram_control_center" });

    expect(result).toMatchObject({ duplicate: false, narrationLength: "هل تعرف؟\n\nهذه الفكرة مثبتة.\n\nجرّبها اليوم.".length });
    expect(mocks.enqueueJob).toHaveBeenCalledWith(expect.objectContaining({ jobType: "tts.generate", providerAdapterKey: "elevenlabs-tts-ar", videoId: 32, payload: expect.objectContaining({ voiceId: "fixed-arabic-narrator", scriptId: 91, language: "ar" }) }));
  });
});
