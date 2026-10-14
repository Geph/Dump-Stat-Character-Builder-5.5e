# Dump Stat — Compact Edition

[![Compact Dump Stat home page](docs/screenshots/compact-home.jpg)](https://geph.github.io/Dump-Stat-Character-Builder-5.5e/)

An art-free 5E-compatible character builder, compendium, and interactive character sheet. This repository owns the shared gameplay, import, and persistence functionality used by both Dump Stat editions.

Current release baseline: **0.32**. The compact UI uses dense lists, text, licensed interface icons, and a parchment palette. It includes no portraits, generated artwork, or decorative backgrounds. Optional BYO LLM import guidance remains available; “art-free” does not mean the code or optional tools are AI-free.

## Run locally

Use Node **24.21.0 LTS** (`.nvmrc`) and **pnpm 11.9.0**. CI uses the same Node pin. Coordinate changes to a machine-wide runtime shared with the visual checkout.

```sh
pnpm install --frozen-lockfile
# Copy .env.example to .env.local (browser storage by default).
pnpm dev
```

Open http://localhost:3002. This separate port avoids colliding with the visual checkout. For a GitHub Pages export, run `pnpm build:static`. Hosted MySQL remains supported; configure `NEXT_PUBLIC_DEPLOY_MODE=hosted` and your database credentials locally.

## Functionality

- Step-by-step character creation and level-up, with spell and feature descriptions.
- Dice rolls, HP, spell slots, resources, conditions, and companions.
- Editable compendium, JSON/Foundry import, shared modifier wiring, and optional BYO prompts.
- SRD 5.2.1 and the existing approved optional KibblesTasty/Mage Hand Press packs.
- Browser persistence and export backups. Data is not migrated automatically between site URLs.

### Character builder

Choose your class, origin, abilities, equipment, and spells alongside a live character preview.

![Compact character builder with SRD class choices and a live character preview](docs/screenshots/compact-builder.jpg)

### Content compendium

Browse and manage classes, spells, creatures, equipment, and custom content in an art-free catalog.

![Compact compendium with SRD classes and content filters](docs/screenshots/compact-compendium.jpg)

### Interactive character sheet

Keep ability scores, skills, proficiencies, combat, and character details close at hand.

![Compact character sheet showing skills, ability scores, and proficiencies](docs/screenshots/compact-sheet.jpg)

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md), [architecture and ownership](docs/repository-ownership.md), and [import documentation](docs/import.md). Shared fixes start in this repository; the visual edition pins an exact reviewed commit. Never copy image sources or private rulebook extracts into this repository.

Run `pnpm check:compact`, `pnpm core:check`, `pnpm lint`, `pnpm exec tsc --noEmit`, `pnpm test`, and `pnpm build:static`. Physical-art integration suites are run by the visual edition; the compact edition tests that artwork cannot be bundled or rendered.

## Attribution

Software is MIT; see [LICENSE](LICENSE) and [NOTICE.md](NOTICE.md). SRD 5.2.1 is CC BY 4.0, with attribution in the app. Publisher pack permissions and scope remain documented in [lib/seed-packs/README.md](lib/seed-packs/README.md). Interface icons and fonts retain their separate notices.
