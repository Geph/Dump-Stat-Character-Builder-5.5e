import { wireBeastheartContent } from "./beastheart-wiring"
import type { FeatureChoice } from "@/lib/types"
import type { ImportContent } from "@/lib/import/content-schema"
import type { EnrichmentPreset } from "@/lib/import/enrichment-presets/types"

const FEROCITY_DESCRIPTION = "Companion-owned combat pool. Build ferocity at turn start, spend it on companion actions or exploits, and resolve Rampage and end-of-combat recovery using the imported rules."

const PRIMAL_EXPLOITS_BY_LEVEL = [
  { level: 2, count: 3 },
  { level: 10, count: 5 },
  { level: 17, count: 7 },
] as const

const SUBCLASS_EXPLOIT_BY_LEVEL = [
  { level: 3, count: 1 },
  { level: 11, count: 2 },
] as const

type Row = Record<string, unknown>

function asRecord(value: unknown): Row | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Row) : null
}

function normalizeOrdinalPrerequisite(text: string | null | undefined): string | null | undefined {
  if (!text) return text
  return text
    .replace(/\b(\d+)th-level\b/gi, (_, n: string) => {
      const num = Number(n)
      const suf = num % 10 === 1 && num % 100 !== 11 ? "st" : num % 10 === 2 && num % 100 !== 12 ? "nd" : num % 10 === 3 && num % 100 !== 13 ? "rd" : "th"
      return `${num}${suf}-level`
    })
    .replace(/\b(\d+)th level\b/gi, (_, n: string) => {
      const num = Number(n)
      const suf = num % 10 === 1 && num % 100 !== 11 ? "st" : num % 10 === 2 && num % 100 !== 12 ? "nd" : num % 10 === 3 && num % 100 !== 13 ? "rd" : "th"
      return `${num}${suf} level`
    })
}

function fixSignatureAction(action: Row): Row {
  const name = String(action.name ?? "")
  const m = name.match(/^(.*?)\s*\(\s*Signature Attack\s*\)\s*$/i)
  if (!m) return action
  return {
    ...action,
    name: m[1].trim(),
    tag: action.tag || "Signature Attack",
  }
}

function abilityToOption(ability: Row): FeatureChoice["options"][number] {
  return {
    linkedModifiers: ability.linkedModifiers as never,
    modifierRefs: ability.modifierRefs as never,
    name: String(ability.name ?? ""),
    description: String(ability.description ?? ""),
    prerequisite: (ability.prerequisite as string | null | undefined) ?? null,
  }
}

/**
 * Sanitize MCDM Beastheart imports:
 * - Ferocity is a companion-owned special tracker (no class level table)
 * - Primal Exploits = class_knacks; Infernal/Nature exploits must not pollute that pool
 * - Companion signature attacks use tag "Signature Attack"
 * - Strip bogus spellcasting_ability from Primal Exploits (WIS is exploit save DC only)
 */
export function sanitizeBeastheartImportContent(content: ImportContent): ImportContent {
  const hasBeastheart = (content.classes ?? []).some((cls) => /^beastheart$/i.test(cls.name ?? ""))
  if (!hasBeastheart) return wireBeastheartContent(content)

  let next: ImportContent = wireBeastheartContent(content)

  const ferocityRow = {
    class_name: "Beastheart",
    resource_key: "ferocity",
    name: "Ferocity",
    description: [content.class_resources?.find(r => r.resource_key === "ferocity")?.description, FEROCITY_DESCRIPTION].filter(Boolean).filter((s, i, all) => i === 0 || !all[0]?.includes("Rampage")).join("\n\n"),
    uses: { type: "special" as const },
  }
  const primalKnownRow = {
    class_name: "Beastheart",
    resource_key: "primal_exploits_known",
    name: "Primal Exploits Known",
    description: "Number of Primal Exploits the Beastheart knows (special choice count).",
    uses: {
      type: "special" as const,
      atLevelMode: "tier" as const,
      atLevelTable: [...PRIMAL_EXPLOITS_BY_LEVEL],
    },
  }

  const resources = [...(next.class_resources ?? [])]
  const without = resources.filter(
    (r) => r.resource_key !== "ferocity" && r.resource_key !== "primal_exploits_known",
  )
  next = { ...next, class_resources: [...without, ferocityRow, primalKnownRow] }

  const abilities = [...(next.import_proposals?.custom_abilities ?? [])]
  const infernal = abilities.filter(
    (a) =>
      a.source_type === "subclass" &&
      /^infernal bond$/i.test(a.source_name ?? "") &&
      (a.ability_role === "knack" || /infernal exploit/i.test(String(a.definition ?? ""))),
  )
  const nature = abilities.filter(
    (a) =>
      a.source_type === "subclass" &&
      /^primordial bond$/i.test(a.source_name ?? "") &&
      (a.ability_role === "knack" || /nature exploit/i.test(String(a.definition ?? ""))),
  )

  if (abilities.length) {
    next = {
      ...next,
      import_proposals: {
        ...next.import_proposals,
        custom_abilities: abilities.map((ability) => {
          const isSubclassExploit =
            ability.source_type === "subclass" &&
            (/^infernal bond$/i.test(ability.source_name ?? "") ||
              /^primordial bond$/i.test(ability.source_name ?? "")) &&
            (ability.ability_role === "knack" || ability.ability_role === "class_talent" || /(?:infernal|nature) exploit/i.test(ability.definition ?? ""))
          if (isSubclassExploit) {
            return {
              ...ability,
              ability_role: "class_talent" as const,
              prerequisite: normalizeOrdinalPrerequisite(ability.prerequisite) ?? ability.prerequisite,
            }
          }
          return {
            ...ability,
            ability_role: ability.ability_role ?? (ability.source_name === "Beastheart" ? "knack" : undefined),
            prerequisite: normalizeOrdinalPrerequisite(ability.prerequisite) ?? ability.prerequisite,
            source_type: ability.source_type ?? "class",
            source_name: ability.source_name || "Beastheart",
          }
        }),
      },
    }
  }

  if (next.classes?.length) {
    next = {
      ...next,
      classes: next.classes.map((cls) => {
        if (!/^beastheart$/i.test(cls.name ?? "")) return cls
        const features = (cls.features ?? []).map((feat) => {
          if (/^primal exploits$/i.test(feat.name ?? "")) {
            const mechanics = Array.isArray(feat.mechanics)
              ? feat.mechanics.filter((m) => asRecord(m)?.kind !== "spellcasting_ability")
              : []
            const prior = feat.choices
            return {
              ...feat,
              isChoice: true,
              mechanics,
              choices: {
                category: "Primal Exploit",
                count: prior?.count ?? 3,
                options: prior?.options ?? [],
                resourceKey: "primal_exploits_known",
                optionsSource: "class_knacks" as const,
                swappableOnRest: false,
                swappableOnLevelUp: true,
                choiceCountByLevel:
                  prior &&
                  "choiceCountByLevel" in prior &&
                  Array.isArray((prior as { choiceCountByLevel?: unknown }).choiceCountByLevel)
                    ? (prior as { choiceCountByLevel: { level: number; count: number }[] })
                        .choiceCountByLevel
                    : [...PRIMAL_EXPLOITS_BY_LEVEL],
              },
            }
          }
          if (/^companion bond$/i.test(feat.name ?? "")) {
            const { isChoice: _i, choices: _c, ...rest } = feat
            return rest
          }
          return feat
        })
        return { ...cls, features }
      }),
    }
  }

  if (next.subclasses?.length) {
    next = {
      ...next,
      subclasses: next.subclasses.map((sc) => {
        const features = (sc.features ?? []).map((feat) => {
          if (/^infernal exploits$/i.test(feat.name ?? "") && /^infernal bond$/i.test(sc.name ?? "")) {
            const prior = feat.choices
            return {
              ...feat,
              isChoice: true,
              choices: {
                category: "Infernal Exploit",
                count: prior?.count ?? 1,
                options: infernal.length ? infernal.map((a) => abilityToOption(a as unknown as Row)) : prior?.options ?? [],
                swappableOnRest: false,
                swappableOnLevelUp: true,
                choiceCountByLevel:
                  prior &&
                  "choiceCountByLevel" in prior &&
                  Array.isArray((prior as { choiceCountByLevel?: unknown }).choiceCountByLevel)
                    ? (prior as { choiceCountByLevel: { level: number; count: number }[] })
                        .choiceCountByLevel
                    : [...SUBCLASS_EXPLOIT_BY_LEVEL],
              },
            }
          }
          if (/^nature exploits$/i.test(feat.name ?? "") && /^primordial bond$/i.test(sc.name ?? "")) {
            const prior = feat.choices
            return {
              ...feat,
              isChoice: true,
              choices: {
                category: "Nature Exploit",
                count: prior?.count ?? 1,
                options: nature.length ? nature.map((a) => abilityToOption(a as unknown as Row)) : prior?.options ?? [],
                swappableOnRest: false,
                swappableOnLevelUp: true,
                choiceCountByLevel:
                  prior &&
                  "choiceCountByLevel" in prior &&
                  Array.isArray((prior as { choiceCountByLevel?: unknown }).choiceCountByLevel)
                    ? (prior as { choiceCountByLevel: { level: number; count: number }[] })
                        .choiceCountByLevel
                    : [...SUBCLASS_EXPLOIT_BY_LEVEL],
              },
            }
          }
          if (/^undying protector$/i.test(feat.name ?? "")) {
            const desc = String(feat.description ?? "").replace(
              /<p><em>Note: this feature's text was interleaved[\s\S]*?<\/em><\/p>/i,
              "",
            )
            return { ...feat, description: desc.trim() }
          }
          return feat
        })
        return { ...sc, features }
      }),
    }
  }

  if (next.creatures?.length) {
    next = {
      ...next,
      creatures: next.creatures.map((creature) => {
        const row = creature as unknown as Row & { category?: string; actions?: Row[] }
        const actions = Array.isArray(row.actions) ? row.actions.map(fixSignatureAction) : undefined
        return {
          ...creature,
          ...(row.category == null ? { category: "companion" } : {}),
          ...(actions ? { actions } : {}),
        } as typeof creature
      }),
    }
  }

  // Inline subclass options already supply their action. A second library row would
  // display another button and spend from the same pool twice.
  const embedded = new Set((next.subclasses ?? []).filter(s => /^beastheart$/i.test(s.class_name ?? "")).flatMap(s =>
    (s.features ?? []).filter(f => /^(Infernal|Nature) Exploits$/i.test(f.name)).flatMap(f =>
      (f.choices?.options ?? []).map(o => `${s.name.toLowerCase()}:${o.name.toLowerCase()}`)),
  ))
  const keep = (a: { source_type?: string | null; source_name?: string | null; name: string }) =>
    a.source_type !== "subclass" || !embedded.has(`${a.source_name?.toLowerCase()}:${a.name.toLowerCase()}`)
  if (next.import_proposals?.custom_abilities) next = { ...next, import_proposals: { ...next.import_proposals, custom_abilities: next.import_proposals.custom_abilities.filter(keep) } }
  if (next.abilities) next = { ...next, abilities: next.abilities.filter(keep) }
  return wireBeastheartContent(next)
}

export const BEASTHEART_PRESETS: EnrichmentPreset[] = []
