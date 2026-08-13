# Production environment variable reference

Set these names and their real values only in your hosting platform's secure environment-variable UI.

| Group | Variable names |
|---|---|
| Server / database | `NODE_ENV`, `PORT`, `DATABASE_URL`, `JWT_SECRET` |
| Existing Manus runtime | `VITE_APP_ID`, `OAUTH_SERVER_URL`, `VITE_OAUTH_PORTAL_URL`, `OWNER_OPEN_ID`, `OWNER_NAME`, `BUILT_IN_FORGE_API_URL`, `BUILT_IN_FORGE_API_KEY`, `VITE_FRONTEND_FORGE_API_URL`, `VITE_FRONTEND_FORGE_API_KEY` |
| Telegram | `TELEGRAM_BOT_TOKEN`, `TELEGRAM_OWNER_USER_ID`, `TELEGRAM_WEBHOOK_SECRET` |
| YouTube OAuth | `YOUTUBE_CLIENT_ID`, `YOUTUBE_CLIENT_SECRET`, `YOUTUBE_TOKEN_ENCRYPTION_KEY`, `YOUTUBE_OAUTH_REDIRECT_URI` |

Never store their values in this file, the source archive, a repository, frontend code, or a browser environment variable.
