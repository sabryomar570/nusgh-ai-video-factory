import { describe, expect, it } from "vitest";
import { normalizeGenerationTimes, scheduledGenerationSlot } from "./conservative-intelligence";

describe("NUSGH production schedule", () => {
  it("normalizes only valid unique HH:MM production slots", () => {
    expect(normalizeGenerationTimes(["16:00", "11:00", "16:00", "24:00", "bad"])).toEqual(["11:00", "16:00"]);
  });

  it("recognizes a Cairo production slot without relying on server local time", () => {
    const now = new Date("2026-08-15T08:00:00.000Z");
    expect(scheduledGenerationSlot(now, ["11:00"], "Africa/Cairo")).toMatchObject({ localTime: "11:00", dateKey: "2026-08-15" });
    expect(scheduledGenerationSlot(now, ["16:00"], "Africa/Cairo")).toBeNull();
  });
});
