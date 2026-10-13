import type { ImportContent } from "@/lib/import/content-schema"
import type { FoundryImportMeta } from "@/lib/import/foundry-types"
import { attachFoundryEffectsToRow } from "@/lib/import/map-foundry-active-effects"
import { cleanFoundryHtml } from "@/lib/import/foundry-html"
import { syncModifierRefs, type LinkedModifierInstance } from "@/lib/compendium/linked-modifiers"
import { charInstance, modId } from "@/lib/compendium/modifier-instance-builders"
import { characteristicCatalogRefId } from "@/lib/compendium/modifier-catalog-refs"
import { foundryFeatureActions, foundryCollection, record, array, string } from "./foundry-feature-actions"

type FoundryItem = Record<string, unknown>
type ClassFeature = NonNullable<ImportContent["classes"]>[number]["features"][number]
type SpeciesTrait = NonNullable<ImportContent["species"]>[number]["traits"][number]
export type FoundryUuidIndex = Map<string, FoundryItem>

/** Index full provenance first; ambiguous short ids must never cross compendium packs. */
export function buildFoundryUuidIndex(items: FoundryItem[]): FoundryUuidIndex {
  const index: FoundryUuidIndex = new Map()
  const aliases = new Map<string, FoundryItem[]>()
  for (const item of items) {
    index.set(`__document_${index.size}`, item)
    const stats = record(item._stats)
    const flags = record(record(item.flags).core)
    for (const key of [item.uuid, stats.compendiumSource, record(stats.exportSource).uuid, flags.sourceId, item._id]) {
      if (typeof key !== "string" || !key) continue
      const list = aliases.get(key) ?? []
      if (!list.includes(item)) list.push(item)
      aliases.set(key, list)
    }
  }
  for (const [key, values] of aliases) if (values.length === 1) index.set(key, values[0])
  return index
}

export function resolveFoundryUuid(uuid: string, index: FoundryUuidIndex): FoundryItem | null {
  const direct = index.get(uuid.trim())
  if (direct) return direct
  const id = uuid.split(".").pop() ?? ""
  const candidate = index.get(id)
  if (!candidate) return null
  const stats = record(candidate._stats), flags = record(record(candidate.flags).core)
  const qualified = [candidate.uuid, stats.compendiumSource, record(stats.exportSource).uuid, flags.sourceId]
    .filter((v): v is string => typeof v === "string" && v.startsWith("Compendium."))
  return uuid.startsWith("Compendium.") && qualified.length && !qualified.includes(uuid) ? null : candidate
}

function feature(item: FoundryItem, level: number, index: FoundryUuidIndex, meta: FoundryImportMeta): ClassFeature {
  const effects = array(item.effects)
  const transferable = effects.filter(e => record(e).transfer !== false)
  for (const e of effects.filter(e => record(e).transfer === false)) {
    meta.review.push({ label: "Activated effect", documentName: string(item.name), detail: `${string(record(e).name) || "Effect"} is applied by an activity, not permanently to the character.` })
  }
  return syncModifierRefs(attachFoundryEffectsToRow({
    level, name: string(item.name), description: cleanFoundryHtml(record(record(item.system).description).value),
    linkedModifiers: foundryFeatureActions(item, new Set(index.values()), meta),
  }, transferable, meta))
}

function grantedFeatures(item: FoundryItem, level: number, index: FoundryUuidIndex, meta: FoundryImportMeta): ClassFeature[] {
  const system = record(item.system), activities = Object.entries(record(system.activities))
  if (activities.length <= 1) return [feature(item, level, index, meta)]
  const base = feature({ ...item, system: { ...system, activities: {}, activation: {}, uses: {} } }, level, index, meta)
  const actions = activities.map(([id, raw], i) => {
    const activity = record(raw)
    const row = feature({ ...item, name: `${string(item.name)}: ${string(activity.name) || `Activity ${i + 1}`}`, effects: [], system: { ...system, activities: { [id]: raw } } }, level, index, meta)
    for (const link of row.linkedModifiers ?? []) for (const characteristic of link.characteristics ?? []) {
      if (characteristic.type === "uses") characteristic.uses.useShareKey = `foundry_${string(item._id) || string(item.name)}`
    }
    return row
  })
  return [base, ...actions]
}

function characteristicFeature(level: number, name: string, description: string, modifier: Parameters<typeof charInstance>[2][number]): ClassFeature {
  const id = `foundry_${modifier.type}_${level}_${name}`
  return syncModifierRefs({ level, name, description, linkedModifiers: [charInstance(id, characteristicCatalogRefId(modifier.type), [modifier])] })
}

export type AdvancementParseResult = {
  classFeatures: ClassFeature[]
  subclassFeatures: ClassFeature[]
  speciesTraits: SpeciesTrait[]
  subclassIdentifier: string | null
  consumedItems: Set<FoundryItem>
}

export function parseFoundryAdvancements(item: FoundryItem, index: FoundryUuidIndex, meta: FoundryImportMeta): AdvancementParseResult {
  const features: ClassFeature[] = [], consumedItems = new Set<FoundryItem>()
  const ownerName = string(item.name)
  const review = (label: string, detail: string) => meta.review.push({ label, detail, documentName: ownerName })
  const visit = (parent: FoundryItem, minimumLevel: number, ancestry: Set<FoundryItem>) => {
    if (ancestry.has(parent)) { review("Cyclic advancement", string(parent.name)); return }
    const next = new Set(ancestry).add(parent)
    for (const raw of foundryCollection(record(parent.system).advancement)) {
      const adv = record(raw), config = record(adv.configuration), type = string(adv.type)
      const level = Math.max(minimumLevel, Number(adv.level) || 1)
      const title = string(adv.name) || string(adv.title) || type
      if (adv.classRestriction === "secondary") continue
      if (type === "ItemGrant") {
        for (const rawGrant of array(config.items)) {
          const grant = record(rawGrant), uuid = typeof rawGrant === "string" ? rawGrant : string(grant.uuid)
          const resolved = resolveFoundryUuid(uuid, index)
          if (!resolved) { review("Unresolved ItemGrant", `${uuid || "missing UUID"} — include the referenced Item JSON in the same import batch.`); continue }
          if (config.optional || grant.optional) { review("Optional ItemGrant", `${string(resolved.name)} at level ${level}; add as an optional choice in the Compendium.`); continue }
          if (resolved.type === "feat" || resolved.type === "feature") {
            features.push(...grantedFeatures(resolved, level, index, meta))
            consumedItems.add(resolved)
            visit(resolved, level, next)
            meta.mapped.advancements++
          } else if (resolved.type === "spell") {
            const spellConfig = record(config.spell)
            features.push(characteristicFeature(level, string(resolved.name), "Granted spell. See the spell entry for its rules.", {
              id: modId(`foundry_spell_${level}_${string(resolved._id)}`), type: "spells_known",
              spells: [{ spellId: `import_spell_name:${string(resolved.name)}`, alwaysPrepared: spellConfig.preparation === "always" || spellConfig.method === "prepared", unlocksAtClassLevel: level }],
            }))
            meta.mapped.advancements++
            if (Object.keys(spellConfig).length) review("Spell grant configuration", `${string(resolved.name)}: verify casting ability, free uses and preparation (${JSON.stringify(spellConfig)}).`)
          } else review("ItemGrant needs review", `${string(resolved.name)} (${string(resolved.type)}) at level ${level}; assign the grant in the Compendium.`)
        }
      } else if (type === "ItemChoice") {
        const options = array(config.pool).map(v => typeof v === "string" ? v : string(record(v).uuid))
        const resolved = options.map(uuid => resolveFoundryUuid(uuid, index))
        const choices = Object.entries(record(config.choices)).sort(([a], [b]) => Number(a) - Number(b))
        const restriction = record(config.restriction)
        if (!options.length || resolved.some(r => !r || !["feat", "feature"].includes(string(r.type))) || restriction.level || array(restriction.list).length || array(restriction.school).length) {
          review("ItemChoice needs review", `${title}: export the complete feature pool and review restrictions (${JSON.stringify(config)}).`)
          continue
        }
        for (const [levelKey, rawChoice] of choices) {
          const choice = record(rawChoice), count = typeof rawChoice === "number" ? rawChoice : Number(choice.count)
          if (!(count > 0)) continue
          const choiceLevel = Math.max(minimumLevel, Number(levelKey) || level)
          if (resolved.some(r => Object.keys(record(record(r!.system).activities)).length > 1 || foundryCollection(record(r!.system).advancement).length)) {
            review("Complex choice option", `${title}: nested advancements or multiple activities need manual configuration.`)
          }
          features.push({
            level: choiceLevel, name: title, description: cleanFoundryHtml(adv.hint) || `Choose ${count} ${title} option(s).`,
            isChoice: true, choices: { category: title, count, options: resolved.map(r => {
              const option = feature(r!, choiceLevel, index, meta)
              consumedItems.add(r!)
              return { name: option.name, description: option.description, linkedModifiers: option.linkedModifiers, modifierRefs: option.modifierRefs }
            }) },
          })
          meta.mapped.advancements++
          if (choice.replacement) review("Choice replacement", `${title} at level ${choiceLevel}: review replacement eligibility in the Compendium.`)
        }
        if (config.allowDrops) review("Open choice pool", `${title}: imported the explicit pool; Foundry also permits additional dropped Items.`)
      } else if (type === "ScaleValue") {
        // Retain all types as reference text. Consumers (such as uses.max) resolve exact
        // numeric references; never mistake an arbitrary scale for global extra damage.
        const rows = Object.entries(record(config.scale)).map(([l, v]) => `Level ${l}: ${JSON.stringify(v)}`).join("\n")
        features.push({ level, name: `${title} (scaling)`, description: rows || "No scale values supplied." })
        review("ScaleValue table", `${title}: numeric uses references are resolved; other consumers require review.`)
      } else if (type === "Subclass") {
        features.push(characteristicFeature(level, title === "Subclass" ? "Subclass" : title, "Choose a subclass.", { id: modId(`foundry_subclass_${level}`), type: "subclass_unlock" }))
        meta.mapped.advancements++
      } else if (type === "AbilityScoreImprovement") {
        const standard = (config.points == null || config.points === 2) && !Object.values(record(config.fixed)).some(v => Number(v) !== 0) && !array(config.locked).length && (config.cap == null || config.cap === 2) && (config.max == null || config.max === 20)
        if (standard) {
          features.push(characteristicFeature(level, "Ability Score Improvement", "Choose an Ability Score Improvement or an eligible feat.", { id: modId(`foundry_asi_${level}`), type: "grant_feat", featCategories: ["General"], count: 1 }))
          meta.mapped.advancements++
        } else review("Ability score advancement", `${title} at level ${level}: ${JSON.stringify(config)}`)
      } else if (type === "Trait") {
        // Core level-one class proficiencies are mapped by mapClass; all other trait
        // advancements remain explicit review entries rather than applying early.
        const unknownGrants = array(config.grants).some(k => !/^(saves:(str|dex|con|int|wis|cha)|armor:(lgt|med|hvy|shl)|weapon:(sim|mar))$/.test(string(k)))
        if (parent !== item || item.type !== "class" || level > 1 || unknownGrants || array(config.choices).some(c => array(record(c).pool).some(k => !/^skills:(acr|ani|arc|ath|dec|his|ins|itm|inv|med|nat|prc|prf|per|rel|slt|ste|sur)$/.test(string(k))))) review("Trait advancement", `${title} at level ${level}: ${JSON.stringify(config)}`)
      } else if (type !== "HitPoints") {
        review("Unsupported advancement", `${title} (${type}) at level ${level}: ${JSON.stringify(config)}`)
      }
    }
  }
  visit(item, 1, new Set())
  return { classFeatures: item.type === "subclass" ? [] : features, subclassFeatures: item.type === "subclass" ? features : [], speciesTraits: [], subclassIdentifier: null, consumedItems }
}

export function featureDestination(item: FoundryItem): "feat" | "class_feature" | "subclass_feature" | "species_trait" {
  const value = string(record(record(item.system).type).value)
  return value === "class" ? "class_feature" : value === "subclass" ? "subclass_feature" : value === "race" ? "species_trait" : "feat"
}

export function mapStandaloneFeatureItem(item: FoundryItem, meta: FoundryImportMeta): {
  feat?: NonNullable<ImportContent["feats"]>[number] & { linkedModifiers?: LinkedModifierInstance[]; modifierRefs?: string[] }
  classFeature?: ClassFeature; subclassFeature?: ClassFeature; speciesTrait?: SpeciesTrait
} {
  const system = record(item.system), destination = featureDestination(item)
  const row = feature(item, Number(record(system.prerequisites).level ?? system.level) || 1, buildFoundryUuidIndex([item]), meta)
  if (destination === "class_feature") return { classFeature: row }
  if (destination === "subclass_feature") return { subclassFeature: row }
  if (destination === "species_trait") return { speciesTrait: row }
  return { feat: { ...row, description: row.description || null, prerequisite: null, category: "General" } }
}

export function extractFoundrySourceLabel(item: FoundryItem, fallback: string): string {
  const books = array(record(record(item.flags).dnd5e).sourceBooks).map(string).filter(Boolean)
  if (books.length) return books.join(", ")
  const raw = record(item.system).source
  if (typeof raw === "string" && raw.trim()) return raw.trim()
  const source = record(raw), book = string(source.book).trim(), label = string(source.label).trim() || string(source.custom).trim()
  return book && label ? `${book}: ${label}` : book || label || fallback
}
export function mergeSourceLabels(current: string, next: string): string {
  if (!current || current === "Foundry VTT Import") return next
  if (!next || next === "Foundry VTT Import" || current.includes(next)) return current
  return `${current}; ${next}`
}
