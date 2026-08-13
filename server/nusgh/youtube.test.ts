import { describe, expect, it } from "vitest";

describe("YouTube OAuth credentials", () => {
  it("accepts the configured OAuth client before an authorization code is supplied", async () => {
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.YOUTUBE_CLIENT_ID ?? "",
        client_secret: process.env.YOUTUBE_CLIENT_SECRET ?? "",
        code: "credential-validation-probe",
        grant_type: "authorization_code",
        redirect_uri: "https://localhost/credential-validation-probe",
      }),
    });
    const payload = (await response.json()) as { error?: string };
    expect(response.status).toBeGreaterThanOrEqual(400);
    expect(payload.error).not.toBe("invalid_client");
  }, 20_000);
});
