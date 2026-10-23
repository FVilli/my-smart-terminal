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

## Contatore `S<n>`
- `sessions/<machine>/counter.md` è metadata versionato nel repo dati (non è un file di sessione): frontmatter `schema_version`, `machine`, `last_session`, `updated_at`.
- L'allocazione avviene sotto il lock del primary (`userData/coordinator/`, `mkdir` atomico, PID/nonce/heartbeat) e prenota l'ID **prima** di restituirlo; i buchi dopo un crash sono accettabili, il riuso no.
- Bootstrap o contatore invalido: ricostruzione del massimo `S<n>` dalle directory esistenti, poi ripartenza dal successivo.
- In M03 l'allocatore è un servizio dietro interfaccia; M04 lo espone dal primary senza introdurre un secondo lock.

## Copertura history MVP
- M03 registra gli invii dell'editor assistito (`source: assisted`).
- La shell history nativa non è coperta in MVP: nessuna iniezione in `.bashrc`/`.zshrc`/startup, nessuna intercettazione di keystroke o prompt TUI. Un'integrazione OSC già presente può essere accettata solo se verificata e affidabile.
- Deviazione esplicita rispetto a M03-T03, da mantenere nei release notes.
