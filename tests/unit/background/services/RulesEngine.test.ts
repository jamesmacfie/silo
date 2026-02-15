import { RulesEngine } from "@/background/services/RulesEngine"
import storageService from "@/background/services/StorageService"
import * as urlMatcher from "@/background/utils/matcher"
import {
  type CreateRuleRequest,
  MatchType,
  type Rule,
  RuleType,
} from "@/shared/types"

jest.mock("@/background/services/StorageService")
jest.mock("@/background/utils/matcher")
jest.mock("@/shared/utils/logger")

describe("RulesEngine", () => {
  let rulesEngine: RulesEngine
  let mockStorageService: jest.Mocked<typeof storageService>
  let mockUrlMatcher: jest.Mocked<typeof urlMatcher>

  const mockRule: Rule = {
    id: "rule-1",
    containerId: "firefox-container-1",
    pattern: "github.com",
    matchType: MatchType.DOMAIN,
    ruleType: RuleType.INCLUDE,
    priority: 1,
    enabled: true,
    created: 1234567890,
    modified: 1234567890,
    metadata: {
      description: "GitHub rule",
      source: "user",
    },
  }

  const mockPreferences = {
    theme: "auto" as const,
    keepOldTabs: false,
    matchDomainOnly: true,
    syncEnabled: false,
    syncOptions: {
      syncRules: true,
      syncContainers: true,
      syncPreferences: true,
    },
    notifications: {
      showOnRuleMatch: false,
      showOnRestrict: true,
      showOnExclude: false,
    },
    advanced: {
      debugMode: false,
      performanceMode: false,
      cacheTimeout: 60000,
    },
    stats: {
      enabled: true,
      retentionDays: 30,
    },
  }

  beforeEach(() => {
    jest.clearAllMocks()
    jest.useFakeTimers()

    // Reset singleton instance
    ;(RulesEngine as any).instance = null

    mockStorageService = storageService as jest.Mocked<typeof storageService>
    mockUrlMatcher = urlMatcher as jest.Mocked<typeof urlMatcher>

    // Default mock implementations
    mockStorageService.getRules = jest.fn().mockResolvedValue([])
    mockStorageService.getPreferences = jest
      .fn()
      .mockResolvedValue(mockPreferences)
    mockStorageService.addRule = jest.fn().mockResolvedValue(undefined)
    mockStorageService.removeRule = jest.fn().mockResolvedValue(undefined)
    mockStorageService.updateRule = jest.fn().mockResolvedValue(undefined)
    mockStorageService.setRules = jest.fn().mockResolvedValue(undefined)

    mockUrlMatcher.match = jest.fn().mockReturnValue(false)
    mockUrlMatcher.isValid = jest.fn().mockReturnValue(true)

    rulesEngine = new RulesEngine()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  describe("addRule", () => {
    it("should add a basic rule with all properties", async () => {
      const request: CreateRuleRequest = {
        containerId: "firefox-container-1",
        pattern: "example.com",
        matchType: MatchType.DOMAIN,
        ruleType: RuleType.INCLUDE,
        priority: 5,
        enabled: true,
        metadata: {
          description: "Test rule",
          source: "user",
        },
      }

      const result = await rulesEngine.addRule(request)

      expect(result.id).toMatch(/^rule_\d+_[a-z0-9]+$/)
      expect(result.containerId).toBe(request.containerId)
      expect(result.pattern).toBe(request.pattern)
      expect(result.matchType).toBe(request.matchType)
      expect(result.ruleType).toBe(request.ruleType)
      expect(result.priority).toBe(request.priority)
      expect(result.enabled).toBe(true)
      expect(result.metadata).toEqual(request.metadata)
      expect(mockStorageService.addRule).toHaveBeenCalledWith(result)
    })

    it("should use default values when not provided", async () => {
      const request: CreateRuleRequest = {
        pattern: "example.com",
        matchType: MatchType.DOMAIN,
      }

      const result = await rulesEngine.addRule(request)

      expect(result.ruleType).toBe(RuleType.INCLUDE)
      expect(result.priority).toBe(1)
      expect(result.enabled).toBe(true)
      expect(result.metadata.source).toBe("user")
    })

    it("should normalize EXCLUDE rules to have no containerId", async () => {
      const request: CreateRuleRequest = {
        containerId: "should-be-removed",
        pattern: "example.com",
        matchType: MatchType.DOMAIN,
        ruleType: RuleType.EXCLUDE,
      }

      const result = await rulesEngine.addRule(request)

      expect(result.ruleType).toBe(RuleType.EXCLUDE)
      expect(result.containerId).toBeUndefined()
    })

    it("should handle enabled=false explicitly", async () => {
      const request: CreateRuleRequest = {
        pattern: "example.com",
        matchType: MatchType.DOMAIN,
        enabled: false,
      }

      const result = await rulesEngine.addRule(request)

      expect(result.enabled).toBe(false)
    })
  })

  describe("removeRule", () => {
    it("should remove rule", async () => {
      await rulesEngine.removeRule("rule-1")

      expect(mockStorageService.removeRule).toHaveBeenCalledWith("rule-1")
    })
  })

  describe("updateRule", () => {
    it("should update rule", async () => {
      const updates = { pattern: "updated.com", priority: 10 }

      await rulesEngine.updateRule("rule-1", updates)

      expect(mockStorageService.updateRule).toHaveBeenCalledWith(
        "rule-1",
        updates,
      )
    })
  })

  describe("evaluate", () => {
    beforeEach(() => {
      // Mock performance.now for timing tests
      global.performance = { now: jest.fn().mockReturnValue(123.45) } as any
    })

    it('should return "open" when no rules match', async () => {
      mockStorageService.getRules = jest.fn().mockResolvedValue([mockRule])
      mockUrlMatcher.match = jest.fn().mockReturnValue(false)

      const result = await rulesEngine.evaluate("https://unmatched.com")

      expect(result.action).toBe("open")
      expect(result.reason).toBe("No matching rules found")
      expect(result.rule).toBeUndefined()
    })

    it("should redirect to default container when no rules match and default is set", async () => {
      const prefsWithDefault = {
        ...mockPreferences,
        defaultContainer: "firefox-container-default",
      }
      mockStorageService.getPreferences = jest
        .fn()
        .mockResolvedValue(prefsWithDefault)
      mockStorageService.getRules = jest.fn().mockResolvedValue([])

      const result = await rulesEngine.evaluate("https://unmatched.com")

      expect(result.action).toBe("redirect")
      expect(result.containerId).toBe("firefox-container-default")
      expect(result.reason).toBe("Default container assignment")
    })

    it("should not redirect to default container when already in a container", async () => {
      const prefsWithDefault = {
        ...mockPreferences,
        defaultContainer: "firefox-container-default",
      }
      mockStorageService.getPreferences = jest
        .fn()
        .mockResolvedValue(prefsWithDefault)
      mockStorageService.getRules = jest.fn().mockResolvedValue([])

      const result = await rulesEngine.evaluate(
        "https://unmatched.com",
        "firefox-container-1",
      )

      expect(result.action).toBe("open")
      expect(result.reason).toBe("No matching rules found")
    })

    it("should handle INCLUDE rule from default container", async () => {
      mockStorageService.getRules = jest.fn().mockResolvedValue([mockRule])
      mockUrlMatcher.match = jest.fn().mockReturnValue(true)

      const result = await rulesEngine.evaluate("https://github.com")

      expect(result.action).toBe("redirect")
      expect(result.containerId).toBe("firefox-container-1")
      expect(result.rule).toEqual(mockRule)
      expect(result.reason).toBe("Include rule from default context")
    })

    it("should handle INCLUDE rule when already in target container", async () => {
      mockStorageService.getRules = jest.fn().mockResolvedValue([mockRule])
      mockUrlMatcher.match = jest.fn().mockReturnValue(true)

      const result = await rulesEngine.evaluate(
        "https://github.com",
        "firefox-container-1",
      )

      expect(result.action).toBe("open")
      expect(result.containerId).toBe("firefox-container-1")
      expect(result.reason).toBe("Already in correct container")
    })

    it("should handle INCLUDE rule when in different container", async () => {
      mockStorageService.getRules = jest.fn().mockResolvedValue([mockRule])
      mockUrlMatcher.match = jest.fn().mockReturnValue(true)

      const result = await rulesEngine.evaluate(
        "https://github.com",
        "firefox-container-2",
      )

      expect(result.action).toBe("open")
      expect(result.containerId).toBe("firefox-container-2")
      expect(result.reason).toBe(
        "Include rule ignored in non-default container",
      )
    })

    it("should handle EXCLUDE rule from default container", async () => {
      const excludeRule: Rule = {
        ...mockRule,
        ruleType: RuleType.EXCLUDE,
        containerId: undefined,
      }
      mockStorageService.getRules = jest.fn().mockResolvedValue([excludeRule])
      mockUrlMatcher.match = jest.fn().mockReturnValue(true)

      const result = await rulesEngine.evaluate("https://github.com")

      expect(result.action).toBe("open")
      expect(result.containerId).toBe("firefox-default")
      expect(result.reason).toBe("URL excluded from container")
    })

    it("should handle EXCLUDE rule from container", async () => {
      const excludeRule: Rule = {
        ...mockRule,
        ruleType: RuleType.EXCLUDE,
        containerId: undefined,
      }
      mockStorageService.getRules = jest.fn().mockResolvedValue([excludeRule])
      mockUrlMatcher.match = jest.fn().mockReturnValue(true)

      const result = await rulesEngine.evaluate(
        "https://github.com",
        "firefox-container-1",
      )

      expect(result.action).toBe("exclude")
      expect(result.containerId).toBe("firefox-default")
      expect(result.reason).toBe("URL excluded from container")
    })

    it("should handle RESTRICT rule when in wrong container", async () => {
      const restrictRule: Rule = {
        ...mockRule,
        ruleType: RuleType.RESTRICT,
      }
      mockStorageService.getRules = jest.fn().mockResolvedValue([restrictRule])
      mockUrlMatcher.match = jest.fn().mockReturnValue(true)

      const result = await rulesEngine.evaluate(
        "https://github.com",
        "firefox-container-2",
      )

      expect(result.action).toBe("redirect")
      expect(result.containerId).toBe("firefox-container-1")
      expect(result.reason).toBe("Restricted to required container")
    })

    it("should handle RESTRICT rule when in correct container", async () => {
      const restrictRule: Rule = {
        ...mockRule,
        ruleType: RuleType.RESTRICT,
      }
      mockStorageService.getRules = jest.fn().mockResolvedValue([restrictRule])
      mockUrlMatcher.match = jest.fn().mockReturnValue(true)

      const result = await rulesEngine.evaluate(
        "https://github.com",
        "firefox-container-1",
      )

      expect(result.action).toBe("open")
      expect(result.containerId).toBe("firefox-container-1")
      expect(result.reason).toBe("Already in required container (restrict)")
    })

    it("should apply rule type precedence: RESTRICT > EXCLUDE > INCLUDE", async () => {
      const includeRule: Rule = {
        ...mockRule,
        id: "include",
        ruleType: RuleType.INCLUDE,
        priority: 100,
      }
      const excludeRule: Rule = {
        ...mockRule,
        id: "exclude",
        ruleType: RuleType.EXCLUDE,
        priority: 50,
        containerId: undefined,
      }
      const restrictRule: Rule = {
        ...mockRule,
        id: "restrict",
        ruleType: RuleType.RESTRICT,
        priority: 10,
      }

      mockStorageService.getRules = jest
        .fn()
        .mockResolvedValue([includeRule, excludeRule, restrictRule])
      mockUrlMatcher.match = jest.fn().mockReturnValue(true)

      const result = await rulesEngine.evaluate(
        "https://github.com",
        "firefox-container-2",
      )

      // RESTRICT should take precedence despite lower priority
      expect(result.rule?.id).toBe("restrict")
      expect(result.action).toBe("redirect")
      expect(result.containerId).toBe("firefox-container-1")
    })

    it("should apply priority within same rule type", async () => {
      const lowPriorityRule: Rule = {
        ...mockRule,
        id: "low",
        priority: 1,
        containerId: "firefox-container-low",
      }
      const highPriorityRule: Rule = {
        ...mockRule,
        id: "high",
        priority: 10,
        containerId: "firefox-container-high",
      }

      mockStorageService.getRules = jest
        .fn()
        .mockResolvedValue([lowPriorityRule, highPriorityRule])
      mockUrlMatcher.match = jest.fn().mockReturnValue(true)

      const result = await rulesEngine.evaluate("https://github.com")

      expect(result.rule?.id).toBe("high")
      expect(result.containerId).toBe("firefox-container-high")
    })

    it("should skip disabled rules", async () => {
      const disabledRule: Rule = {
        ...mockRule,
        enabled: false,
      }
      mockStorageService.getRules = jest.fn().mockResolvedValue([disabledRule])

      const result = await rulesEngine.evaluate("https://github.com")

      expect(result.action).toBe("open")
      expect(result.reason).toBe("No matching rules found")
    })

    it("should handle different match types", async () => {
      const exactRule: Rule = { ...mockRule, matchType: MatchType.EXACT }
      const domainRule: Rule = { ...mockRule, matchType: MatchType.DOMAIN }
      const globRule: Rule = { ...mockRule, matchType: MatchType.GLOB }
      const regexRule: Rule = { ...mockRule, matchType: MatchType.REGEX }

      mockStorageService.getRules = jest
        .fn()
        .mockResolvedValue([exactRule, domainRule, globRule, regexRule])
      mockUrlMatcher.match = jest.fn().mockReturnValue(true)

      await rulesEngine.evaluate("https://github.com")

      expect(mockUrlMatcher.match).toHaveBeenCalledWith(
        "https://github.com",
        "github.com",
        MatchType.EXACT,
      )
      expect(mockUrlMatcher.match).toHaveBeenCalledWith(
        "https://github.com",
        "github.com",
        MatchType.DOMAIN,
      )
      expect(mockUrlMatcher.match).toHaveBeenCalledWith(
        "https://github.com",
        "github.com",
        MatchType.GLOB,
      )
      expect(mockUrlMatcher.match).toHaveBeenCalledWith(
        "https://github.com",
        "github.com",
        MatchType.REGEX,
      )
    })
  })

  describe("importRules", () => {
    it("should import valid rules", async () => {
      const rules: Rule[] = [mockRule]

      await rulesEngine.importRules(rules)

      expect(mockStorageService.setRules).toHaveBeenCalledWith(rules)
    })

    it("should reject invalid rules", async () => {
      const invalidRules: Rule[] = [
        {
          ...mockRule,
          pattern: "",
          matchType: MatchType.GLOB,
        },
      ]

      await expect(rulesEngine.importRules(invalidRules)).rejects.toThrow(
        "Invalid rules",
      )
    })
  })

  describe("exportRules", () => {
    it("should export all rules", async () => {
      const rules = [mockRule]
      mockStorageService.getRules = jest.fn().mockResolvedValue(rules)

      const result = await rulesEngine.exportRules()

      expect(result).toEqual(rules)
      expect(mockStorageService.getRules).toHaveBeenCalled()
    })
  })

  describe("validateRules", () => {
    it("should return valid for good rules", async () => {
      mockStorageService.getRules = jest.fn().mockResolvedValue([mockRule])

      const result = await rulesEngine.validateRules()

      expect(result.valid).toBe(true)
      expect(result.errors).toEqual([])
      expect(result.warnings).toEqual([])
    })

    it("should detect invalid regex patterns", async () => {
      const invalidRule: Rule = {
        ...mockRule,
        pattern: "(unclosed group",
        matchType: MatchType.REGEX,
      }
      mockStorageService.getRules = jest.fn().mockResolvedValue([invalidRule])

      const result = await rulesEngine.validateRules()

      expect(result.valid).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
      expect(result.errors[0]).toContain("Invalid regex pattern")
    })

    it("should detect empty glob patterns", async () => {
      const invalidRule: Rule = {
        ...mockRule,
        pattern: "",
        matchType: MatchType.GLOB,
      }
      mockStorageService.getRules = jest.fn().mockResolvedValue([invalidRule])

      const result = await rulesEngine.validateRules()

      expect(result.valid).toBe(false)
      expect(result.errors[0]).toContain("Glob pattern cannot be empty")
    })

    it("should warn about domain patterns with protocols", async () => {
      const warningRule: Rule = {
        ...mockRule,
        pattern: "https://example.com",
        matchType: MatchType.DOMAIN,
      }
      mockStorageService.getRules = jest.fn().mockResolvedValue([warningRule])

      const result = await rulesEngine.validateRules()

      expect(result.valid).toBe(true)
      expect(result.warnings.length).toBeGreaterThan(0)
      expect(result.warnings[0]).toContain("should not include protocol")
    })

    it("should warn about invalid exact URLs", async () => {
      const warningRule: Rule = {
        ...mockRule,
        pattern: "not-a-url",
        matchType: MatchType.EXACT,
      }
      mockStorageService.getRules = jest.fn().mockResolvedValue([warningRule])
      mockUrlMatcher.isValid = jest.fn().mockReturnValue(false)

      const result = await rulesEngine.validateRules()

      expect(result.warnings.length).toBeGreaterThan(0)
      expect(result.warnings[0]).toContain("should be a valid URL")
    })

    it("should warn about priority out of range", async () => {
      const warningRule: Rule = {
        ...mockRule,
        priority: 150,
      }
      mockStorageService.getRules = jest.fn().mockResolvedValue([warningRule])

      const result = await rulesEngine.validateRules()

      expect(result.warnings.length).toBeGreaterThan(0)
      expect(result.warnings[0]).toContain(
        "Priority should be between 0 and 100",
      )
    })

    it("should warn about conflicting RESTRICT rules", async () => {
      const rule1: Rule = {
        ...mockRule,
        id: "rule1",
        ruleType: RuleType.RESTRICT,
        containerId: "container1",
        pattern: "conflict.com",
      }
      const rule2: Rule = {
        ...mockRule,
        id: "rule2",
        ruleType: RuleType.RESTRICT,
        containerId: "container2",
        pattern: "conflict.com",
      }
      mockStorageService.getRules = jest.fn().mockResolvedValue([rule1, rule2])

      const result = await rulesEngine.validateRules()

      expect(result.warnings.length).toBeGreaterThan(0)
      expect(result.warnings[0]).toContain("conflicting RESTRICT rules")
    })
  })

  describe("error handling", () => {
    it("should handle storage errors in evaluate", async () => {
      mockStorageService.getRules = jest
        .fn()
        .mockRejectedValue(new Error("Storage error"))

      await expect(rulesEngine.evaluate("https://example.com")).rejects.toThrow(
        "Storage error",
      )
    })

    it("should handle storage errors in addRule", async () => {
      mockStorageService.addRule = jest
        .fn()
        .mockRejectedValue(new Error("Storage error"))

      const request: CreateRuleRequest = {
        pattern: "example.com",
        matchType: MatchType.DOMAIN,
      }

      await expect(rulesEngine.addRule(request)).rejects.toThrow(
        "Storage error",
      )
    })

    it("should handle storage errors in removeRule", async () => {
      mockStorageService.removeRule = jest
        .fn()
        .mockRejectedValue(new Error("Storage error"))

      await expect(rulesEngine.removeRule("rule-1")).rejects.toThrow(
        "Storage error",
      )
    })

    it("should handle storage errors in updateRule", async () => {
      mockStorageService.updateRule = jest
        .fn()
        .mockRejectedValue(new Error("Storage error"))

      await expect(rulesEngine.updateRule("rule-1", {})).rejects.toThrow(
        "Storage error",
      )
    })
  })

  describe("performance", () => {
    beforeEach(() => {
      global.performance = {
        now: jest
          .fn()
          .mockReturnValueOnce(0) // Start time
          .mockReturnValueOnce(5.5), // End time
      } as any
    })

    it("should measure evaluation performance", async () => {
      mockStorageService.getRules = jest.fn().mockResolvedValue([mockRule])
      mockUrlMatcher.match = jest.fn().mockReturnValue(true)

      await rulesEngine.evaluate("https://github.com")

      expect(performance.now).toHaveBeenCalledTimes(2)
    })

    it("should handle large numbers of rules efficiently", async () => {
      const manyRules = Array.from({ length: 1000 }, (_, i) => ({
        ...mockRule,
        id: `rule-${i}`,
        pattern: `example${i}.com`,
      }))

      mockStorageService.getRules = jest.fn().mockResolvedValue(manyRules)
      mockUrlMatcher.match = jest.fn().mockReturnValue(false)

      const start = Date.now()
      await rulesEngine.evaluate("https://unmatched.com")
      const duration = Date.now() - start

      // Should complete within reasonable time (this is a loose check)
      expect(duration).toBeLessThan(1000)
    })
  })

  describe("edge cases", () => {
    it("should handle empty rule list", async () => {
      mockStorageService.getRules = jest.fn().mockResolvedValue([])

      const result = await rulesEngine.evaluate("https://example.com")

      expect(result.action).toBe("open")
      expect(result.reason).toBe("No matching rules found")
    })

    it("should handle rules with missing metadata", async () => {
      const ruleWithoutMetadata: Rule = {
        ...mockRule,
        metadata: {},
      }

      mockStorageService.getRules = jest
        .fn()
        .mockResolvedValue([ruleWithoutMetadata])
      mockUrlMatcher.match = jest.fn().mockReturnValue(true)

      const result = await rulesEngine.evaluate("https://github.com")

      expect(result.action).toBe("redirect")
    })

    it("should handle undefined containerId in rules", async () => {
      const ruleWithoutContainer: Rule = {
        ...mockRule,
        containerId: undefined,
        ruleType: RuleType.EXCLUDE,
      }

      mockStorageService.getRules = jest
        .fn()
        .mockResolvedValue([ruleWithoutContainer])
      mockUrlMatcher.match = jest.fn().mockReturnValue(true)

      const result = await rulesEngine.evaluate(
        "https://github.com",
        "firefox-container-1",
      )

      expect(result.action).toBe("exclude")
    })
  })
})
