# Contributing to Dump Stat

This is the public shared-functionality owner and compact UI. Read [repository ownership](docs/repository-ownership.md). Artwork allowlists in historical guidance apply only to the visual repository: no raster art, image masters, or screenshots belong here.

Thanks for wanting to help. This guide is for people opening pull requests — setup, what we check before merge, and a few rules that keep the public repo clean.

## Getting started

Follow [Quick start](README.md#quick-start) in the README:

Use Node **24.21.0 LTS** (pinned in `.nvmrc`, also used by CI) and **pnpm 11.9.0**. Coordinate runtime upgrades when the compact and visual checkouts share a machine. Use pnpm so `pnpm-lock.yaml` remains the dependency source of truth.

```bash
git clone https://github.com/Geph/Dump-Stat-Character-Builder-5.5e.git
cd Dump-Stat-Character-Builder-5.5e
corepack enable
pnpm install
cp .env.example .env.local
# The example defaults to browser storage; no database setup is required.
pnpm dev
```

Open [http://localhost:3002](http://localhost:3002). Use `pnpm dev` so the port is set in the script. Cursor/VS Code integrated terminals also export `PORT=3002` (see `.vscode/settings.json`).

## Checks before you push

Install the local pre-push gate once per clone:

```bash
pnpm hooks:install
```

A normal `git push` then runs the same checks as CI and blocks on the first failure:

```bash
pnpm verify:ci
```

That covers the MySQL dependency audit, ESLint, TypeScript, the Vitest suite, modifier/SRD audits, and the static export. A successful run is cached for that commit so retrying the same push does not redo the whole suite.

Emergency bypass: `git push --no-verify`. Use it only when you are intentionally accepting that GitHub CI may fail.

## Branch naming

| Prefix | Use for |
|--------|---------|
| `feature/*` | New functionality or enhancements |
| `fix/*` | Bug fixes |
| `chore/*` | Tooling, dependencies, refactors, docs-only |

Examples: `feature/compendium-card-images`, `fix/builder-feat-slots`, `chore/ci-node-22`.

## Pull request expectations

- **Keep PRs small and focused** — one logical change when you can.
- **Link an issue** if one exists (`Fixes #123` or `Relates to #456`).
- **Say how you tested** — note what you ran (for example `pnpm verify:ci`, or the builder / sheet / import steps you clicked through).
- **Update the README** when setup steps or user-facing behavior change.
- **Do not bump the release version** in a contributor PR — see [Updating the release version](#updating-the-release-version) below.

### SRD and rules accuracy

Changes that affect SRD / 5E rules accuracy (class features, species traits, spell data, builder calculations, and so on) should cite the source in the PR description — for example the [SRD on D&D Beyond](https://www.dndbeyond.com/srd) section you used. Seed data is rebuilt from SRD 5.2.1 markdown via `pnpm srd:build`; see [lib/srd/README.md](lib/srd/README.md).

## What not to commit

- Artwork, portraits, screenshots, image originals, PDFs or decorative backgrounds. This edition is art-free; interface icons and fonts keep their licenses.
- Private rulebook prose or local import JSON. Existing approved publisher seed packs retain their documented scope; a new import is not permission to bundle it.
- Secrets, `.env.local`, audit dumps or scratch files.

Hosted MySQL is optional: configure `NEXT_PUBLIC_DEPLOY_MODE=hosted` and database credentials locally, then follow mysql/schema.sql and the migration scripts. Never commit those credentials.

## Where everyday changes go

A short map (see the [README project structure](README.md#project-structure) for the tree):

| Kind of change | Start here |
|----------------|------------|
| Pages and API routes | `app/` |
| UI (builder, sheet, compendium, import) | `components/` |
| Builder / sheet rules and calculations | `lib/builder/`, `lib/character/` |
| Catalog, modifiers, enrichment | `lib/compendium/` |
| Import pipeline | `lib/import/` |
| SRD seed | `lib/srd/` (rebuild with `pnpm srd:build`) |
| Hosted database | `lib/db/`, `mysql/` |
| Static / browser storage | `lib/data/` |

Put UI in `app/` and `components/`, calculations in `lib/`, and rulebook-style content in seed data or the compendium UI — not hard-coded into a single class component.

Prefer **common modifier** types the user can edit in the Compendium over a one-off class-name branch in sheet or runtime code. If a bug existed because an import JSON extract or the BYO LLM prompt missed the mechanic, update that Drive JSON and/or the BYO hints (`lib/import/modifier-wiring-registry.ts`) as well as the runtime — see [docs/homebrew-import-review.md](docs/homebrew-import-review.md).

## Code of conduct

This project follows the [Contributor Covenant](CODE_OF_CONDUCT.md). By participating, you agree to uphold it. To report concerns, [open a GitHub issue](https://github.com/Geph/dump-stat-character-builder/issues/new).

## Updating the release version

**Maintainers only** — do not bump the version in contributor PRs.

After merging to `main`, run:

```bash
pnpm version:bump
```

That increments `VERSION` and syncs `package.json` `version` (for example `0.3` → `0.4`). Commit the result as part of the release push. Do not hand-edit `VERSION`, `package.json` `version`, or the “Current release” line in the README in a normal contribution.
