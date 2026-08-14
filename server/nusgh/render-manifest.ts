import { assessRenderReadiness, type RenderReadinessInput } from "./production-qc";

export type RenderScene = { sequence: number; startTimeMs: number; endTimeMs: number; narration?: string | null; visualType: string; assetUrl?: string | null; caption?: string | null };
export type RenderManifestInput = {
  videoId: number;
  targetFormat: "short" | "long_form";
  scenes: RenderScene[];
  narrationUrl?: string | null;
  captionsUrl?: string | null;
  hasMusicLikeAudio: boolean;
  allAssetsApproved: boolean;
  safetyFlags: string[];
};

export function buildNusghRenderManifest(input: RenderManifestInput) {
  const readiness: RenderReadinessInput = {
    sceneCount: input.scenes.length,
    hasNarration: Boolean(input.narrationUrl),
    hasMusicLikeAudio: input.hasMusicLikeAudio,
    allAssetsApproved: input.allAssetsApproved,
    safetyFlags: input.safetyFlags,
    captionsCount: input.captionsUrl ? 1 : 0,
    targetFormat: input.targetFormat,
  };
  const gate = assessRenderReadiness(readiness);
  if (!gate.ready) return { ready: false as const, blockers: gate.blockers, requiresHumanReview: true as const, manifest: null };
  const orderedScenes = [...input.scenes].sort((a, b) => a.sequence - b.sequence);
  const durationMs = Math.max(...orderedScenes.map(scene => scene.endTimeMs));
  return {
    ready: true as const,
    blockers: [] as string[],
    requiresHumanReview: true as const,
    manifest: {
      schemaVersion: 1,
      videoId: input.videoId,
      dimensions: gate.dimensions,
      durationMs,
      audio: { narrationUrl: input.narrationUrl, music: "off" as const },
      captions: { language: "ar", direction: "rtl", format: "webvtt", url: input.captionsUrl },
      scenes: orderedScenes.map(scene => ({ sequence: scene.sequence, startTimeMs: scene.startTimeMs, endTimeMs: scene.endTimeMs, narration: scene.narration ?? null, visual: { type: scene.visualType, assetUrl: scene.assetUrl ?? null }, caption: scene.caption ?? null })),
      releasePolicy: { uploadVisibility: "private", requiresHumanReview: true, safetyOverride: true },
    },
  };
}
