import { describe, expect, it } from "vitest";

const repository = "sabryomar570/nusgh-ai-video-factory";

describe("GitHub render credential", () => {
  it("can read the repository workflow catalog with the configured fine-grained token", async () => {
    const token = process.env.NUSGH_GITHUB_RENDER_TOKEN;
    expect(token, "NUSGH_GITHUB_RENDER_TOKEN must be configured").toMatch(/^github_pat_[A-Za-z0-9_]+$/);

    const response = await fetch(`https://api.github.com/repos/${repository}/actions/workflows`, {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "X-GitHub-Api-Version": "2026-03-10",
      },
      signal: AbortSignal.timeout(15_000),
    });

    expect(response.status, `GitHub workflow catalog request failed with HTTP ${response.status}`).toBe(200);
    const payload = (await response.json()) as { workflows?: unknown[] };
    expect(Array.isArray(payload.workflows)).toBe(true);
  });
});
