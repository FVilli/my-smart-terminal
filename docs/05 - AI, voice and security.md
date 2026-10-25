---
title: "AI, voice, and security"
type: spec
project: smart-terminal
created: 2026-10-22
---
<!-- gsynchro:v1 id=8517ddcb-12aa-4e8a-aac4-22d53c6b7a18 registered=2026-10-23T07:57:46.061Z -->

# AI, voice, and security

## AI correction
Anthropic, OpenAI, and local OpenAI-compatible providers through a common interface. Correct only typos in assisted-editor prompts; preserve code, paths, commands, flags, and meaning. Timeout and fallback to the original. Never alter or automatically execute shell commands. Keep originals only if the privacy policy allows it.

## AI correction implementation (M05)
- Anthropic, OpenAI, and OpenAI-compatible adapters in the `ai` package, called only from main; tokens from `safeStorage`/keychain and never in the renderer.
- Constrained prompt: correct only typos, preserve code/paths/URLs/commands/flags/meaning, return only the text. `temperature: 0`, 8 s timeout, fallback to the original on error/timeout/empty response.
- Text that appears to be shell commands is skipped; correction occurs only on explicit click, updates the editable draft, and requires review before submission. No automatic execution.
- AI errors do not block the terminal or submission. Test seam `SMART_TERMINAL_AI_TEST_MODE=1` for smoke tests only, never in production.

## Voice
Configurable local or cloud STT; push-to-talk microphone, explicit permissions, editable draft before submission. No permanent audio recording by default.

## STT implementation (M05)
- `LocalSttAdapter`: configured absolute command (`stt_command`), audio through stdin, never a shell, no temporary files, 30 s timeout. `OpenAiSttAdapter`: multipart `/audio/transcriptions`, `stt:cloud` token, `stt_model`/`whisper-1` model.
- Push-to-talk in the renderer: explicit microphone permission, `MediaRecorder` in memory only, stop at 60 s, result appended to the editable draft without automatic submission. No permanent recording; stop/discard on tab change or destroy.
- Errors/denied permission show localized messages and do not block the terminal or submission. Test seam `SMART_TERMINAL_STT_TEST_MODE=1` for smoke tests only.

## Secrets
Tokens in the OS keychain, SSH through the OpenSSH client/agent and `~/.ssh/config`; do not save keys, passwords, or sensitive content in history/clipboard/repository. Configurable filters and collection-pause mode; provider logout/revocation.

## Clipboard
- Explicit opt-in collection, with pause and deletion; one polling instance per machine (primary's main in M04).
- Polling ~800 ms, in-memory SHA-256 deduplication, 32 KiB limit, discard empty/oversize content.
- Best-effort filter for private keys, tokens, passwords, and URLs with credentials: it does not guarantee recognition of every secret.
- Association with the active session updated on tab change and window focus.

## Errors
Unavailable AI/STT do not interrupt the terminal or local writing.


## AI actions (M23)
The composer `AI` button opens a modal with a select for built-in and custom actions and editable System Prompt and User Prompt fields. Both are composed from local templates and terminal context. Editing the System Prompt is supported; it is not immutable. `ai:compose` renders without network access; `ai:action` submits the displayed prompts on explicit Send (15 s timeout, temperature 0, no streaming).

- Settings → AI actions edits/resets built-in templates and adds/deletes custom actions. See [AI prompt templates and storage](36%20-%20AI%20prompt%20templates%20and%20storage.md) for storage, limits and placeholders.
- Console context is captured on demand from the active xterm buffer (last 200 lines / 8000 characters), never persisted. Prompts and answers are not persisted or logged.
- Before provider access, main applies the secret filter to both submitted prompts; a match blocks the call and produces a sanitized sensitive result. This filter is not a guarantee of detecting every secret format.
- The answer is read-only/selectable. `Use` inserts text at the composer caret; it never submits or executes. Risk assessment is advisory, not a security control.
- Session environment (`os`, `shell`, `env_source`, `env_detected_at`) is recorded at creation; SSH probing is best-effort outside the PTY and falls back to `unknown`.
