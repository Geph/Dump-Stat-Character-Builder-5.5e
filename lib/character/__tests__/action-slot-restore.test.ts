import { describe, expect, it, vi } from "vitest"
import { restoreActionWithSpellSlot, spendAbilitySpellSlot } from "@/lib/character/action-slot-restore"
import { spellSlotTableKey, type SpellSlotTable } from "@/lib/compendium/spell-slots"

const ordinary: SpellSlotTable = { type: "full", className: "Wizard", classLevel: 5, slotsByLevel: [4, 3, 2] }
const pact: SpellSlotTable = { type: "pact", className: "Warlock", classLevel: 5, pactSlotLevel: 3, slotsByLevel: [0, 0, 2] }
describe("ability restoration from spell slots", () => {
  it("requires a Pact Magic slot when specified, including multiclass characters", () => {
    const spent = spendAbilitySpellSlot([ordinary, pact], {}, 1, true)!
    expect(spent.key).toBe(spellSlotTableKey(pact))
    expect(spent.spentLevel).toBe(3)
    expect(spendAbilitySpellSlot([ordinary, pact], { [spellSlotTableKey(pact)]: [0, 0, 2] }, 1, true)).toBeNull()
  })
  it("searches beyond an exhausted first table and respects the minimum slot", () => {
    const spent = spendAbilitySpellSlot([ordinary, pact], { [spellSlotTableKey(ordinary)]: [4, 3, 2] }, 2)!
    expect(spent.key).toBe(spellSlotTableKey(pact))
    expect(spent.nextUsed[2]).toBe(1)
    expect(spendAbilitySpellSlot([ordinary, pact], {}, 4)).toBeNull()
  })
  it("does not charge for a full pool or restore without an eligible slot", () => {
    const spend = vi.fn(() => null)
    const conversion = { minSpellLevel: 2, restores: 1 }
    expect(restoreActionWithSpellSlot(conversion, 0, spend).nextUsed).toBe(0)
    expect(spend).not.toHaveBeenCalled()
    expect(restoreActionWithSpellSlot(conversion, 2, spend).nextUsed).toBe(2)
    expect(restoreActionWithSpellSlot(conversion, 2, () => "Spent slot").nextUsed).toBe(1)
  })
})
