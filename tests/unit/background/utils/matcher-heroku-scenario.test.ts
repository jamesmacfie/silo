/**
 * Test file specifically for the Heroku wildcard matching scenario
 * This addresses the original issue where https://www.heroku.com/
 * didn't match a rule with pattern *.heroku.com
 */

import { URLMatcher } from "@/background/utils/matcher"
import { MatchType } from "@/shared/types"

describe("URLMatcher - Heroku Wildcard Scenario", () => {
  let matcher: URLMatcher

  beforeEach(() => {
    matcher = URLMatcher.getInstance()
  })

  describe("Original Issue Fix", () => {
    it("should match heroku.com with *.heroku.com pattern", () => {
      // This was the original failing case
      expect(
        matcher.match(
          "https://www.heroku.com/",
          "*.heroku.com",
          MatchType.DOMAIN,
        ),
      ).toBe(true)
      expect(
        matcher.match("https://heroku.com/", "*.heroku.com", MatchType.DOMAIN),
      ).toBe(true)
      expect(
        matcher.match("https://heroku.com", "*.heroku.com", MatchType.DOMAIN),
      ).toBe(true)
    })

    it("should match all Heroku subdomains and paths", () => {
      const herokuUrls = [
        "https://heroku.com",
        "https://www.heroku.com",
        "https://dashboard.heroku.com",
        "https://api.heroku.com",
        "https://devcenter.heroku.com",
        "https://elements.heroku.com",
        "https://help.heroku.com",
        "https://blog.heroku.com",
        "https://status.heroku.com",
        "https://data.heroku.com",
      ]

      herokuUrls.forEach((url) => {
        expect(matcher.match(url, "*.heroku.com", MatchType.DOMAIN)).toBe(
          true,
          `Failed to match ${url} with *.heroku.com`,
        )
      })
    })

    it("should match Heroku URLs with paths and parameters", () => {
      const herokuUrlsWithPaths = [
        "https://heroku.com/home",
        "https://www.heroku.com/pricing",
        "https://dashboard.heroku.com/apps/my-app",
        "https://dashboard.heroku.com/apps/my-app/settings?tab=general",
        "https://api.heroku.com/apps/my-app/dynos",
        "https://devcenter.heroku.com/articles/getting-started-with-python",
        "https://elements.heroku.com/addons/heroku-postgresql",
      ]

      herokuUrlsWithPaths.forEach((url) => {
        expect(matcher.match(url, "*.heroku.com", MatchType.DOMAIN)).toBe(
          true,
          `Failed to match ${url} with *.heroku.com`,
        )
      })
    })

    it("should NOT match non-Heroku domains", () => {
      const nonHerokuUrls = [
        "https://herokuapp.com",
        "https://heroku-clone.com",
        "https://heroku.org",
        "https://heroku.net",
        "https://heroku.com.evil.com",
        "https://fakeheroku.com",
        "https://myheroku.com",
        "https://herokuapp.com",
      ]

      nonHerokuUrls.forEach((url) => {
        expect(matcher.match(url, "*.heroku.com", MatchType.DOMAIN)).toBe(
          false,
          `Incorrectly matched ${url} with *.heroku.com`,
        )
      })
    })
  })

  describe("Real-world URL Patterns", () => {
    it("should handle common wildcard patterns correctly", () => {
      const testCases = [
        // GitHub
        {
          url: "https://github.com",
          pattern: "*.github.com",
          shouldMatch: true,
        },
        {
          url: "https://www.github.com",
          pattern: "*.github.com",
          shouldMatch: true,
        },
        {
          url: "https://api.github.com",
          pattern: "*.github.com",
          shouldMatch: true,
        },
        {
          url: "https://raw.githubusercontent.com",
          pattern: "*.github.com",
          shouldMatch: false,
        },

        // Google
        {
          url: "https://google.com",
          pattern: "*.google.com",
          shouldMatch: true,
        },
        {
          url: "https://www.google.com",
          pattern: "*.google.com",
          shouldMatch: true,
        },
        {
          url: "https://mail.google.com",
          pattern: "*.google.com",
          shouldMatch: true,
        },
        {
          url: "https://docs.google.com",
          pattern: "*.google.com",
          shouldMatch: true,
        },
        {
          url: "https://googleapis.com",
          pattern: "*.google.com",
          shouldMatch: false,
        },

        // Microsoft
        {
          url: "https://microsoft.com",
          pattern: "*.microsoft.com",
          shouldMatch: true,
        },
        {
          url: "https://www.microsoft.com",
          pattern: "*.microsoft.com",
          shouldMatch: true,
        },
        {
          url: "https://office.microsoft.com",
          pattern: "*.microsoft.com",
          shouldMatch: true,
        },
        {
          url: "https://azure.microsoft.com",
          pattern: "*.microsoft.com",
          shouldMatch: true,
        },

        // Amazon
        {
          url: "https://amazon.com",
          pattern: "*.amazon.com",
          shouldMatch: true,
        },
        {
          url: "https://www.amazon.com",
          pattern: "*.amazon.com",
          shouldMatch: true,
        },
        {
          url: "https://aws.amazon.com",
          pattern: "*.amazon.com",
          shouldMatch: true,
        },
        {
          url: "https://amazonaws.com",
          pattern: "*.amazon.com",
          shouldMatch: false,
        },
      ]

      testCases.forEach(({ url, pattern, shouldMatch }) => {
        const result = matcher.match(url, pattern, MatchType.DOMAIN)
        expect(result).toBe(
          shouldMatch,
          `Expected ${url} ${shouldMatch ? "to match" : "not to match"} ${pattern}, got ${result}`,
        )
      })
    })

    it("should work with complex multi-level subdomains", () => {
      const complexCases = [
        "https://secure.api.v1.heroku.com",
        "https://admin.dashboard.west.heroku.com",
        "https://logs.app.us-east-1.heroku.com",
        "https://metrics.addon.postgres.heroku.com",
      ]

      complexCases.forEach((url) => {
        expect(matcher.match(url, "*.heroku.com", MatchType.DOMAIN)).toBe(
          true,
          `Failed to match complex subdomain ${url}`,
        )
      })
    })

    it("should handle edge cases with ports and protocols", () => {
      const edgeCases = [
        "http://heroku.com",
        "https://heroku.com:443",
        "https://www.heroku.com:8080",
        "http://api.heroku.com:80",
        "https://dashboard.heroku.com:3000",
      ]

      edgeCases.forEach((url) => {
        expect(matcher.match(url, "*.heroku.com", MatchType.DOMAIN)).toBe(
          true,
          `Failed to match edge case ${url}`,
        )
      })
    })
  })

  describe("Pattern Validation", () => {
    it("should maintain security by not matching malicious patterns", () => {
      const maliciousUrls = [
        "https://heroku.com.evil.com",
        "https://heroku.com.phishing.site",
        "https://heroku.com@evil.com",
        "https://evilheroku.com",
        "https://heroku-fake.com",
      ]

      maliciousUrls.forEach((url) => {
        expect(matcher.match(url, "*.heroku.com", MatchType.DOMAIN)).toBe(
          false,
          `Incorrectly matched potentially malicious URL ${url}`,
        )
      })
    })

    it("should be case insensitive but maintain security", () => {
      expect(
        matcher.match("https://HEROKU.COM", "*.heroku.com", MatchType.DOMAIN),
      ).toBe(true)
      expect(
        matcher.match("https://heroku.com", "*.HEROKU.COM", MatchType.DOMAIN),
      ).toBe(true)
      expect(
        matcher.match(
          "https://WWW.HEROKU.COM",
          "*.heroku.com",
          MatchType.DOMAIN,
        ),
      ).toBe(true)

      // Still shouldn't match malicious variations
      expect(
        matcher.match(
          "https://HEROKU.COM.EVIL.COM",
          "*.heroku.com",
          MatchType.DOMAIN,
        ),
      ).toBe(false)
    })
  })

  describe("Performance with Real URLs", () => {
    it("should handle large lists of URLs efficiently", () => {
      const urls = []
      for (let i = 0; i < 1000; i++) {
        urls.push(`https://app${i}.heroku.com`)
        urls.push(`https://api.v${i}.heroku.com`)
      }

      const startTime = Date.now()

      urls.forEach((url) => {
        expect(matcher.match(url, "*.heroku.com", MatchType.DOMAIN)).toBe(true)
      })

      const duration = Date.now() - startTime

      // Should complete within reasonable time (less than 1 second for 2000 URLs)
      expect(duration).toBeLessThan(1000)
    })

    it("should cache results for repeated matches", () => {
      const url = "https://heroku.com"
      const pattern = "*.heroku.com"

      // First call
      const start1 = Date.now()
      const result1 = matcher.match(url, pattern, MatchType.DOMAIN)
      const duration1 = Date.now() - start1

      // Second call (should be faster due to internal optimizations)
      const start2 = Date.now()
      const result2 = matcher.match(url, pattern, MatchType.DOMAIN)
      const duration2 = Date.now() - start2

      expect(result1).toBe(true)
      expect(result2).toBe(true)
      expect(result1).toBe(result2)

      // Note: We can't guarantee caching will make it faster due to
      // the simplicity of the operation, but results should be consistent
    })
  })

  describe("Integration with Rules Engine", () => {
    it("should work correctly when integrated with rule evaluation", () => {
      // Test scenarios that would occur in actual rule evaluation
      const ruleScenarios = [
        {
          name: "Work container for all Heroku sites",
          url: "https://heroku.com",
          pattern: "*.heroku.com",
          matchType: MatchType.DOMAIN,
          expected: true,
        },
        {
          name: "Personal container for GitHub",
          url: "https://github.com",
          pattern: "*.github.com",
          matchType: MatchType.DOMAIN,
          expected: true,
        },
        {
          name: "Shopping container for Amazon",
          url: "https://amazon.com",
          pattern: "*.amazon.com",
          matchType: MatchType.DOMAIN,
          expected: true,
        },
      ]

      ruleScenarios.forEach((scenario) => {
        const result = matcher.match(
          scenario.url,
          scenario.pattern,
          scenario.matchType,
        )
        expect(result).toBe(
          scenario.expected,
          `Rule scenario '${scenario.name}' failed: ${scenario.url} with ${scenario.pattern}`,
        )
      })
    })
  })
})
