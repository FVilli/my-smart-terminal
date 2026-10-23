---
title: "Architecture"
type: spec
project: smart-terminal
created: 2026-10-22
---
<!-- gsynchro:v1 id=c4141769-a174-4af4-a6e3-b252b33b60ef registered=2026-10-23T07:57:43.073Z -->

# Architecture

## Fixed stack
Angular standalone + TypeScript, Electron, `@xterm/xterm`, `node-pty`, Node.js services, OpenSSH CLI, Git CLI. No SQLite or database.

## Processes
Each Electron window is independent and maintains its own PTY. One exclusive local coordinator per machine manages counters, shared writes, and Git. A primary process is elected with an OS lock and heartbeat; the other windows use local IPC. If the primary terminates, a new election takes place.

## IPC
`contextIsolation: true`, renderer sandbox, and `nodeIntegration: false`; typed preload APIs and an operation whitelist. No execution of shell strings through IPC; paths are validated.

## Data
The persistent source is the Markdown filesystem in the Git clone. Search indexes exist only in memory and can be rebuilt. Sensitive configuration is stored in the OS keychain, never in shared Markdown.

## Failure modes
PTYs are independent of the network; the coordinator can be restarted; locks support recovery; Git operations are serialized and never use `push --force`.

## Implementation decisions
Local IPC transport, lock/heartbeat, local configuration, and keychain policy: `docs/10 - Config locale, coordinatore e sicurezza runtime.md`.
