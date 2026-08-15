import { createRenderCallbackSignature, isLikelyMp4, isValidRenderCallback } from "./github-render";
import { describe, expect, it } from "vitest";

describe("GitHub Actions render security", () => {
  const secret = "a test-only secret that is long enough";

  it("accepts a fresh HMAC callback signature only for its exact job and content hash", () => {
    const timestamp = "1786795000";
    const jobId = 42;
    const sha256 = "a".repeat(64);
    const signature = createRenderCallbackSignature({ timestamp, jobId, sha256, secret });
    expect(isValidRenderCallback({ timestamp, jobId: String(jobId), sha256, signature, secret, now: 1786795000_000 })).toBe(true);
    expect(isValidRenderCallback({ timestamp, jobId: "43", sha256, signature, secret, now: 1786795000_000 })).toBe(false);
  });

  it("recognizes an MP4 container header without treating arbitrary bytes as a final video", () => {
    expect(isLikelyMp4(Buffer.from([0, 0, 0, 20, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d]))).toBe(true);
    expect(isLikelyMp4(Buffer.from("not an mp4"))).toBe(false);
  });
});
