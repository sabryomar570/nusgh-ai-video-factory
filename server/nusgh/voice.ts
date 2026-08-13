import type { ProviderAdapter, ProviderExecutionContext, ProviderExecutionResult } from "./providers";
import { providerRegistry } from "./providers";
import { ENV } from "../_core/env";
import { audioTracks } from "../../drizzle/schema";
import { getDb } from "../db";
import { storagePut } from "../storage";

export type CaptionCue = { startTimeMs: number; endTimeMs: number; text: string; direction: "rtl"; language: "ar" };

function cleanCaption(text: string) {
  return text.replace(/\s+/g, " ").trim();
}

export function createArabicCaptionCues(scenes: Array<{ startTimeMs: number; endTimeMs: number; narration?: string | null; caption?: string | null }>): CaptionCue[] {
  return scenes.flatMap(scene => {
    const text = cleanCaption(scene.caption || scene.narration || "");
    if (!text || scene.endTimeMs <= scene.startTimeMs) return [];
    return [{ startTimeMs: scene.startTimeMs, endTimeMs: scene.endTimeMs, text, direction: "rtl" as const, language: "ar" as const }];
  });
}

type ElevenLabsSynthesisInput = {
  text?: unknown;
  voiceId?: unknown;
  modelId?: unknown;
  stability?: unknown;
  similarityBoost?: unknown;
  style?: unknown;
};

function textInput(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function numericInput(value: unknown, fallback: number) {
  return typeof value === "number" && value >= 0 && value <= 1 ? value : fallback;
}

function providerFailure(status: number, details: string): ProviderExecutionResult {
  if (status === 429) return { ok: false, requiresHumanReview: true, error: "بلغ ElevenLabs حد الطلبات أو الحصة المتاحة. أوقفت المهمة للمراجعة ولن يتعطل النظام." };
  if (status === 401 || status === 403) return { ok: false, requiresHumanReview: true, error: "رفض ElevenLabs المصادقة أو الصلاحيات. تحقق من مفتاح الخادم وصلاحيات Create speech وVoices Read." };
  if (status >= 500) return { ok: false, error: `خطأ مؤقت من ElevenLabs (${status}). سيُعالج عبر إعادة محاولة الطابور.` };
  return { ok: false, requiresHumanReview: true, error: `تعذر توليد الصوت من ElevenLabs (${status}): ${details.slice(0, 240)}` };
}

export class ElevenLabsArabicTtsAdapter implements ProviderAdapter {
  readonly key = "elevenlabs-tts-ar";
  readonly type = "tts" as const;
  readonly displayName = "ElevenLabs Text-to-Speech (Arabic)";

  async healthCheck() {
    if (!ENV.elevenLabsApiKey) return { status: "unavailable" as const, detail: "مفتاح ELEVENLABS_API_KEY غير مهيأ." };
    return { status: "available" as const, detail: "الموصل مهيأ خادميًا؛ الحصة وحق الاستخدام يتحققان عند التنفيذ." };
  }

  async execute(context: ProviderExecutionContext): Promise<ProviderExecutionResult> {
    if (!ENV.elevenLabsApiKey) return { ok: false, requiresHumanReview: true, error: "مفتاح ELEVENLABS_API_KEY غير مهيأ؛ توقفت المهمة للمراجعة." };
    const input = context.input as ElevenLabsSynthesisInput;
    const text = textInput(input.text);
    const voiceId = textInput(input.voiceId);
    if (!text) return { ok: false, requiresHumanReview: true, error: "لا يوجد نص صالح لتوليد التعليق الصوتي." };
    if (!voiceId) return { ok: false, requiresHumanReview: true, error: "لم يُحدد voiceId ثابت لراوي نُسغ. توقفت المهمة للمراجعة." };

    let response: Response;
    try {
      response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=mp3_44100_128`, {
        method: "POST",
        headers: { "content-type": "application/json", "xi-api-key": ENV.elevenLabsApiKey },
        body: JSON.stringify({
          text,
          model_id: textInput(input.modelId) || "eleven_multilingual_v2",
          language_code: "ar",
          voice_settings: {
            stability: numericInput(input.stability, 0.5),
            similarity_boost: numericInput(input.similarityBoost, 0.75),
            style: numericInput(input.style, 0.1),
            use_speaker_boost: true,
          },
        }),
      });
    } catch {
      return { ok: false, error: "تعذر الاتصال بـ ElevenLabs. سيُعاد تشغيل المهمة وفق سياسة الطابور." };
    }
    if (!response.ok) return providerFailure(response.status, await response.text().catch(() => ""));

    try {
      const audio = Buffer.from(await response.arrayBuffer());
      if (!audio.length) return { ok: false, error: "أعاد ElevenLabs ملفًا صوتيًا فارغًا؛ ستعاد محاولة المهمة." };
      const saved = await storagePut(`projects/${context.projectId}/videos/${context.videoId ?? "unassigned"}/audio/narration.mp3`, audio, "audio/mpeg");
      if (context.videoId) {
        const db = await getDb();
        if (db) await db.insert(audioTracks).values({ videoId: context.videoId, audioType: "narration", provider: this.key, voiceId, storageKey: saved.key, publicUrl: saved.url, isMusicLike: false, reviewStatus: "pending", metadata: { modelId: textInput(input.modelId) || "eleven_multilingual_v2", language: "ar", requiresCommercialLicenseReview: true } });
      }
      return { ok: true, requiresHumanReview: true, output: { storageKey: saved.key, publicUrl: saved.url, contentType: "audio/mpeg", provider: this.key, voiceId, requiresCommercialLicenseReview: true } };
    } catch {
      return { ok: false, error: "تم توليد الصوت لكن تعذر حفظه أو تسجيله. سيُعاد تشغيل المهمة دون إيقاف النظام." };
    }
  }
}

export function registerArabicVoiceProvider() {
  if (!providerRegistry.get("elevenlabs-tts-ar")) providerRegistry.register(new ElevenLabsArabicTtsAdapter());
}
