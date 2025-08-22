export enum RuleType {
  INCLUDE = "include",
  EXCLUDE = "exclude",
  RESTRICT = "restrict",
}

export enum MatchType {
  EXACT = "exact",
  DOMAIN = "domain",
  GLOB = "glob",
  REGEX = "regex",
}

export interface Rule {
  id: string
  containerId?: string // optional for EXCLUDE rules
  pattern: string
  matchType: MatchType
  ruleType: RuleType
  priority: number
  enabled: boolean
  created: number
  modified: number
  metadata: {
    description?: string
    source?: "user" | "bookmark" | "import"
    tags?: string[]
  }
}

export interface CreateRuleRequest {
  containerId?: string // optional for EXCLUDE rules
  pattern: string
  matchType: MatchType
  ruleType?: RuleType
  priority?: number
  enabled?: boolean
  metadata?: {
    description?: string
    source?: "user" | "bookmark" | "import"
    tags?: string[]
  }
}

export interface EvaluationResult {
  action: "open" | "redirect" | "block" | "exclude"
  containerId?: string
  rule?: Rule
  reason?: string
}
