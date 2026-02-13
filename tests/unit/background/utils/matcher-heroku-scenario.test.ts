import * as matcher from "@/background/utils/matcher"
import { MatchType } from "@/shared/types"

describe("matcher heroku wildcard scenario", () => {
  it("matches heroku root and subdomains for *.heroku.com", () => {
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
      matcher.match(
        "https://dashboard.heroku.com/apps",
        "*.heroku.com",
        MatchType.DOMAIN,
      ),
    ).toBe(true)
  })

  it("does not match lookalike domains", () => {
    expect(
      matcher.match(
        "https://heroku.com.evil.com",
        "*.heroku.com",
        MatchType.DOMAIN,
      ),
    ).toBe(false)
    expect(
      matcher.match("https://fakeheroku.com", "*.heroku.com", MatchType.DOMAIN),
    ).toBe(false)
  })

  it("supports http/https and explicit ports", () => {
    expect(
      matcher.match("http://heroku.com:80", "*.heroku.com", MatchType.DOMAIN),
    ).toBe(true)
    expect(
      matcher.match(
        "https://api.heroku.com:443",
        "*.heroku.com",
        MatchType.DOMAIN,
      ),
    ).toBe(true)
  })
})
