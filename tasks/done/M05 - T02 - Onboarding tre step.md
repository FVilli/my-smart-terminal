---
title: "M05 - T02 - Onboarding tre step"
type: task
project: smart-terminal
created: 2026-10-22
id: "M05-T02"
milestone: "M05"
depends_on: "T01"
deliverables: "Onboarding tre step"
---
<!-- gsynchro:v1 id=1a8d96f1-3590-4d1d-92fd-72d28bf84871 registered=2026-10-23T07:58:08.886Z -->

# M05 - T02 - Onboarding tre step

## Obiettivo
Onboarding tre step.

## Implementazione vincolata
Configurare repo, nome macchina e provider AI; verificare connessione e permessi.

## Criteri di accettazione
Setup persistito in Markdown non segreto e keychain per credenziali.

## Riferimenti
`docs/01 - Architettura.md`; `docs/02 - UI e sessioni.md`; `docs/03 - Markdown schema.md`; `docs/04 - Sync Git.md`; `docs/05 - AI Voice Sicurezza.md`.

## Non fare
Non introdurre database, servizi remoti aggiuntivi o scelte architetturali non specificate.

## Esito
- 2026-10-23: completato.
- Implementato: config Markdown validata con backup/quarantena, precedenza env>config>default, SecretStore safeStorage con policy basic_text→memoria, wizard 3 step (repo/machine, AI, STT con verifica microfono e skip), salvataggio token solo keychain, restartRequired, `SMART_TERMINAL_USER_DATA`.
- Verifica: smoke onboarding su tre avvii (wizard, restart senza wizard, skip), config.md senza token, repo/machine applicati; 319 test.
- Deviazioni: il wizard non appare se `SMART_TERMINAL_DATA_REPO` è impostata (smoke/dev); `restartRequired` anche per cambio remote; safeStorage sync deprecato in Electron 45.
