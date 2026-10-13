import { char, free, key, note, pool, wire } from "./helpers"

export const PHB_MANEUVER_NAMES = ["Ambush", "Bait and Switch", "Commander's Strike", "Commanding Presence", "Disarming Attack", "Distracting Strike", "Evasive Footwork", "Feinting Attack", "Goading Attack", "Lunging Attack", "Maneuvering Attack", "Menacing Attack", "Parry", "Precision Attack", "Pushing Attack", "Rally", "Riposte", "Sweeping Attack", "Tactical Assessment", "Trip Attack"]

/** The selected library entry owns the spend; it must not become a permanent passive bonus. */
export function wirePhbManeuver(row: Record<string, unknown>): Record<string, unknown> {
  if (row.source_name !== "Battle Master" || !PHB_MANEUVER_NAMES.some((name) => key(name) === key(String(row.name)))) return row
  const name = String(row.name)
  const reaction = ["parry", "riposte"].includes(key(name))
  const bonus = ["evasive_footwork", "feinting_attack", "lunging_attack", "rally"].includes(key(name))
  const activation = reaction ? { reaction: true } : bonus ? { bonusAction: true } : free
  const uses = pool("superiority_dice")
  const f = wire({ name, level: 3, description: String(row.description ?? "") }, [note(name, "Spend one Superiority Die. Apply the rolled benefit and any target save from the source description; only one maneuver per attack.")], activation, uses)
  return { ...row, casting_time: reaction ? "Reaction" : bonus ? "Bonus Action" : "Special", uses,
    linkedModifiers: f.linkedModifiers, linked_modifiers: f.linkedModifiers, modifierRefs: f.modifierRefs, modifier_refs: f.modifierRefs,
    sheetDisplay: { combatActions: true, abilitiesActions: ["ambush", "commanding_presence", "tactical_assessment"].includes(key(name)), featuresTab: true } }
}

export const relentlessManeuvers = () => char("Relentless", { type: "modify_custom_ability", abilityNames: PHB_MANEUVER_NAMES,
  resourceCostWaiver: "Relentless: once this turn, use a d8 instead of spending a Superiority Die",
  addendum: "When using Relentless, roll a d8 manually rather than the pool's larger die. One such free maneuver per turn." })
