import { describe, expect, it } from "vitest";
import { decryptYouTubeToken, encryptYouTubeToken, getYouTubeOAuthPublicConfig } from "./youtube-oauth";

describe("YouTube OAuth token protection", () => {
  it("encrypts and decrypts a token only with the server-side key", () => {
    const envelope = encryptYouTubeToken("temporary-access-token");
    expect(envelope.ciphertext).not.toContain("temporary-access-token");
    expect(decryptYouTubeToken(envelope)).toBe("temporary-access-token");
  });
  it("uses the configured production callback without exposing secrets", () => {
    const config = getYouTubeOAuthPublicConfig();
    expect(config.redirectUri).toBe("https://nusghvideo-fqf8exqq.manus.space/api/oauth/youtube/callback");
    expect(config.clientId).toContain(".apps.googleusercontent.com");
  });
});
