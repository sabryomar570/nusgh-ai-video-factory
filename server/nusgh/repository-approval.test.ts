import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getDb: vi.fn() }));

vi.mock("../db", () => ({ getDb: mocks.getDb }));

import { decideVideoApproval } from "./repository";

describe("decideVideoApproval governance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects a stale decision when the matching approval is no longer pending", async () => {
    const videoLimit = vi.fn().mockResolvedValue([{ id: 44, projectId: 8, status: "awaiting_review" }]);
    const approvalLimit = vi.fn().mockResolvedValue([]);
    const where = vi.fn().mockReturnValueOnce({ limit: videoLimit }).mockReturnValueOnce({ limit: approvalLimit });
    const from = vi.fn().mockReturnValue({ where });
    const select = vi.fn().mockReturnValue({ from });
    mocks.getDb.mockResolvedValue({ select });

    await expect(decideVideoApproval({ projectId: 8, videoId: 44, decision: "approved", approvalType: "final_video" })).rejects.toThrow("لا يوجد طلب اعتماد معلّق");
    expect(select).toHaveBeenCalledTimes(2);
  });
});
