import { describe, expect, it } from "vitest";
import { nextInternalPublishingSlot, parseGoogleTrendsRss, scoreResearchCandidate } from "./conservative-intelligence";

describe("conservative daily idea intelligence", () => {
  it("scores candidates with the approved 100-point weighting", () => {
    const result = scoreResearchCandidate({ topic: "كيف تؤثر العادات الصغيرة في القرار اليومي؟", sourceUrl: "https://example.org/topic", publisher: "Test", trendSignal: 80, freshness: 70, audienceRelevance: 90, competitionOpportunity: 60, viralPotential: 85, retentionPotential: 75, productionFeasibility: 95 });
    expect(result.score).toBe(80);
    expect(result.riskLevel).toBe("green");
  });

  it("marks high-risk topics for human review instead of selecting them automatically", () => {
    const result = scoreResearchCandidate({ topic: "أفضل أسهم للاستثمار بعد الانتخابات", sourceUrl: "https://example.org/topic", publisher: "Test", trendSignal: 100, freshness: 100, audienceRelevance: 100, competitionOpportunity: 100, viralPotential: 100, retentionPotential: 100, productionFeasibility: 100 });
    expect(result.riskLevel).toBe("requires_human_review");
  });

  it("parses source-backed RSS items without inventing topics", () => {
    const candidates = parseGoogleTrendsRss("<rss><channel><item><title><![CDATA[عادات الدراسة الذكية]]></title><link>https://example.org/trend</link></item></channel></rss>");
    expect(candidates).toEqual([expect.objectContaining({ topic: "عادات الدراسة الذكية", sourceUrl: "https://example.org/trend" })]);
  });

  it("returns the next internal publishing window without publishing externally", () => {
    expect(nextInternalPublishingSlot(new Date("2026-08-14T12:30:00Z"), [11, 16, 21], "Africa/Cairo").toISOString()).toBe("2026-08-14T13:00:00.000Z");
  });
});
