
## Esito
- 2026-10-23: completato.
- Implementato: `MarkdownSearchIndex` volatile con rebuild/refresh incrementale/upsert, scansione solo `sessions/` senza symlink e con limite 2 MiB, filtri macchina/sessione/data/kind, cap 100; `SearchService` main con rebuild all'avvio e aggiornamento dopo history/clipboard/fine sessione; canale `search:query` e API preload.
- Verifica: search smoke con found, entryShape, filtersWork, sensitiveNotIndexed, invalidRejected, rebuiltIndexFindsEvent; test di restart, symlink e oversize.
