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

Select **TEST**. Smart Terminal saves the current STT values, activates the microphone, records for about two seconds, sends the audio to the configured provider, and displays the recognized text. The audio is discarded and the result is not sent to the terminal.

The first time, grant microphone permission if the operating system asks. If the microphone is denied or unavailable, the terminal remains usable. If the AI provider/token is not configured, fix the AI tab first.

## Language

The STT language is independent from the terminal locale. Set `EN` or `IT` explicitly. When no language has been saved, the initial selection follows the OS/browser locale when it is English or Italian; otherwise it falls back to `EN`.

## Troubleshooting

| Symptom | Action |
| --- | --- |
| **TEST does not start** | Configure an OpenAI/OpenAI-compatible AI provider and token in the AI tab first. |
| **Microphone denied** | Grant microphone permission in the OS settings, then retry TEST. |
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
