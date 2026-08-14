import { describe, expect, it } from "vitest";
import { canRunScheduledAutopilot } from "./daily-autopilot";

describe("Daily Autopilot authorization", () => {
  it("allows only an authenticated Heartbeat task", () => {
    expect(canRunScheduledAutopilot({ isCron: true, taskUid: "task_123" })).toBe(true);
    expect(canRunScheduledAutopilot({ isCron: true })).toBe(false);
    expect(canRunScheduledAutopilot({ taskUid: "task_123" })).toBe(false);
  });
});
