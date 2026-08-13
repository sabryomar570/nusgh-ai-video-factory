import { describe, expect, it } from "vitest";
import { assessRenderReadiness, buildVideoMetadata, reviewThumbnailConcept } from "./production-qc";

describe("NUSGH production QC", () => {
  it("blocks any music-like audio before render", () => {
    const result = assessRenderReadiness({ sceneCount: 2, hasNarration: true, hasMusicLikeAudio: true, allAssetsApproved: true, safetyFlags: [], captionsCount: 2, targetFormat: "short" });
    expect(result.ready).toBe(false);
    expect(result.blockers.join(" ")).toContain("الموسيقى");
  });
  it("creates private metadata by default", () => {
    expect(buildVideoMetadata({ title: "عنوان", centralIdea: "فكرة واحدة", targetFormat: "short" }).visibility).toBe("private");
  });
  it("rejects a thumbnail that violates visual identity rules", () => {
    expect(reviewThumbnailConcept({ headline: "اختبر الفكرة", hasHumanFace: true, usesMasterIdentity: true, contrastScore: 90 }).approved).toBe(false);
  });
});
