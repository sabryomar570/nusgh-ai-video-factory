import { and, asc, count, desc, eq, inArray, lte } from "drizzle-orm";
import {
  assetLicenses,
  assets,
  audioTracks,
  approvals,
  auditLogs,
  ideas,
  jobs,
  projects,
  providers,
  schedules,
  scripts,
  videos,
  type Project,
} from "../../drizzle/schema";
import { getDb } from "../db";
import { reviewAsset, type AssetReviewInput } from "./asset-policy";
import { enqueueJob } from "./queue";

export const DEFAULT_PROJECT_SLUG = "nusgh-primary";

export async function ensureNusghProject(ownerUserId: number): Promise<Project> {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا.");

  const existing = await db
    .select()
    .from(projects)
    .where(and(eq(projects.ownerUserId, ownerUserId), eq(projects.slug, DEFAULT_PROJECT_SLUG)))
    .limit(1);

  if (existing[0]) return existing[0];

  await db.insert(projects).values({
    ownerUserId,
    name: "NUSGH — AI Video Factory",
    slug: DEFAULT_PROJECT_SLUG,
    description: "منظومة نُسغ لإنتاج فيديوهات YouTube العربية مع مراجعة بشرية افتراضية.",
    brandConfig: {
      nameArabic: "نُسغ",
      nameLatin: "NUSGH",
      palette: { background: "#11110f", cream: "#f1eadc", gold: "#e9b850" },
      musicPolicy: "off",
    },
  });

  const created = await db
    .select()
    .from(projects)
    .where(and(eq(projects.ownerUserId, ownerUserId), eq(projects.slug, DEFAULT_PROJECT_SLUG)))
    .limit(1);
  if (!created[0]) throw new Error("تعذر إنشاء مشروع نُسغ.");
  return created[0];
}

export async function getDashboardSnapshot(projectId: number) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا.");

  const [videoRows, jobRows, providerRows, ideaRows, latestVideos, latestJobs] = await Promise.all([
    db.select({ status: videos.status, total: count() }).from(videos).where(eq(videos.projectId, projectId)).groupBy(videos.status),
    db.select({ status: jobs.status, total: count() }).from(jobs).where(eq(jobs.projectId, projectId)).groupBy(jobs.status),
    db.select().from(providers).where(eq(providers.projectId, projectId)).orderBy(asc(providers.providerType)),
    db.select({ total: count() }).from(ideas).where(eq(ideas.projectId, projectId)),
    db.select().from(videos).where(eq(videos.projectId, projectId)).orderBy(desc(videos.updatedAt)).limit(6),
    db.select().from(jobs).where(eq(jobs.projectId, projectId)).orderBy(desc(jobs.updatedAt)).limit(6),
  ]);

  return {
    videoStatusCounts: Object.fromEntries(videoRows.map(row => [row.status, Number(row.total)])),
    jobStatusCounts: Object.fromEntries(jobRows.map(row => [row.status, Number(row.total)])),
    providerRows,
    ideaCount: Number(ideaRows[0]?.total ?? 0),
    latestVideos,
    latestJobs,
  };
}

export async function listProjectVideos(projectId: number) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا.");
  return db.select().from(videos).where(eq(videos.projectId, projectId)).orderBy(desc(videos.updatedAt)).limit(50);
}

export async function listProjectIdeas(projectId: number) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا.");
  return db.select().from(ideas).where(eq(ideas.projectId, projectId)).orderBy(desc(ideas.updatedAt)).limit(20);
}

export async function listProjectSchedules(projectId: number) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا.");
  return db.select().from(schedules).where(eq(schedules.projectId, projectId)).orderBy(desc(schedules.updatedAt)).limit(20);
}

export async function listVideosReadyForReview(projectId: number) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا.");
  return db.select().from(videos).where(and(eq(videos.projectId, projectId), eq(videos.status, "awaiting_review"))).orderBy(desc(videos.updatedAt)).limit(10);
}

export async function listPendingVideoApprovals(projectId: number) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا.");
  return db
    .select({ approvalId: approvals.id, approvalType: approvals.approvalType, requestedBy: approvals.requestedBy, createdAt: approvals.createdAt, videoId: videos.id, title: videos.title, videoStatus: videos.status, qualityScore: videos.qualityScore, safetyFlags: videos.safetyFlags })
    .from(approvals)
    .innerJoin(videos, and(eq(approvals.videoId, videos.id), eq(approvals.projectId, videos.projectId)))
    .where(and(eq(approvals.projectId, projectId), eq(approvals.status, "pending")))
    .orderBy(asc(approvals.createdAt))
    .limit(20);
}

export async function getVideoWorkflowStatus(projectId: number, videoId: number) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا.");
  const video = (await db.select().from(videos).where(and(eq(videos.projectId, projectId), eq(videos.id, videoId))).limit(1))[0];
  if (!video) throw new Error("الفيديو المطلوب غير موجود داخل مشروع نُسغ.");
  const [latestJobs, tracks, pendingApprovals] = await Promise.all([
    db.select().from(jobs).where(and(eq(jobs.projectId, projectId), eq(jobs.videoId, videoId))).orderBy(desc(jobs.updatedAt)).limit(5),
    db.select().from(audioTracks).where(eq(audioTracks.videoId, videoId)).orderBy(desc(audioTracks.createdAt)).limit(3),
    db.select().from(approvals).where(and(eq(approvals.projectId, projectId), eq(approvals.videoId, videoId), eq(approvals.status, "pending"))).orderBy(asc(approvals.createdAt)).limit(5),
  ]);
  return { video, latestJobs, tracks, pendingApprovals };
}

export async function listProjectJobs(projectId: number) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا.");
  return db.select().from(jobs).where(eq(jobs.projectId, projectId)).orderBy(desc(jobs.updatedAt)).limit(100);
}

export async function listProjectProviders(projectId: number) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا.");
  return db.select().from(providers).where(eq(providers.projectId, projectId)).orderBy(asc(providers.providerType));
}

export async function setElevenLabsVoiceId(projectId: number, voiceId: string) {
  const normalized = voiceId.trim();
  if (!/^[A-Za-z0-9_-]{4,160}$/.test(normalized)) throw new Error("Voice ID غير صالح.");
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا.");
  const existing = (await db.select().from(providers).where(and(eq(providers.projectId, projectId), eq(providers.adapterKey, "elevenlabs-tts-ar"))).limit(1))[0];
  const configuration = { ...(existing?.configuration ?? {}), voiceId: normalized, modelId: "eleven_multilingual_v2" };
  if (existing) {
    await db.update(providers).set({ configuration, isEnabled: true, status: "limited", capabilityNotes: "Voice ID مهيأ؛ يظل الصوت مقيدًا بمراجعة الحقوق والحصة." }).where(eq(providers.id, existing.id));
  } else {
    await db.insert(providers).values({ projectId, providerType: "tts", adapterKey: "elevenlabs-tts-ar", displayName: "ElevenLabs Text-to-Speech (Arabic)", status: "limited", isEnabled: true, isFallback: false, freeTierStatus: "free_tier_limited", configuration, capabilityNotes: "Voice ID مهيأ؛ يظل الصوت مقيدًا بمراجعة الحقوق والحصة." });
  }
  return (await db.select().from(providers).where(and(eq(providers.projectId, projectId), eq(providers.adapterKey, "elevenlabs-tts-ar"))).limit(1))[0];
}

export async function getElevenLabsVoiceId(projectId: number) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا.");
  const provider = (await db.select().from(providers).where(and(eq(providers.projectId, projectId), eq(providers.adapterKey, "elevenlabs-tts-ar"))).limit(1))[0];
  const voiceId = provider?.configuration?.voiceId;
  return typeof voiceId === "string" ? voiceId : null;
}

export function composeArabicNarration(script: { hook?: string | null; body: string; takeaway?: string | null }) {
  return [script.hook, script.body, script.takeaway].filter((part): part is string => Boolean(part?.trim())).map(part => part.trim()).join("\n\n");
}

export async function prepareNarrationJob(input: { projectId: number; videoId: number; requestedBy: string }) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا.");
  const video = (await db.select().from(videos).where(and(eq(videos.id, input.videoId), eq(videos.projectId, input.projectId))).limit(1))[0];
  if (!video) throw new Error("الفيديو المطلوب غير موجود داخل مشروع نُسغ.");
  if (video.requiresHumanReview && video.status !== "producing") throw new Error("يتطلب الفيديو استكمال واعتماد المراحل التحريرية قبل توليد الصوت.");

  const script = (await db.select().from(scripts).where(and(eq(scripts.videoId, input.videoId), eq(scripts.status, "approved"))).orderBy(desc(scripts.version)).limit(1))[0];
  if (!script) throw new Error("لا يوجد سكريبت معتمد لهذا الفيديو؛ لا يمكن توليد صوت غير معتمد.");
  const narration = composeArabicNarration(script);
  if (!narration) throw new Error("السكريبت المعتمد لا يحتوي نصًا صالحًا للتعليق الصوتي.");
  const voiceId = await getElevenLabsVoiceId(input.projectId);
  if (!voiceId) throw new Error("لم يُحدد Voice ID ثابت. استخدم /voice <id> قبل جدولة الصوت.");

  const existing = (await db.select().from(jobs).where(and(eq(jobs.projectId, input.projectId), eq(jobs.videoId, input.videoId), eq(jobs.jobType, "tts.generate"), inArray(jobs.status, ["queued", "running", "retrying", "requires_review", "completed"]))).orderBy(desc(jobs.id)).limit(1))[0];
  if (existing) return { job: existing, duplicate: true, narrationLength: narration.length };

  await db.update(videos).set({ status: "producing", requiresHumanReview: true, failureReason: null }).where(eq(videos.id, input.videoId));
  const job = await enqueueJob({
    projectId: input.projectId,
    videoId: input.videoId,
    jobType: "tts.generate",
    providerAdapterKey: "elevenlabs-tts-ar",
    priority: 50,
    maxAttempts: 3,
    timeoutSeconds: 180,
    payload: { text: narration, voiceId, modelId: "eleven_multilingual_v2", language: "ar", scriptId: script.id, requestedBy: input.requestedBy },
  });
  await createAuditEntry({ projectId: input.projectId, actorType: "system", action: "created", entityType: "job", entityId: String(job.id), summary: "أضيف توليد التعليق الصوتي من سكريبت معتمد إلى الطابور.", context: { videoId: input.videoId, scriptId: script.id, narrationLength: narration.length } });
  return { job, duplicate: false, narrationLength: narration.length };
}

export async function getProjectById(projectId: number) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا.");
  return (await db.select().from(projects).where(eq(projects.id, projectId)).limit(1))[0];
}

export async function setProjectAutomationMode(projectId: number, mode: "full_review" | "semi_auto" | "conditional_auto") {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا.");
  await db.update(projects).set({ automationMode: mode }).where(eq(projects.id, projectId));
  return getProjectById(projectId);
}

export async function decideVideoApproval(input: {
  projectId: number;
  videoId: number;
  decision: "approved" | "rejected" | "requires_changes";
  approvalType?: "idea" | "final_video";
  actorUserId?: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا.");
  const video = await db.select().from(videos).where(and(eq(videos.id, input.videoId), eq(videos.projectId, input.projectId))).limit(1);
  if (!video[0]) throw new Error("الفيديو المطلوب غير موجود داخل مشروع نُسغ.");
  const approvalType = input.approvalType ?? "final_video";
  const pendingApprovals = await db.select().from(approvals).where(and(eq(approvals.projectId, input.projectId), eq(approvals.videoId, input.videoId), eq(approvals.approvalType, approvalType), eq(approvals.status, "pending"))).limit(5);
  if (!pendingApprovals.length) throw new Error("لا يوجد طلب اعتماد معلّق لهذه المرحلة؛ لن يُنفذ قرار مكرر أو قديم.");
  const nextStatus = input.decision === "approved" ? (approvalType === "idea" ? "researching" : "approved") : input.decision === "rejected" ? "cancelled" : "draft";
  await db.update(videos).set({ status: nextStatus, requiresHumanReview: input.decision !== "approved" }).where(eq(videos.id, input.videoId));
  await db.update(approvals).set({ status: input.decision, decidedByUserId: input.actorUserId, decidedAt: new Date() }).where(and(eq(approvals.projectId, input.projectId), eq(approvals.videoId, input.videoId), eq(approvals.approvalType, approvalType), eq(approvals.status, "pending")));
  return { ...video[0], status: nextStatus, requiresHumanReview: input.decision !== "approved" };
}

export async function requestInitialVideoReview(input: { projectId: number; videoId: number; requestedBy: string }) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا.");
  const video = (await db.select().from(videos).where(and(eq(videos.id, input.videoId), eq(videos.projectId, input.projectId))).limit(1))[0];
  if (!video) throw new Error("الفيديو المطلوب غير موجود داخل مشروع نُسغ.");
  await db.update(videos).set({ status: "awaiting_review", requiresHumanReview: true }).where(eq(videos.id, input.videoId));
  await db.insert(approvals).values({ projectId: input.projectId, videoId: input.videoId, approvalType: "idea", status: "pending", requestedBy: input.requestedBy });
  return video;
}

export async function createIdea(input: {
  projectId: number;
  title: string;
  centralIdea: string;
  contentPillar: string;
  targetFormat: "short" | "long_form";
}) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا.");
  await db.insert(ideas).values({ ...input, source: "manual" });
  const created = await db.select().from(ideas).where(eq(ideas.projectId, input.projectId)).orderBy(desc(ideas.id)).limit(1);
  return created[0];
}

export async function createVideoFromIdea(input: {
  projectId: number;
  ideaId: number;
  title: string;
  videoType: "short" | "long_form";
  targetDurationSeconds: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا.");
  await db.insert(videos).values({ ...input, status: "draft", requiresHumanReview: true });
  const created = await db.select().from(videos).where(eq(videos.projectId, input.projectId)).orderBy(desc(videos.id)).limit(1);
  return created[0];
}

export async function createAuditEntry(input: {
  projectId: number;
  actorUserId?: number;
  actorType: string;
  action: "created" | "updated" | "deleted" | "approved" | "rejected" | "regenerated" | "published" | "failed" | "cancelled" | "review_requested";
  entityType: string;
  entityId: string;
  summary: string;
  context?: Record<string, unknown>;
}) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا.");
  await db.insert(auditLogs).values(input);
}

export async function registerAssetWithLicense(input: AssetReviewInput & { projectId: number; videoId?: number; assetType: string; label: string; provider?: string; storageKey?: string; publicUrl?: string }) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا.");
  const review = reviewAsset(input);
  await db.insert(assets).values({
    projectId: input.projectId,
    videoId: input.videoId,
    assetType: input.assetType,
    label: input.label,
    provider: input.provider,
    storageKey: input.storageKey,
    publicUrl: input.publicUrl,
    sourceUrl: input.sourceUrl,
    licenseType: input.licenseId,
    commercialUsageStatus: review.status === "approved" ? "approved" : "pending",
    provenanceStatus: review.status === "approved" ? "approved" : "pending",
    attributionRequirement: input.attributionRequired ? input.attributionText ?? "مطلوب قبل النشر" : null,
    metadata: { sourceType: input.sourceType, reviewReason: review.reason },
  });
  const created = await db.select().from(assets).where(eq(assets.projectId, input.projectId)).orderBy(desc(assets.id)).limit(1);
  const asset = created[0];
  if (!asset) throw new Error("تعذر حفظ الأصل.");
  if (input.licenseId) await db.insert(assetLicenses).values({ assetId: asset.id, licenseName: input.licenseId, licenseUrl: input.sourceUrl, commercialUseAllowed: input.commercialUseConfirmed, modificationAllowed: input.sourceType !== "owner_supplied", reviewerNotes: review.reason, verifiedAt: review.status === "approved" ? new Date() : null });
  return { asset, review };
}

export function canUseAssetInRender(asset: { commercialUsageStatus: string; provenanceStatus: string }) {
  return asset.commercialUsageStatus === "approved" && asset.provenanceStatus === "approved";
}

export async function findDueJobs(projectId: number, now = new Date()) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا.");
  return db
    .select()
    .from(jobs)
    .where(
      and(
        eq(jobs.projectId, projectId),
        inArray(jobs.status, ["queued", "retrying"]),
        lte(jobs.availableAt, now)
      )
    )
    .orderBy(desc(jobs.priority), asc(jobs.createdAt))
    .limit(10);
}
