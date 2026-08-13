export const PROVIDER_TYPES = [
  "llm",
  "research",
  "tts",
  "image",
  "video",
  "sfx",
  "render",
  "storage",
  "youtube",
] as const;

export type ProviderType = (typeof PROVIDER_TYPES)[number];

export type ProviderExecutionContext = {
  projectId: number;
  videoId?: number;
  jobId?: number;
  input: Record<string, unknown>;
};

export type ProviderExecutionResult = {
  ok: boolean;
  output?: Record<string, unknown>;
  error?: string;
  requiresHumanReview?: boolean;
};

export interface ProviderAdapter {
  readonly key: string;
  readonly type: ProviderType;
  readonly displayName: string;
  healthCheck(): Promise<{ status: "available" | "limited" | "unavailable"; detail?: string }>;
  execute(context: ProviderExecutionContext): Promise<ProviderExecutionResult>;
}

export class ProviderRegistry {
  private readonly adapters = new Map<string, ProviderAdapter>();

  register(adapter: ProviderAdapter) {
    this.adapters.set(adapter.key, adapter);
  }

  get(key: string) {
    return this.adapters.get(key);
  }

  list() {
    return Array.from(this.adapters.values());
  }

  async executeWithFallback(keys: string[], context: ProviderExecutionContext) {
    const attempted: Array<{ key: string; error: string }> = [];
    for (const key of keys) {
      const adapter = this.get(key);
      if (!adapter) {
        attempted.push({ key, error: "المزود غير مسجل." });
        continue;
      }
      const health = await adapter.healthCheck();
      if (health.status === "unavailable") {
        attempted.push({ key, error: health.detail ?? "المزود غير متاح." });
        continue;
      }
      const result = await adapter.execute(context);
      if (result.ok || result.requiresHumanReview) return { adapterKey: key, result, attempted };
      attempted.push({ key, error: result.error ?? "فشل تنفيذ المزود." });
    }
    return {
      adapterKey: null,
      result: { ok: false, error: "فشلت جميع المزودات المتاحة." },
      attempted,
    };
  }
}

export const providerRegistry = new ProviderRegistry();
