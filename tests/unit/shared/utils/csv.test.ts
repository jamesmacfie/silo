import { type Container, MatchType, type Rule, RuleType } from "@/shared/types"
import {
  exportToCSV as generateCSV,
  parseCSV,
  validateCSVRow,
} from "@/shared/utils/csv"

describe("CSV Utilities", () => {
  const mockContainers: Container[] = [
    {
      id: "container-1",
      name: "Work",
      icon: "briefcase",
      color: "blue",
      cookieStoreId: "firefox-container-1",
      created: Date.now(),
      modified: Date.now(),
      temporary: false,
      syncEnabled: true,
    },
    {
      id: "container-2",
      name: "Personal",
      icon: "gift",
      color: "red",
      cookieStoreId: "firefox-container-2",
      created: Date.now(),
      modified: Date.now(),
      temporary: false,
      syncEnabled: true,
    },
  ]

  const mockRules: Rule[] = [
    {
      id: "rule-1",
      pattern: "github.com",
      containerId: "firefox-container-1",
      matchType: MatchType.DOMAIN,
      ruleType: RuleType.INCLUDE,
      priority: 1,
      enabled: true,
      created: Date.now(),
      modified: Date.now(),
      metadata: {},
    },
    {
      id: "rule-2",
      pattern: "*.example.com",
      containerId: "firefox-container-2",
      matchType: MatchType.GLOB,
      ruleType: RuleType.INCLUDE,
      priority: 2,
      enabled: true,
      created: Date.now(),
      modified: Date.now(),
      metadata: {},
    },
  ]

  describe("generateCSV", () => {
    it("should generate CSV with header", () => {
      const result = generateCSV(mockRules, mockContainers)

      expect(result).toContain(
        "# Format: pattern, container_name, match_type, rule_type, priority, enabled, description",
      )
    })

    it("should generate CSV rows for rules", () => {
      const result = generateCSV(mockRules, mockContainers)

      expect(result).toContain("github.com,Work,domain,include,1,true,")
      expect(result).toContain("*.example.com,Personal,glob,include,2,true,")
    })

    it("should handle rules without containers", () => {
      const rulesWithoutContainer = [
        {
          ...mockRules[0],
          containerId: "non-existent",
        },
      ]

      const result = generateCSV(rulesWithoutContainer, mockContainers)

      expect(result).toContain("github.com,No Container,domain,include,1,true,")
    })

    it("should handle exclude rules without containers", () => {
      const excludeRules: Rule[] = [
        {
          id: "rule-exclude",
          pattern: "public.example.com",
          matchType: MatchType.DOMAIN,
          ruleType: RuleType.EXCLUDE,
          priority: 1,
          enabled: true,
          created: Date.now(),
          modified: Date.now(),
          metadata: {},
        },
      ]

      const result = generateCSV(excludeRules, mockContainers)

      expect(result).toContain("public.example.com,,domain,exclude,1,true")
    })

    it("should escape commas in patterns", () => {
      const rulesWithCommas: Rule[] = [
        {
          ...mockRules[0],
          pattern: "site1.com,site2.com",
        },
      ]

      const result = generateCSV(rulesWithCommas, mockContainers)

      expect(result).toContain('"site1.com,site2.com",Work')
    })

    it("should handle empty rules array", () => {
      const result = generateCSV([], mockContainers)

      expect(result).toContain("# Silo Rules Export")
      expect(result).toContain(
        "pattern,container_name,match_type,rule_type,priority,enabled,description",
      )
      const lines = result
        .split("\n")
        .filter((line) => !line.startsWith("#") && line.trim())
      expect(lines).toHaveLength(1) // Just the header
    })

    it("should sort rules by priority", () => {
      const unsortedRules = [...mockRules].reverse()
      const result = generateCSV(unsortedRules, mockContainers)

      const lines = result
        .split("\n")
        .filter((line) => !line.startsWith("#") && line.trim())
      // Skip the header line
      expect(lines[1]).toContain("*.example.com") // Priority 2 (higher) should come first within same container
      expect(lines[2]).toContain("github.com") // Priority 1 (lower) should come second
    })
  })

  describe("parseCSV", () => {
    it("should parse basic CSV format", () => {
      const csv = `# Domain, Container
github.com,Work
gitlab.com,Personal`

      const result = parseCSV(csv, mockContainers)

      expect(result.rules).toHaveLength(2)
      expect(result.rules[0].pattern).toBe("github.com")
      expect(result.rules[0].containerId).toBe("firefox-container-1")
      expect(result.rules[1].pattern).toBe("gitlab.com")
      expect(result.rules[1].containerId).toBe("firefox-container-2")
    })

    it("should parse extended CSV format with all columns", () => {
      const csv = `# Domain, Container, Match Type, Rule Type, Priority, Enabled
github.com,Work,domain,include,1,true
*.example.com,Personal,glob,exclude,2,false`

      const result = parseCSV(csv, mockContainers)

      expect(result.rules).toHaveLength(2)
      expect(result.rules[0].matchType).toBe(MatchType.DOMAIN)
      expect(result.rules[0].ruleType).toBe(RuleType.INCLUDE)
      expect(result.rules[0].priority).toBe(1)
      expect(result.rules[0].enabled).toBe(true)

      expect(result.rules[1].matchType).toBe(MatchType.GLOB)
      expect(result.rules[1].ruleType).toBe(RuleType.EXCLUDE)
      expect(result.rules[1].priority).toBe(2)
      expect(result.rules[1].enabled).toBe(false)
    })

    it("should skip comment lines", () => {
      const csv = `# This is a comment
# Another comment
github.com,Work
# Inline comment
gitlab.com,Personal`

      const result = parseCSV(csv, mockContainers)

      expect(result.rules).toHaveLength(2)
      // CSV parser now skips comments, doesn't return them
      expect(result.skipped).toBeGreaterThan(0)
    })

    it("should skip empty lines", () => {
      const csv = `github.com,Work

gitlab.com,Personal

`

      const result = parseCSV(csv, mockContainers)

      expect(result.rules).toHaveLength(2)
    })

    it("should handle missing containers", () => {
      const csv = `github.com,Work
gitlab.com,NonExistentContainer
bitbucket.com,Personal`

      const result = parseCSV(csv, mockContainers)

      expect(result.rules).toHaveLength(3) // All rules are created, some without valid containers
      expect(result.warnings).toHaveLength(1)
      expect(result.warnings[0].message).toContain("NonExistentContainer")
      expect(result.missingContainers).toContain("NonExistentContainer")
    })

    it("should create missing containers when requested", () => {
      const csv = `github.com,Work
gitlab.com,NewContainer
bitbucket.com,Personal`

      const result = parseCSV(csv, mockContainers, {
        createMissingContainers: true,
      })

      expect(result.rules).toHaveLength(3)
      expect(result.containersToCreate).toContain("NewContainer")
      expect(result.errors).toHaveLength(0)
    })

    it("should handle quoted fields with commas", () => {
      const csv = `"site1.com,site2.com",Work
"complex, pattern",Personal`

      const result = parseCSV(csv, mockContainers)

      expect(result.rules[0].pattern).toBe("site1.com,site2.com")
      expect(result.rules[1].pattern).toBe("complex, pattern")
    })

    it("should validate patterns", () => {
      const csv = `github.com,Work
invalid[regex,Personal
*.valid.com,Work`

      const result = parseCSV(csv, mockContainers)

      expect(result.rules).toHaveLength(2) // Only valid patterns
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0].message).toContain("invalid[regex")
    })

    it("should handle different line endings", () => {
      const csvWithCRLF = `github.com,Work\r\ngitlab.com,Personal\r\n`
      const csvWithCR = `github.com,Work\rgitlab.com,Personal\r`

      const resultCRLF = parseCSV(csvWithCRLF, mockContainers)
      const resultCR = parseCSV(csvWithCR, mockContainers)

      expect(resultCRLF.rules).toHaveLength(2)
      expect(resultCR.rules).toHaveLength(2)
    })

    it("should handle malformed CSV gracefully", () => {
      const csv = `github.com,Work,extra,field
gitlab.com
bitbucket.com,Personal`

      const result = parseCSV(csv, mockContainers)

      expect(result.rules).toHaveLength(2)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0].message).toContain("gitlab.com")
    })
  })

  describe("validateCSVRow", () => {
    it("should validate correct row format", () => {
      const result = validateCSVRow(["github.com", "Work"], mockContainers)

      expect(result.isValid).toBe(true)
      expect(result.error).toBeUndefined()
    })

    it("should reject empty domain", () => {
      const result = validateCSVRow(["", "Work"], mockContainers)

      expect(result.isValid).toBe(false)
      expect(result.error).toContain("Domain cannot be empty")
    })

    it("should reject invalid domain patterns", () => {
      const invalidPatterns = [
        "invalid[regex",
        "http://",
        "ftp://site.com",
        "javascript:alert(1)",
      ]

      for (const pattern of invalidPatterns) {
        const result = validateCSVRow([pattern, "Work"], mockContainers)
        expect(result.isValid).toBe(false)
        expect(result.error).toContain("Invalid domain pattern")
      }
    })

    it("should accept valid domain patterns", () => {
      const validPatterns = [
        "example.com",
        "*.example.com",
        "sub.example.com",
        "example.com/path",
        "example.com/path/*",
        "!glob-pattern.com",
        "@regex-pattern\\.com",
      ]

      for (const pattern of validPatterns) {
        const result = validateCSVRow([pattern, "Work"], mockContainers)
        expect(result.isValid).toBe(true)
      }
    })

    it("should validate container existence", () => {
      const result = validateCSVRow(
        ["github.com", "NonExistent"],
        mockContainers,
      )

      expect(result.isValid).toBe(false)
      expect(result.error).toContain('Container "NonExistent" does not exist')
    })

    it("should allow empty container for exclude rules", () => {
      const result = validateCSVRow(
        ["github.com", "", "domain", "exclude"],
        mockContainers,
      )

      expect(result.isValid).toBe(true)
    })

    it("should validate match type", () => {
      const validTypes = ["domain", "exact", "glob", "regex"]
      const invalidType = "invalid-type"

      for (const type of validTypes) {
        const result = validateCSVRow(
          ["github.com", "Work", type],
          mockContainers,
        )
        expect(result.isValid).toBe(true)
      }

      const result = validateCSVRow(
        ["github.com", "Work", invalidType],
        mockContainers,
      )
      expect(result.isValid).toBe(false)
      expect(result.error).toContain("Invalid match type")
    })

    it("should validate rule type", () => {
      const validTypes = ["include", "exclude", "restrict"]
      const invalidType = "invalid-rule-type"

      for (const type of validTypes) {
        const result = validateCSVRow(
          ["github.com", "Work", "domain", type],
          mockContainers,
        )
        expect(result.isValid).toBe(true)
      }

      const result = validateCSVRow(
        ["github.com", "Work", "domain", invalidType],
        mockContainers,
      )
      expect(result.isValid).toBe(false)
      expect(result.error).toContain("Invalid rule type")
    })

    it("should validate priority", () => {
      const validPriorities = ["1", "10", "100"]
      const invalidPriorities = ["0", "-1", "abc", "101"]

      for (const priority of validPriorities) {
        const result = validateCSVRow(
          ["github.com", "Work", "domain", "include", priority],
          mockContainers,
        )
        expect(result.isValid).toBe(true)
      }

      for (const priority of invalidPriorities) {
        const result = validateCSVRow(
          ["github.com", "Work", "domain", "include", priority],
          mockContainers,
        )
        expect(result.isValid).toBe(false)
        expect(result.error).toContain(
          "Priority must be a number between 1 and 100",
        )
      }
    })

    it("should validate enabled flag", () => {
      const validFlags = ["true", "false", "1", "0", "yes", "no"]
      const invalidFlag = "maybe"

      for (const flag of validFlags) {
        const result = validateCSVRow(
          ["github.com", "Work", "domain", "include", "1", flag],
          mockContainers,
        )
        expect(result.isValid).toBe(true)
      }

      const result = validateCSVRow(
        ["github.com", "Work", "domain", "include", "1", invalidFlag],
        mockContainers,
      )
      expect(result.isValid).toBe(false)
      expect(result.error).toContain("Enabled flag must be true/false")
    })

    it("should require minimum fields", () => {
      const result = validateCSVRow(["github.com"], mockContainers)

      expect(result.isValid).toBe(false)
      expect(result.error).toContain("Minimum 2 fields required")
    })

    it("should handle too many fields", () => {
      const result = validateCSVRow(
        [
          "github.com",
          "Work",
          "domain",
          "include",
          "1",
          "true",
          "extra",
          "fields",
        ],
        mockContainers,
      )

      expect(result.isValid).toBe(true) // Should ignore extra fields
    })
  })

  describe("edge cases", () => {
    it("should handle very large CSV files", () => {
      const largeCsv = Array.from(
        { length: 1000 },
        (_, i) => `site${i}.com,Work`,
      ).join("\n")

      const result = parseCSV(largeCsv, mockContainers)

      expect(result.rules).toHaveLength(1000)
      expect(result.errors).toHaveLength(0)
    })

    it("should handle Unicode characters in patterns", () => {
      const csv = `测试.com,Work
müller.de,Personal
café.fr,Work`

      const result = parseCSV(csv, mockContainers)

      expect(result.rules).toHaveLength(3)
      expect(result.rules[0].pattern).toBe("测试.com")
      expect(result.rules[1].pattern).toBe("müller.de")
      expect(result.rules[2].pattern).toBe("café.fr")
    })

    it("should handle special CSV characters", () => {
      const csv = `"pattern,with,commas",Work
"pattern""with""quotes",Personal
pattern;with;semicolons,Work`

      const result = parseCSV(csv, mockContainers)

      expect(result.rules[0].pattern).toBe("pattern,with,commas")
      expect(result.rules[1].pattern).toBe('pattern"with"quotes')
      expect(result.rules[2].pattern).toBe("pattern;with;semicolons")
    })

    it("should preserve rule metadata", () => {
      const csv = `# Domain, Container, Match Type, Rule Type, Priority, Enabled
github.com,Work,domain,include,1,true`

      const result = parseCSV(csv, mockContainers, {
        preserveMetadata: true,
        source: "import",
      })

      expect(result.rules[0].metadata.source).toBe("import")
    })
  })
})
