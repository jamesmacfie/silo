import { type Container, MatchType, type Rule, RuleType } from "@/shared/types"

interface PresetSeed {
  id: string
  label: string
  shortDescription: string
  container: {
    name: string
    color: string
    icon: string
    description: string
  }
  domains: string[]
}

export interface ContainerRulePresetRule {
  id: string
  domain: string
  pattern: string
  matchType: MatchType
  ruleType: RuleType
  priority: number
  description: string
}

export interface ContainerRulePreset {
  id: string
  label: string
  shortDescription: string
  container: {
    name: string
    color: string
    icon: string
    description: string
  }
  domains: string[]
  rules: ContainerRulePresetRule[]
}

const DEFAULT_RULE_PRIORITY = 50

const PRESET_SEEDS: PresetSeed[] = [
  {
    id: "facebook",
    label: "Facebook",
    shortDescription:
      "Meta social and messaging properties including Facebook, Instagram, and Threads.",
    container: {
      name: "Facebook",
      color: "blue",
      icon: "fingerprint",
      description:
        "Preset container for Meta properties like Facebook, Instagram, and Messenger.",
    },
    domains: [
      "facebook.com",
      "fb.com",
      "messenger.com",
      "instagram.com",
      "threads.net",
      "whatsapp.com",
    ],
  },
  {
    id: "google",
    label: "Google",
    shortDescription:
      "Google Search, account surfaces, and common platform domains used by Google services.",
    container: {
      name: "Google",
      color: "red",
      icon: "tree",
      description:
        "Preset container for Google Search, account, and platform service domains.",
    },
    domains: [
      "google.com",
      "gmail.com",
      "g.co",
      "googleapis.com",
      "gstatic.com",
      "googleusercontent.com",
      "googletagmanager.com",
      "doubleclick.net",
    ],
  },
  {
    id: "discord",
    label: "Discord",
    shortDescription:
      "Discord app, invites, CDN, and related domains used by Discord web clients.",
    container: {
      name: "Discord",
      color: "purple",
      icon: "chill",
      description:
        "Preset container for Discord chat, invites, and media delivery domains.",
    },
    domains: ["discord.com", "discord.gg", "discordapp.com", "discord.media"],
  },
  {
    id: "amazon",
    label: "Amazon",
    shortDescription:
      "Amazon retail, AWS, and key consumer properties such as Prime Video and Audible.",
    container: {
      name: "Amazon",
      color: "orange",
      icon: "cart",
      description:
        "Preset container for Amazon retail, AWS, and major consumer properties.",
    },
    domains: [
      "amazon.com",
      "aws.amazon.com",
      "amazonaws.com",
      "primevideo.com",
      "audible.com",
    ],
  },
  {
    id: "x-twitter",
    label: "X / Twitter",
    shortDescription:
      "Core X and legacy Twitter domains including short links and static assets.",
    container: {
      name: "X / Twitter",
      color: "turquoise",
      icon: "fence",
      description:
        "Preset container for X and legacy Twitter domains, short links, and media assets.",
    },
    domains: ["x.com", "twitter.com", "t.co", "twimg.com"],
  },
  {
    id: "tiktok",
    label: "TikTok",
    shortDescription:
      "TikTok app and CDN domains, including legacy musical.ly traffic.",
    container: {
      name: "TikTok",
      color: "pink",
      icon: "gift",
      description:
        "Preset container for TikTok app and supporting media/CDN domains.",
    },
    domains: ["tiktok.com", "tiktokv.com", "tiktokcdn.com", "musical.ly"],
  },
  {
    id: "youtube",
    label: "YouTube",
    shortDescription:
      "YouTube watch and embed domains, short links, and static media assets.",
    container: {
      name: "YouTube",
      color: "red",
      icon: "vacation",
      description:
        "Preset container for YouTube watch, embed, and media delivery domains.",
    },
    domains: ["youtube.com", "youtu.be", "ytimg.com", "youtube-nocookie.com"],
  },
  {
    id: "microsoft",
    label: "Microsoft",
    shortDescription:
      "Microsoft identity, productivity, cloud, and gaming domains used in daily workflows.",
    container: {
      name: "Microsoft",
      color: "green",
      icon: "briefcase",
      description:
        "Preset container for Microsoft identity, productivity, cloud, and gaming domains.",
    },
    domains: [
      "microsoft.com",
      "live.com",
      "outlook.com",
      "office.com",
      "office365.com",
      "onedrive.com",
      "sharepoint.com",
      "teams.microsoft.com",
      "xbox.com",
    ],
  },
]

function makeStableRuleId(value: string): string {
  const normalized = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")

  return normalized || "rule"
}

function buildPresetRules(seed: PresetSeed): ContainerRulePresetRule[] {
  const seenPatterns = new Set<string>()
  const rules: ContainerRulePresetRule[] = []

  for (const domain of seed.domains) {
    const normalizedDomain = domain.trim().toLowerCase()
    if (!normalizedDomain || seenPatterns.has(normalizedDomain)) {
      continue
    }

    seenPatterns.add(normalizedDomain)

    rules.push({
      id: makeStableRuleId(`${seed.id}-${normalizedDomain}`),
      domain: normalizedDomain,
      pattern: normalizedDomain,
      matchType: MatchType.DOMAIN,
      ruleType: RuleType.INCLUDE,
      priority: DEFAULT_RULE_PRIORITY,
      description: `${seed.label} web property (${normalizedDomain})`,
    })
  }

  return rules
}

export const CONTAINER_RULE_PRESETS: ContainerRulePreset[] = PRESET_SEEDS.map(
  (seed) => ({
    ...seed,
    rules: buildPresetRules(seed),
  }),
)

export type RuleIdentity = Pick<
  Rule,
  "pattern" | "matchType" | "ruleType" | "containerId"
>

export function createRuleIdentityKey(rule: RuleIdentity): string {
  const containerId = rule.containerId || ""
  return `${rule.pattern.trim().toLowerCase()}|${rule.matchType}|${rule.ruleType}|${containerId}`
}

export function getPresetRuleIdentityKeys(
  rule: Pick<ContainerRulePresetRule, "pattern" | "matchType" | "ruleType">,
  containerId: string,
): string[] {
  const keys = new Set<string>([
    createRuleIdentityKey({
      pattern: rule.pattern,
      matchType: rule.matchType,
      ruleType: rule.ruleType,
      containerId,
    }),
  ])

  if (rule.matchType !== MatchType.DOMAIN) {
    return Array.from(keys)
  }

  const normalizedPattern = rule.pattern.trim().toLowerCase()
  if (!normalizedPattern) {
    return Array.from(keys)
  }

  const baseDomain = normalizedPattern.startsWith("*.")
    ? normalizedPattern.slice(2)
    : normalizedPattern

  const legacyGlobPatterns = [`*://${baseDomain}/*`, `*://*.${baseDomain}/*`]

  for (const pattern of legacyGlobPatterns) {
    keys.add(
      createRuleIdentityKey({
        pattern,
        matchType: MatchType.GLOB,
        ruleType: rule.ruleType,
        containerId,
      }),
    )
  }

  return Array.from(keys)
}

export function buildRuleIdentitySet(rules: Rule[]): Set<string> {
  const keys = new Set<string>()

  for (const rule of rules) {
    keys.add(createRuleIdentityKey(rule))
  }

  return keys
}

export function findContainerForPreset(
  containers: Container[],
  preset: ContainerRulePreset,
): Container | undefined {
  const presetName = preset.container.name.trim().toLowerCase()
  const presetCategoryMarker = `preset:${preset.id}`

  return containers.find((container) => {
    const byName = container.name.trim().toLowerCase() === presetName
    const byCategory =
      container.metadata?.categories?.includes(presetCategoryMarker) || false

    return byName || byCategory
  })
}
