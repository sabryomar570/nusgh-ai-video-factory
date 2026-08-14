import { assessRenderReadiness, type RenderReadinessInput } from "./production-qc";

export type RenderScene = { sequence: number; startTimeMs: number; endTimeMs: number; narration?: string | null; visualType: string; assetUrl?: string | null; caption?: string | null };
export type RecordedRenderScene = Omit<RenderScene, "assetUrl"> & { visualAssetId?: number | null };
export type RecordedNarrationTrack = { audioType: string; publicUrl?: string | null; reviewStatus: string; isMusicLike: boolean; metadata?: Record<string, unknown> | null };
export type RecordedVisualAsset = { id: number; publicUrl?: string | null; commercialUsageStatus: string; provenanceStatus: string };
export type RenderManifestInput = {
  videoId: number;
  targetFormat: "short" | "long_form";
  scenes: RenderScene[];
  narrationUrl?: string | null;
  narrationManifestUrl?: string | null;
  narrationSegmentCount?: number | null;
  captionsUrl?: string | null;
  hasMusicLikeAudio: boolean;
  allAssetsApproved: boolean;
  safetyFlags: string[];
};

function stringMetadataValue(metadata: Record<string, unknown> | null | undefined, key: string) {
  const value = metadata?.[key];
  return typeof value === "string" && value.trim() ? value : null;
}

function captionVttUrl(metadata: Record<string, unknown> | null | undefined) {
  const captionFiles = metadata?.captionFiles;
  if (!captionFiles || typeof captionFiles !== "object") return null;
  const value = (captionFiles as Record<string, unknown>).vtt;
  return typeof value === "string" && value.trim() ? value : null;
}

function recordedSegmentCount(metadata: Record<string, unknown> | null | undefined) {
  const value = metadata?.segmentCount;
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0 ? value : null;
}

export function buildNusghRenderManifestFromRecordedArtifacts(input: {
  videoId: number;
  targetFormat: "short" | "long_form";
  scenes: RecordedRenderScene[];
  audioTracks: RecordedNarrationTrack[];
  visualAssets: RecordedVisualAsset[];
  safetyFlags: string[];
}) {
  const narration = input.audioTracks.find(track => track.audioType === "narration" && track.reviewStatus === "approved");
  const assetsById = new Map(input.visualAssets.map(asset => [asset.id, asset]));
  const allAssetsApproved = input.scenes.every(scene => {
    if (!scene.visualAssetId) return true;
    const asset = assetsById.get(scene.visualAssetId);
    return Boolean(asset?.publicUrl && asset.commercialUsageStatus === "approved" && asset.provenanceStatus === "approved");
  });
  const scenes: RenderScene[] = input.scenes.map(scene => {
    const asset = scene.visualAssetId ? assetsById.get(scene.visualAssetId) : undefined;
    return { ...scene, assetUrl: asset?.publicUrl ?? null };
  });
  return buildNusghRenderManifest({
    videoId: input.videoId,
    targetFormat: input.targetFormat,
    scenes,
    narrationUrl: narration?.publicUrl ?? null,
    narrationManifestUrl: stringMetadataValue(narration?.metadata, "narrationManifest"),
    narrationSegmentCount: recordedSegmentCount(narration?.metadata),
    captionsUrl: captionVttUrl(narration?.metadata),
    hasMusicLikeAudio: input.audioTracks.some(track => track.isMusicLike),
    allAssetsApproved,
    safetyFlags: input.safetyFlags,
  });
}

export function buildNusghRenderManifest(input: RenderManifestInput) {
  const readiness: RenderReadinessInput = {
    sceneCount: input.scenes.length,
    hasNarration: Boolean(input.narrationUrl || input.narrationManifestUrl),
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
      schemaVersion: 2,
      videoId: input.videoId,
      dimensions: gate.dimensions,
      durationMs,
      audio: {
        sourceKind: input.narrationManifestUrl ? "segmented_manifest" as const : "single_file" as const,
        narrationUrl: input.narrationUrl ?? null,
        narrationManifestUrl: input.narrationManifestUrl ?? null,
        segmentCount: input.narrationManifestUrl ? Math.max(2, input.narrationSegmentCount ?? 2) : 1,
        music: "off" as const,
      },
      captions: { language: "ar", direction: "rtl", format: "webvtt", url: input.captionsUrl },
      scenes: orderedScenes.map(scene => ({ sequence: scene.sequence, startTimeMs: scene.startTimeMs, endTimeMs: scene.endTimeMs, narration: scene.narration ?? null, visual: { type: scene.visualType, assetUrl: scene.assetUrl ?? null }, caption: scene.caption ?? null })),
      releasePolicy: { uploadVisibility: "private", requiresHumanReview: true, safetyOverride: true },
    },
  };
}
