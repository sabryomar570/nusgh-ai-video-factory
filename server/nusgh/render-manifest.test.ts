import { describe, expect, it } from "vitest";
import { buildNusghRenderManifest } from "./render-manifest";

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
  it("carries a segmented narration manifest and RTL captions into the render contract", () => {
    const result = buildNusghRenderManifest({ ...base, narrationUrl: null, narrationManifestUrl: "https://audio.example/narration.manifest.json", narrationSegmentCount: 3 });
    expect(result.ready).toBe(true);
    expect(result.manifest?.audio).toMatchObject({ sourceKind: "segmented_manifest", narrationManifestUrl: "https://audio.example/narration.manifest.json", segmentCount: 3, music: "off" });
    expect(result.manifest?.captions).toMatchObject({ direction: "rtl", format: "webvtt", url: "https://audio.example/ar.vtt" });
  });
});
