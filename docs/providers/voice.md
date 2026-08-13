# Voice provider note

## ElevenLabs connector and commercial-use guardrail

NUSGH uses the ElevenLabs Text-to-Speech endpoint from the server only. The adapter requires `ELEVENLABS_API_KEY`, a selected `voiceId`, and narration `text`; it stores successful MP3 files in managed storage and registers a pending `audio_tracks` record for review.

ElevenLabs exposes Arabic voices, but its published help guidance states that generated content under the Free plan has no commercial license. NUSGH must therefore retain `requiresHumanReview` for every generated track until commercial rights are confirmed. A 429 rate-limit or quota response is placed into review rather than silently claiming success or stopping the project.

Sources:
- https://elevenlabs.io/text-to-speech/arabic
- https://help.elevenlabs.io/hc/en-us/articles/13313564601361-Can-I-publish-the-content-I-generate-on-the-platform
- https://elevenlabs.io/docs/api-reference/text-to-speech/convert
