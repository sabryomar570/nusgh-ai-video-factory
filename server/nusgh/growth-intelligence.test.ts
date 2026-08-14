import { describe, expect, it } from "vitest";
import { suggestGrowthExperiments } from "./growth-intelligence";

describe("NUSGH growth intelligence", () => {
  it("keeps recommendations advisory and brand-safe", () => {
    const rows = suggestGrowthExperiments({ views: 400, watchTimeMinutes: 20, averageViewDurationSeconds: 12, subscribersGained: 0, likes: 1, comments: 0, shares: 0 }, 60);
    expect(rows.some(row => row.area === "retention" && row.requiresOwnerApproval)).toBe(true);
    expect(rows.some(row => row.suggestion.includes("تضليل"))).toBe(true);
  });
  it("does not treat a tiny sample as a trend", () => {
    expect(suggestGrowthExperiments({ views: 20, watchTimeMinutes: 1, subscribersGained: 0, likes: 0, comments: 0, shares: 0 }).map(row => row.area)).toContain("baseline");
  });
});
