# Repository ownership and edition boundary

Effective 2026-10-13. Baseline: visual v0.32 (833145ec4706a7e79fe7f3669a37ed79beb32dbf).

## Public owner

`Geph/Dump-Stat-Character-Builder-5.5e` owns all of `lib/`: character/builder rules, import schemas and enrichment, common modifiers, dice, SRD and approved seed data, persistence, hosted adapters, and their tests. It also owns its compact UI (`app/`, `components/`, `hooks/`, styles) and build configuration.

No rules forks by edition. `NEXT_PUBLIC_UI_EDITION` is a presentation capability only. Compact builds force it to `compact` in Next configuration, including SSR. Persisted image fields are retained for import/export compatibility but no artwork is rendered or requested. Icons are not character art. Do not delete stored portraits while opening a visual character in compact mode.

## Visual consumer

`Geph/dump-stat-character-builder` owns the visual UI and approved artwork. Its `lib/` is a generated, reviewed snapshot of this repository, pinned in `shared-core.lock.json`. It must not be edited independently. The transport preserves paths to avoid a risky simultaneous rewrite of every import and retains offline, reproducible builds. This is source vendoring, not an npm registry dependency.

After merging a shared change here, the visual agent runs `pnpm core:sync <full-public-commit-sha>`, reviews the `lib/` diff, verifies both UIs, and commits the snapshot with its lock. `pnpm core:check` rejects consumer drift. Only `lib/` crosses automatically; API route glue, schemas in mysql/, scripts and UI hooks require explicit integration when a shared contract changes. Do not cherry-pick UI commits across repositories.

Shared library code cannot import app/components/hooks. Generic presentation policies may live in lib/site-settings, but classes and rules must never branch on edition. Library tests that require physical visual assets remain in the shared source and run in the visual checkout; compact Vitest explicitly omits those asset-only suites and runs a replacement no-art contract test. Rules and progression tests run in both.

## Data, content and history

This repository starts from its original license commit plus a clean reviewed source snapshot. It has no visual repository history, raster images, Drive files, local credentials, or source masters. Approved optional publisher packs retain the same attribution and permission scope. Laserllama and other private imports remain user-provided; this split does not authorize new content.

Keep storage/export formats compatible. Different deployed URLs can have different browser storage; export/import backups deliberately, never silently overwrite a user's existing compendium. The visual repository visibility is controlled by the owner; this migration does not change it.

## Working in separate chats

Use this checkout for gameplay/import fixes and compact UI. Use the visual checkout for visual UI/art and core updates. Read this file and AGENTS.md at each new chat. Commit IDs, tests, and contract changes form the handoff, not assumptions about another chat's memory.
