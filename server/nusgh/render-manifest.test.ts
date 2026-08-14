import { describe, expect, it } from "vitest";
import { buildNusghRenderManifest, buildNusghRenderManifestFromRecordedArtifacts } from "./render-manifest";

describe("NUSGH render manifest", () => {
  const base = { videoId: 9, targetFormat: "short" as const, narrationUrl: "https://audio.example/n.mp3", captionsUrl: "https://audio.example/ar.vtt", hasMusicLikeAudio: false, allAssetsApproved: true, safetyFlags: [], scenes: [{ sequence: 1, startTimeMs: 0, endTimeMs: 1000, narration: "نص", visualType: "illustration", assetUrl: "https://asset.example/a.png", caption: "نص" }] };
  it("emits a private, review-gated manifest when every precondition is met", () => {
    const result = buildNusghRenderManifest(base);
    expect(result.ready).toBe(true);
    expect(result.manifest?.releasePolicy).toEqual({ uploadVisibility: "private", requiresHumanReview: true, safetyOverride: true });
  });
  it("refuses output when music-like audio is present", () => {
    const result = buildNusghRenderManifest({ ...base, hasMusicLikeAudio: true });
    expect(result).toMatchObject({ ready: false });
    expect(result.blockers.join(" ")).toContain("الموسيقى");
  });
  it("refuses an incomplete contract when narration or Arabic captions are missing", () => {
    const noNarration = buildNusghRenderManifest({ ...base, narrationUrl: null });
    const noCaptions = buildNusghRenderManifest({ ...base, captionsUrl: null });
    expect(noNarration).toMatchObject({ ready: false, requiresHumanReview: true, manifest: null });
    expect(noNarration.blockers.join(" ")).toContain("تعليق صوتي");
    expect(noCaptions).toMatchObject({ ready: false, requiresHumanReview: true, manifest: null });
    expect(noCaptions.blockers.join(" ")).toContain("ترجمات عربية");
  });
  it("carries a segmented narration manifest and RTL captions into the render contract", () => {
    const result = buildNusghRenderManifest({ ...base, narrationUrl: null, narrationManifestUrl: "https://audio.example/narration.manifest.json", narrationSegmentCount: 3 });
    expect(result.ready).toBe(true);
    expect(result.manifest?.audio).toMatchObject({ sourceKind: "segmented_manifest", narrationManifestUrl: "https://audio.example/narration.manifest.json", segmentCount: 3, music: "off" });
    expect(result.manifest?.captions).toMatchObject({ direction: "rtl", format: "webvtt", url: "https://audio.example/ar.vtt" });
  });
  it("uses only approved recorded narration and approved visual assets", () => {
    const result = buildNusghRenderManifestFromRecordedArtifacts({
      videoId: 11,
      targetFormat: "short",
      scenes: [{ sequence: 1, startTimeMs: 0, endTimeMs: 1_000, narration: "نص", visualType: "illustration", visualAssetId: 7 }],
      audioTracks: [
        { audioType: "narration", publicUrl: "https://audio.example/pending.mp3", reviewStatus: "pending", isMusicLike: false, metadata: { captionFiles: { vtt: "https://audio.example/pending.vtt" } } },
        { audioType: "narration", publicUrl: "https://audio.example/narration.manifest.json", reviewStatus: "approved", isMusicLike: false, metadata: { narrationManifest: "https://audio.example/narration.manifest.json", segmentCount: 2, captionFiles: { vtt: "https://audio.example/ar.vtt" } } },
      ],
      visualAssets: [{ id: 7, publicUrl: "https://asset.example/a.png", commercialUsageStatus: "approved", provenanceStatus: "approved" }],
      safetyFlags: [],
    });
    expect(result.ready).toBe(true);
    expect(result.manifest?.audio).toMatchObject({ sourceKind: "segmented_manifest", narrationManifestUrl: "https://audio.example/narration.manifest.json", segmentCount: 2 });
    expect(result.manifest?.captions.url).toBe("https://audio.example/ar.vtt");
    expect(result.manifest?.scenes[0].visual.assetUrl).toBe("https://asset.example/a.png");
  });
  it("blocks recorded artifacts that remain pending review or lack approved asset provenance", () => {
    const result = buildNusghRenderManifestFromRecordedArtifacts({
      videoId: 12,
      targetFormat: "long_form",
      scenes: [{ sequence: 1, startTimeMs: 0, endTimeMs: 1_000, visualType: "illustration", visualAssetId: 8 }],
      audioTracks: [{ audioType: "narration", publicUrl: "https://audio.example/pending.mp3", reviewStatus: "pending", isMusicLike: false, metadata: { captionFiles: { vtt: "https://audio.example/pending.vtt" } } }],
      visualAssets: [{ id: 8, publicUrl: "https://asset.example/pending.png", commercialUsageStatus: "pending", provenanceStatus: "approved" }],
      safetyFlags: [],
    });
    expect(result).toMatchObject({ ready: false, requiresHumanReview: true, manifest: null });
    expect(result.blockers.join(" ")).toContain("تعليق صوتي");
    expect(result.blockers.join(" ")).toContain("أصل مرئي");
  });
});
