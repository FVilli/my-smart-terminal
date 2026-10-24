---
title: "M19 - T03 - Debug UI and end-to-end test"
type: task
project: smart-terminal
created: 2026-10-25
id: "M19-T03"
milestone: "M19"
depends_on: "M19-T02"
deliverables: "REC/STOP/PLAY/TRANSCRIBE UI with concise summary and expandable sanitized debug details"
---

# M19 - T03 - Debug UI and end-to-end test

## Objective
Let a non-expert see microphone/audio state and a developer see why transcription did not work.

## Constrained implementation
- Under STT controls show recorded duration/bytes, playback state and TRANSCRIBE summary.
- Summary states service reached/not reached and HTTP status when available; expandable copyable details show safe diagnostics.
- Keep operational notices in the footer message area; do not duplicate errors in random places.
- Preserve simplified shared-AI provider/model/language settings.
- Update STT setup smoke to exercise REC/STOP/PLAY/TRANSCRIBE and debug fields.

## Acceptance
Debug panel is understandable, sanitized and copyable; real failure stages visible; UI state transitions tested.
