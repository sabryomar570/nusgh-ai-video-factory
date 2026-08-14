import { and, desc, eq } from "drizzle-orm";
import { analyticsSnapshots, youtubeChannels, youtubeOAuthTokens } from "../../drizzle/schema";
import { getDb } from "../db";
import { decryptYouTubeToken, encryptYouTubeToken } from "./youtube-oauth";

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const ANALYTICS_URL = "https://youtubeanalytics.googleapis.com/v2/reports";
const METRICS = ["views", "estimatedMinutesWatched", "averageViewDuration", "subscribersGained", "likes", "comments", "shares"] as const;

type TokenEnvelope = { ciphertext: string; iv: string; authTag: string };
type AnalyticsApiResponse = { rows?: Array<Array<number>>; error?: { message?: string } };

export function analyticsWindow(days = 28, now = new Date()) {
  const end = new Date(now); end.setUTCDate(end.getUTCDate() - 1);
  const start = new Date(end); start.setUTCDate(start.getUTCDate() - Math.max(1, days) + 1);
  const format = (date: Date) => date.toISOString().slice(0, 10);
  return { start, end, startDate: format(start), endDate: format(end) };
}

export function normalizeAnalyticsRow(row: number[] | undefined) {
  const [views = 0, watchTimeMinutes = 0, averageViewDurationSeconds = 0, subscribersGained = 0, likes = 0, comments = 0, shares = 0] = row ?? [];
  return { views, watchTimeMinutes, averageViewDurationSeconds: Math.round(averageViewDurationSeconds), subscribersGained, likes, comments, shares };
}

function parseEnvelope(value: string): TokenEnvelope {
  const parsed = JSON.parse(value) as Partial<TokenEnvelope>;
  if (!parsed.ciphertext || !parsed.iv || !parsed.authTag) throw new Error("سجل رمز YouTube المشفر غير صالح.");
  return parsed as TokenEnvelope;
}

async function tokenForChannel(channelId: number) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة لمزامنة YouTube Analytics.");
  const record = (await db.select().from(youtubeOAuthTokens).where(eq(youtubeOAuthTokens.youtubeChannelId, channelId)).orderBy(desc(youtubeOAuthTokens.updatedAt)).limit(1))[0];
  if (!record) throw new Error("لا يوجد رمز OAuth محفوظ للقناة.");
  const expiresSoon = !record.expiresAt || record.expiresAt.getTime() <= Date.now() + 60_000;
  if (!expiresSoon) return { db, accessToken: decryptYouTubeToken(parseEnvelope(record.accessTokenCiphertext)) };

  const refreshToken = decryptYouTubeToken(parseEnvelope(record.refreshTokenCiphertext));
  const clientId = process.env.YOUTUBE_CLIENT_ID;
  const clientSecret = process.env.YOUTUBE_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("إعداد YouTube OAuth غير مكتمل لتجديد الرمز.");
  const response = await fetch(GOOGLE_TOKEN_URL, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken, grant_type: "refresh_token" }) });
  const refreshed = await response.json() as { access_token?: string; expires_in?: number };
  if (!response.ok || !refreshed.access_token) throw new Error("تعذر تجديد رمز YouTube؛ يتطلب الربط مراجعة المالك.");
  const encrypted = encryptYouTubeToken(refreshed.access_token);
  await db.update(youtubeOAuthTokens).set({ accessTokenCiphertext: JSON.stringify(encrypted), expiresAt: refreshed.expires_in ? new Date(Date.now() + refreshed.expires_in * 1000) : null }).where(eq(youtubeOAuthTokens.id, record.id));
  return { db, accessToken: refreshed.access_token };
}

export async function syncChannelAnalytics(projectId: number, days = 28) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة لمزامنة YouTube Analytics.");
  const channel = (await db.select().from(youtubeChannels).where(and(eq(youtubeChannels.projectId, projectId), eq(youtubeChannels.isConnected, true))).limit(1))[0];
  if (!channel) throw new Error("لا توجد قناة YouTube متصلة لهذا المشروع.");
  const { accessToken } = await tokenForChannel(channel.id);
  const window = analyticsWindow(days);
  const url = new URL(ANALYTICS_URL);
  url.search = new URLSearchParams({ ids: "channel==MINE", startDate: window.startDate, endDate: window.endDate, metrics: METRICS.join(",") }).toString();
  const response = await fetch(url, { headers: { authorization: `Bearer ${accessToken}` } });
  const payload = await response.json() as AnalyticsApiResponse;
  if (!response.ok) throw new Error(`تعذر جلب تحليلات YouTube: ${payload.error?.message ?? response.status}`);
  const metrics = normalizeAnalyticsRow(payload.rows?.[0]);
  const [snapshot] = await db.insert(analyticsSnapshots).values({ projectId, youtubeChannelId: channel.id, periodStart: window.start, periodEnd: window.end, views: metrics.views, impressions: 0, watchTimeMinutes: metrics.watchTimeMinutes, averageViewDurationSeconds: metrics.averageViewDurationSeconds, subscribersGained: metrics.subscribersGained, likes: metrics.likes, comments: metrics.comments, shares: metrics.shares, rawMetrics: { requestedMetrics: METRICS, sourceRows: payload.rows ?? [] } }).$returningId();
  await db.update(youtubeChannels).set({ lastSyncedAt: new Date() }).where(eq(youtubeChannels.id, channel.id));
  return { snapshotId: snapshot?.id, channelId: channel.channelId, period: { start: window.startDate, end: window.endDate }, metrics };
}
