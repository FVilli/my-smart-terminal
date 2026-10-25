---
title: "M23 - T06 - Documentation and screenshots"
type: task
project: smart-terminal
created: 2026-10-25
id: "M23-T06"
milestone: "M23"
depends_on: "M23-T05"
deliverables: "Updated AI/IPC/settings/security docs, storage format note and refreshed screenshots"
---

# M23 - T06 - Documentation and screenshots

## Implementation
- `docs/36 - AI prompt templates and storage.md`: JSON schema, placeholders, defaults, limits, local-vs-sync rationale, corrupt fallback; link from docs/05/11/12/13/19/24/34.
- Update manual/settings docs for the select, two prompts, AI actions tab and custom actions; security note on editable system prompts and secret storage.
- Add capture scenarios for the modal (select + prompts) and settings editor; refresh affected screenshots deterministically.
- Run doc links/consistency/install checks.

## Acceptance
- Documentation matches implementation, no unsupported claims, screenshots deterministic and referenced.
