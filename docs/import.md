# Import formats

Last reviewed: 2026-10-12.

Hand-authored feat and custom-ability JSON can set `modifierWiring: "explicit"`
alongside `linkedModifiers` to retain its wiring without adding name presets or
prose-inferred modifiers (including on inline choices). Use this only when the
author has supplied the complete intended catalog wiring; it is not a claim that
all rules are automated. Ordinary BYO/partial imports omit it and retain automatic
detection. Feat JSON preserves persisted modifier links through normalization.
Both storage paths also preserve `isChoice` / `choices` as `is_choice` / `choices`
and resolve spell references within the options. Explicit ability wiring stays
intact during the separate persistence-time enrichment pass.

Dump Stat supports six compendium import paths:

| Method | Input | AI? | Best for |
|--------|--------|-----|----------|
| **SRD seed** | Button / `POST /api/seed` | No | Official SRD baseline |
| **Dump Stat JSON** | `.json` file or pasted JSON | No | Homebrew with full `linkedModifiers`, repeatable imports |
| **Foundry VTT JSON** | `dnd5e` item/NPC/pack export (file or pasted) | No | Migrating items, feats, spells, classes, and creatures from Foundry |
| **Text import** | Pasted plain text + optional content hint | Optional server AI or BYO LLM | UA PDFs, website copy-paste, copied stat blocks |
| **Images from URL** | Directory or page URL + Images from URL hint | Optional server AI or BYO LLM | Card art mapping without rewriting rules |
| **PDF import** | Uploaded PDF (+ optional page range) | Optional server AI | Same as text; also accepts JSON export files (no AI) |

AI is used **only** for compendium import (PDF upload and optional server-side text extraction). The builder, sheet, SRD seed, Foundry import, Dump Stat JSON bundles, and BYO LLM clipboard workflow do not call AI APIs.

## Extraction modes

Shown on the import report:

| Mode | When |
|------|------|
| `deterministic` | Well-structured class documents pass the confidence gate with **zero** API calls |
| `hybrid` | Partial deterministic parse (e.g. class shell + resources) plus AI for remaining sections |
| `ai` | Full server AI extraction when deterministic parsing is not confident enough |
| `byo-json` | You pasted LLM-generated JSON or a Dump Stat export bundle |

## Foundry class and subclass exports

Checked against `foundryvtt/dnd5e` 6.0.6 (upstream commit
`10d00807d854e85e02e4e6e142d8a742748c1102`, 2026-10-12). Import one class family
at a time: put the class, subclasses, and referenced feature/spell Items in the
same JSON array or `{ "items": [...] }` bundle. A class's Export Data file usually
contains UUID references, **not the referenced feature documents**. Missing Items
are listed in the Foundry review report; exporting only the class cannot supply
their rules or mechanics. Parent classes must accompany subclasses or already
exist in the Compendium under the matching class name.

The deterministic adapter supports legacy advancement arrays and current keyed
collections; ItemGrant ownership/levels; nested feature advancements; explicit
ItemChoice feature pools; standard ASI and subclass milestones; and full/half/
third/pact spell-slot progression. Structured feature activities retain action,
bonus-action and reaction timing. Multiple activities become separate buttons
with a shared item-use counter. Numeric, proficiency, ability-modifier and exact
numeric ScaleValue use limits map to common uses modifiers, including full/partial
rest recovery. Supported self-healing maps to the existing healing modifier.
Other activity effects remain manual actions with their original description.

Import review is still required for open/restricted choice pools, replacement
rules, complex formulas, activity-specific resources, cross-item consumption,
temporary Active Effects, nonstandard trait/ability-score advancements, starting
equipment, preparation counts and module automation. Numeric scale references
are resolved for uses; arbitrary scales are retained as reference text, never
applied as unconditional damage. Foundry-specific macros are not executed.

Implementation: `lib/import/foundry-advancements.ts` resolves ownership and
advancements; `foundry-feature-actions.ts` translates timing/uses/healing into
editable common modifiers; `parse-foundry-dnd5e.ts` assembles ImportContent for
the regular prepare/enrich/persist pipeline. Regression coverage lives in
`lib/import/__tests__/foundry-class-import.test.ts`. Full UUID provenance wins;
ambiguous short IDs and references to a different pack do not match by name.

## Dump Stat JSON export

Review skips and card-image selections use the original content-array indices.
`finalizeImportWithPersist` applies both before collision resolution removes
skipped duplicates or linked spells. Reordering those operations can import
excluded rows or assign an image to the wrong entry.

Export bundles use type `dump-stat-export` with an `items` array. Each item has `type` (e.g. `dnd-subclass`, `dnd-feat`, `dnd-spell`) and `data` (compendium fields without server ids).

**Single-item shape:**

```json
{
  "type": "dnd-subclass",
  "version": 1,
  "data": {
    "name": "Circle of the Titan",
    "class_name": "Druid",
    "description": "…",
    "source": "UA 2026",
    "features": [
      { "level": 3, "name": "Circle of the Titan Spells", "description": "…" }
    ]
  }
}
```

**Bulk bundle:**

```json
{
  "type": "dump-stat-export",
  "version": 1,
  "section": "my-homebrew",
  "items": [ … ]
}
```

Import via **Import → PDF upload** (choose the `.json` file) or **paste the entire JSON into Text Import**.

- Subclasses resolve parent classes by `class_name` (must exist in compendium — seed SRD first).
- Subclass rows run **post-import enrichment** (always-prepared spell links, limited uses, class-resource bindings) when presets exist.
- Feats should include `"category": "Origin"` or `"Epic Boon"` so they appear in the correct builder pickers.

**Example bundle:** [lib/import/examples/ua-villainous-options-export.json](../lib/import/examples/ua-villainous-options-export.json) — UA 2026 Villainous Options. Regenerate with:

```bash
pnpm dlx tsx scripts/build-ua-villainous-export.ts
```

## Text import (BYO LLM + optional server AI)

The **Clipboard** tab is the primary import path for pasted text:

1. Paste raw source text (from a PDF copy, website, or document).
2. Copy the **extraction prompt** and **JSON template** (matched to your content-type hint).
3. Run the prompt in ChatGPT, Claude, Gemini, or any LLM — using your own API key or subscription.
4. Paste the model's JSON output back into Dump Stat and click **Import JSON**.

**Prompt size.** Step 1 has a **Lite / Full** selector (your choice is remembered):

- **Lite** is a short prompt (roughly 5–25K characters, depending on content type) that fits free or base-tier ChatGPT, Gemini, Copilot, and Claude. It asks the model to copy rules sentences verbatim and lets Dump Stat wire most mechanics at import. For long chapters the model returns the first part plus a `Continue with: …` line; reply "continue" and import each part in order.
- **Full** is the complete wiring guide (about 190K characters before your source text) for paid or large-context models. It pre-wires more unusual mechanics, especially for homebrew classes Dump Stat has not seen before.

If a free-tier model refuses the paste, switch to Lite, shorten the source (one class chapter or a short spell batch), or attach the prompt as a `.txt` file.

The full prompt includes **clean PDF / paste guidelines** (keep level tables intact, one content type per run, preserve feature headings, collapse doubled ALL-CAPS PDF glyphs, strip trailing superscript markers like KibblesTasty `K`, etc.). No server API keys are required for this flow.

**Optional server AI:** If the host has `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, or `GOOGLE_GENERATIVE_AI_API_KEY` configured, an expandable **server AI extraction** section appears on Clipboard and PDF tabs. The BYO prompt/template workflow remains available either way.

**Dump Stat JSON export** — if the pasted text is a valid `dump-stat-export` bundle, it imports directly without LLM extraction (same as file upload; extraction mode `byo-json`).

## PDF import (optional server AI)

Same schema and persistence as text import. Optional **page range** limits extraction to specific pages. Upload a **`.json` export bundle** through the PDF file picker for non-AI JSON import.

PDF text extraction tries **deterministic** parsing first, then **hybrid** or full **AI** when needed. Requires at least one AI provider key for PDF text extraction (not for JSON bundles, SRD seed, or Foundry JSON).

## Multi-file homebrew import order

Many third-party classes ship as **several JSON files** (spell libraries, discipline powers, class chapter). **Happy path: two LLM extracts → one Step 2 paste.** Import **supporting libraries** and the **class chapter** (core + every archetype in `classes[]` + `subclasses[]`) as a JSON array — Dump Stat **auto-orders** libraries before the class chapter even if you paste them reversed. Do not leave archetypes for a later file unless you are intentionally adding to a class already in the compendium.

On the app: **Import → Import tips → Import order** lists workflows for spellcasters, KibblesTasty Psion, Laserllama-style Martial Exploits, and Inventor.

**General rules**

1. **SRD spells** — If your compendium is SRD-seeded, standard spells (e.g. *Fireball*, *Burning Hands*) do not need a separate import; only import homebrew spell JSON for third-party names.
2. **One batch or sequential** — Either paste a **JSON array** of import objects (order flexible — libraries are auto-sorted ahead of the class chapter), or run separate imports in the same order (earlier files persist to the compendium before later ones wire references).
3. **Class + subclasses together** — Use content type **Class + subclasses**. An empty `subclasses[]` means no archetypes in the builder. Use **Subclasses only** only for add-ons when the parent class is already imported.
4. **Set a source label** — Use the compendium source label field (e.g. `Kibbles Witch`) so you can filter and re-import safely.

**Spellcasting classes** (Witch, full casters, etc.)

| Step | Content |
|------|---------|
| 1 | Homebrew spell libraries when needed |
| 2 | Class chapter JSON: core class **and** subclasses, **including** the class spell list when present |
| 3 | Choice options if separate (grand hexes, invocations, …) |

**KibblesTasty Psion** (and similar psionic classes with separated powers)

| Step | Content |
|------|---------|
| 1 | `psion-disciplines.json` (psionic powers as custom abilities / proposals — not ordinary `spells[]`) |
| 2 | Class chapter: core Psion **and** all archetypes in one JSON (`classes[]` + `subclasses[]`) |

Discipline powers with psi-point augments get `psionic_augments` at import; pick augments on the character sheet when casting those powers.

**Martial Exploits** (Laserllama Alternate Fighter, etc.)

| Step | Content |
|------|---------|
| 1 | Exploit / maneuver library (if separate) |
| 2 | Class chapter: level table (Exploit Dice, Exploits Known) **and** all subclasses in the same pass |

**JSON array example** (BYO LLM → Step 2):

```json
[
  { "spells": [ … ] },
  { "classes": [ … ], "subclasses": [ … ] }
]
```

Dump Stat merges the array into one import batch before wiring modifiers.

## Server AI keys (optional)

Set **one** API key. The first configured provider is used unless you set `IMPORT_AI_PROVIDER`.

| Provider | Environment variable | Default model |
|----------|---------------------|---------------|
| OpenAI | `OPENAI_API_KEY` | `gpt-4o-mini` |
| Anthropic | `ANTHROPIC_API_KEY` | `claude-sonnet-4-20250514` |
| Google Gemini | `GOOGLE_GENERATIVE_AI_API_KEY` or `GOOGLE_API_KEY` | `gemini-2.0-flash-001` |

Optional: `IMPORT_AI_MODEL` to override the default. Restart the server after changing keys.

Without any provider key, seed, Dump Stat JSON, Foundry JSON, BYO clipboard import, and manual compendium edits still work — only **server AI extraction** on PDF upload or Clipboard **Import with server AI** returns a configuration error.

## Re-importing corrected class packs

Keep the supporting ability library and the class chapter together when updating
a pack. The class chapter should include its subclasses and level tables. Review
the prepared modifiers, then choose **Overwrite** for existing records so corrected
wiring replaces the previous import. Back up a custom-edited pack before replacing
it. A **WIRED** label confirms linked modifier metadata exists; it does not mean
every conditional rule, target effect, or companion interaction is automated.
The current audited coverage and manual boundaries are recorded in
[Homebrew class import review](homebrew-import-review.md).

## Card art on import

Import review fills optional `/images/compendium/…` URLs when the PNG is **on this machine** (bundled SRD art, or a local file after `pnpm images:optimize`). Missing files stay blank so you can paste a URL.

**Kibbles Tasty** portraits are local-only and are not part of Seed Example Content. Drop masters under `scripts/*-card-sources/kibbles/`, optimize, then re-import (or use Seed Example Content) — Inventor, Occultist, Psion, Warden, Kibbles species/backgrounds, and Kibbles spells pick up art when those files exist.

Maintainer playbook for Drive extracts: [homebrew-import-review.md](homebrew-import-review.md).

## Default and sample content

On the first visit to Import in each browser, a creator picker offers SRD,
Kibbles Tasty, and Mage Hand Press. SRD is checked
initially because static installs include it by default. Select all, Select none, or individual creators, then Import
selected. Not now / closing the dialog remembers the visit; the Seed Example
Content menu remains available. Imports run sequentially, report each creator's
result, and let failed creators retry without repeating successful ones.

Unchecking SRD and applying removes only exact SRD-source compendium rows, after
selected packs finish (packs may include SRD spell dependencies). Closing or
Not now does not remove anything. Other unchecked creators are unchanged.
`lib/data/remove-srd-content.ts` handles both stores and invalidates builder caches;
`lib/site-settings/srd-content.ts` prevents automatic static reseeding after removal.
Explicit SRD seeding restores automatic updates. Custom subclasses are detached
before their SRD parent is deleted; custom resources attached to an SRD class must
be moved first to avoid hosted cascade deletion. Characters are not deleted, but
their removed compendium references require reimporting the corresponding rules.

Laserllama content is user-imported only, not bundled in the creator picker. Its import enrichment, BYO guidance, and generated class/subclass portraits remain available. Existing imports are not removed.
