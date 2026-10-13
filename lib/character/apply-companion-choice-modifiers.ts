import { applyModifierPlayerPicks } from "@/lib/builder/modifier-player-choices"
import { featureChoiceKey } from "@/lib/builder/choices"
import type { CharacterClassDetail } from "@/lib/character/character-classes"
import type {
  CompanionNamedBlock,
  CompanionSource,
  CompanionStatBlockTemplate,
} from "@/lib/character/companion-stat-block"
import { characteristicsFromLinkedModifiers } from "@/lib/compendium/builder-modifier-refs"
import {
  companionSourceMatchesChoice,
  featureChoiceAppliesToCompanion,
  findChoiceOption,
} from "@/lib/compendium/feature-choice-target"
import { effectiveLinkedModifiers } from "@/lib/compendium/linked-modifiers"
import type { ModifierCatalogEntry } from "@/lib/compendium/modifier-catalog"
import type { CustomAbility, Feature } from "@/lib/types"
import { inferCompanionAttackFromText } from "@/lib/character/infer-companion-attack"

function uniqLabels(values: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of values) {
    const name = raw.trim()
    if (!name) continue
    const key = name.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(name)
  }
  return out
}

function appendCsv(line: string | null | undefined, names: string[]): string | null {
  const existing = (line ?? "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
  const merged = uniqLabels([...existing, ...names])
  return merged.length ? merged.join(", ") : (line ?? null)
}

function pushTrait(template: CompanionStatBlockTemplate, trait: CompanionNamedBlock): CompanionStatBlockTemplate {
  const text = trait.description.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim()
  const activation = text.match(/(?:^|\.\s+)As (?:an?|your) (bonus action|reaction|action)\b/i)?.[1]?.toLowerCase()
  if (activation) {
    const key = activation === "bonus action" ? "bonusActions" : activation === "reaction" ? "reactions" : "actions"
    const entries = template[key] ?? []
    if (entries.some((entry) => entry.name.toLowerCase() === trait.name.toLowerCase())) return template
    return { ...template, [key]: [...entries, { ...trait, attack: inferCompanionAttackFromText(trait.description) }] }
  }
  if (
    template.traits.some(
      (entry) => entry.name.trim().toLowerCase() === trait.name.trim().toLowerCase(),
    )
  ) {
    return template
  }
  return { ...template, traits: [...template.traits, trait] }
}

function applyLinkedToTemplate(
  template: CompanionStatBlockTemplate,
  optionName: string,
  optionDescription: string,
  instances: ReturnType<typeof effectiveLinkedModifiers>,
  characteristics: ReturnType<typeof characteristicsFromLinkedModifiers>,
  extras?: { omitTrait?: boolean; classLevel?: number },
): CompanionStatBlockTemplate {
  let next = template
  const classLevel = extras?.classLevel ?? 1
  const saveEffect = instances.flatMap(m => m.activation?.effects ?? []).find(e => e.kind === "force_save_control" && e.saveDCConfig?.mode === "ability_modifier")
  if (saveEffect) next = { ...next, actions: next.actions.map(block => {
    const attack = block.attack ?? inferCompanionAttackFromText(block.description)
    if (attack?.kind !== "save" || !/Ferocity/i.test(block.tag ?? "")) return block
    const ability = ({ STR: "strength", DEX: "dexterity", CON: "constitution", INT: "intelligence", WIS: "wisdom", CHA: "charisma" } as const)[saveEffect.saveDCConfig!.ability ?? "WIS"]
    return { ...block, attack: { ...attack, alternativeSaveDc: { parts: [{ type: "fixed", value: saveEffect.saveDCBase ?? 8 }, { type: "scale", ref: { kind: "proficiency_bonus" } }, { type: "scale", ref: { kind: "ability_modifier", ability } }] } } }
  }) }
  for (const mod of characteristics) {
    // Conditional effects remain rules text until their condition has an explicit evaluator.
    if (mod.limitations?.length) continue
    if (mod.type === "ac" && mod.mode === "flat_bonus") {
      next = { ...next, ac: { parts: [...next.ac.parts, { type: "fixed", value: mod.flatBonus ?? 0 }] } }
    }
    if (mod.type === "speed") {
      const speedName = mod.speedType === "walk" ? "" : `${mod.speedType} `
      const pattern = new RegExp(`(?:^|,\\s*)${speedName}(\\d+)\\s*ft\\.?`, "i")
      const current = Number(next.speed?.match(pattern)?.[1] ?? 0)
      const value = mod.mode === "add" ? current + mod.value : mod.mode === "equal_to_walk"
        ? Number(next.speed?.match(/^(\d+)/)?.[1] ?? 0) : mod.value
      const without = (next.speed ?? "").replace(pattern, "").replace(/^,\s*/, "")
      next = { ...next, speed: (mod.speedType === "walk" ? [`${value} ft.`, without] : [without, `${speedName}${value} ft.`]).filter(Boolean).join(", ") }
    }
    if (mod.type === "damage_immunity") next = { ...next, damageImmunities: uniqLabels([...(next.damageImmunities ?? []), ...mod.damageTypes]) }
    if (mod.type === "power_rider" && !mod.selectable && !mod.spendClassResourceAmount) {
      const die = [...(mod.dieByLevel ?? [])].sort((a,b) => b.level-a.level).find(row => row.level <= classLevel)?.die ?? mod.bonusDice
      if (die) next = { ...next, actions: next.actions.map(block => {
        if (!mod.parentPowerNames.some(name => [block.name, block.tag].some(value => value?.toLowerCase() === name.toLowerCase()))) return block
        const attack = block.attack ?? inferCompanionAttackFromText(block.description)
        if (!attack) return block
        return { ...block, attack: { ...attack, damage: [...attack.damage, { dice: die, type: mod.bonusDiceType ?? attack.damage[0]?.type }] } }
      }) }
    }
  }

  const resistances = characteristics.flatMap((mod) =>
    mod.type === "damage_resistance" && !mod.limitations?.length ? (mod.damageTypes ?? []) : [],
  )
  const immunities = characteristics.flatMap((mod) =>
    mod.type === "condition_immunity" && !mod.limitations?.length ? (mod.conditions ?? []) : [],
  )
  const saves = characteristics.flatMap((mod) => (mod.type === "saving_throws" ? mod.values : []))
  const skills = characteristics.flatMap((mod) =>
    mod.type === "skills" ? (mod.entries ?? []).map((entry) => entry.skill) : [],
  )

  if (resistances.length) {
    next = { ...next, resistances: uniqLabels([...(next.resistances ?? []), ...resistances]) }
  }
  if (immunities.length) {
    next = {
      ...next,
      conditionImmunities: uniqLabels([...(next.conditionImmunities ?? []), ...immunities]),
    }
  }
  if (saves.length) {
    next = { ...next, savingThrows: appendCsv(next.savingThrows, saves) }
    const scores = { ...next.abilityScores }
    for (const save of saves) {
      const key = save.toLowerCase() as keyof typeof scores
      const row = scores[key]
      if (row) scores[key] = { ...row, saveFormula: { parts: [{ type: "fixed", value: row.modifier }, { type: "scale", ref: { kind: "proficiency_bonus" } }] } }
    }
    next = { ...next, abilityScores: scores }
  }
  if (skills.length) {
    next = { ...next, skills: appendCsv(next.skills, skills) }
  }

  const relentless = instances.some((instance) => instance.activation?.onDropToZeroHp)
  if (!extras?.omitTrait) {
    const traitName = optionName.trim() || "Species Trait"
    next = pushTrait(next, {
      name: traitName,
      description: optionDescription.trim() || traitName,
      tag: relentless ? "1/Day" : null,
    })
  }

  return next
}

export function applyCompanionScopedChoiceModifiers(params: {
  template: CompanionStatBlockTemplate
  source: CompanionSource
  classDetails: CharacterClassDetail[]
  featureChoicePicks?: Record<string, string[]>
  modifierPlayerPicks?: Record<string, string[]>
  modifierCatalog?: ModifierCatalogEntry[]
  /** Already filtered to the character's selected/granted abilities. */
  customAbilities?: CustomAbility[]
}): CompanionStatBlockTemplate {
  const catalog = params.modifierCatalog ?? []
  const picks = params.featureChoicePicks ?? {}
  const playerPicks = params.modifierPlayerPicks ?? {}
  let template = params.template

  for (const entry of params.classDetails) {
    if (entry.row.class_id !== params.source.classId) continue
    const features = [
      ...((entry.class?.features as Feature[] | undefined) ?? []),
      ...((entry.subclass?.features as Feature[] | undefined) ?? []),
      ...(params.customAbilities ?? [])
        .filter((ability) => featureChoiceAppliesToCompanion(ability) &&
          ((ability.attached_to_type === "subclass" && [entry.subclass?.id, entry.subclass?.name].includes(ability.attached_to_id ?? "")) ||
           (ability.attached_to_type === "class" && [entry.class?.id, entry.class?.name].includes(ability.attached_to_id ?? ""))))
        .map((ability) => ({ name: ability.name, description: ability.description ?? "", level: ability.level_requirement ?? 1,
          isChoice: ability.isChoice ?? false, choices: ability.choices ?? undefined,
          linkedModifiers: ability.linked_modifiers ?? [], modifierRefs: ability.modifierRefs ?? [],
        })),
    ]
    for (const feature of features) {
      if ((feature.level ?? 1) > entry.row.level) continue
      if (!featureChoiceAppliesToCompanion(feature)) continue
      if (!companionSourceMatchesChoice(feature, params.source)) continue
      if (!feature.choices?.options?.length) template = pushTrait(template, { name: feature.name, description: feature.description })
      const key = featureChoiceKey(entry.row.class_id, feature.name, feature.level)
      const featureInstances = effectiveLinkedModifiers(
        feature.linkedModifiers,
        feature.modifierRefs,
        catalog,
      )
      if (featureInstances.length) {
        const featureCharacteristics = applyModifierPlayerPicks(
          characteristicsFromLinkedModifiers(catalog, featureInstances, feature.modifierRefs),
          key,
          playerPicks,
        )
        template = applyLinkedToTemplate(
          template,
          feature.name,
          feature.description,
          featureInstances,
          featureCharacteristics,
          { omitTrait: Boolean(feature.choices?.options?.length), classLevel: entry.row.level },
        )
      }
      const chosen = feature.isChoice
        ? (picks[key] ?? picks[featureChoiceKey(entry.row.class_id, feature.name)] ?? [])
        : (feature.choices?.options ?? []).map((option) => option.name)
      for (const optionName of chosen) {
        const option = findChoiceOption(feature.choices?.options, optionName)
        if (!option) continue
        const instances = effectiveLinkedModifiers(
          option.linkedModifiers,
          option.modifierRefs,
          catalog,
        )
        const characteristics = applyModifierPlayerPicks(
          characteristicsFromLinkedModifiers(catalog, instances, option.modifierRefs),
          key,
          playerPicks,
        )
        template = applyLinkedToTemplate(
          template,
          option.name,
          option.description,
          instances,
          characteristics,
          { classLevel: entry.row.level },
        )
      }
    }
  }

  return template
}
