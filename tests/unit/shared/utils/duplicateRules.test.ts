import {
  findDuplicateRules,
  getDuplicateCount,
  suggestRulesToKeep,
} from "@/shared/utils/duplicateRules"
import { RuleType, MatchType, type Rule } from "@/shared/types/rule"

// Mock rules for testing
const createMockRule = (overrides: Partial<Rule> = {}): Rule => ({
  id: Math.random().toString(36),
  pattern: "example.com",
  matchType: MatchType.DOMAIN,
  ruleType: RuleType.INCLUDE,
  priority: 1,
  enabled: true,
  created: Date.now(),
  modified: Date.now(),
  containerId: "container-1",
  metadata: {
    description: "Test rule",
    source: "user" as const,
  },
  ...overrides,
})

describe("duplicateRules", () => {
  describe("findDuplicateRules", () => {
    it("should find no duplicates when all rules are unique", () => {
      const rules = [
        createMockRule({ pattern: "example.com" }),
        createMockRule({ pattern: "test.com" }),
        createMockRule({ pattern: "different.com" }),
      ]

      const duplicates = findDuplicateRules(rules)
      expect(duplicates).toHaveLength(0)
    })

    it("should identify duplicate rules with same pattern, matchType, ruleType, and containerId", () => {
      const rules = [
        createMockRule({ id: "1", pattern: "example.com", priority: 1 }),
        createMockRule({ id: "2", pattern: "example.com", priority: 2 }),
        createMockRule({ id: "3", pattern: "different.com" }),
      ]

      const duplicates = findDuplicateRules(rules)
      expect(duplicates).toHaveLength(1)
      expect(duplicates[0].rules).toHaveLength(2)
      expect(duplicates[0].pattern).toBe("example.com")
    })

    it("should not consider rules with different containers as duplicates", () => {
      const rules = [
        createMockRule({ pattern: "example.com", containerId: "container-1" }),
        createMockRule({ pattern: "example.com", containerId: "container-2" }),
      ]

      const duplicates = findDuplicateRules(rules)
      expect(duplicates).toHaveLength(0)
    })

    it("should not consider rules with different rule types as duplicates", () => {
      const rules = [
        createMockRule({ pattern: "example.com", ruleType: RuleType.INCLUDE }),
        createMockRule({ pattern: "example.com", ruleType: RuleType.EXCLUDE }),
      ]

      const duplicates = findDuplicateRules(rules)
      expect(duplicates).toHaveLength(0)
    })

    it("should normalize pattern case when detecting duplicates", () => {
      const rules = [
        createMockRule({ pattern: "Example.com" }),
        createMockRule({ pattern: "example.com" }),
        createMockRule({ pattern: "EXAMPLE.COM" }),
      ]

      const duplicates = findDuplicateRules(rules)
      expect(duplicates).toHaveLength(1)
      expect(duplicates[0].rules).toHaveLength(3)
    })
  })

  describe("getDuplicateCount", () => {
    it("should return 0 when no duplicates exist", () => {
      const rules = [
        createMockRule({ pattern: "example.com" }),
        createMockRule({ pattern: "test.com" }),
      ]

      const count = getDuplicateCount(rules)
      expect(count).toBe(0)
    })

    it("should return correct count of duplicate rules (excluding one to keep from each group)", () => {
      const rules = [
        // Group 1: 3 duplicates = 2 to remove
        createMockRule({ pattern: "example.com" }),
        createMockRule({ pattern: "example.com" }),
        createMockRule({ pattern: "example.com" }),
        // Group 2: 2 duplicates = 1 to remove
        createMockRule({ pattern: "test.com" }),
        createMockRule({ pattern: "test.com" }),
        // Unique rule
        createMockRule({ pattern: "unique.com" }),
      ]

      const count = getDuplicateCount(rules)
      expect(count).toBe(3) // 2 + 1 = 3 duplicates to remove
    })
  })

  describe("suggestRulesToKeep", () => {
    it("should suggest keeping rule with highest priority", () => {
      const rules = [
        createMockRule({
          id: "1",
          pattern: "example.com",
          priority: 1,
          created: 1000,
        }),
        createMockRule({
          id: "2",
          pattern: "example.com",
          priority: 5,
          created: 2000,
        }),
        createMockRule({
          id: "3",
          pattern: "example.com",
          priority: 3,
          created: 3000,
        }),
      ]

      const duplicates = findDuplicateRules(rules)
      const { keep, remove } = suggestRulesToKeep(duplicates)

      expect(keep).toHaveLength(1)
      expect(keep[0].id).toBe("2") // Highest priority
      expect(remove).toHaveLength(2)
      expect(remove.map((r) => r.id)).toEqual(
        expect.arrayContaining(["1", "3"]),
      )
    })

    it("should suggest keeping most recently modified when priorities are equal", () => {
      const rules = [
        createMockRule({
          id: "1",
          pattern: "example.com",
          priority: 1,
          modified: 1000,
        }),
        createMockRule({
          id: "2",
          pattern: "example.com",
          priority: 1,
          modified: 3000,
        }),
        createMockRule({
          id: "3",
          pattern: "example.com",
          priority: 1,
          modified: 2000,
        }),
      ]

      const duplicates = findDuplicateRules(rules)
      const { keep, remove } = suggestRulesToKeep(duplicates)

      expect(keep).toHaveLength(1)
      expect(keep[0].id).toBe("2") // Most recently modified
      expect(remove).toHaveLength(2)
    })
  })
})
