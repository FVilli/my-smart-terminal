---
title: "AI provider setup guide"
type: guide
project: smart-terminal
created: 2026-10-23
---
<!-- gsynchro:v1 id=cf2920b2-88e0-4939-a886-48bccc6095e8 registered=2026-10-23T13:00:27.389Z -->

# AI provider setup guide

![Initial setup, step 2: AI provider, model and token](assets/screenshots/07-onboarding-ai.png)

AI correction is optional. It corrects typos only in the assisted-input draft, preserves code, paths, URLs, commands and flags, and never executes a command automatically. Shell/Pty use is unaffected when no provider is configured.

## Provider choices

| Provider | Configuration |
| --- | --- |
| Anthropic | Provider, optional model, API token. |
| OpenAI | Provider, optional model, API token. |
| OpenAI-compatible | Provider, base URL, model, API token. The endpoint must expose an OpenAI-compatible chat-completions API. |

The base URL must be `http(s)`, without credentials or query parameters. The model name is provider-specific.

## Token and keychain

Enter the token only in the token field; **never** in the data repository or a Markdown file. The main process stores it through the system keychain/Electron `safeStorage`. On Linux, if the backend is `basic_text`, `unknown`, or encryption is unavailable, the token is kept in memory for the current session only and a warning is displayed. Configure a secure keyring before relying on cloud AI after restart.

The renderer never receives the token; it only sees whether a token is present. Logout/revocation removes it.

## Test the provider

Click **Test AI**. Smart Terminal sends a fixed minimal prompt through the main process with the configured provider, model and token, waits up to 8 seconds, and reports success with latency/model or an actionable error. It does not log your terminal text and does not execute commands.

| Result | Action |
| --- | --- |
| **AI responded in … ms** | Configuration works; continue setup. |
| **AI provider is not configured** | Select a provider. |
| **AI token is not configured** | Enter a token and save it in the keychain. |
| **AI request timed out** | Check network/base URL/provider status and retry. |
| **Provider error** | Verify token, base URL, model and provider status. |

You can skip AI or save without a token; the terminal remains fully functional.

## Review before sending

Clicking **AI** in the assisted input applies a correction to the editable draft and shows **“AI correction applied: review before sending.”** Nothing is sent automatically. Shell-like input is skipped conservatively so commands are not rewritten. AI/STT errors never block the terminal.
