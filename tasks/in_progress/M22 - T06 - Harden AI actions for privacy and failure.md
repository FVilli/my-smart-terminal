---
title: "M22 - T06 - Harden AI actions for privacy and failure"
type: task
project: smart-terminal
created: 2026-10-25
id: "M22-T06"
milestone: "M22"
depends_on: "M22-T05"
deliverables: "Secret-filter gate, injection-safe prompts, sanitized diagnostics, timeout and offline behaviour with tests"
---

# M22 - T06 - Harden AI actions for privacy and failure

## Objective
Make the new AI surface safe to use with real commands and messages, and predictable when the provider is unavailable.

## Implementation
- Run `isSensitiveText` over the prompt before Send in main (the authoritative check, not only in the renderer); on match, return a structured `sensitive` skip, block the provider call, and let the modal explain which kinds of content are blocked without echoing the secret.
- Keep system instructions immutable in main; assert with tests that editing the prompt body cannot inject a new role/instruction that changes the action or output contract; delimit user text and instruct the model to answer only with the requested artifact.
- Sanitize every failure: `unconfigured`, `missing-token`, `timeout`, `provider-error`, `empty`, `sensitive`; map HTTP/network categories only, never bodies, headers, tokens or file paths. Reuse the existing STT/AI diagnostic vocabulary where possible.
- Timeout budget 15 s with `AbortSignal`; cancel in-flight requests when the modal closes; a late answer must not populate a closed modal.
- Risk action: enforce and surface the advisory disclaimer; never present the assessment as a guarantee.
- Ensure prompts/answers are not persisted, not logged with content, and not written to the data repository; add a test that no file under the data repo contains the test prompt.
- Extend the Electron AI smoke with blocked/secret, timeout (test-mode), error and empty-answer cases; keep the terminal usable in every failure.

## Acceptance
- Secrets are blocked before any network call, with a clear non-echoing message.
- Prompt injection through the editable body cannot change the action contract (tested).
- All failure modes are structured and non-blocking; late responses are ignored.
- No prompt/answer content is persisted or logged; tests and docs/13 updated.
