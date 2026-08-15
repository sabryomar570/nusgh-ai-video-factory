import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import type { Request, Response } from "express";
import { and, eq } from "drizzle-orm";
import { approvals, audioTracks, assets, jobs, renders, scenes, videos } from "../../drizzle/schema";
import { ENV } from "../_core/env";
import { getDb } from "../db";
import { storagePut } from "../storage";
import { completeJob } from "./queue";
import { buildVideoAuditRenderManifest, createAuditEntry } from "./repository";
import { providerRegistry, type ProviderAdapter, type ProviderExecutionContext, type ProviderExecutionResult } from "./providers";
import { sendRenderedVideoForOwner } from "./telegram";

const RENDER_JOB_TYPE = "render.github_actions";
const RENDER_PROVIDER_KEY = "github-actions-ffmpeg";
const MAX_CALLBACK_VIDEO_BYTES = 45 * 1024 * 1024;
const WORKFLOW_FILE = "nusgh-render.yml";
const REPOSITORY = "sabryomar570/nusgh-ai-video-factory";

type RenderManifest = {
  version: 1;
  videoId: number;
  jobId: number;
  title: string;
  width: 1080;
  height: 1920;
  music: "off";
  scenes: Array<{ sequence: number; startTimeMs: number; endTimeMs: number; visual: { type: string; assetUrl: string }; caption: string | null }>;
  narration: { durationMs: number; segments: Array<{ index: number; url: string }>; captionSrtUrl: string };
};

function absoluteUrl(value: string, baseUrl: string) {
  return new URL(value, baseUrl).toString();
}

export function getNusghPublicBaseUrl() {
  const configured = process.env.NUSGH_PUBLIC_BASE_URL || process.env.YOUTUBE_OAUTH_REDIRECT_URI;
  if (!configured) throw new Error("تعذر تحديد رابط NUSGH العام لإرجاع ملف الرندر.");
  return new URL(configured).origin;
}

function timingSafeEqualText(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function createRenderCallbackSignature(input: { timestamp: string; jobId: number; sha256: string; secret: string }) {
  return createHmac("sha256", input.secret).update(`${input.timestamp}.${input.jobId}.${input.sha256}`).digest("hex");
}

export function isValidRenderCallback(input: { timestamp?: string; jobId?: string; sha256?: string; signature?: string; secret?: string; now?: number }) {
  const timestamp = Number(input.timestamp);
  const jobId = Number(input.jobId);
  const sha256 = input.sha256 ?? "";
  const signature = input.signature ?? "";
  const secret = input.secret ?? "";
  const now = input.now ?? Date.now();
  if (!secret || !Number.isSafeInteger(jobId) || jobId < 1 || !/^[a-f0-9]{64}$/i.test(sha256) || !/^[a-f0-9]{64}$/i.test(signature)) return false;
  if (!Number.isFinite(timestamp) || Math.abs(now - timestamp * 1_000) > 15 * 60 * 1_000) return false;
  const expected = createRenderCallbackSignature({ timestamp: String(timestamp), jobId, sha256: sha256.toLowerCase(), secret });
  return timingSafeEqualText(expected, signature.toLowerCase());
}

export function isLikelyMp4(buffer: Buffer) {
  return buffer.length >= 12 && buffer.subarray(4, 8).toString("ascii") === "ftyp";
}

async function buildRenderManifest(jobId: number): Promise<RenderManifest> {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة.");
  const job = (await db.select().from(jobs).where(eq(jobs.id, jobId)).limit(1))[0];
  if (!job?.videoId || job.jobType !== RENDER_JOB_TYPE || job.status !== "running") throw new Error("مهمة الرندر غير صالحة أو ليست قيد التنفيذ.");
  const video = (await db.select().from(videos).where(and(eq(videos.id, job.videoId), eq(videos.projectId, job.projectId))).limit(1))[0];
  if (!video || video.videoType !== "short") throw new Error("رندر GitHub الحالي يدعم Shorts العمودية فقط.");

  const readiness = await buildVideoAuditRenderManifest(job.projectId, video.id);
  if (!readiness.ready || !readiness.manifest) throw new Error(readiness.blockers.join(" ") || "مواصفة الرندر غير مكتملة.");
  if (readiness.manifest.audio.music !== "off") throw new Error("سياسة Music=OFF تمنع بدء الرندر.");

  const [videoScenes, tracks, videoAssets] = await Promise.all([
    db.select().from(scenes).where(eq(scenes.videoId, video.id)),
    db.select().from(audioTracks).where(eq(audioTracks.videoId, video.id)),
    db.select().from(assets).where(and(eq(assets.projectId, job.projectId), eq(assets.videoId, video.id))),
  ]);
  const narration = tracks.find(track => track.audioType === "narration" && track.reviewStatus === "approved" && !track.isMusicLike);
  const metadata = narration?.metadata ?? {};
  const rawSegments = Array.isArray(metadata.segments) ? metadata.segments : [];
  const segmentUrls = rawSegments.flatMap((segment, index) => {
    if (!segment || typeof segment !== "object") return [];
    const url = (segment as Record<string, unknown>).publicUrl;
    return typeof url === "string" && url ? [{ index: index + 1, url }] : [];
  });
  const directNarration = narration?.publicUrl && !narration.publicUrl.endsWith(".json") ? [{ index: 1, url: narration.publicUrl }] : [];
  const segments = segmentUrls.length ? segmentUrls : directNarration;
  const captions = metadata.captionFiles;
  const captionSrtUrl = captions && typeof captions === "object" && typeof (captions as Record<string, unknown>).srt === "string" ? (captions as Record<string, string>).srt : null;
  if (!narration || !segments.length || !captionSrtUrl || !narration.durationMs) throw new Error("التعليق الصوتي أو SRT الحقيقي غير متاح للرندر.");

  const assetsById = new Map(videoAssets.map(asset => [asset.id, asset]));
  const orderedScenes = [...videoScenes].sort((a, b) => a.sequence - b.sequence).map(scene => {
    const asset = scene.visualAssetId ? assetsById.get(scene.visualAssetId) : undefined;
    if (!asset?.publicUrl || asset.commercialUsageStatus !== "approved" || asset.provenanceStatus !== "approved") throw new Error(`المشهد #${scene.sequence} لا يملك أصلاً مرئيًا معتمدًا للرندر.`);
    return { sequence: scene.sequence, startTimeMs: scene.startTimeMs, endTimeMs: scene.endTimeMs, visual: { type: scene.visualType, assetUrl: asset.publicUrl }, caption: scene.caption ?? null };
  });
  const baseUrl = getNusghPublicBaseUrl();
  return {
    version: 1,
    videoId: video.id,
    jobId,
    title: video.title,
    width: 1080,
    height: 1920,
    music: "off",
    scenes: orderedScenes.map(scene => ({ ...scene, visual: { ...scene.visual, assetUrl: absoluteUrl(scene.visual.assetUrl, baseUrl) } })),
    narration: { durationMs: narration.durationMs, segments: segments.map(segment => ({ ...segment, url: absoluteUrl(segment.url, baseUrl) })), captionSrtUrl: absoluteUrl(captionSrtUrl, baseUrl) },
  };
}

export class GithubActionsRenderAdapter implements ProviderAdapter {
  readonly key = RENDER_PROVIDER_KEY;
  readonly type = "render" as const;
  readonly displayName = "GitHub Actions + FFmpeg Render";

  async healthCheck() {
    if (!ENV.githubRenderToken || !ENV.renderCallbackSecret) return { status: "unavailable" as const, detail: "أسرار GitHub Actions أو callback غير مهيأة." };
    return { status: "available" as const, detail: "إطلاق workflow مهيأ؛ يظل نجاح FFmpeg والتحقق النهائي مشروطين بتنفيذ GitHub." };
  }

  async execute(context: ProviderExecutionContext): Promise<ProviderExecutionResult> {
    if (!context.videoId || !context.jobId) return { ok: false, requiresHumanReview: true, error: "مهمة الرندر لا تحتوي معرف فيديو أو Job صالحًا." };
    if (!ENV.githubRenderToken || !ENV.renderCallbackSecret) return { ok: false, requiresHumanReview: true, error: "أسرار GitHub Actions أو callback غير مهيأة." };
    try {
      await buildRenderManifest(context.jobId);
    } catch (error) {
      return { ok: false, requiresHumanReview: true, error: error instanceof Error ? error.message : "مواصفة الرندر غير صالحة." };
    }
    const callbackUrl = getNusghPublicBaseUrl();
    let response: globalThis.Response;
    try {
      response = await fetch(`https://api.github.com/repos/${REPOSITORY}/actions/workflows/${WORKFLOW_FILE}/dispatches`, {
        method: "POST",
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${ENV.githubRenderToken}`,
          "X-GitHub-Api-Version": "2026-03-10",
          "content-type": "application/json",
        },
        body: JSON.stringify({ ref: "main", inputs: { job_id: String(context.jobId), callback_url: callbackUrl } }),
        signal: AbortSignal.timeout(20_000),
      });
    } catch {
      return { ok: false, error: "تعذر الاتصال بـGitHub Actions؛ ستعاد محاولة مهمة الرندر." };
    }
    if (!response.ok) {
      const retryable = response.status === 429 || response.status >= 500;
      return { ok: false, requiresHumanReview: !retryable, error: retryable ? `GitHub Actions أعاد ${response.status}؛ ستعاد محاولة الرندر.` : `رفض GitHub إطلاق workflow (${response.status}). تحقق من Actions: Write وتفعيل Actions في المستودع.` };
    }
    return { ok: true, output: { awaitingCallback: true, provider: this.key, workflow: WORKFLOW_FILE, dispatchedAt: new Date().toISOString() } };
  }
}

export function registerGithubRenderProvider() {
  if (!providerRegistry.get(RENDER_PROVIDER_KEY)) providerRegistry.register(new GithubActionsRenderAdapter());
}

export async function githubRenderManifestHandler(req: Request, res: Response) {
  const jobId = Number(req.params.jobId);
  if (!Number.isSafeInteger(jobId) || jobId < 1) return res.status(400).json({ error: "invalid_render_job" });
  const supplied = req.header("x-nusgh-render-secret") ?? "";
  if (!ENV.renderCallbackSecret || !timingSafeEqualText(supplied, ENV.renderCallbackSecret)) return res.status(403).json({ error: "invalid_render_secret" });
  try {
    return res.status(200).json(await buildRenderManifest(jobId));
  } catch (error) {
    return res.status(409).json({ error: error instanceof Error ? error.message : "render_manifest_unavailable" });
  }
}

export async function githubRenderCallbackHandler(req: Request, res: Response) {
  const jobId = Number(req.header("x-nusgh-render-job"));
  const timestamp = req.header("x-nusgh-render-timestamp") ?? "";
  const sha256 = req.header("x-nusgh-render-sha256") ?? "";
  const signature = req.header("x-nusgh-render-signature") ?? "";
  const file = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
  if (!isValidRenderCallback({ timestamp, jobId: String(jobId), sha256, signature, secret: ENV.renderCallbackSecret })) return res.status(401).json({ error: "invalid_render_callback" });
  if (!file.length || file.length > MAX_CALLBACK_VIDEO_BYTES || !isLikelyMp4(file)) return res.status(422).json({ error: "invalid_final_video_mp4" });
  if (createHash("sha256").update(file).digest("hex") !== sha256.toLowerCase()) return res.status(422).json({ error: "final_video_checksum_mismatch" });

  const db = await getDb();
  if (!db) return res.status(503).json({ error: "database_unavailable" });
  const job = (await db.select().from(jobs).where(eq(jobs.id, jobId)).limit(1))[0];
  if (!job?.videoId || job.jobType !== RENDER_JOB_TYPE) return res.status(404).json({ error: "render_job_not_found" });
  if (job.status === "completed") return res.status(200).json({ ok: true, duplicate: true });
  if (job.status !== "running") return res.status(409).json({ error: "render_job_not_running" });

  const video = (await db.select().from(videos).where(and(eq(videos.id, job.videoId), eq(videos.projectId, job.projectId))).limit(1))[0];
  if (!video || video.safetyFlags?.length) return res.status(409).json({ error: "video_safety_block" });
  const stored = await storagePut(`projects/${job.projectId}/videos/${video.id}/render/FINAL_VIDEO.mp4`, file, "video/mp4");
  const publicUrl = absoluteUrl(stored.url, getNusghPublicBaseUrl());

  try {
    await sendRenderedVideoForOwner({ videoId: video.id, title: video.title, videoUrl: publicUrl, generation: Number(job.payload?.generationNumber ?? 1), durationSeconds: Number(req.header("x-nusgh-render-duration") ?? 0), viralScore: Number(job.payload?.viralScore ?? 0) || null });
  } catch (error) {
    return res.status(502).json({ error: "telegram_delivery_failed", detail: error instanceof Error ? error.message : "unknown" });
  }

  await db.insert(renders).values({ videoId: video.id, status: "completed", renderProvider: RENDER_PROVIDER_KEY, storageKey: stored.key, publicUrl: stored.url, durationSeconds: Number(req.header("x-nusgh-render-duration") ?? 0) || null, width: 1080, height: 1920 });
  await db.update(videos).set({ status: "awaiting_review", requiresHumanReview: true, failureReason: null }).where(eq(videos.id, video.id));
  await db.insert(approvals).values({ projectId: job.projectId, videoId: video.id, approvalType: "final_video", status: "pending", requestedBy: RENDER_PROVIDER_KEY });
  await completeJob(job.id, { storageKey: stored.key, publicUrl: stored.url, sha256: sha256.toLowerCase(), deliveredToTelegram: true });
  await createAuditEntry({ projectId: job.projectId, actorType: "system", action: "created", entityType: "render", entityId: String(job.id), summary: "تم التحقق من FINAL_VIDEO.mp4 وتخزينه وإرساله إلى Telegram للمراجعة البشرية.", context: { videoId: video.id, renderProvider: RENDER_PROVIDER_KEY, bytes: file.length, sha256: sha256.toLowerCase(), music: "off" } });
  return res.status(200).json({ ok: true, status: "waiting_for_owner" });
}

export const GITHUB_RENDER_JOB_TYPE = RENDER_JOB_TYPE;
export const GITHUB_RENDER_PROVIDER_KEY = RENDER_PROVIDER_KEY;
