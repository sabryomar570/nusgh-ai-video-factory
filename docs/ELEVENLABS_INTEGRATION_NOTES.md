# ElevenLabs Integration Notes

**Checked:** 14 August 2026 (UTC)

The official ElevenLabs API reference documents a text-to-speech endpoint with timing data. The returned JSON contains base64 audio and character-level alignment data, which is appropriate for generating Arabic subtitle cues. The NUSGH integration therefore treats alignment as a required data source for captions when available.

The implementation must not assume that every audio output format is available to every account tier. In particular, production code must preserve the configured MP3 output for compatibility, detect provider-side quota or format errors, and stop the job for human review rather than silently creating an incomplete asset. Multi-segment narration requires an explicit, tested composition strategy before it is considered production-capable.

No claim of unlimited free voice generation, commercial rights, or automated publishing is made by this note. Account quota, voice rights, and commercial-use suitability remain runtime review gates.
