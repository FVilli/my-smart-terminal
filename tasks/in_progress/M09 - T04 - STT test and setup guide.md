---
title: "M09 - T04 - STT test and setup guide"
type: task
project: smart-terminal
created: 2026-10-23
id: "M09-T04"
milestone: "M09"
depends_on: "T01"
deliverables: "STT test and setup guide"
---
<!-- gsynchro:v1 id=25d3cea2-fa19-4a34-a4ef-03da7ab0a8e1 registered=2026-10-23T12:22:28.376Z -->

# M09 - T04 - STT test and setup guide

## Objective
Let users verify microphone and STT during setup, with a complete guide.

## Constrained implementation
Add a shared `setup:test-stt` IPC contract and a “Test STT” action that records a short push-to-talk sample (or uses a deterministic test sample in smoke), sends it through the configured STT provider, shows the recognized text and elapsed time, and discards audio. Handle permission deny, unavailable microphone, missing token/command, timeout and provider errors. Local/cloud providers and onboarding fields must match. Write an English STT setup guide (microphone permissions per OS, keyring/basic_text, local absolute command on stdin with no arguments, cloud provider/token, privacy/no audio persistence, troubleshooting) and link it from the wizard and docs.

## Acceptance criteria
A successful test displays editable recognized text (not auto-sent); deny/unavailable/timeout show actionable messages; no audio file remains in userData/repo/temp; guide covers local/cloud and is linked from README/manual/onboarding; smoke/unit tests cover the flows.

## References
docs/05; docs/14; packages/ai/src/stt.ts; apps/renderer/src/app/stt.

## Do not
Do not persist audio or send commands automatically.
