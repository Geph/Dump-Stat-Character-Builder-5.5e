import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { CompanionStatPanel, type CompanionStatPanelCompanion } from "@/components/character-sheet/companion-stat-panel"
import { SheetRollProvider } from "@/components/character-sheet/sheet-roll-context"
import { TooltipProvider } from "@/components/ui/tooltip"
import { SpellRecipientControls } from "@/components/character-sheet/spell-recipient-controls"

describe("companion UI integration", () => {
  const companion: CompanionStatPanelCompanion = {
    key: "wolf", displayName: "Ash", currentHp: 10, maxHp: 20, ac: 12, proficiencyBonus: 2,
    polymorph: false, polymorphActive: false, activeConditions: [],
    source: { featureName: "Companion", featureLevel: 1, className: "Ranger", classId: "ranger" },
    template: { name: "Wolf", ac: { parts: [] }, hp: { parts: [] }, traits: [], actions: [], abilityScores: { strength: { score: 14, modifier: 2, save: 4 } } },
    actions: [{ name: "Bite", description: "Melee attack", resolvedAttack: { kind: "melee", toHitBonus: 4, damage: [{ formula: "1d6+2", type: "Piercing" }], reach: "5 ft.", range: null } }],
    bonusActions: [], reactions: [], legendaryActions: [],
  }
  // Provider prop types require children even for server-rendered createElement fixtures.
  // eslint-disable-next-line react/no-children-prop
  const render = (row: CompanionStatPanelCompanion) => renderToStaticMarkup(createElement(TooltipProvider, { children: createElement(SheetRollProvider, {
    value: { activeConditions: ["Poisoned"], exhaustionLevel: 0, incapacitated: false, classFeatures: [] },
    children: createElement(CompanionStatPanel, { companion: row, onHpChange: () => {}, onConditionsChange: () => {}, onBuffsChange: () => {} }),
  }) }))

  it("offers saves and all conditions without inheriting the owner's poisoned rolls", () => {
    const html = render(companion)
    expect(html).toContain("Roll Ash STR save")
    expect(html).toContain("Roll Ash STR check")
    expect(html).toContain("Unconscious")
    expect(html).not.toContain(">Dis<")
    expect(render({ ...companion, activeConditions: ["Poisoned"] })).toContain(">Dis<")
  })

  it("renders persistent buff removal and modified armor class", () => {
    const html = render({ ...companion, buffs: [{ id: "shield", label: "Shield", acBonus: 2, remaining: "1 minute", effects: [] }] })
    expect(html).toContain("Remove Shield")
    expect(html).toContain("1 minute")
    expect(html).toContain(">14</p>")
  })

  it("offers companion recipients for healing, but excludes them for self-range spells", () => {
    const props = { spellId: "heal", name: "Heal", description: "The target regains 2d8 hit points.", duration: "Instantaneous", spellLevel: 1, spellcastingMod: 3, modifiers: [], targets: [{ key: "wolf", label: "Ash", currentHp: 10, maxHp: 20 }] }
    expect(renderToStaticMarkup(createElement(SpellRecipientControls, { ...props, selfOnly: false }))).toContain('value="wolf"')
    expect(renderToStaticMarkup(createElement(SpellRecipientControls, { ...props, selfOnly: true }))).not.toContain('value="wolf"')
  })
})
