# YouTube OAuth integration status

## Verified conditions

- The production callback used by NUSGH is `https://nusghvideo-fqf8exqq.manus.space/api/oauth/youtube/callback`.
- Google accepts this callback URI after it was added to the OAuth client configuration; the previous `redirect_uri_mismatch` is resolved.
- The production OAuth attempt completed successfully after adding the channel owner to the consent-screen test-user audience. The server recorded one connected channel and one encrypted token record; no token values were queried or exposed.

## Required owner action

Keep the channel owner's Google account in the OAuth testing audience while the consent screen remains in Testing. Do not substitute a client ID from another project without updating the server secret deliberately.

## Safety state

NUSGH does not consider YouTube connected until the callback has encrypted and persisted both the access and refresh token, and then resolves the channel through the official YouTube Data API.
