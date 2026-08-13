import { describe, expect, it } from "vitest";
import { hasValidTelegramWebhookSecret, isAllowedTelegramOwner, verifyTelegramBot } from "./telegram";

describe("Telegram configuration", () => {
  it("validates the configured bot token through Telegram getMe", async () => {
    const bot = await verifyTelegramBot();
    expect(bot.id).toBeTypeOf("number");
    expect(bot.first_name.length).toBeGreaterThan(0);
  }, 20_000);

  it("rejects an incorrect webhook secret", () => {
    expect(hasValidTelegramWebhookSecret("incorrect-webhook-secret")).toBe(false);
  });

  it("does not allow an unrelated Telegram user ID", () => {
    expect(isAllowedTelegramOwner("0")).toBe(false);
  });
});
