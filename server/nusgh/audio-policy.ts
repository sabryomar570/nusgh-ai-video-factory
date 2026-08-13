export type AudioReviewInput = {
  audioType: "narration" | "natural_sfx" | "ambient" | "music";
  sourceVerified: boolean;
  commercialUseConfirmed: boolean;
  isMusicLike: boolean;
};

export function reviewAudio(input: AudioReviewInput) {
  if (input.audioType === "music" || input.isMusicLike) return { status: "requires_review" as const, reason: "سياسة نُسغ تمنع الموسيقى والمؤثرات المحاكية لها." };
  if (!input.sourceVerified || !input.commercialUseConfirmed) return { status: "requires_review" as const, reason: "المصدر أو حق الاستخدام التجاري للصوت غير مؤكد." };
  return { status: "approved" as const, reason: "الصوت وظيفي ومصدره وحق استخدامه موثقان." };
}
