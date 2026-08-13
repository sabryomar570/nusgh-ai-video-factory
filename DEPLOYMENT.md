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

## Important OAuth note

The current source does not yet include the `GET /api/oauth/youtube/callback` route. Do not add a YouTube redirect URI in Google Cloud until that route has been implemented and deployed. Once the production domain is known, the intended callback will be:

```text
https://YOUR-PRODUCTION-DOMAIN/api/oauth/youtube/callback
```

## Security

Never put `YOUTUBE_CLIENT_SECRET`, `YOUTUBE_TOKEN_ENCRYPTION_KEY`, Telegram tokens, JWT values, database URLs, or Forge keys into this archive, a repository, browser code, or a frontend environment variable.
