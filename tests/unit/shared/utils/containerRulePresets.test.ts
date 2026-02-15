import { type Container, MatchType, type Rule, RuleType } from "@/shared/types"
import {
  buildRuleIdentitySet,
  CONTAINER_RULE_PRESETS,
  createRuleIdentityKey,
  findContainerForPreset,
  getPresetRuleIdentityKeys,
} from "@/shared/utils/containerRulePresets"

describe("containerRulePresets", () => {
  it("defines all requested company presets", () => {
    const presetIds = CONTAINER_RULE_PRESETS.map((preset) => preset.id)

    expect(presetIds).toEqual([
      "facebook",
      "google",
      "discord",
      "amazon",
      "x-twitter",
      "tiktok",
      "youtube",
      "microsoft",
    ])
  })

  it("builds one domain rule per domain", () => {
    const facebookPreset = CONTAINER_RULE_PRESETS.find(
      (preset) => preset.id === "facebook",
    )

    expect(facebookPreset).toBeDefined()
    expect(
      facebookPreset?.rules.some((rule) => rule.pattern === "facebook.com"),
    ).toBe(true)
    expect(
      facebookPreset?.rules.some((rule) => rule.pattern.startsWith("*://")),
    ).toBe(false)
    expect(
      facebookPreset?.rules.every(
        (rule) =>
          rule.matchType === MatchType.DOMAIN &&
          rule.ruleType === RuleType.INCLUDE,
      ),
    ).toBe(true)
    expect(facebookPreset?.rules.length).toBe(facebookPreset?.domains.length)
  })

  it("matches existing preset containers by name", () => {
    const preset = CONTAINER_RULE_PRESETS.find((item) => item.id === "youtube")
    expect(preset).toBeDefined()
    if (!preset) {
      return
    }

    const containers: Container[] = [
      {
        id: "1",
        name: "YouTube",
        icon: "vacation",
        color: "red",
        cookieStoreId: "firefox-container-1",
        created: Date.now(),
        modified: Date.now(),
        temporary: false,
        syncEnabled: true,
      },
    ]

    const matched = findContainerForPreset(containers, preset)
    expect(matched?.cookieStoreId).toBe("firefox-container-1")
  })

  it("normalizes rule identity keys for duplicate checks", () => {
    const first = createRuleIdentityKey({
      pattern: "  *://Example.com/*  ",
      matchType: MatchType.GLOB,
      ruleType: RuleType.INCLUDE,
      containerId: "container-1",
    })

    const second = createRuleIdentityKey({
      pattern: "*://example.com/*",
      matchType: MatchType.GLOB,
      ruleType: RuleType.INCLUDE,
      containerId: "container-1",
    })

    expect(first).toBe(second)
  })

  it("builds identity sets for existing rules", () => {
    const rules: Rule[] = [
      {
        id: "rule-1",
        containerId: "container-1",
        pattern: "*://example.com/*",
        matchType: MatchType.GLOB,
        ruleType: RuleType.INCLUDE,
        priority: 50,
        enabled: true,
        created: Date.now(),
        modified: Date.now(),
        metadata: { source: "user" },
      },
      {
        id: "rule-2",
        containerId: "container-1",
        pattern: "*://*.example.com/*",
        matchType: MatchType.GLOB,
        ruleType: RuleType.INCLUDE,
        priority: 50,
        enabled: true,
        created: Date.now(),
        modified: Date.now(),
        metadata: { source: "user" },
      },
    ]

    const identities = buildRuleIdentitySet(rules)

    expect(identities.size).toBe(2)
    expect(
      identities.has(
        createRuleIdentityKey({
          pattern: "*://example.com/*",
          matchType: MatchType.GLOB,
          ruleType: RuleType.INCLUDE,
          containerId: "container-1",
        }),
      ),
    ).toBe(true)
  })

  it("includes legacy glob identity keys for domain preset rules", () => {
    const keys = getPresetRuleIdentityKeys(
      {
        pattern: "facebook.com",
        matchType: MatchType.DOMAIN,
        ruleType: RuleType.INCLUDE,
      },
      "container-1",
    )

    expect(keys).toContain(
      createRuleIdentityKey({
        pattern: "facebook.com",
        matchType: MatchType.DOMAIN,
        ruleType: RuleType.INCLUDE,
        containerId: "container-1",
      }),
    )
    expect(keys).toContain(
      createRuleIdentityKey({
        pattern: "*://facebook.com/*",
        matchType: MatchType.GLOB,
        ruleType: RuleType.INCLUDE,
        containerId: "container-1",
      }),
    )
    expect(keys).toContain(
      createRuleIdentityKey({
        pattern: "*://*.facebook.com/*",
        matchType: MatchType.GLOB,
        ruleType: RuleType.INCLUDE,
        containerId: "container-1",
      }),
    )
  })
})
