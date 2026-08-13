import { describe, expect, it } from "vitest";
import { calculateBackoffMs, isSafetyStopReason } from "./queue";
import { ProviderRegistry, type ProviderAdapter } from "./providers";

describe("NUSGH job policy", () => {
  it("uses bounded exponential backoff", () => {
    expect(calculateBackoffMs(1)).toBe(15_000);
    expect(calculateBackoffMs(2)).toBe(30_000);
    expect(calculateBackoffMs(20)).toBe(15 * 60 * 1000);
  });

  it("recognizes non-bypassable safety stop reasons", () => {
    expect(isSafetyStopReason("fact_check_failure")).toBe(true);
    expect(isSafetyStopReason("render_failure")).toBe(true);
    expect(isSafetyStopReason("ordinary_timeout")).toBe(false);
  });
});

describe("NUSGH provider fallback", () => {
  it("moves to the next provider after a failed execution", async () => {
    const primary: ProviderAdapter = {
      key: "primary",
      type: "research",
      displayName: "Primary",
      healthCheck: async () => ({ status: "available" }),
      execute: async () => ({ ok: false, error: "upstream failed" }),
    };
    const fallback: ProviderAdapter = {
      key: "fallback",
      type: "research",
      displayName: "Fallback",
      healthCheck: async () => ({ status: "available" }),
      execute: async () => ({ ok: true, output: { source: "fallback" } }),
    };
    const registry = new ProviderRegistry();
    registry.register(primary);
    registry.register(fallback);

    const outcome = await registry.executeWithFallback(["primary", "fallback"], {
      projectId: 1,
      input: {},
    });

    expect(outcome.adapterKey).toBe("fallback");
    expect(outcome.result.ok).toBe(true);
    expect(outcome.attempted).toEqual([{ key: "primary", error: "upstream failed" }]);
  });
});
