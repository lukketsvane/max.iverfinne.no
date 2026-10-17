# MAX soundtrack

User-supplied complete recordings, streamed at 44.1 kHz stereo.
Ozan uses 128 kbps MP3; the longer Concierto uses 80 kbps AAC in a fast-start M4A
container to fit the upload limit. Their cover artwork was removed during
transcoding. Theme and Stormy Weather retain the supplied 320 kbps MP3 bytes.

| File | Title | Artist in supplied metadata | Duration |
| --- | --- | --- | --- |
| theme-instrumental.mp3 | Theme - Instrumental | Moondog | 179.748571 s |
| ozan-koukle.mp3 | Ozan Koukle | Ice | 348.212245 s |
| concierto-de-aranjuez.m4a | Concierto De Aranjuez | Jim Hall | about 1160.46 s |
| stormy-weather.mp3 | Stormy Weather | Oscar Peterson | 214.073469 s |

The 17 October 2026 owner request places Theme first and adds Stormy Weather
once. `Stormy Weather 2.mp3` and `Stormy Weather.mp3` were identical uploads.
Source SHA-256 hashes:

- Theme: `73c30936397b5e35b13c23dd84946aaf8ef5cd594029e1defa8014ece9466505`
- Stormy Weather: `9dc0ed6f1e5ac70ceaff6240c98b5de895c34e02b9c841cfab9eaf8f5ac8d9d5`

Playlist and playback: `soundtrack.mjs`. Build: `scripts/build-static.cjs`.
All files retain the complete recording. Do not embed them in the JS
bundle or replace them with generated audio.
