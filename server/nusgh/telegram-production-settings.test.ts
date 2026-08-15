import { describe, expect, it } from "vitest";
import { parseProductionScheduleCommand, parseStageToggleCommand, parseTimeZoneCommand } from "./telegram";

describe("Telegram production settings", () => {
  it("accepts a bounded daily limit and clean Cairo production times", () => {
    expect(parseProductionScheduleCommand("3 | 21:00,11:00,16:00")).toEqual({ dailyVideoLimit: 3, generationTimes: ["11:00", "16:00", "21:00"], internalPublishingHours: [11, 16, 21] });
    expect(parseProductionScheduleCommand("11 | 11:00")).toBeNull();
  });

  it("accepts only explicitly allowed stage toggles", () => {
    expect(parseStageToggleCommand("render off")).toEqual({ stage: "render", enabled: false });
    expect(parseStageToggleCommand("youtube on")).toBeNull();
  });

  it("accepts valid IANA zones while rejecting invalid time zone values", () => {
    expect(parseTimeZoneCommand("Africa/Cairo")).toBe("Africa/Cairo");
    expect(parseTimeZoneCommand("Not/AZone")).toBeNull();
  });
});
