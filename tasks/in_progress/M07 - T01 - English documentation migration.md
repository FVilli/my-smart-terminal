---
title: "M07 - T01 - English documentation migration"
type: task
project: smart-terminal
created: 2026-10-23
id: "M07-T01"
milestone: "M07"
depends_on: ""
deliverables: "English documentation migration"
---
<!-- gsynchro:v1 id=be9ab271-1cc5-45b5-8e98-299722a4447f registered=2026-10-23T10:19:23.498Z -->

# M07 - T01 - English documentation migration

## Objective
Translate every Markdown document in the repository to English and remove Italian prose, starting with README.md.

## Constrained implementation
Cover README.md, RELEASE_NOTES.md, docs/**, tasks/** and milestones/**. Preserve frontmatter keys, IDs, folder-based state, gsynchro identity comments, code blocks, commands and paths. Translate titles, body text, acceptance criteria and historical notes; do not rename files or IDs. Use consistent product terminology (session, tab, primary instance, data repository, history, clipboard).

## Acceptance criteria
No Italian prose remains in Markdown files; links and frontmatter remain valid; the README reads as a product presentation with vision, strengths and download section; task/milestone states remain consistent with their folders.

## References
docs/WORKFLOW.md; docs/00-13; README.md; RELEASE_NOTES.md.

## Do not
Do not change code, package metadata or release artifacts in this task.
