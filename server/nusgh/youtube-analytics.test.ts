import { describe, expect, it } from "vitest";
import { analyticsWindow, normalizeAnalyticsRow } from "./youtube-analytics";

describe("YouTube analytics helpers", () => {
  it("uses a closed UTC reporting window ending yesterday", () => {
    const window = analyticsWindow(7, new Date("2026-08-14T12:00:00Z"));
    expect(window).toMatchObject({ startDate: "2026-08-07", endDate: "2026-08-13" });
  });
  it("normalizes partial report rows without inventing metrics", () => {
    expect(normalizeAnalyticsRow([10, 4, 9.6])).toEqual({ views: 10, watchTimeMinutes: 4, averageViewDurationSeconds: 10, subscribersGained: 0, likes: 0, comments: 0, shares: 0 });
  });
});
