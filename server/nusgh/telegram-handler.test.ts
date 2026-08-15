import { afterEach, describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  process.env.TELEGRAM_BOT_TOKEN ||= "test-bot-token";
  process.env.TELEGRAM_OWNER_USER_ID ||= "991001";
  process.env.TELEGRAM_WEBHOOK_SECRET ||= "test-webhook-secret";
});

vi.mock("./daily-autopilot", () => ({ runConservativeDailyAutopilot: vi.fn() }));

import { createTelegramWebhookHandler } from "./telegram";
import { runConservativeDailyAutopilot } from "./daily-autopilot";

describe("Telegram create-video callback", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("sends Telegram-native creation instructions instead of a dashboard form URL", async () => {
    const fetchMock = vi.fn().mockImplementation(async () => new Response(JSON.stringify({ ok: true, result: true }), { status: 200, headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);
    const status = vi.fn().mockReturnThis();
    const json = vi.fn();
    const handler = createTelegramWebhookHandler(async () => 7);

    await handler({ header: vi.fn().mockReturnValue(process.env.TELEGRAM_WEBHOOK_SECRET), body: { callback_query: { id: "callback-1", from: { id: Number(process.env.TELEGRAM_OWNER_USER_ID) }, message: { chat: { id: 101 } }, data: "create_video" } } } as never, { status, json } as never);

    expect(status).toHaveBeenCalledWith(200);
    const sendMessageBody = JSON.parse(fetchMock.mock.calls[1]?.[1]?.body as string) as { text: string; reply_markup: { inline_keyboard: Array<Array<{ url?: string }>> } };
    expect(sendMessageBody.text).toContain("/new short");
    expect(JSON.stringify(sendMessageBody.reply_markup)).not.toContain("?create=video");
  });

  it("runs the conservative daily pipeline and reports review-only results from the Telegram button", async () => {
    vi.mocked(runConservativeDailyAutopilot).mockResolvedValue({ mode: "conservative_review_gated", candidateCount: 4, created: [{ ideaId: 9, videoId: 11, score: 82, scheduledFor: "2026-08-14T13:00:00.000Z" }], settings: { dailyIdeaLimit: 1, timezone: "Africa/Cairo" } });
    const fetchMock = vi.fn().mockImplementation(async () => new Response(JSON.stringify({ ok: true, result: true }), { status: 200, headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);
    const status = vi.fn().mockReturnThis();
    const json = vi.fn();
    const handler = createTelegramWebhookHandler(async () => 7);

    await handler({ header: vi.fn().mockReturnValue(process.env.TELEGRAM_WEBHOOK_SECRET), body: { callback_query: { id: "callback-2", from: { id: Number(process.env.TELEGRAM_OWNER_USER_ID) }, message: { chat: { id: 101 } }, data: "daily_intelligence" } } } as never, { status, json } as never);

    expect(runConservativeDailyAutopilot).toHaveBeenCalledWith(7);
    const sendMessageBody = JSON.parse(fetchMock.mock.calls[1]?.[1]?.body as string) as { text: string };
    expect(sendMessageBody.text).toContain("82/100");
    expect(sendMessageBody.text).toContain("لم يُنشأ صوت أو رندر أو نشر");
  });
});
