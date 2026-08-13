import { describe, expect, it } from "vitest";

describe("ElevenLabs server credential", () => {
  it("authenticates against the required voices endpoint without exposing the key", async () => {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    expect(apiKey).toBeTruthy();
    const response = await fetch("https://api.elevenlabs.io/v1/voices", {
      headers: { "xi-api-key": apiKey! },
    });
    expect(response.status, `فشل تحقق ElevenLabs بحالة HTTP ${response.status}`).toBe(200);
  }, 20_000);
});
