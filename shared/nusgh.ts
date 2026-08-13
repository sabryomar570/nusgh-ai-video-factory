export const NUSGH_BRAND = {
  nameArabic: "نُسغ",
  nameLatin: "NUSGH",
  primaryLanguage: "ar",
  musicPolicy: "off",
  defaultAutomationMode: "full_review",
} as const;

export const PIPELINE_STAGES = [
  "idea",
  "research",
  "fact_check",
  "script",
  "scene_plan",
  "assets",
  "voice",
  "natural_sfx",
  "captions",
  "render",
  "thumbnail",
  "metadata",
  "quality_control",
  "telegram_preview",
  "approval",
  "youtube_publish",
] as const;

export type PipelineStage = (typeof PIPELINE_STAGES)[number];

export const SAFETY_STOP_REASONS = [
  "safety_failure",
  "fact_check_failure",
  "copyright_uncertainty",
  "provider_failure",
  "render_failure",
  "quality_failure",
] as const;

export type SafetyStopReason = (typeof SAFETY_STOP_REASONS)[number];
