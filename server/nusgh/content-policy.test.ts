import { describe, expect, it } from "vitest";
import { buildSceneTimeline, classifyContentRisk, validateClaim } from "./content-policy";

describe("NUSGH content safety", () => {
  it("stops medical-style treatment claims", () => { expect(classifyContentRisk("هذا علاج مضمون 100%" )).toBe("red"); });
  it("requires evidence before approving a claim", () => { expect(validateClaim({ text: "النوم يؤثر في الانتباه", confidence: "high" }).requiresHumanReview).toBe(true); });
  it("creates a renderable sequential scene timeline", () => { const scenes = buildSceneTimeline("ابدأ بسؤال. ثم اشرح الفكرة. اختم بخطوة واحدة.", 30); expect(scenes).toHaveLength(3); expect(scenes[0].startTimeMs).toBe(0); expect(scenes[2].endTimeMs).toBe(30000); });
});
