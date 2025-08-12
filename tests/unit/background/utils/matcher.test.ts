import { URLMatcher } from '@/background/utils/matcher';
import { MatchType } from '@/shared/types';

describe('URLMatcher', () => {
  let matcher: URLMatcher;

  beforeEach(() => {
    matcher = URLMatcher.getInstance();
  });

  describe('URL Parsing', () => {
    it('should parse valid URLs correctly', () => {
      const parsed = matcher.parse('https://example.com:8080/path?query=value#fragment');

      expect(parsed.protocol).toBe('https:');
      expect(parsed.hostname).toBe('example.com');
      expect(parsed.port).toBe('8080');
      expect(parsed.pathname).toBe('/path');
      expect(parsed.search).toBe('?query=value');
      expect(parsed.hash).toBe('#fragment');
    });

    it('should throw error for invalid URLs', () => {
      expect(() => matcher.parse('not-a-url')).toThrow('Invalid URL');
    });
  });

  describe('URL Normalization', () => {
    it('should remove default ports', () => {
      expect(matcher.normalize('https://example.com:443/')).toBe('https://example.com');
      expect(matcher.normalize('http://example.com:80/')).toBe('http://example.com');
    });

    it('should preserve non-default ports', () => {
      expect(matcher.normalize('https://example.com:8080/')).toBe('https://example.com:8080/');
    });

    it('should handle trailing slashes', () => {
      expect(matcher.normalize('https://example.com/')).toBe('https://example.com');
      expect(matcher.normalize('https://example.com/path/')).toBe('https://example.com/path/');
    });
  });

  describe('Domain Extraction', () => {
    it('should extract domain from full URL', () => {
      expect(matcher.extractDomain('https://www.example.com/path')).toBe('www.example.com');
    });

    it('should handle incomplete URLs', () => {
      expect(matcher.extractDomain('example.com/path')).toBe('example.com');
      expect(matcher.extractDomain('www.example.com')).toBe('www.example.com');
    });
  });

  describe('Exact Matching', () => {
    it('should match exact URLs', () => {
      const url = 'https://example.com/path';
      const pattern = 'https://example.com/path';

      expect(matcher.match(url, pattern, MatchType.EXACT)).toBe(true);
    });

    it('should not match different URLs', () => {
      const url = 'https://example.com/path1';
      const pattern = 'https://example.com/path2';

      expect(matcher.match(url, pattern, MatchType.EXACT)).toBe(false);
    });

    it('should normalize before matching', () => {
      const url = 'https://example.com:443/';
      const pattern = 'https://example.com';

      expect(matcher.match(url, pattern, MatchType.EXACT)).toBe(true);
    });
  });

  describe('Domain Matching', () => {
    it('should match exact domains', () => {
      expect(matcher.match('https://example.com/path', 'example.com', MatchType.DOMAIN)).toBe(true);
      expect(matcher.match('http://example.com', 'example.com', MatchType.DOMAIN)).toBe(true);
    });

    it('should match wildcard subdomains', () => {
      expect(matcher.match('https://api.example.com', '*.example.com', MatchType.DOMAIN)).toBe(true);
      expect(matcher.match('https://www.api.example.com', '*.example.com', MatchType.DOMAIN)).toBe(true);
      expect(matcher.match('https://example.com', '*.example.com', MatchType.DOMAIN)).toBe(true);
    });

    it('should match bare domains with subdomains', () => {
      // When pattern is "example.com", it should match both "example.com" and "www.example.com"
      expect(matcher.match('https://example.com', 'example.com', MatchType.DOMAIN)).toBe(true);
      expect(matcher.match('https://www.example.com', 'example.com', MatchType.DOMAIN)).toBe(true);
      expect(matcher.match('https://api.example.com', 'example.com', MatchType.DOMAIN)).toBe(true);
      expect(matcher.match('https://sub.api.example.com', 'example.com', MatchType.DOMAIN)).toBe(true);
    });

    // NEW: Enhanced wildcard matching tests
    describe('Enhanced Wildcard Matching', () => {
      it('should match base domain when pattern has wildcard', () => {
        // This is the key improvement: *.heroku.com should match heroku.com
        expect(matcher.match('https://heroku.com', '*.heroku.com', MatchType.DOMAIN)).toBe(true);
        expect(matcher.match('https://example.com', '*.example.com', MatchType.DOMAIN)).toBe(true);
        expect(matcher.match('https://github.com', '*.github.com', MatchType.DOMAIN)).toBe(true);
      });

      it('should match all subdomain variants with wildcard pattern', () => {
        const pattern = '*.example.com';
        
        // Base domain (new behavior)
        expect(matcher.match('https://example.com', pattern, MatchType.DOMAIN)).toBe(true);
        expect(matcher.match('https://example.com/', pattern, MatchType.DOMAIN)).toBe(true);
        expect(matcher.match('https://example.com/path', pattern, MatchType.DOMAIN)).toBe(true);
        
        // Single level subdomains
        expect(matcher.match('https://www.example.com', pattern, MatchType.DOMAIN)).toBe(true);
        expect(matcher.match('https://api.example.com', pattern, MatchType.DOMAIN)).toBe(true);
        expect(matcher.match('https://blog.example.com', pattern, MatchType.DOMAIN)).toBe(true);
        
        // Multi-level subdomains
        expect(matcher.match('https://api.v1.example.com', pattern, MatchType.DOMAIN)).toBe(true);
        expect(matcher.match('https://secure.admin.example.com', pattern, MatchType.DOMAIN)).toBe(true);
      });

      it('should not match unrelated domains with wildcard', () => {
        const pattern = '*.example.com';
        
        expect(matcher.match('https://example.org', pattern, MatchType.DOMAIN)).toBe(false);
        expect(matcher.match('https://notexample.com', pattern, MatchType.DOMAIN)).toBe(false);
        expect(matcher.match('https://example.com.evil.com', pattern, MatchType.DOMAIN)).toBe(false);
        expect(matcher.match('https://fakeexample.com', pattern, MatchType.DOMAIN)).toBe(false);
      });

      it('should handle common real-world scenarios', () => {
        // Heroku scenario (the original issue)
        expect(matcher.match('https://heroku.com', '*.heroku.com', MatchType.DOMAIN)).toBe(true);
        expect(matcher.match('https://www.heroku.com', '*.heroku.com', MatchType.DOMAIN)).toBe(true);
        expect(matcher.match('https://dashboard.heroku.com', '*.heroku.com', MatchType.DOMAIN)).toBe(true);
        
        // GitHub scenarios
        expect(matcher.match('https://github.com', '*.github.com', MatchType.DOMAIN)).toBe(true);
        expect(matcher.match('https://www.github.com', '*.github.com', MatchType.DOMAIN)).toBe(true);
        expect(matcher.match('https://api.github.com', '*.github.com', MatchType.DOMAIN)).toBe(true);
        expect(matcher.match('https://raw.githubusercontent.com', '*.github.com', MatchType.DOMAIN)).toBe(false);
        
        // Google scenarios
        expect(matcher.match('https://google.com', '*.google.com', MatchType.DOMAIN)).toBe(true);
        expect(matcher.match('https://www.google.com', '*.google.com', MatchType.DOMAIN)).toBe(true);
        expect(matcher.match('https://mail.google.com', '*.google.com', MatchType.DOMAIN)).toBe(true);
        expect(matcher.match('https://docs.google.com', '*.google.com', MatchType.DOMAIN)).toBe(true);
      });

      it('should be case insensitive for wildcard matching', () => {
        expect(matcher.match('https://HEROKU.COM', '*.heroku.com', MatchType.DOMAIN)).toBe(true);
        expect(matcher.match('https://heroku.com', '*.HEROKU.COM', MatchType.DOMAIN)).toBe(true);
        expect(matcher.match('https://WWW.HEROKU.COM', '*.heroku.com', MatchType.DOMAIN)).toBe(true);
        expect(matcher.match('https://API.heroku.com', '*.HEROKU.COM', MatchType.DOMAIN)).toBe(true);
      });

      it('should work with paths in wildcard patterns', () => {
        // Wildcard with specific paths
        expect(matcher.match('https://heroku.com/admin', '*.heroku.com/admin', MatchType.DOMAIN)).toBe(true);
        expect(matcher.match('https://www.heroku.com/admin/users', '*.heroku.com/admin', MatchType.DOMAIN)).toBe(true);
        expect(matcher.match('https://api.heroku.com/admin', '*.heroku.com/admin', MatchType.DOMAIN)).toBe(true);
        
        // Should not match different paths
        expect(matcher.match('https://heroku.com/public', '*.heroku.com/admin', MatchType.DOMAIN)).toBe(false);
        expect(matcher.match('https://www.heroku.com/public', '*.heroku.com/admin', MatchType.DOMAIN)).toBe(false);
      });
    });

    it('should not match different domains', () => {
      expect(matcher.match('https://example.org', 'example.com', MatchType.DOMAIN)).toBe(false);
      expect(matcher.match('https://notexample.com', 'example.com', MatchType.DOMAIN)).toBe(false);
    });

    it('should be case insensitive', () => {
      expect(matcher.match('https://EXAMPLE.COM', 'example.com', MatchType.DOMAIN)).toBe(true);
      expect(matcher.match('https://example.com', 'EXAMPLE.COM', MatchType.DOMAIN)).toBe(true);
    });

    describe('Edge Cases and Integration', () => {
      it('should handle ports correctly with wildcards', () => {
        expect(matcher.match('https://heroku.com:8080', '*.heroku.com', MatchType.DOMAIN)).toBe(true);
        expect(matcher.match('https://www.heroku.com:3000', '*.heroku.com', MatchType.DOMAIN)).toBe(true);
        expect(matcher.match('https://api.heroku.com:443', '*.heroku.com', MatchType.DOMAIN)).toBe(true);
      });

      it('should handle query parameters and fragments with wildcards', () => {
        expect(matcher.match('https://heroku.com?ref=homepage', '*.heroku.com', MatchType.DOMAIN)).toBe(true);
        expect(matcher.match('https://www.heroku.com#section', '*.heroku.com', MatchType.DOMAIN)).toBe(true);
        expect(matcher.match('https://api.heroku.com?token=123&user=456#results', '*.heroku.com', MatchType.DOMAIN)).toBe(true);
      });

      it('should handle complex URLs with wildcards', () => {
        const complexUrls = [
          'https://heroku.com/apps/my-app/settings?tab=general#overview',
          'https://www.heroku.com/products/platform/pricing',
          'https://dashboard.heroku.com/apps/12345/logs?source=app',
          'https://api.heroku.com/v1/apps?limit=100&offset=0',
        ];

        complexUrls.forEach(url => {
          expect(matcher.match(url, '*.heroku.com', MatchType.DOMAIN)).toBe(true);
        });
      });

      it('should distinguish between similar domains', () => {
        // These should NOT match
        expect(matcher.match('https://herokuapp.com', '*.heroku.com', MatchType.DOMAIN)).toBe(false);
        expect(matcher.match('https://heroku-clone.com', '*.heroku.com', MatchType.DOMAIN)).toBe(false);
        expect(matcher.match('https://heroku.com.evil.com', '*.heroku.com', MatchType.DOMAIN)).toBe(false);
        expect(matcher.match('https://fakeheroku.com', '*.heroku.com', MatchType.DOMAIN)).toBe(false);
      });

      it('should handle international domains with wildcards', () => {
        // Punycode domains
        expect(matcher.match('https://xn--nxasmq6b.com', '*.xn--nxasmq6b.com', MatchType.DOMAIN)).toBe(true);
        expect(matcher.match('https://www.xn--nxasmq6b.com', '*.xn--nxasmq6b.com', MatchType.DOMAIN)).toBe(true);
        
        // Unicode domains (should work if browser supports them)
        expect(matcher.match('https://test.münchen.de', '*.münchen.de', MatchType.DOMAIN)).toBe(true);
      });

      it('should preserve original behavior for non-wildcard patterns', () => {
        // Make sure we didn't break existing behavior
        expect(matcher.match('https://example.com', 'example.com', MatchType.DOMAIN)).toBe(true);
        expect(matcher.match('https://www.example.com', 'example.com', MatchType.DOMAIN)).toBe(true);
        expect(matcher.match('https://api.example.com', 'example.com', MatchType.DOMAIN)).toBe(true);
        
        // These should still not match
        expect(matcher.match('https://example.org', 'example.com', MatchType.DOMAIN)).toBe(false);
        expect(matcher.match('https://notexample.com', 'example.com', MatchType.DOMAIN)).toBe(false);
      });
    });

    it('should match domain with path prefix', () => {
      expect(matcher.match('https://example.com/admin/tools', 'example.com/admin', MatchType.DOMAIN)).toBe(true);
      expect(matcher.match('https://example.com/blog', 'example.com/admin', MatchType.DOMAIN)).toBe(false);
    });

    it('should match wildcard subdomain with path prefix', () => {
      expect(matcher.match('https://api.example.com/admin', '*.example.com/admin', MatchType.DOMAIN)).toBe(true);
      expect(matcher.match('https://api.example.com/blog', '*.example.com/admin', MatchType.DOMAIN)).toBe(false);
    });
  });

  describe('Glob Matching', () => {
    it('should match with wildcards', () => {
      expect(matcher.match('https://example.com/path', 'https://*.com/*', MatchType.GLOB)).toBe(true);
      expect(matcher.match('https://api.github.com/users/test', 'https://api.github.com/*', MatchType.GLOB)).toBe(true);
    });

    it('should match with single character wildcards', () => {
      expect(matcher.match('https://example.com', 'https://exampl?.com', MatchType.GLOB)).toBe(true);
      expect(matcher.match('https://example.org', 'https://example.???', MatchType.GLOB)).toBe(true);
    });

    it('should not match when pattern differs', () => {
      expect(matcher.match('https://example.com/path', 'https://example.org/*', MatchType.GLOB)).toBe(false);
    });
  });

  describe('Regex Matching', () => {
    it('should match with regex patterns', () => {
      expect(matcher.match('https://example.com', 'https://.*\\.com', MatchType.REGEX)).toBe(true);
      expect(matcher.match('https://api.github.com', 'https://[a-z]+\\.github\\.com', MatchType.REGEX)).toBe(true);
    });

    it('should be case insensitive', () => {
      expect(matcher.match('https://EXAMPLE.com', 'https://example\\.com', MatchType.REGEX)).toBe(true);
    });

    it('should handle invalid regex gracefully', () => {
      // Silence expected error logs for invalid regex during this test
      const origError = console.error;
      console.error = jest.fn();
      expect(matcher.match('https://example.com', '(invalid regex', MatchType.REGEX)).toBe(false);
      console.error = origError;
    });

    it('should not match when regex differs', () => {
      expect(matcher.match('https://example.org', 'https://.*\\.com$', MatchType.REGEX)).toBe(false);
    });
  });

  describe('URL Validation', () => {
    it('should validate correct URLs', () => {
      expect(matcher.isValid('https://example.com')).toBe(true);
      expect(matcher.isValid('http://localhost:8080')).toBe(true);
      expect(matcher.isValid('ftp://files.example.com')).toBe(true);
    });

    it('should reject invalid URLs', () => {
      expect(matcher.isValid('not-a-url')).toBe(false);
      expect(matcher.isValid('://invalid')).toBe(false);
      expect(matcher.isValid('')).toBe(false);
    });
  });
});