---
title: "STT setup guide"
type: guide
project: smart-terminal
created: 2026-10-23
---
<!-- gsynchro:v1 id=cf4671d0-54be-499f-800e-7dd16b28bec4 registered=2026-10-23T13:00:27.389Z -->

# STT setup guide

Smart Terminal can dictate into the assisted-input draft with a local command or a cloud provider. Audio is held in memory only: the app does not write recordings to the data repository or userData. A denied microphone or unavailable provider never blocks the terminal or normal submission.

## 1. Microphone permission

| Platform | What to check |
| --- | --- |
| Linux | The desktop/keyring session grants microphone access to the app; in the wizard use **Check microphone**. On PipeWire/PulseAudio, verify the input device is not muted. |
| macOS | Allow microphone access in **System Settings → Privacy & Security → Microphone** for Smart Terminal. |
| Windows | Allow microphone access in **Settings → Privacy → Microphone**; check the default input device. |

The wizard shows **Microphone denied** or **Microphone unavailable** with a recovery hint. You can continue without STT.

## 2. Local STT

Choose **local** in the STT step. The **Local STT command** must be an absolute executable path. Smart Terminal runs it without a shell, passes audio bytes on stdin, and reads the transcript from stdout. It does not pass arguments and does not create a temporary audio file.

Example wrappers (adapt to your installed model):

```bash
#!/bin/sh
# /home/me/bin/whisper-stdin
exec /home/me/bin/whisper-cli -m /home/me/models/ggml-base.bin --no-timestamps -
```

Use the wrapper's absolute path in **Local STT command**, then click **Test transcription**. The test records up to three seconds and displays the recognized text; audio is discarded.

## 3. Cloud STT

Choose **cloud** and configure the provider model and token. The token is stored through the system keychain/Electron `safeStorage`, never in Markdown. On Linux, if the keyring backend is `basic_text` or encryption is unavailable, the token remains in memory for the session only; configure a secure keyring before relying on cloud STT after restart.

Cloud transcription requires network access. In the **STT** Settings tab, or in the STT onboarding step, configure these fields:

- **Base URL:** `https://unsloth.fvsg.mqu.it/v1`
- **Model:** `audio-cpp/audio.cpp-gguf/Parakeet-TDT-0.6B-v3-GGUF`
- **Response format:** `json` or `verbose_json` (the default example is `verbose_json`)
- **Language:** `en`
- **Bearer token:** enter the token in the token field; it is stored in the system keychain.

The request endpoint is `<base>/audio/transcriptions`, so the `/v1` suffix must be included in the base URL. The app sends a short audio sample only when you explicitly start a test or dictation; it never sends audio in the background.

**Test transcription** records up to three seconds, displays the recognized text, and never saves the audio. It uses the current unsaved STT values, including Base URL, Response format, and Language.

## 4. Using dictation

- Press and hold the microphone for push-to-talk, or use the keyboard toggle.
- Recording stops automatically after 60 seconds.
- The transcript is appended to the current editable draft and is **not** sent automatically.
- Changing tab or closing the dialog stops and discards an in-flight recording.
- No audio file is persisted; only the resulting text can be edited and submitted.

## 5. Troubleshooting

| Symptom | Action |
| --- | --- |
| **Microphone denied** | Grant the OS permission, reload the app, retry **Check microphone**/**Test transcription**. |
| **Microphone unavailable** | Select a working input device; close other apps that hold exclusive access. |
| **STT not configured** | Select a provider; for local, set an absolute command; for cloud, set a token/model. |
| **Local command failed** | Verify the path is absolute and executable and that it accepts audio on stdin and prints text on stdout. |
| **Cloud timeout/provider error** | Check network, token, base URL/model and provider status; retry. The terminal remains usable. |
| **Token lost after restart** | The keyring is unavailable or used `basic_text`; configure a secure keyring and re-enter the token. |
| **No audio artifacts expected** | Smart Terminal stores audio in memory only; do not look for recordings in the data repository. |

## 6. Privacy checklist

- [ ] Microphone permission granted explicitly.
- [ ] Local command or cloud token configured.
- [ ] **Test transcription** shows editable text.
- [ ] No audio files in userData or the data repository.
- [ ] Transcript is reviewed before submission.
