import type { FeatureActivation, FeatureEffect, UsesConfig, UsesAtLevel } from "@/lib/types"
import type { LinkedModifierInstance } from "@/lib/compendium/linked-modifiers"
import { charInstance, fxInstance, modId, usesInstance } from "@/lib/compendium/modifier-instance-builders"
import { characteristicCatalogRefId, effectCatalogRefId } from "@/lib/compendium/modifier-catalog-refs"
import type { FoundryImportMeta } from "./foundry-types"

type RecordValue = Record<string, unknown>
export const record = (v: unknown): RecordValue => v && typeof v === "object" && !Array.isArray(v) ? v as RecordValue : {}
export const array = (v: unknown): unknown[] => Array.isArray(v) ? v : []
/** v6 advancement collections are keyed objects; older exports used arrays. */
export const foundryCollection = (v: unknown): unknown[] => Array.isArray(v) ? v : Object.values(record(v))
export const string = (v: unknown): string => typeof v === "string" ? v : ""
const slug = (v: string) => v.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")

/** Exact Foundry scale references only. A scale is data, never a global damage bonus. */
export function numericScale(raw: string, documents: Iterable<RecordValue>): UsesAtLevel[] | null {
  const match = raw.match(/^@scale\.([\w-]+)\.([\w-]+)$/)
  if (!match) return null
  for (const doc of documents) {
    const sys = record(doc.system)
    if ((string(sys.identifier) || slug(string(doc.name))) !== match[1]) continue
    for (const value of foundryCollection(sys.advancement)) {
      const adv = record(value), config = record(adv.configuration)
      if (adv.type !== "ScaleValue" || config.type !== "number") continue
      if ((string(config.identifier) || slug(string(adv.name) || string(adv.title))) !== match[2]) continue
      const rows = Object.entries(record(config.scale)).map(([level, value]) => ({ level: Number(level), count: Number(record(value).value) }))
      if (rows.length && rows.every(r => Number.isInteger(r.level) && r.level >= 1 && r.level <= 20 && Number.isFinite(r.count) && r.count >= 0)) return rows.sort((a, b) => a.level - b.level)
    }
  }
  return null
}

function mapUses(raw: unknown, documents: Iterable<RecordValue>, name: string, meta: FoundryImportMeta): UsesConfig | null {
  const data = record(raw), max = String(data.max ?? "").trim()
  if (!max || max === "0") return null
  let uses: UsesConfig
  const table = numericScale(max, documents)
  if (/^\d+$/.test(max)) uses = { type: "fixed", fixedAmount: Number(max) }
  else if (max === "@prof") uses = { type: "proficiency" }
  else if (/^@abilities\.(str|dex|con|int|wis|cha)\.mod$/.test(max)) uses = { type: "ability_modifier", abilityModifier: max.split(".")[1].toUpperCase() as UsesConfig["abilityModifier"] }
  else if (table) uses = { type: "at_level", atLevelTable: table }
  else {
    meta.review.push({ label: "Unresolved uses formula", documentName: name, detail: max })
    return { type: "special", specialDescription: `Uses: ${max}. Configure the resource in the Compendium.` }
  }
  uses.recharges = []
  const recoveries = array(data.recovery)
  if (!recoveries.length && data.per) recoveries.push({ period: data.per, type: "recoverAll" })
  for (const rawRecovery of recoveries) {
    const recovery = record(rawRecovery)
    const rest = recovery.period === "sr" ? "short_rest" : recovery.period === "lr" ? "long_rest" : null
    const formula = String(recovery.formula ?? "")
    if (rest && recovery.type === "recoverAll") uses.recharges.push({ rest })
    else if (rest && recovery.type === "formula" && /^\d+$/.test(formula)) uses.recharges.push({ rest, amount: Number(formula) })
    else meta.review.push({ label: "Uses recovery needs review", documentName: name, detail: JSON.stringify(recovery) })
  }
  return uses
}

/** Keep untranslatable activity rules actionable as a manual note, without inventing effects. */
export function foundryFeatureActions(item: RecordValue, documents: Iterable<RecordValue>, meta: FoundryImportMeta): LinkedModifierInstance[] {
  const sys = record(item.system), name = string(item.name), key = `foundry_${string(item._id) || slug(name)}`
  const linked: LinkedModifierInstance[] = []
  const activities = Object.values(record(sys.activities)).map(record)
  if (!activities.length && string(record(sys.activation).type)) activities.push({ activation: sys.activation, type: "legacy" })
  const spendsOwnUse = !activities.length || activities.some(a => a.type === "legacy" || array(record(a.consumption).targets).some(t => {
    const target = record(t)
    return target.type === "itemUses" && !target.target && String(target.value ?? "1") === "1"
  }))
  const uses = mapUses(sys.uses, documents, name, meta)
  if (uses && spendsOwnUse) linked.push(usesInstance(`${key}_uses`, uses, name))
  for (const [i, activity] of activities.entries()) {
    const activationData = record(activity.activation), timing = string(activationData.type)
    const activation: FeatureActivation = {
      action: timing === "action", bonusAction: timing === "bonus", reaction: timing === "reaction",
      ...(timing === "special" || timing === "free" ? { action: true, noEconomyCost: true } : {}),
      ...(activationData.condition ? { requirements: [{ kind: "custom", text: string(activationData.condition) }] } : {}),
    }
    const id = `${key}_activity_${i}`
    let effect: FeatureEffect | null = null
    const healing = record(activity.healing)
    const affects = string(record(record(activity.target).affects).type)
    const self = affects === "self" || (!affects && record(activity.range).units === "self")
    const bonus = String(healing.bonus ?? "0").trim() || "0"
    const classBonus = bonus.match(/^@classes\.([\w-]+)\.levels$/)
    const owner = [...documents].find(d => d.type === "class" && record(d.system).identifier === classBonus?.[1])
    if (activity.type === "heal" && self && !record(healing.custom).enabled && [4, 6, 8, 10, 12, 20].includes(Number(healing.denomination)) && (Number.isFinite(Number(bonus)) || owner)) {
      effect = { id: modId(id), kind: "heal_self", healMode: "dice", healDiceCount: Number(healing.number) || 1, healDieType: `d${healing.denomination}` as FeatureEffect["healDieType"],
        ...(owner ? { bonusByLevel: Array.from({ length: 20 }, (_, n) => ({ level: n + 1, mode: "fixed" as const, fixed: n + 1 })) } : { healFlatBonus: Number(bonus) }) }
    }
    // Only automatic, transferred effects are passive. Activity effects remain manual.
    if (effect) linked.push(fxInstance(id, effectCatalogRefId(effect.kind), { ...activation, effects: [effect] }))
    else {
      const note = charInstance(id, characteristicCatalogRefId("player_note"), [{ id: modId(id), type: "player_note", prompt: string(activity.name) || name, target: "feature" }])
      note.activation = activation
      linked.push(note)
      meta.review.push({ label: "Manual activity", documentName: name, detail: `${string(activity.name) || name}: ${string(activity.type)} (${timing || "unspecified timing"}); apply the effect from its description.` })
    }
    const activityUses = mapUses(activity.uses, documents, name, meta)
    if (activityUses) meta.review.push({ label: "Activity-specific uses", documentName: name, detail: "Configure the separate activity resource; the item resource is imported independently." })
    const targets = array(record(activity.consumption).targets).map(record)
    if (targets.some(t => t.type !== "itemUses" || t.target || String(t.value ?? "1") !== "1")) meta.review.push({ label: "Activity consumption", documentName: name, detail: JSON.stringify(targets) })
    if (!["action", "bonus", "reaction", "special", "free"].includes(timing)) meta.review.push({ label: "Activity timing", documentName: name, detail: timing || "No activation type provided" })
  }
  return linked
}
