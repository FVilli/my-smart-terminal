<!-- gsynchro:v1 id=46583df2-55bb-4886-9080-d00100647de7 registered=2026-10-23T08:24:09.118Z -->

## Esito
- 2026-10-23: completato.
- Implementato: `SessionsStore` (sessioni, activeId, bozze, errori, buffer output), pannelli xterm persistenti nascosti via CSS, creazione locale da `+`, switch/close con conferma inline, empty/error state, etichette S<n> per finestra.
- Verifica: `npm run test:tabs-smoke` con `twoTabs`, `panelsMounted`, `switchKeepsSessions`, `closedOne` tutti true; 46 test Vitest; build/lint/typecheck verdi.
- Nota: etichette S<n> sono provvisorie per finestra; M03 le sostituirà con ID atomici persistenti.
