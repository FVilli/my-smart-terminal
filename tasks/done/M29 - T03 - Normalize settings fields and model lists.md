---
title: "M29 - T03 - Normalize settings fields and model lists"
type: task
project: smart-terminal
created: 2026-10-25
id: "M29-T03"
milestone: "M29"
depends_on: "M29-T02"
deliverables: "Uniform settings field spacing, no Custom AI model, audio/chat model filtering, verification"
---
# M29 - T03 - Normalize settings fields and model lists

## Implementation
- Migrate Settings AI/STT labels/hints to the form primitives (label spacing, help/error, provider fields).
- Remove the AI model Custom option/input: Provider default + discovered chat models + saved value if absent.
- Filter AI discovery to exclude audio/transcription ids; STT discovery keeps transcription ids (workflow flag) or audio ids when the provider exposes no workflow metadata.
- Tests for filters, updated smokes/screenshots/docs, audit + review.
## Acceptance
- Model lists correct, fields uniform, all gates green, review recorded.
