import { createCipheriv, createDecipheriv, randomBytes, timingSafeEqual } from "node:crypto";
import type { Request, Response } from "express";
import { parse as parseCookieHeader } from "cookie";
import { and, eq } from "drizzle-orm";
import { youtubeChannels, youtubeOAuthTokens } from "../../drizzle/schema";
import { getDb } from "../db";
import { createContext } from "../_core/context";
import { ensureNusghProject } from "./repository";

const STATE_COOKIE = "nusgh_youtube_oauth_state";
const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const SCOPES = ["https://www.googleapis.com/auth/youtube.upload", "https://www.googleapis.com/auth/youtube.readonly", "https://www.googleapis.com/auth/yt-analytics.readonly"];

function config() {
  const clientId = process.env.YOUTUBE_CLIENT_ID;
  const clientSecret = process.env.YOUTUBE_CLIENT_SECRET;
  const redirectUri = process.env.YOUTUBE_OAUTH_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) throw new Error("YouTube OAuth غير مهيأ بالكامل.");
  return { clientId, clientSecret, redirectUri };
}
export function getYouTubeOAuthPublicConfig() {
  const { clientId, redirectUri } = config();
  return { clientId, redirectUri };
}
function key() { const raw = Buffer.from(process.env.YOUTUBE_TOKEN_ENCRYPTION_KEY ?? "", "base64"); if (raw.length !== 32) throw new Error("مفتاح تشفير YouTube غير صالح."); return raw; }
export function encryptYouTubeToken(value: string) { const iv = randomBytes(12); const cipher = createCipheriv("aes-256-gcm", key(), iv); const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]); return { ciphertext: encrypted.toString("base64"), iv: iv.toString("base64"), authTag: cipher.getAuthTag().toString("base64") }; }
export function decryptYouTubeToken(input: { ciphertext: string; iv: string; authTag: string }) { const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(input.iv, "base64")); decipher.setAuthTag(Buffer.from(input.authTag, "base64")); return Buffer.concat([decipher.update(Buffer.from(input.ciphertext, "base64")), decipher.final()]).toString("utf8"); }

async function owner(req: Request, res: Response) { const ctx = await createContext({ req, res, info: undefined as never }); if (!ctx.user || ctx.user.role !== "admin") return null; return ctx.user; }
export async function startYouTubeOAuth(req: Request, res: Response) { const user = await owner(req, res); if (!user) return res.status(403).json({ error: "owner authentication required" }); const state = randomBytes(32).toString("base64url"); res.cookie(STATE_COOKIE, state, { httpOnly: true, secure: true, sameSite: "lax", path: "/api/oauth/youtube", maxAge: 10 * 60 * 1000 }); const { clientId, redirectUri } = config(); const url = new URL(GOOGLE_AUTH_URL); url.search = new URLSearchParams({ client_id: clientId, redirect_uri: redirectUri, response_type: "code", scope: SCOPES.join(" "), access_type: "offline", prompt: "consent", state }).toString(); return res.redirect(302, url.toString()); }

export async function completeYouTubeOAuth(req: Request, res: Response) {
  const user = await owner(req, res); if (!user) return res.status(403).json({ error: "owner authentication required" });
  const state = typeof req.query.state === "string" ? req.query.state : ""; const code = typeof req.query.code === "string" ? req.query.code : ""; const expected = parseCookieHeader(req.headers.cookie ?? "")[STATE_COOKIE];
  if (!code || !state || !expected || state.length !== expected.length || !timingSafeEqual(Buffer.from(state), Buffer.from(expected))) return res.status(400).json({ error: "invalid oauth state" });
  res.clearCookie(STATE_COOKIE, { httpOnly: true, secure: true, sameSite: "lax", path: "/api/oauth/youtube" });
  const { clientId, clientSecret, redirectUri } = config(); const tokenResponse = await fetch(GOOGLE_TOKEN_URL, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, grant_type: "authorization_code" }) });
  const tokens = await tokenResponse.json() as { access_token?: string; refresh_token?: string; expires_in?: number; scope?: string; error?: string };
  if (!tokenResponse.ok || !tokens.access_token || !tokens.refresh_token) return res.status(502).json({ error: "youtube token exchange failed" });
  const channelResponse = await fetch("https://www.googleapis.com/youtube/v3/channels?part=id,snippet&mine=true", { headers: { authorization: `Bearer ${tokens.access_token}` } });
  const channelPayload = await channelResponse.json() as { items?: Array<{ id: string; snippet?: { title?: string } }> }; const channel = channelPayload.items?.[0]; if (!channelResponse.ok || !channel) return res.status(502).json({ error: "youtube channel lookup failed" });
  const db = await getDb(); if (!db) return res.status(503).json({ error: "database unavailable" }); const project = await ensureNusghProject(user.id); const existing = await db.select().from(youtubeChannels).where(and(eq(youtubeChannels.projectId, project.id), eq(youtubeChannels.channelId, channel.id))).limit(1);
  if (existing[0]) await db.update(youtubeChannels).set({ channelTitle: channel.snippet?.title ?? null, isConnected: true, lastSyncedAt: new Date(), oauthSecretRef: "database:youtube_oauth_tokens" }).where(eq(youtubeChannels.id, existing[0].id)); else await db.insert(youtubeChannels).values({ projectId: project.id, channelId: channel.id, channelTitle: channel.snippet?.title ?? null, isConnected: true, lastSyncedAt: new Date(), oauthSecretRef: "database:youtube_oauth_tokens" });
  const connected = (await db.select().from(youtubeChannels).where(and(eq(youtubeChannels.projectId, project.id), eq(youtubeChannels.channelId, channel.id))).limit(1))[0]; if (!connected) return res.status(500).json({ error: "channel persistence failed" }); const access = encryptYouTubeToken(tokens.access_token); const refresh = encryptYouTubeToken(tokens.refresh_token); if (access.iv !== refresh.iv || access.authTag !== refresh.authTag) { /* each encrypted value is stored as a self-contained envelope below */ }
  await db.insert(youtubeOAuthTokens).values({ youtubeChannelId: connected.id, accessTokenCiphertext: JSON.stringify(access), refreshTokenCiphertext: JSON.stringify(refresh), iv: "envelope", authTag: "envelope", scope: tokens.scope ?? null, expiresAt: tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000) : null }).onDuplicateKeyUpdate({ set: { accessTokenCiphertext: JSON.stringify(access), refreshTokenCiphertext: JSON.stringify(refresh), scope: tokens.scope ?? null, expiresAt: tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000) : null } });
  return res.redirect(302, "/?youtube=connected");
}
