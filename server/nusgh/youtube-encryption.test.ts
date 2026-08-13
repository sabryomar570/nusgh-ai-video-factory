import { describe, expect, it } from "vitest";

describe("YouTube token encryption key", () => {
  it("is a valid 32-byte Base64 server-side key", () => {
    const encoded = process.env.YOUTUBE_TOKEN_ENCRYPTION_KEY ?? "";
    const decoded = Buffer.from(encoded, "base64");
    expect(encoded).toMatch(/^[A-Za-z0-9+/]+={0,2}$/);
    expect(decoded).toHaveLength(32);
  });
});
