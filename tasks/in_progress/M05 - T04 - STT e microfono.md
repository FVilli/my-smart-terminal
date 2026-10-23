---
title: "M05 - T04 - STT e microfono"
type: task
project: smart-terminal
created: 2026-10-22
id: "M05-T04"
milestone: "M05"
depends_on: "T03"
deliverables: "STT e microfono"
---
<!-- gsynchro:v1 id=d7d1b986-9d09-449d-8374-b31c17ba1375 registered=2026-10-23T07:58:10.224Z -->

# M05 - T04 - STT e microfono

## Obiettivo
STT e microfono.

## Implementazione vincolata
Adapter STT cloud/locale con permessi e push-to-talk nell’editor.

## Criteri di accettazione
Test autorizzazioni/deny; risultato editabile; no audio persistito.

## Riferimenti
`docs/01 - Architettura.md`; `docs/02 - UI e sessioni.md`; `docs/03 - Markdown schema.md`; `docs/04 - Sync Git.md`; `docs/05 - AI Voice Sicurezza.md`.

## Non fare
Non introdurre database, servizi remoti aggiuntivi o scelte architetturali non specificate.

## Esito
- 2026-10-23: completato.
- Implementato: config `stt_command`, adapter STT locale (stdin, no shell/file) e cloud OpenAI, `SttService` main con status/transcribe e test mode, IPC/preload, `SttStore` push-to-talk con permessi/deny, MediaRecorder in memoria, limite 60 s, risultato editabile senza auto-send, onboarding step 3 aggiornato.
- Verifica: 380 test (50 nuovi), smoke STT con deny, dettatura simulata, nessun file audio in userData/repo, nessun overflow; build/lint/typecheck verdi.
- Deviazioni: limite payload per-canale per l'audio; cloud usa endpoint OpenAI di default (base URL solo opzione adapter/test); comando locale senza argomenti (wrapper utente); halt su cambio tab scarta l'audio in volo.
