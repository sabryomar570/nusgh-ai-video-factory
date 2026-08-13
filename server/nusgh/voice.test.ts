import { afterEach, describe, expect, it, vi } from "vitest";
import { createArabicCaptionCues, createArabicCaptionCuesFromTiming, ElevenLabsArabicTtsAdapter, registerArabicVoiceProvider, splitArabicNarration } from "./voice";
import { providerRegistry } from "./providers";

describe("Arabic voice layer", () => {
  afterEach(() => vi.restoreAllMocks());

  it("creates RTL caption cues from timed scenes", () => {
    expect(createArabicCaptionCues([{ startTimeMs: 0, endTimeMs: 1600, narration: "  الفكرة  تبدأ  هنا ", caption: null }])).toEqual([{ startTimeMs: 0, endTimeMs: 1600, text: "الفكرة تبدأ هنا", direction: "rtl", language: "ar" }]);
  });
  it("splits long Arabic narration at sentence boundaries", () => {
    expect(splitArabicNarration("الأولى مفيدة. الثانية مفيدة.", 16)).toEqual(["الأولى مفيدة.", "الثانية مفيدة."]);
  });
  it("turns ElevenLabs character timing into RTL cues", () => {
    expect(createArabicCaptionCuesFromTiming({ characters: ["أ", "ه", "ل", "ا", "ً", "!"], character_start_times_seconds: [0, 0.1, 0.2, 0.3, 0.4, 0.5], character_end_times_seconds: [0.1, 0.2, 0.3, 0.4, 0.5, 0.6] })).toEqual([{ startTimeMs: 0, endTimeMs: 600, text: "أهلاً!", direction: "rtl", language: "ar" }]);
  });
  it("stops at review when a narrator voice is not selected", async () => {
    const result = await new ElevenLabsArabicTtsAdapter().execute({ projectId: 1, input: { text: "نص عربي" } });
    expect(result.requiresHumanReview).toBe(true);
    expect(result.ok).toBe(false);
  });
  it("registers the Arabic TTS provider without pretending it is configured", () => {
    registerArabicVoiceProvider();
    expect(providerRegistry.get("elevenlabs-tts-ar")?.key).toBe("elevenlabs-tts-ar");
  });
  it("turns an ElevenLabs rate limit into a review stop rather than a crash", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("quota", { status: 429 })));
    const result = await new ElevenLabsArabicTtsAdapter().execute({ projectId: 1, videoId: 7, input: { text: "نص عربي", voiceId: "voice_test" } });
    expect(result.ok).toBe(false);
    expect(result.requiresHumanReview).toBe(true);
    expect(result.error).toContain("حد الطلبات");
  });
});
