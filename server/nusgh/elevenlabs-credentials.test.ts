import { describe, expect, it } from "vitest";

describe("ElevenLabs server credential", () => {
  const shouldVerifyExternalProvider = process.env.NUSGH_VERIFY_EXTERNAL_PROVIDERS === "true";
  it.skipIf(!shouldVerifyExternalProvider)("authenticates against the required voices endpoint without exposing the key", async () => {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    expect(apiKey).toBeTruthy();
    const response = await fetch("https://api.elevenlabs.io/v1/voices", {
      headers: { "xi-api-key": apiKey! },
      signal: AbortSignal.timeout(10_000),
    });
    expect(response.status, `فشل تحقق ElevenLabs بحالة HTTP ${response.status}`).toBe(200);
  }, 12_000);
});
