---
title: "STT setup guide"
type: guide
project: smart-terminal
created: 2026-10-23
---

# STT setup guide

Smart Terminal uses the OpenAI-compatible AI provider configured in the **AI** tab for speech-to-text. Audio is held in memory only: recordings are never written to the data repository or userData.

## Configure

Open **Settings** with the gear, select the **STT** tab, and configure:

- **STT provider:** `Use the same AI provider (OpenAI-compatible)` (the only option).
- **Model:** select the audio model exposed by the provider. The current list includes `Parakeet TDT 0.6B v3 (GGUF)` (`audio-cpp/audio.cpp-gguf/Parakeet-TDT-0.6B-v3-GGUF`).
- **Language:** `EN (English)` or `IT (Italiano)`.

The base URL and token are taken from the AI tab, so configure and test AI first. Use an `openai` or `openai-compatible` AI provider. AI settings, including the token, remain in the main process/keychain and are not copied into Markdown or logs.

## TEST

Select **REC**, speak, then **STOP**. The recording time is shown. Use **PLAY** to listen to the in-memory sample, then **TRANSCRIBE** to save the current values and send the audio to the provider. The result or detailed error appears below the controls. The audio is discarded and the result is not sent to the terminal.

The first time, grant microphone permission if the operating system asks. REC works even before the AI provider is configured; TRANSCRIBE needs the provider. If the microphone is denied, missing, busy or unsupported, the UI names the specific failure and the terminal remains usable.

### Debug details

After TRANSCRIBE, expand **Debug details** under the controls. The sanitized panel shows:

- whether the provider service was reached (`serviceReached` is true only after an HTTP response);
- HTTP status, content type, JSON validity, elapsed time, safe endpoint host/path, model and language;
- audio bytes/MIME/duration and transcript length;
- an allowlisted error stage such as `network`, `http`, `json`, `timeout` or `empty`.

Tokens, audio, raw provider bodies and exception stacks are never shown. A 401 means the service responded but rejected authentication; a network stage means no HTTP response was received.

## Language

The STT language is independent from the terminal locale. Set `EN` or `IT` explicitly. When no language has been saved, the initial selection follows the OS/browser locale when it is English or Italian; otherwise it falls back to `EN`.

## Troubleshooting

| Symptom | Action |
| --- | --- |
| **REC does not start** | Configure an OpenAI/OpenAI-compatible AI provider and token in the AI tab first. |
| **Microphone denied** | Grant microphone permission in the OS settings, then retry REC. |
| **Microphone unavailable** | Select a working input device; close applications that hold exclusive access. |
| **No speech recognized** | Record closer to the microphone and retry; the audio is discarded. |
| **Provider timeout/error** | Check network, AI base URL, model and token; the terminal remains usable. |
| **Token lost after restart** | The Linux keyring may be unavailable; configure a secure keyring and re-enter the AI token. |
| **No audio artifacts** | This is expected: Smart Terminal stores no recordings. |

## Privacy checklist

- [ ] AI provider and token configured and tested.
- [ ] STT model and language selected.
- [ ] **TEST** shows an editable result.
- [ ] No audio files in userData or the data repository.
