import { describe, expect, it } from "vitest";
import { reviewAudio } from "./audio-policy";

describe("NUSGH audio policy", () => {
  it("blocks music and music-like tracks", () => { expect(reviewAudio({ audioType: "music", sourceVerified: true, commercialUseConfirmed: true, isMusicLike: true }).status).toBe("requires_review"); });
  it("allows verified natural SFX", () => { expect(reviewAudio({ audioType: "natural_sfx", sourceVerified: true, commercialUseConfirmed: true, isMusicLike: false }).status).toBe("approved"); });
});
