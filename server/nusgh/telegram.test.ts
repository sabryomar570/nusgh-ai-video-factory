import { describe, expect, it } from "vitest";
import { formatRenderManifestPreview, formatVideoWorkflowStatus, hasValidTelegramWebhookSecret, isAllowedTelegramOwner, verifyTelegramBot } from "./telegram";

describe("Telegram configuration", () => {
  it("validates the configured bot token through Telegram getMe", async () => {
    const bot = await verifyTelegramBot();
    expect(bot.id).toBeTypeOf("number");
    expect(bot.first_name.length).toBeGreaterThan(0);
  }, 20_000);

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
});
