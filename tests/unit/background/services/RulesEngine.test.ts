
import { RulesEngine } from '@/background/services/RulesEngine';
import { StorageService } from '@/background/services/StorageService';
import { Rule, MatchType, RuleType } from '@/shared/types';

// Mock the StorageService
jest.mock('@/background/services/StorageService');

describe('RulesEngine', () => {
  let rulesEngine: RulesEngine;
  let mockStorageService: jest.Mocked<StorageService>;

  beforeEach(() => {
    rulesEngine = RulesEngine.getInstance();
    mockStorageService = StorageService.getInstance() as jest.Mocked<StorageService>;
    jest.clearAllMocks();
  });

  describe('Rule Evaluation', () => {
    const mockRules: Rule[] = [
      {
        id: 'rule-1',
        containerId: 'firefox-container-1',
        pattern: 'github.com',
        matchType: MatchType.DOMAIN,
        ruleType: RuleType.INCLUDE,
        priority: 1,
        enabled: true,
        created: Date.now(),
        modified: Date.now(),
        metadata: { source: 'user' },
      },
      {
        id: 'rule-2',
        containerId: 'firefox-container-2',
        pattern: 'work.example.com',
        matchType: MatchType.DOMAIN,
        ruleType: RuleType.INCLUDE,
        priority: 2,
        enabled: true,
        created: Date.now(),
        modified: Date.now(),
        metadata: { source: 'user' },
      },
    ];

    beforeEach(() => {
      mockStorageService.getRules.mockResolvedValue(mockRules);
      mockStorageService.getPreferences.mockResolvedValue({
        theme: 'auto',
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
      });
    });

    it('should match domain correctly', async () => {
      const result = await rulesEngine.evaluate('https://github.com/user/repo');

      expect(result.action).toBe('redirect');
      expect(result.containerId).toBe('firefox-container-1');
      expect(result.rule?.id).toBe('rule-1');
    });

    it('should handle priority correctly', async () => {
      const result = await rulesEngine.evaluate('https://work.example.com/path');

      // Should match rule-2 which has higher priority
      expect(result.action).toBe('redirect');
      expect(result.containerId).toBe('firefox-container-2');
      expect(result.rule?.id).toBe('rule-2');
    });

    it('should handle no matches', async () => {
      const result = await rulesEngine.evaluate('https://unmatched.com');

      expect(result.action).toBe('open');
      expect(result.reason).toBe('No matching rules found');
    });

    it('should handle same container', async () => {
      const result = await rulesEngine.evaluate(
        'https://github.com',
        'firefox-container-1'
      );

      expect(result.action).toBe('open');
      expect(result.containerId).toBe('firefox-container-1');
    });

    it('should handle exclude rules', async () => {
      const excludeRule: Rule = {
        ...mockRules[0],
        id: 'exclude-rule',
        ruleType: RuleType.EXCLUDE,
        priority: 5, // Higher priority
      };

      mockStorageService.getRules.mockResolvedValue([...mockRules, excludeRule]);

      const result = await rulesEngine.evaluate(
        'https://github.com',
        'firefox-container-1'
      );

      expect(result.action).toBe('exclude');
      expect(result.containerId).toBe('firefox-default');
    });

    it('should handle restrict rules', async () => {
      const restrictRule: Rule = {
        ...mockRules[0],
        id: 'restrict-rule',
        ruleType: RuleType.RESTRICT,
        priority: 10, // Highest priority
      };

      mockStorageService.getRules.mockResolvedValue([...mockRules, restrictRule]);

      const result = await rulesEngine.evaluate(
        'https://github.com',
        'firefox-container-2' // Wrong container
      );

      expect(result.action).toBe('redirect');
      expect(result.containerId).toBe('firefox-container-1');
    });

    it('should apply RESTRICT > EXCLUDE > INCLUDE precedence', async () => {
      const includeRule: Rule = {
        id: 'inc',
        containerId: 'firefox-container-1',
        pattern: 'example.com',
        matchType: MatchType.DOMAIN,
        ruleType: RuleType.INCLUDE,
        priority: 1,
        enabled: true,
        created: Date.now(),
        modified: Date.now(),
        metadata: { source: 'user' },
      };

      const excludeRule: Rule = {
        ...includeRule,
        id: 'exc',
        ruleType: RuleType.EXCLUDE,
        priority: 50,
      };

      const restrictRule: Rule = {
        ...includeRule,
        id: 'res',
        ruleType: RuleType.RESTRICT,
        priority: 100,
      };

      mockStorageService.getRules.mockResolvedValue([includeRule, excludeRule, restrictRule]);

      // Wrong container should be redirected due to RESTRICT taking precedence
      const redirected = await rulesEngine.evaluate('https://example.com/path', 'firefox-container-2');
      expect(redirected.action).toBe('redirect');
      expect(redirected.containerId).toBe('firefox-container-1');

      // No current container: RESTRICT should redirect to required container
      const redirect = await rulesEngine.evaluate('https://example.com/path');
      expect(redirect.action).toBe('redirect');
      expect(redirect.containerId).toBe('firefox-container-1');
    });

    it('should warn about conflicting RESTRICT rules in validation', async () => {
      const r1: Rule = {
        id: 'r1',
        containerId: 'c1',
        pattern: 'conflict.com',
        matchType: MatchType.DOMAIN,
        ruleType: RuleType.RESTRICT,
        priority: 10,
        enabled: true,
        created: Date.now(),
        modified: Date.now(),
        metadata: { source: 'user' },
      };
      const r2: Rule = {
        ...r1,
        id: 'r2',
        containerId: 'c2',
      };

      mockStorageService.getRules.mockResolvedValue([r1, r2]);
      const res = await rulesEngine.validateRules();
      expect(res.valid).toBe(true);
      expect(res.warnings.join('\n')).toMatch(/conflicting RESTRICT rules/i);
    });
  });

  describe('Rule Management', () => {
    it('should add rule correctly', async () => {
      const request = {
        containerId: 'firefox-container-1',
        pattern: 'example.com',
        matchType: MatchType.DOMAIN,
        ruleType: RuleType.INCLUDE,
      };

      const rule = await rulesEngine.addRule(request);

      expect(rule.id).toBeDefined();
      expect(rule.containerId).toBe(request.containerId);
      expect(rule.pattern).toBe(request.pattern);
      expect(rule.enabled).toBe(true);
      expect(mockStorageService.addRule).toHaveBeenCalledWith(rule);
    });

    it('should update rule correctly', async () => {
      const updates = { pattern: 'updated.com' };

      await rulesEngine.updateRule('rule-1', updates);

      expect(mockStorageService.updateRule).toHaveBeenCalledWith('rule-1', updates);
    });

    it('should remove rule correctly', async () => {
      await rulesEngine.removeRule('rule-1');

      expect(mockStorageService.removeRule).toHaveBeenCalledWith('rule-1');
    });
  });

  describe('Pattern Matching', () => {
    const testRule = {
      id: 'test-rule',
      containerId: 'firefox-container-1',
      pattern: '',
      matchType: MatchType.EXACT,
      ruleType: RuleType.INCLUDE,
      priority: 1,
      enabled: true,
      created: Date.now(),
      modified: Date.now(),
      metadata: { source: 'user' },
    };

    beforeEach(() => {
      mockStorageService.getPreferences.mockResolvedValue({
        theme: 'auto',
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
      });
    });

    it('should match exact patterns', async () => {
      const rule = {
        ...testRule,
        pattern: 'https://example.com/path',
        matchType: MatchType.EXACT
      };

      mockStorageService.getRules.mockResolvedValue([rule]);

      const result = await rulesEngine.evaluate('https://example.com/path');
      expect(result.action).toBe('redirect');
    });

    it('should match glob patterns', async () => {
      const rule = {
        ...testRule,
        pattern: 'https://*.github.com/*',
        matchType: MatchType.GLOB
      };

      mockStorageService.getRules.mockResolvedValue([rule]);

      const result = await rulesEngine.evaluate('https://api.github.com/users');
      expect(result.action).toBe('redirect');
    });

    it('should match regex patterns', async () => {
      const rule = {
        ...testRule,
        pattern: 'https://.*\\.example\\.(com|org)',
        matchType: MatchType.REGEX
      };

      mockStorageService.getRules.mockResolvedValue([rule]);

      const result1 = await rulesEngine.evaluate('https://sub.example.com');
      const result2 = await rulesEngine.evaluate('https://test.example.org');

      expect(result1.action).toBe('redirect');
      expect(result2.action).toBe('redirect');
    });

    it('should match domain rules with path prefixes', async () => {
      const rule = {
        ...testRule,
        pattern: 'example.com/admin',
        matchType: MatchType.DOMAIN,
      };

      mockStorageService.getRules.mockResolvedValue([rule]);

      const positive = await rulesEngine.evaluate('https://example.com/admin/tools');
      const negative = await rulesEngine.evaluate('https://example.com/blog');

      expect(positive.action).toBe('redirect');
      expect(negative.action).toBe('open');
    });
  });

  describe('Validation', () => {
    it('should validate rules correctly', async () => {
      const validRules: Rule[] = [
        {
          id: 'valid-rule',
          containerId: 'firefox-container-1',
          pattern: 'example.com',
          matchType: MatchType.DOMAIN,
          ruleType: RuleType.INCLUDE,
          priority: 1,
          enabled: true,
          created: Date.now(),
          modified: Date.now(),
          metadata: { source: 'user' },
        }
      ];

      mockStorageService.getRules.mockResolvedValue(validRules);

      const result = await rulesEngine.validateRules();

      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should detect invalid regex patterns', async () => {
      const invalidRules: Rule[] = [
        {
          id: 'invalid-rule',
          containerId: 'firefox-container-1',
          pattern: '(invalid regex',  // Invalid regex
          matchType: MatchType.REGEX,
          ruleType: RuleType.INCLUDE,
          priority: 1,
          enabled: true,
          created: Date.now(),
          modified: Date.now(),
          metadata: { source: 'user' },
        }
      ];

      mockStorageService.getRules.mockResolvedValue(invalidRules);

      const result = await rulesEngine.validateRules();

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });
});