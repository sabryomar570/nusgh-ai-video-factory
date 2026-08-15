import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { eq } from "drizzle-orm";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerStorageProxy } from "./storageProxy";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { createTelegramWebhookHandler } from "../nusgh/telegram";
import { ensureNusghProject } from "../nusgh/repository";
import { ENV } from "./env";
import { completeYouTubeOAuth, startYouTubeOAuth } from "../nusgh/youtube-oauth";
import { registerArabicVoiceProvider } from "../nusgh/voice";
import { users } from "../../drizzle/schema";
import { dailyAutopilotHandler } from "../nusgh/daily-autopilot";
import { githubRenderCallbackHandler, githubRenderManifestHandler, registerGithubRenderProvider } from "../nusgh/github-render";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function resolveTelegramProjectId() {
  const database = await import("../db");
  const configuredOwner = await database.getUserByOpenId(ENV.ownerOpenId);
  if (configuredOwner) return (await ensureNusghProject(configuredOwner.id)).id;

  if (ENV.ownerOpenId) {
    await database.upsertUser({ openId: ENV.ownerOpenId, name: "NUSGH Owner", role: "admin", loginMethod: "system", lastSignedIn: new Date() });
    const provisionedOwner = await database.getUserByOpenId(ENV.ownerOpenId);
    if (provisionedOwner) return (await ensureNusghProject(provisionedOwner.id)).id;
  }

  const db = await database.getDb();
  if (!db) throw new Error("قاعدة بيانات المالك غير متاحة.");
  const admins = await db.select().from(users).where(eq(users.role, "admin")).limit(2);
  if (admins.length !== 1) throw new Error("تعذر تحديد مالك Telegram بأمان.");
  return (await ensureNusghProject(admins[0].id)).id;
}

async function startServer() {
  registerArabicVoiceProvider();
  registerGithubRenderProvider();
  const app = express();
  const server = createServer(app);
  app.post("/api/render/callback", express.raw({ type: "video/mp4", limit: "50mb" }), githubRenderCallbackHandler);
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  registerStorageProxy(app);
  registerOAuthRoutes(app);
  app.get("/api/oauth/youtube/start", startYouTubeOAuth);
  app.get("/api/oauth/youtube/callback", completeYouTubeOAuth);
  app.post(
    "/api/telegram/webhook",
    createTelegramWebhookHandler(resolveTelegramProjectId)
  );
  app.post("/api/scheduled/daily-autopilot", dailyAutopilotHandler);
  app.get("/api/render/jobs/:jobId/manifest", githubRenderManifestHandler);
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
