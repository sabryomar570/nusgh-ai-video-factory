export type ClaimInput = { text: string; sourceUrl?: string; evidence?: string; confidence: "low" | "medium" | "high" };
export type SceneDraft = { sequence: number; startTimeMs: number; endTimeMs: number; narration: string; visualType: "text" | "stock" | "generated" | "brand"; caption: string; motion: { type: string; intensity: "subtle" | "medium" } };

const HIGH_RISK_PATTERNS = [/تشخيص/i, /علاج/i, /يُشفي/i, /مضمون 100/i, /نتيجة مؤكدة/i];
const REVIEW_PATTERNS = [/اضطراب/i, /اكتئاب/i, /قلق مرضي/i, /دواء/i, /انتحار/i];

export function classifyContentRisk(text: string): "green" | "yellow" | "red" | "requires_human_review" {
  if (HIGH_RISK_PATTERNS.some(pattern => pattern.test(text))) return "red";
  if (REVIEW_PATTERNS.some(pattern => pattern.test(text))) return "requires_human_review";
  return "green";
}

export function validateClaim(input: ClaimInput) {
  const riskLevel = classifyContentRisk(input.text);
  const supported = Boolean(input.sourceUrl && input.evidence && input.evidence.trim().length >= 20);
  const requiresHumanReview = riskLevel !== "green" || input.confidence === "low" || !supported;
  return { supported, riskLevel, requiresHumanReview, status: supported && !requiresHumanReview ? "approved" : "pending" as const };
}

export function buildSceneTimeline(script: string, durationSeconds: number): SceneDraft[] {
  const phrases = script.split(/[.!؟]\s*/).map(value => value.trim()).filter(Boolean);
  if (!phrases.length) throw new Error("لا يمكن بناء خط المشاهد من نص فارغ.");
  const totalMs = durationSeconds * 1000;
  const sliceMs = Math.max(1800, Math.floor(totalMs / phrases.length));
  return phrases.map((narration, index) => ({
    sequence: index + 1,
    startTimeMs: index * sliceMs,
    endTimeMs: Math.min(totalMs, (index + 1) * sliceMs),
    narration,
    visualType: index === 0 || index === phrases.length - 1 ? "brand" : index % 3 === 0 ? "generated" : "stock",
    caption: narration,
    motion: { type: index === 0 ? "organic_reveal" : "slow_pan", intensity: "subtle" },
  }));
}
