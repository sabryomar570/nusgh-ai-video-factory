import { describe, expect, it } from "vitest";
import { decryptYouTubeToken, encryptYouTubeToken } from "./youtube-oauth";

describe("YouTube OAuth token protection", () => {
  it("encrypts and decrypts a token only with the server-side key", () => {
    const envelope = encryptYouTubeToken("temporary-access-token");
    expect(envelope.ciphertext).not.toContain("temporary-access-token");
    expect(decryptYouTubeToken(envelope)).toBe("temporary-access-token");
  });
});
