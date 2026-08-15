import { describe, expect, it } from "vitest";
import { findMatchingPendingReview, formatConservativeDailyReport, formatRenderManifestPreview, formatVideoWorkflowStatus, formatYouTubeConnectionStatus, hasValidTelegramWebhookSecret, isAllowedTelegramOwner, verifyTelegramBot } from "./telegram";

describe("Telegram configuration", () => {
  const shouldVerifyExternalProvider = process.env.NUSGH_VERIFY_EXTERNAL_PROVIDERS === "true";
  it.skipIf(!shouldVerifyExternalProvider)("validates the configured bot token through Telegram getMe", async () => {
    const bot = await verifyTelegramBot();
    expect(bot.id).toBeTypeOf("number");
    expect(bot.first_name.length).toBeGreaterThan(0);
  }, 22_000);

  it("rejects an incorrect webhook secret", () => {
    expect(hasValidTelegramWebhookSecret("incorrect-webhook-secret")).toBe(false);
  });

  it("does not allow an unrelated Telegram user ID", () => {
    expect(isAllowedTelegramOwner("0")).toBe(false);
  });
  it("labels a render preview as review-only and never as a produced video", () => {
    const ready = formatRenderManifestPreview(5, { ready: true, blockers: [], manifest: { dimensions: { width: 1080, height: 1920 }, audio: { sourceKind: "segmented_manifest" }, captions: { direction: "rtl", format: "webvtt" } } });
    const blocked = formatRenderManifestPreview(5, { ready: false, blockers: ["لا توجد ترجمات عربية متزامنة للمراجعة."], manifest: null });
    expect(ready).toContain("جاهز للمراجعة فقط");
    expect(ready).toContain("لم يُنشأ فيديو ولم يبدأ نشر");
    expect(blocked).toContain("محجوبة للمراجعة");
    expect(blocked).toContain("لا توجد ترجمات عربية");
  });
  it("shows the recorded safe-stop reason in video status", () => {
    const status = formatVideoWorkflowStatus({ video: { id: 9, title: "اختبار", status: "requires_review", safetyFlags: ["copyright_uncertainty"], failureReason: "render_manifest_incomplete" }, pendingApprovals: [], latestJobs: [{ jobType: "render.prepare", status: "requires_review" }], tracks: [] });
    expect(status).toContain("سبب التوقف");
    expect(status).toContain("render_manifest_incomplete");
    expect(status).toContain("أعلام السلامة");
  });
  it("refuses a review decision that no longer maps to a pending approval stage", () => {
    const openReview = findMatchingPendingReview([{ videoId: 12, approvalType: "idea" }], 12, "idea");
    const closedReview = findMatchingPendingReview([{ videoId: 12, approvalType: "idea" }], 12, "final_video");
    expect(openReview).toEqual({ videoId: 12, approvalType: "idea" });
    expect(closedReview).toBeUndefined();
  });
  it("shows actual YouTube connection state without offering automatic publishing", () => {
    expect(formatYouTubeConnectionStatus(null)).toContain("غير متصلة");
    const connected = formatYouTubeConnectionStatus({ isConnected: true, channelTitle: "NUSGH", lastSyncedAt: new Date("2026-08-14T08:00:00Z") });
    expect(connected).toContain("متصلة خادميًا");
    expect(connected).toContain("مقيدين بالمراجعة البشرية");
  });
  it("keeps operational guidance in Telegram without claiming web creation controls", () => {
    expect(formatConservativeDailyReport({ candidateCount: 0, created: [] })).not.toContain("?create=video");
  });
  it("formats a conservative daily report without claiming production or publication", () => {
    const report = formatConservativeDailyReport({ candidateCount: 4, created: [{ ideaId: 9, videoId: 11, score: 82, scheduledFor: "2026-08-14T16:00:00.000Z" }], analyticsStatus: "تمت مزامنة قراءة فقط" });
    expect(report).toContain("82/100");
    expect(report).toContain("تمت مزامنة قراءة فقط");
    expect(report).toContain("لم يُنشأ صوت أو رندر أو نشر");
  });
});
