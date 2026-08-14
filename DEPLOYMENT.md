# NUSGH deployment package

## Commands

Use Node.js 22 and pnpm 10.

```bash
pnpm install --frozen-lockfile
pnpm build
pnpm start
```

The production server listens on the `PORT` environment variable and serves the built application from `dist/`.

## Required configuration

Use `DEPLOYMENT_ENVIRONMENT_VARIABLES.md` as the list of names to configure in your host's secret/environment-variable manager. Do not commit `.env` files or upload secrets to source control.

The application requires a MySQL-compatible database through `DATABASE_URL`. It also contains the existing Manus authentication and Forge runtime integrations, so an external host must supply the corresponding runtime variables listed in `.env.example` or replace those integrations before use outside Manus.

## YouTube OAuth

The source includes both `GET /api/oauth/youtube/start` and `GET /api/oauth/youtube/callback`. The production callback registered in the active Google OAuth client is:

```text
https://nusghvideo-fqf8exqq.manus.space/api/oauth/youtube/callback
```

For a Google OAuth consent screen in **Testing**, add the channel owner's Google account under **Google Auth Platform → Audience → Test users** before beginning authorization. A successful callback persists the channel record and encrypted OAuth token record server-side only; it does not publish, upload, or change a video's visibility.

## Security

Never put `YOUTUBE_CLIENT_SECRET`, `YOUTUBE_TOKEN_ENCRYPTION_KEY`, Telegram tokens, JWT values, database URLs, or Forge keys into this archive, a repository, browser code, or a frontend environment variable.
