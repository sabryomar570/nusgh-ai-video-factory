export type RenderReadinessInput = {
  sceneCount: number;
  hasNarration: boolean;
  hasMusicLikeAudio: boolean;
  allAssetsApproved: boolean;
  safetyFlags: string[];
  captionsCount: number;
  targetFormat: "short" | "long_form";
};

export function assessRenderReadiness(input: RenderReadinessInput) {
  const blockers: string[] = [];
  if (input.sceneCount < 1) blockers.push("لا توجد مشاهد معتمدة للرندر.");
  if (!input.hasNarration) blockers.push("لا يوجد تعليق صوتي معتمد.");
  if (input.hasMusicLikeAudio) blockers.push("سياسة نُسغ تمنع الموسيقى والمؤثرات المحاكية لها.");
  if (!input.allAssetsApproved) blockers.push("يوجد أصل مرئي بلا إثبات حقوق واستخدام تجاري معتمد.");
  if (input.safetyFlags.length) blockers.push("توجد أعلام سلامة غير محسومة.");
  if (!input.captionsCount) blockers.push("لا توجد ترجمات عربية متزامنة للمراجعة.");
  return { ready: blockers.length === 0, blockers, requiredReview: true, dimensions: input.targetFormat === "short" ? { width: 1080, height: 1920 } : { width: 1920, height: 1080 } };
}

export function buildVideoMetadata(input: { title: string; centralIdea: string; targetFormat: "short" | "long_form"; tags?: string[] }) {
  const title = input.title.replace(/\s+/g, " ").trim();
  const tags = Array.from(new Set(["نُسغ", "NUSGH", ...(input.tags ?? [])].map(tag => tag.trim()).filter(Boolean))).slice(0, 15);
  return {
    title,
    description: `${input.centralIdea.trim()}\n\nنُسغ — فكرة واحدة مفيدة، تُروى بوضوح وبلا مبالغة.\n\n#نُسغ #NUSGH`,
    tags,
    visibility: "private" as const,
    category: "Education",
    format: input.targetFormat,
  };
}

export function reviewThumbnailConcept(input: { headline: string; hasHumanFace: boolean; usesMasterIdentity: boolean; contrastScore: number }) {
  const blockers: string[] = [];
  if (!input.headline.trim()) blockers.push("لا يوجد نص رئيسي للصورة المصغرة.");
  if (input.hasHumanFace) blockers.push("الصورة المصغرة لا تستخدم وجهًا أو شخصية حية ضمن هوية نُسغ.");
  if (!input.usesMasterIdentity) blockers.push("لم تُستخدم الهوية البصرية المعتمدة لنُسغ.");
  if (input.contrastScore < 70) blockers.push("تباين النص غير كافٍ للمراجعة البصرية.");
  return { approved: blockers.length === 0, blockers, requiresHumanReview: true };
}
