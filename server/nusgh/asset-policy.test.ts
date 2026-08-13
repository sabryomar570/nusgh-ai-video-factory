import { describe, expect, it } from "vitest";
import { reviewAsset } from "./asset-policy";

describe("NUSGH asset provenance policy", () => {
  it("stops an external asset with missing provenance", () => {
    expect(reviewAsset({ sourceType: "stock", commercialUseConfirmed: true, attributionRequired: false, visualRole: "scene" }).status).toBe("requires_review");
  });
  it("stops external assets without commercial-use evidence", () => {
    expect(reviewAsset({ sourceType: "stock", sourceUrl: "https://example.com/a", licenseId: "unknown", commercialUseConfirmed: false, attributionRequired: false, visualRole: "scene" }).status).toBe("requires_review");
  });
  it("allows a verified scene asset", () => {
    expect(reviewAsset({ sourceType: "stock", sourceUrl: "https://pexels.com/a", licenseId: "pexels", commercialUseConfirmed: true, attributionRequired: false, visualRole: "scene" }).status).toBe("approved");
  });
});
