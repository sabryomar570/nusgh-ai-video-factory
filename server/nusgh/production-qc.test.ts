import { describe, expect, it } from "vitest";
import { assessRenderReadiness, buildVideoMetadata, reviewThumbnailConcept } from "./production-qc";

describe("NUSGH production QC", () => {
  it("blocks any music-like audio before render", () => {
    const result = assessRenderReadiness({ sceneCount: 2, hasNarration: true, hasMusicLikeAudio: true, allAssetsApproved: true, safetyFlags: [], captionsCount: 2, targetFormat: "short" });
    expect(result.ready).toBe(false);
    expect(result.blockers.join(" ")).toContain("الموسيقى");
  });
  it("blocks rendering when approved narration or synchronized Arabic captions are absent", () => {
    const missingNarration = assessRenderReadiness({ sceneCount: 1, hasNarration: false, hasMusicLikeAudio: false, allAssetsApproved: true, safetyFlags: [], captionsCount: 1, targetFormat: "long_form" });
    const missingCaptions = assessRenderReadiness({ sceneCount: 1, hasNarration: true, hasMusicLikeAudio: false, allAssetsApproved: true, safetyFlags: [], captionsCount: 0, targetFormat: "long_form" });
    expect(missingNarration).toMatchObject({ ready: false, requiredReview: true });
    expect(missingNarration.blockers.join(" ")).toContain("تعليق صوتي");
    expect(missingCaptions).toMatchObject({ ready: false, requiredReview: true });
    expect(missingCaptions.blockers.join(" ")).toContain("ترجمات عربية");
  });
  it("creates private metadata by default", () => {
    expect(buildVideoMetadata({ title: "عنوان", centralIdea: "فكرة واحدة", targetFormat: "short" }).visibility).toBe("private");
  });
  it("rejects a thumbnail that violates visual identity rules", () => {
    expect(reviewThumbnailConcept({ headline: "اختبر الفكرة", hasHumanFace: true, usesMasterIdentity: true, contrastScore: 90 }).approved).toBe(false);
  });
});
