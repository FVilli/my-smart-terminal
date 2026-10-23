---
title: "Workflow agenti"
type: workflow
project: smart-terminal
created: 2026-10-22
---
<!-- gsynchro:v1 id=f2889ae1-28e4-43eb-b6d0-da75bb1febd4 registered=2026-10-23T07:57:50.130Z -->

# Workflow agenti

## Organizzazione
- `docs/`: specifiche architetturali e contratti brevi con frontmatter. `mockups/`: baseline visiva.
- `milestones/todo|in_progress|done/`: file `MNN - Nome.md`.
- `tasks/todo|in_progress|done/`: file `MNN - TNN - Nome.md`.
- **Lo stato deriva soltanto dalla cartella**, mai dal frontmatter. Spostare fisicamente il file nel cambio di stato.

## Frontmatter richiesto
Tutti i Markdown: `title`, `type`, `project`, `created`. Milestone: `id`, `goal`, `depends_on`. Task: `id`, `milestone`, `depends_on`, `deliverables`; non aggiungere campo `status`.

## Esecuzione
1. Selezionare task in `todo` con dipendenze `done`; spostarlo in `in_progress` prima di lavorare.
2. Leggere le specifiche linkate, rispettare decisioni e scope; vietato introdurre stack/DB/servizi senza decisione esplicita.
3. Implementare cambiamenti minimi; eseguire test descritti in criteri di accettazione.
4. Documentare eventuali deviazioni in task e fermarsi per decisioni architetturali non coperte.
5. Spostare task in `done` solo se criteri verificati e deliverable presenti.
6. Spostare milestone in `in_progress` quando parte il primo task e in `done` solo quando tutti i suoi task sono `done`.

## Convenzioni
Gli ID sono immutabili; non rinominare task completati. Un task deve essere eseguibile senza scelte architetturali rilevanti; fare riferimento alle specifiche sotto `docs/`. Niente SQL/SQLite: persistenza Markdown + Git.

## Priorità
Seguire M01→M06; parallelizzare solo task senza dipendenze e senza modifiche concorrenti agli stessi file.
