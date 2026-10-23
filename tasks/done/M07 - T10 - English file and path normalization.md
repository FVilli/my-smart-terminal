---
title: "M07 - T10 - English file and path normalization"
type: task
project: smart-terminal
created: 2026-10-23
id: "M07-T10"
milestone: "M07"
depends_on: "T01"
deliverables: "English file and path normalization"
---
<!-- gsynchro:v1 id=b87605ad-7625-4da7-bd06-3db5270d5fdc registered=2026-10-23T10:25:07.161Z -->

# M07 - T10 - English file and path normalization

## Objective
Remove Italian from documentation, milestone and task filenames while preserving stable IDs and folder-based state.

## Constrained implementation
Rename docs, milestone and task files to English equivalents using `git mv`; keep numeric prefixes and IDs unchanged. Update every Markdown link and reference to the new paths. Preserve frontmatter keys/values, gsynchro identity comments and state folders. This task is an explicit owner-approved exception to the "do not rename completed tasks" convention; IDs and history remain stable. Stop gsynchro before the renames, reconcile the Drive destination, and restart it afterwards.

## Acceptance criteria
No Italian words remain in repository file paths (excluding stable IDs and proper names); all Markdown links resolve; task/milestone state has no duplicates; gsynchro reconciliation leaves frontmatter intact.

## References
docs/WORKFLOW.md; docs/09; all Markdown.

## Do not
Do not change task IDs, folder states or historical content semantics.
