import { describe, expect, it } from "vitest";
import { shouldReplaceControlMessage } from "./telegram";

describe("Telegram compact control panel", () => {
  it("replaces navigational control panels instead of accumulating them", () => {
    expect(shouldReplaceControlMessage("settings")).toBe(true);
    expect(shouldReplaceControlMessage("start_production")).toBe(true);
    expect(shouldReplaceControlMessage("review:final_video:approve:7")).toBe(false);
  });
});
