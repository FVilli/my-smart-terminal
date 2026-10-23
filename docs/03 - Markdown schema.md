---
title: "Contratto Markdown"
type: spec
project: smart-terminal
created: 2026-10-22
---
<!-- gsynchro:v1 id=c43eea1f-0202-4303-8175-cee41950769b registered=2026-10-23T07:57:44.707Z -->

# Contratto Markdown

## Percorso
`sessions/<machine>/YYYY-MM-DD_HH.mm_S<n>_<local|ssh-alias>/{history,clipboard,session}.md`. Timestamp locale nell'ID; `S<n>` progressivo per macchina, assegnato atomicamente e mai riutilizzato. `machine` normalizzata senza slash. Sessioni di più finestre condividono il contatore.

## Frontmatter comune
`schema_version: 1`, `session_id`, `machine`, `created_at` ISO 8601 con timezone; `kind` nei metadati. Gli eventi hanno ID e timestamp univoci per deduplica.

## history.md
Sezioni `## <ISO8601> · <event-id>` con campi `source: shell|assisted`, `agent: ...`, `cwd: ...` e blocco fenced `text` dell'input. Registrare input shell solo con integrazione affidabile; prompt TUI soltanto se inviati via editor assistito. Non registrare password o input segreti.

## clipboard.md
Sezioni evento con timestamp, tipo `text`, sorgente se disponibile e blocco fenced. Deduplica per hash in sessione, blacklist e limiti di dimensione. Non catturare clipboard sensibile; disabilitazione configurabile.

## session.md
Frontmatter con `session_id`, `machine`, `window_id`, `kind`, `ssh_alias` eventuale, `cwd_initial`, `started_at`, `ended_at` se chiusa. Stato ricavabile, non aggiornamenti heartbeat continui.

## Concorrenti
Solo il proprietario della sessione modifica i suoi tre file; il coordinatore assegna ID e serializza operazioni Git. Markdown leggibili e versionati; nessun database persistente.
