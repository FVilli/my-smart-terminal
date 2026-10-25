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


## AI actions (M22)
The composer `AI` button opens one modal with five explicit actions: suggest a command, explain a command, assess risk, fix a message for an interactive agent, and rewrite a dictated message. Each action pre-fills an editable prompt that includes the session's detected OS/shell; the fixed system instruction and artifact contract stay in the main process and cannot be overridden by editing the body.

- `ai:compose` renders the prompt body without network access; `ai:action` wraps the edited body in the immutable contract and makes one provider request (15 s timeout, temperature 0, no streaming).
- The answer is read-only and selectable. `Use` inserts the selection (or the whole answer) at the composer caret and closes the modal; it never submits or executes. `Cancel` discards prompt and answer; `Close` keeps the prompt for reopening. Nothing is written to Markdown, history or logs.
- Before any provider call, main runs the secret filter over the prompt: a match returns a structured `sensitive` skip, blocks the network request, and the modal explains the block without echoing the value. Provider errors, timeouts, empty answers and unconfigured providers are non-blocking and sanitized.
- Risk assessment is explicitly advisory: it is heuristic, not a security control, and the UI says so.
- Session environment (`os`, `shell`, `env_source`, `env_detected_at`) is recorded when the session is created: local sessions are exact; SSH sessions use one non-interactive probe outside the PTY and fall back to `unknown` without affecting the session.
