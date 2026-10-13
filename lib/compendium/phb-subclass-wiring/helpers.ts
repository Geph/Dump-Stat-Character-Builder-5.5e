import type { Feature, FeatureActivation, FeatureEffect, UsesConfig } from "@/lib/types"
import type { CharacteristicModifier } from "@/lib/compendium/characteristic-modifiers"
import { syncModifierRefs, type LinkedModifierInstance } from "@/lib/compendium/linked-modifiers"
import { sheetToggleIdActivatedByAction } from "@/lib/compendium/sheet-toggle-registry"

type WithoutId<T> = T extends unknown ? Omit<T, "id"> : never
export const key = (value: string) => value.toLowerCase().replace(/[’‘]/g, "'").replace(/[^a-z0-9]+/g, "_").replace(/_$/, "")
export const longRest = [{ rest: "long_rest" as const }]
export const bothRests = [{ rest: "short_rest" as const }, ...longRest]
export const free: FeatureActivation = { action: true, noEconomyCost: true }
export const pool = (classResourceKey: string, classResourceAmount = 1): UsesConfig => ({ type: "class_resource", classResourceKey, classResourceAmount })
export const daily = (fixedAmount = 1): UsesConfig => ({ type: "fixed", fixedAmount, recharges: longRest })
export const statUses = (abilityModifier: UsesConfig["abilityModifier"]): UsesConfig => ({ type: "ability_modifier", abilityModifier, recharges: longRest })
export const state = (name: string) => [{ id: `phb_state_${key(name)}`, kind: "sheet_toggle" as const, rule: "requires_active" as const, value: sheetToggleIdActivatedByAction({ name }) ?? `feature_state:${name}` }]

export function char(name: string, value: WithoutId<CharacteristicModifier>): LinkedModifierInstance {
  const id = `phb_${key(name)}_${value.type}`
  return { instanceId: id, catalogRefId: `cat_char_${value.type}`, characteristics: [{ ...value, id } as CharacteristicModifier] }
}
export function fx(name: string, value: Omit<FeatureEffect, "id">): LinkedModifierInstance {
  const id = `phb_${key(name)}_${value.kind}`
  return { instanceId: id, catalogRefId: `cat_fx_${value.kind}`, activation: { effects: [{ ...value, id }] } }
}
export const note = (name: string, prompt: string) => char(name, { type: "player_note", target: "feature", prompt })
export const rider = (name: string, parentPowerNames: string[]) => char(name, { type: "power_rider", parentPowerNames, alertSummary: name })
export const known = (name: string, names: string[]) => char(name, { type: "spells_known", spells: names.map((s) => ({ spellId: `import_spell_name:${s}`, alwaysPrepared: true })) })

/** Strip only the replaced mechanics, retaining unrelated authored benefits. */
export function omit(f: Feature, types: string[]): LinkedModifierInstance[] {
  return (f.linkedModifiers ?? []).map((m) => ({ ...m,
    characteristics: m.characteristics?.filter((c) => !types.includes(c.type)),
    activation: m.activation ? { ...m.activation, effects: m.activation.effects?.filter((e) => !types.includes(e.kind)) } : undefined,
  })).filter((m) => m.characteristics?.length || m.activation?.effects?.length)
}
export function wire(f: Feature, mods: LinkedModifierInstance[], activation?: FeatureActivation, uses?: UsesConfig | null): Feature {
  // Clear the old detector hints: a subsequent import must not resurrect them.
  const effectiveUses = uses ?? (activation ? { type: "unlimited" as const } : null)
  const linkedModifiers: LinkedModifierInstance[] = [...new Map(mods.map((m) => [m.instanceId, m])).values()].map((m, i) => ({ ...m, activation: m.activation || (i === 0 && activation)
    ? { ...(i === 0 ? activation : {}), effects: m.activation?.effects } : undefined }))
  if (effectiveUses) linkedModifiers.push(char(f.name, { type: "uses", uses: effectiveUses }))
  return syncModifierRefs({ ...f, mechanics: [], activation: activation ?? null, limitedUses: effectiveUses,
    linkedModifiers, sheetDisplay: { ...f.sheetDisplay, featuresTab: true, ...(activation ? { combatActions: true, abilitiesActions: false } : {}) },
  })
}
export function timing(f: Feature, activation: FeatureActivation, uses?: UsesConfig | null): Feature {
  return wire(f, omit(f, ["uses"]), activation, uses === undefined ? f.limitedUses : uses)
}
export function spell(f: Feature, name: string, activation: FeatureActivation, uses?: UsesConfig, withoutSlot = true): Feature {
  return wire(f, [known(f.name, [name]), fx(f.name, { kind: "cast_spell", label: f.name,
    castSpellName: name, castSpellWithoutSlot: withoutSlot,
    castSpellCastingTime: activation.bonusAction ? "bonus_action" : activation.reaction ? "reaction" : "action",
  })], activation, uses)
}
/** A derived action uses the original imported description; no book prose is shipped here. */
export function child(f: Feature, name: string): Feature {
  return { name, level: f.level, description: f.description, sheetDisplay: { featuresTab: true, combatActions: true } }
}
