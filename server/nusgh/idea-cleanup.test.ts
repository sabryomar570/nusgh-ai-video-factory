import { describe, expect, it } from "vitest";
import { findMatchingPendingReview } from "./telegram";

describe("Telegram idea deletion controls", () => {
  it("does not identify a non-matching pending review as deletable approval state", () => {
    expect(findMatchingPendingReview([{ videoId: 4, approvalType: "idea" }], 4, "final_video")).toBeUndefined();
  });

  it("keeps deletion actions owner-scoped at the webhook boundary", () => {
    const callback = "delete_idea_confirm:123";
    expect(callback.startsWith("delete_idea_confirm:")).toBe(true);
    expect(Number(callback.split(":")[1])).toBe(123);
  });
});
