import { describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";
import { canRunScheduledAutopilot, conservativeAutopilotSkipReason, dailyAutopilotHandler, evaluateScheduledProductionTick } from "./daily-autopilot";
import { sdk } from "../_core/sdk";

function createResponseRecorder() {
  const state = { statusCode: 200, body: undefined as unknown };
  const res = {
    status(code: number) {
      state.statusCode = code;
      return this;
    },
    json(body: unknown) {
      state.body = body;
      return this;
    },
  } as unknown as Response;
  return { res, state };
}

describe("Daily Autopilot authorization", () => {
  it("allows only an authenticated Heartbeat task", () => {
    expect(canRunScheduledAutopilot({ isCron: true, taskUid: "task_123" })).toBe(true);
    expect(canRunScheduledAutopilot({ isCron: true })).toBe(false);
    expect(canRunScheduledAutopilot({ taskUid: "task_123" })).toBe(false);
    expect(canRunScheduledAutopilot({})).toBe(false);
  });

  it("stops all new conservative work when Kill Switch is active", () => {
    expect(conservativeAutopilotSkipReason({ enabled: true, killSwitch: true })).toBe("kill_switch");
    expect(conservativeAutopilotSkipReason({ enabled: false, killSwitch: false })).toBe("disabled");
    expect(conservativeAutopilotSkipReason({ enabled: true, killSwitch: false })).toBeNull();
  });

  it("returns 403 when schedule authentication rejects the request", async () => {
    const authenticate = vi.spyOn(sdk, "authenticateRequest").mockRejectedValue(new Error("invalid session"));
    const { res, state } = createResponseRecorder();

    await dailyAutopilotHandler({ headers: {} } as Request, res);

    expect(state.statusCode).toBe(403);
    expect(state.body).toEqual({ error: "cron_only" });
    authenticate.mockRestore();
  });
});

describe("scheduled production tick", () => {
  const settings = { dailyVideoLimit: 2, generationTimes: ["11:00", "16:00"], timezone: "Africa/Cairo" };
  const now = new Date("2026-08-15T08:00:00.000Z");

  it("runs once at a matching Cairo slot and rejects a duplicate slot", () => {
    const first = evaluateScheduledProductionTick({ now, settings, configuration: {} });
    expect(first.run).toBe(true);
    if (!first.run) return;
    expect(evaluateScheduledProductionTick({ now, settings, configuration: { lastGenerationSlotKey: first.slot.slotKey } }).skipped).toBe("slot_already_processed");
  });

  it("enforces the saved daily video limit", () => {
    expect(evaluateScheduledProductionTick({ now, settings, configuration: { generationDate: "2026-08-15", generatedCount: 2 } }).skipped).toBe("daily_video_limit_reached");
  });
});
