import { describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";
import { canRunScheduledAutopilot, dailyAutopilotHandler } from "./daily-autopilot";
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

  it("returns 403 when schedule authentication rejects the request", async () => {
    const authenticate = vi.spyOn(sdk, "authenticateRequest").mockRejectedValue(new Error("invalid session"));
    const { res, state } = createResponseRecorder();

    await dailyAutopilotHandler({ headers: {} } as Request, res);

    expect(state.statusCode).toBe(403);
    expect(state.body).toEqual({ error: "cron_only" });
    authenticate.mockRestore();
  });
});
