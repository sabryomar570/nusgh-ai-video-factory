import type { ProviderAdapter, ProviderExecutionContext, ProviderExecutionResult } from "./providers";
import { providerRegistry } from "./providers";
import { ENV } from "../_core/env";
import { audioTracks } from "../../drizzle/schema";
import { getDb } from "../db";
import { storagePut } from "../storage";

export type CaptionCue = { startTimeMs: number; endTimeMs: number; text: string; direction: "rtl"; language: "ar" };
type ElevenLabsAlignment = { characters?: string[]; character_start_times_seconds?: number[]; character_end_times_seconds?: number[] };
type ElevenLabsTimedResponse = { audio_base64?: string; alignment?: ElevenLabsAlignment; normalized_alignment?: ElevenLabsAlignment };
const MAX_ELEVENLABS_SEGMENT_CHARS = 2_500;

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

export function splitArabicNarration(text: string, maxChars = MAX_ELEVENLABS_SEGMENT_CHARS) {
  const normalized = cleanCaption(text);
  if (!normalized) return [];
  const sentences = normalized.match(/[^.!؟…]+[.!؟…]?/g) ?? [normalized];
  const chunks: string[] = [];
  let current = "";
  for (const sentence of sentences) {
    const candidate = cleanCaption(`${current} ${sentence}`);
    if (candidate.length <= maxChars) current = candidate;
    else if (current) {
      chunks.push(current);
      current = cleanCaption(sentence);
    } else {
      const words = sentence.trim().split(/\s+/);
      let longChunk = "";
      for (const word of words) {
        const candidateWord = cleanCaption(`${longChunk} ${word}`);
        if (candidateWord.length > maxChars && longChunk) {
          chunks.push(longChunk);
          longChunk = word;
        } else longChunk = candidateWord;
      }
      current = longChunk;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

export function createArabicCaptionCuesFromTiming(alignment: ElevenLabsAlignment | undefined): CaptionCue[] {
  const characters = alignment?.characters ?? [];
  const starts = alignment?.character_start_times_seconds ?? [];
  const ends = alignment?.character_end_times_seconds ?? [];
  if (!characters.length || characters.length !== starts.length || characters.length !== ends.length) return [];
  const cues: CaptionCue[] = [];
  let text = "";
  let cueStart = starts[0];
  for (let index = 0; index < characters.length; index++) {
    text += characters[index];
    const boundary = /[.!؟…،]/.test(characters[index]) || text.trim().split(/\s+/).length >= 8 || index === characters.length - 1;
    if (!boundary) continue;
    const cueText = cleanCaption(text);
    if (cueText) cues.push({ startTimeMs: Math.max(0, Math.round(cueStart * 1000)), endTimeMs: Math.max(1, Math.round(ends[index] * 1000)), text: cueText, direction: "rtl", language: "ar" });
    text = "";
    cueStart = starts[index + 1] ?? ends[index];
  }
  return cues.filter(cue => cue.endTimeMs > cue.startTimeMs);
}

function subtitleTimestamp(milliseconds: number, separator: "," | ".") {
  const total = Math.max(0, Math.round(milliseconds));
  const hours = Math.floor(total / 3_600_000);
  const minutes = Math.floor((total % 3_600_000) / 60_000);
  const seconds = Math.floor((total % 60_000) / 1_000);
  const fraction = String(total % 1_000).padStart(3, "0");
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}${separator}${fraction}`;
}

export function renderArabicSrt(cues: CaptionCue[]) {
  return cues.map((cue, index) => `${index + 1}\n${subtitleTimestamp(cue.startTimeMs, ",")} --> ${subtitleTimestamp(cue.endTimeMs, ",")}\n${cue.text}`).join("\n\n") + (cues.length ? "\n" : "");
}

export function renderArabicWebVtt(cues: CaptionCue[]) {
  return `WEBVTT\n\n${cues.map(cue => `${subtitleTimestamp(cue.startTimeMs, ".")} --> ${subtitleTimestamp(cue.endTimeMs, ".")}\n<c.ar>${cue.text}</c>`).join("\n\n")}${cues.length ? "\n" : ""}`;
}

type ElevenLabsSynthesisInput = { text?: unknown; voiceId?: unknown; modelId?: unknown; stability?: unknown; similarityBoost?: unknown; style?: unknown };

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
    const chunks = splitArabicNarration(text);
    if (chunks.length > 1) return { ok: false, requiresHumanReview: true, error: `يتطلب النص ${chunks.length} مقاطع صوتية. سيقسمه خط الإنتاج قبل التوليد بدل قصه أو دمجه بصورة غير دقيقة.` };

    let response: Response;
    try {
      response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}/with-timestamps?output_format=mp3_44100_128`, {
        method: "POST",
        headers: { "content-type": "application/json", "xi-api-key": ENV.elevenLabsApiKey },
        body: JSON.stringify({
          text,
          model_id: textInput(input.modelId) || "eleven_multilingual_v2",
          language_code: "ar",
          voice_settings: { stability: numericInput(input.stability, 0.5), similarity_boost: numericInput(input.similarityBoost, 0.75), style: numericInput(input.style, 0.1), use_speaker_boost: true },
        }),
      });
    } catch {
      return { ok: false, error: "تعذر الاتصال بـ ElevenLabs. سيُعاد تشغيل المهمة وفق سياسة الطابور." };
    }
    if (!response.ok) return providerFailure(response.status, await response.text().catch(() => ""));

    try {
      const payload = await response.json() as ElevenLabsTimedResponse;
      const audio = Buffer.from(payload.audio_base64 ?? "", "base64");
      if (!audio.length) return { ok: false, error: "أعاد ElevenLabs ملفًا صوتيًا فارغًا؛ ستعاد محاولة المهمة." };
      const alignment = payload.normalized_alignment ?? payload.alignment;
      const captionCues = createArabicCaptionCuesFromTiming(alignment);
      const durationMs = Math.max(0, ...((alignment?.character_end_times_seconds ?? []).map(value => Math.round(value * 1000))));
      const saved = await storagePut(`projects/${context.projectId}/videos/${context.videoId ?? "unassigned"}/audio/narration.mp3`, audio, "audio/mpeg");
      const subtitles = { srt: renderArabicSrt(captionCues), vtt: renderArabicWebVtt(captionCues) };
      const srtFile = await storagePut(`projects/${context.projectId}/videos/${context.videoId ?? "unassigned"}/captions/ar.srt`, Buffer.from(subtitles.srt, "utf8"), "application/x-subrip");
      const vttFile = await storagePut(`projects/${context.projectId}/videos/${context.videoId ?? "unassigned"}/captions/ar.vtt`, Buffer.from(subtitles.vtt, "utf8"), "text/vtt; charset=utf-8");
      if (context.videoId) {
        const db = await getDb();
        if (db) await db.insert(audioTracks).values({ videoId: context.videoId, audioType: "narration", provider: this.key, voiceId, storageKey: saved.key, publicUrl: saved.url, durationMs: durationMs || null, isMusicLike: false, reviewStatus: "pending", metadata: { modelId: textInput(input.modelId) || "eleven_multilingual_v2", language: "ar", captionCues, captionFiles: { srt: srtFile.url, vtt: vttFile.url }, requiresCommercialLicenseReview: true } });
      }
      return { ok: true, requiresHumanReview: true, output: { storageKey: saved.key, publicUrl: saved.url, contentType: "audio/mpeg", provider: this.key, voiceId, durationMs, captionCues, captionFiles: { srt: srtFile.url, vtt: vttFile.url }, requiresCommercialLicenseReview: true } };
    } catch {
      return { ok: false, error: "تم توليد الصوت لكن تعذر حفظه أو تسجيله. سيُعاد تشغيل المهمة دون إيقاف النظام." };
    }
  }
}

export function registerArabicVoiceProvider() {
  if (!providerRegistry.get("elevenlabs-tts-ar")) providerRegistry.register(new ElevenLabsArabicTtsAdapter());
}
