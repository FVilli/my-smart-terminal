---
title: "Comments and documentation policy"
type: standard
project: smart-terminal
version: 1
created: 2026-10-24
---
# Comments and documentation policy

## Purpose and scope

This policy covers comments in TypeScript, HTML, CSS and MJS; TSDoc/JSDoc for exported APIs; repository documentation (`docs/`, milestones and tasks); and commit messages. It complements `docs/29 - Coding rules.md` (especially DOC-01), `docs/30 - Angular conventions.md`, and `docs/WORKFLOW.md`; it does not repeat their code or workflow rules.

A useful comment explains **why** behavior exists, which invariant must hold, or what cannot be inferred from the code. Narration that paraphrases the next line drifts as code changes and should be removed. Comments are not a substitute for clear names, types, tests, or authoritative specifications.

## Rules

### Code comments

- **CMT-01 MUST** explain non-obvious intent, invariants, concurrency/ordering, trust boundaries (including IPC validation and secret redaction), lifecycle/cleanup ownership, platform quirks, protocol/format choices, PTY/Git/STT ordering, and non-obvious workarounds where the code alone does not make the constraint clear. Rationale: these constraints are easy to break during maintenance.
- **CMT-02 MUST NOT** restate the next line, describe obvious getters, retain commented-out code, add vague “fix later” TODOs, preserve stale narration, or put large design essays inline. Rationale: noise hides the behavior that needs protection.
- **CMT-03 SHOULD** place a comment immediately beside the constrained behavior and state the consequence of violating it; update it with that behavior. Rationale: nearby, consequence-oriented comments are verifiable during review.
- **CMT-04 MAY** use a brief file/module header for a non-obvious module role or boundary; omit headers that only repeat the filename. Rationale: a header is useful only when it adds discoverable context.
- **CMT-05 SHOULD** link to the owning specification or contract rather than duplicate its full rules; comments may identify the relevant section or rule. Rationale: duplicated specifications diverge.

### Public API documentation

- **DOK-01 MUST** give exported package APIs and contract types a concise TSDoc/JSDoc summary. Rationale: consumers need the purpose and public guarantee at the point of use.
- **DOK-02 SHOULD** document parameter, return, and failure constraints when they are non-obvious; include security/trust notes for boundary values and sensitive data. Do not add exhaustive `@param`/`@returns` noise when types and summary already communicate the contract. Rationale: document caveats, not syntax.
- **DOK-03 SHOULD** document ownership and lifecycle for exported subscriptions, handles, and resources. Rationale: callers need to know who releases them.

### TODO and documentation maintenance

- **DOK-04 MUST** attach any TODO/FIXME to an actionable task or milestone reference and state the reason; otherwise remove it. Never leave unbounded TODOs. Rationale: work without an owner or destination is not trackable.
- **DOK-05 MUST** update the relevant authoritative document when changing IPC/contracts, externally visible behavior, tokens/styling rules, or build/release procedures. Rationale: users and maintainers rely on docs for these boundaries.
- **DOK-06 SHOULD** keep `docs/29` (general coding rules), `docs/30` (Angular-specific conventions), `docs/31` (comment/documentation policy), and `docs/06`, `docs/11`, `docs/15`, `docs/28` consistent: refer to a single owner for shared policy, and update cross-references when ownership moves. Rationale: overlapping standards otherwise contradict each other.
- **DOK-07 MUST** write code comments, repository documentation, and commit messages in English. Commit subjects SHOULD be concise and imperative; include a body explaining why when the subject alone is insufficient. Rationale: one consistent language improves review and search.
- **DOK-08 MUST** keep changes scoped: touch neighboring comments only when they are in scope, and do not reformat unrelated code. Rationale: focused diffs make behavioral changes reviewable.

## Examples

Examples are trimmed from current code; snippets keep the real names and ordering.

### IPC trust boundary — `apps/desktop/src/main/ipc.ts`

Good:
```ts
// Executes a channel: sender -> size -> validation -> handler.
if (!isSenderAllowed(sender, policy)) {
  throw new IpcError('IPC_INVALID_SENDER');
}
checkPayloadSize(args, def.maxPayloadBytes ?? MAX_PAYLOAD_BYTES);
if (!def.validate(args)) {
  throw new IpcError('IPC_INVALID_PAYLOAD');
}
```
Why: the header comment states the security order that every handler must follow.

Bad:
```ts
// Check the sender.
if (!isSenderAllowed(sender, policy)) {
  throw new IpcError('IPC_INVALID_SENDER');
}
// Validate the arguments.
if (!def.validate(args)) {
  throw new IpcError('IPC_INVALID_PAYLOAD');
}
```
Why: narrates the conditions and hides that the order is a trust-boundary invariant.

### PTY ownership and exit cleanup — `packages/terminal/src/session-manager.ts`

Good:
```ts
const session: Session = { info: { sessionId: id, kind: request.kind, /* ... */ }, process, createdAt: this.clock() };
// Register before wiring callbacks: onData/onExit must never observe an unowned session.
this.sessions.set(id, session);
process.onData((data) => { if (this.sessions.get(id) === session) this.emit('data', { sessionId: id, data }); });
process.onExit((exit) => this.handleExit(session, exit));
```
Why: records why registration precedes callbacks and why the identity check exists.

Bad:
```ts
// Save the session.
this.sessions.set(id, session);
// Handle data.
process.onData((data) => this.emit('data', { sessionId: id, data }));
```
Why: no note about ordering or ownership, and the identity guard is missing.

### Session-switch effect — `apps/renderer/src/app/app.ts`

Good:
```ts
// Tab change: an ongoing recording is interrupted instead of ending up in the wrong draft.
effect(() => {
  const activeId = this.store.activeId();
  untracked(() => {
    if (activeId !== undefined) this.stt.halt();
  });
});
```
Why: explains the user-visible consequence and why `untracked` keeps `halt()` out of the dependency graph.

Bad:
```ts
// Create an effect.
effect(() => {
  const activeId = this.store.activeId();
  if (activeId !== undefined) this.stt.halt();
});
```
Why: names framework syntax instead of intent, and drops the reason for reading the signal outside the tracked call.

### STT diagnostic redaction — `apps/desktop/src/main/stt-service.ts`

Good:
```ts
/** Never throws: every error becomes a `skipped` result with a stable reason. */
const skipped = (reason: NonNullable<SttTranscribeResult['reason']>): SttTranscribeResult => ({
  text: '',
  skipped: true,
  reason,
});
```
Why: the contract (stable reasons, never throw) is stated where callers rely on it.

Bad:
```ts
// TODO: improve errors later
catch (error) {
  return { text: '', skipped: true, reason: 'error', error: String(error) };
}
```
Why: unbounded TODO and a raw error string that can leak provider details or credentials.

## Documentation map

| Material | Put it here | Examples / owner |
|---|---|---|
| Stable architecture, contracts, security and operating guides | `docs/` | `docs/06` structure; `docs/11` IPC; `docs/13` security; `docs/15` visual baseline; `docs/28` styling |
| Rationale for a consequential decision | ADR in `docs/` | `docs/23 - ADR assisted input and terminal keyboard behavior.md` |
| Time-bounded work, acceptance criteria, dependencies | Milestone/task files | `milestones/` and `tasks/`, per `docs/WORKFLOW.md` |
| Local invariant or non-obvious implementation constraint | Inline comment | Link to authoritative spec; do not copy it |
| General code, framework, comment policy | Standards | `docs/29`, `docs/30`, this document (`docs/31`) |

## Review checklist

- [ ] Does each comment explain intent or a constraint rather than narrate? (CMT-01, CMT-02)
- [ ] Are ordering, concurrency, trust, and cleanup invariants documented where not evident? (CMT-01, CMT-03)
- [ ] Is the comment accurate and current? No stale/misleading comment. (CMT-02, CMT-03)
- [ ] Is there any commented-out code? Remove it. (CMT-02)
- [ ] Does each TODO have an actionable owner/reference and reason? (DOK-04)
- [ ] Do exported APIs/contracts have concise summaries and necessary caveats? (DOK-01, DOK-02)
- [ ] Does a contract/IPC change update its authoritative documentation? (DOK-05)
- [ ] Do shared standards and their references remain consistent? (DOK-06)
- [ ] Are comments, docs, and commit messages in English? (DOK-07)
- [ ] Is the diff scoped, without unrelated comment churn or formatting? (DOK-08)

## Legacy comment triage during M21 refactors

For each legacy comment, verify the behavior it describes against code, tests, and its owning specification. **Delete** it if it only narrates or is obsolete; **rewrite** it if the invariant remains but its explanation is stale; **convert** it into a linked documentation entry or actionable task when it describes broader policy or deferred work. Never silently delete a comment that may encode an invariant: verify the invariant first, and preserve or relocate it if still valid.
