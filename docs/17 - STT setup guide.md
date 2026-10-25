---
title: "STT setup guide"
type: guide
project: smart-terminal
created: 2026-10-23
---
<!-- gsynchro:v1 id=0fdd52e3-a3eb-4ef3-b8ef-6078e5b1f576 registered=2026-10-24T17:17:12.601Z -->

# STT setup guide

STT can use the AI provider configured in **AI**, a separately configured OpenAI-compatible provider, a local command, or be disabled. Audio is held in memory only: recordings are never written to the data repository or userData.

## Configure

Open **Settings** with the gear, select the **STT** tab, and configure:

- **Speech to Text provider:** `Use the same AI provider (OpenAI-compatible)` (the only option).
- **Model:** choose an explicit audio model, or **Server default (do not send model)** to omit the `model` field and let the provider choose. **Refresh models** queries the provider's `/v1/models` endpoint and filters entries whose `audio_workflows` contains `transcribe`; static fallback options include Parakeet, Qwen3 ASR 0.6B and Qwen3 ASR 1.7B.
- **Language:** `EN (English)` or `IT (Italiano)`.

The base URL and token are taken from the AI tab, so configure and test AI first. Use an `openai` or `openai-compatible` AI provider. AI settings, including the token, remain in the main process/keychain and are not copied into Markdown or logs.

## Specific cloud provider

In Settings → **STT**, choose **Use Specific Provider**, then select **DeepSeek Platform** or **OpenAI Compatible** and enter its base URL, token, and model. For example, DeepSeek's documented example base URL is `https://api.deepseek.com/v1`; an OpenAI-compatible endpoint can also be configured. Enter tokens only in the token field: they are handled through the system keychain, never Markdown. Use model refresh to discover available models. Exact endpoint compatibility depends on the service; verify it with TEST.

Alternatively, choose **Use same AI provider** to retain the existing shared AI URL and key; **None** disables STT. Existing local configurations still load, but Local command is no longer offered as a new option. The shared-provider mode remains unchanged.

## TEST

Select **REC**, speak, then **STOP**. The recording time is shown. Use **PLAY** to listen to the in-memory sample, then **TRANSCRIBE** to save the current values and send the audio to the provider. The result or detailed error appears below the controls. During the current debugging phase the sample is saved to `userData/stt-debug/` and its path is shown under the controls, so you can verify that audio was captured. It is not sent to the terminal; remove the debug folder when finished.

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
