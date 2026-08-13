import { describe, expect, it } from "vitest";
import { canUseAssetInRender } from "./repository";

describe("NUSGH render asset gate", () => {
  it("allows only assets with approved rights and provenance", () => {
    expect(canUseAssetInRender({ commercialUsageStatus: "approved", provenanceStatus: "approved" })).toBe(true);
    expect(canUseAssetInRender({ commercialUsageStatus: "pending", provenanceStatus: "approved" })).toBe(false);
  });
});
