---
title: "Agent workflow"
type: workflow
project: smart-terminal
created: 2026-10-22
---
<!-- gsynchro:v1 id=f2889ae1-28e4-43eb-b6d0-da75bb1febd4 registered=2026-10-23T07:57:50.130Z -->

# Agent workflow

## Organization
- `docs/`: short architectural specifications and contracts with frontmatter. `mockups/`: visual baseline.
- `milestones/todo|in_progress|done/`: `MNN - Name.md` files.
- `tasks/todo|in_progress|done/`: `MNN - TNN - Name.md` files.
- **State derives only from the folder**, never from frontmatter. Physically move the file when changing state.

## Required frontmatter
All Markdown: `title`, `type`, `project`, `created`. Milestone: `id`, `goal`, `depends_on`. Task: `id`, `milestone`, `depends_on`, `deliverables`; do not add a `status` field.

## Execution
1. Select a `todo` task whose dependencies are `done`; move it to `in_progress` before working.
2. Read the linked specifications, respect decisions and scope; do not introduce stack/DB/services without an explicit decision.
3. Implement minimal changes; run the tests described in the acceptance criteria.
4. Document any deviations in the task and stop for architectural decisions not covered.
5. Move the task to `done` only when criteria are verified and deliverables are present.
6. Move the milestone to `in_progress` when its first task starts and to `done` only when all its tasks are `done`.

## Conventions
IDs are immutable; do not rename completed tasks. A task must be executable without significant architectural choices; refer to the specifications under `docs/`. No SQL/SQLite: Markdown + Git persistence.

## Priorities
Follow M01→M06; parallelize only tasks without dependencies and without concurrent changes to the same files.

## Document synchronization
- `gsynchro` can synchronize in both directions with the Drive copy. After every state change, verify that the same `id` does not exist in multiple folders.
- If duplicates appear, the canonical copy is the one in the most advanced state folder (`done` > `in_progress` > `todo`); remove stale copies from the synchronized destination as well, not only from the repository.
- Avoid multiple moves while the daemon is reconciling: stop it, reconcile, and restart it when the milestone is complete. Frontmatter and task body must remain intact after synchronization.
