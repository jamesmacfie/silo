import type { Rule, CreateRuleRequest, EvaluationResult, ValidationResult } from '@/shared/types';
import { RuleType, MatchType } from '@/shared/types';
import storageService from './StorageService';
import urlMatcher from '../utils/matcher';
import { logger } from '@/shared/utils/logger';

interface RuleCache {
  url: string;
  result: EvaluationResult;
  timestamp: number;
}

export class RulesEngine {
  private static instance: RulesEngine | null = null;
  private storage = storageService;
  private matcher = urlMatcher;
  private cache = new Map<string, RuleCache>();
  private readonly CACHE_TTL = 60000; // 1 minute
  private readonly MAX_CACHE_SIZE = 1000;
  private log = logger.withContext('RulesEngine');

  private constructor() { }

  static getInstance(): RulesEngine {
    if (!this.instance) {
      this.instance = new RulesEngine();
    }
    return this.instance;
  }

  async addRule(request: CreateRuleRequest): Promise<Rule> {
    this.log.info('Adding rule', request);

    const normalizedRuleType = request.ruleType || RuleType.INCLUDE;
    const normalizedContainerId = normalizedRuleType === RuleType.EXCLUDE ? undefined : (request.containerId || undefined);

    const rule: Rule = {
      id: this.generateRuleId(),
      containerId: normalizedContainerId,
      pattern: request.pattern,
      matchType: request.matchType,
      ruleType: normalizedRuleType,
      priority: request.priority || 1,
      enabled: request.enabled !== false, // default true
      created: Date.now(),
      modified: Date.now(),
      metadata: {
        description: request.metadata?.description,
        source: request.metadata?.source || 'user',
        tags: request.metadata?.tags || [],
      },
    };

    await this.storage.addRule(rule);
    this.invalidateCache();

    this.log.info('Rule added successfully', rule);
    return rule;
  }

  async removeRule(id: string): Promise<void> {
    this.log.info('Removing rule', { id });

    await this.storage.removeRule(id);
    this.invalidateCache();

    this.log.info('Rule removed successfully', { id });
  }

  async updateRule(id: string, updates: Partial<Rule>): Promise<void> {
    this.log.info('Updating rule', { id, updates });

    await this.storage.updateRule(id, updates);
    this.invalidateCache();

    this.log.info('Rule updated successfully', { id });
  }

  async evaluate(url: string, currentContainer?: string): Promise<EvaluationResult> {
    this.log.debug('Starting rule evaluation', { url, currentContainer });
    
    // Load rules to build a cache signature tied to rule changes
    const allRules = await this.storage.getRules();
    const enabledRules = allRules.filter(r => r.enabled);
    
    this.log.debug('Rules loaded', { 
      totalRules: allRules.length, 
      enabledRules: enabledRules.length,
      rules: enabledRules.map(r => ({ id: r.id, pattern: r.pattern, type: r.ruleType, matchType: r.matchType, containerId: r.containerId }))
    });
    
    const lastModified = enabledRules.length > 0 ? Math.max(...enabledRules.map(r => r.modified || 0)) : 0;
    const cacheKey = `${url}:${currentContainer || ''}:${lastModified}:${enabledRules.length}`;

    // Check cache first (now rules-aware)
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      this.log.debug('Returning cached result', { url, result: cached.result });
      return cached.result;
    }

    const startTime = performance.now();
    const result = await this.performEvaluation(url, currentContainer, enabledRules);
    const duration = performance.now() - startTime;

    this.log.debug('Rule evaluation completed', {
      url,
      currentContainer,
      result,
      duration: `${duration.toFixed(2)}ms`
    });

    // Cache the result
    this.setCache(cacheKey, result);

    return result;
  }

  private async performEvaluation(url: string, currentContainer: string | undefined, enabledRules: Rule[]): Promise<EvaluationResult> {

    // Find matching rules (we'll apply type precedence explicitly)
    const matchingRules = enabledRules.filter(rule =>
      this.matcher.match(url, rule.pattern, rule.matchType)
    );

    if (matchingRules.length === 0) {
      // No matching rules - check if there's a default container
      const preferences = await this.storage.getPreferences();
      if (preferences.defaultContainer) {
        const isDefault = !currentContainer || currentContainer === 'firefox-default';
        if (isDefault) {
          return {
            action: 'redirect',
            containerId: preferences.defaultContainer,
            reason: 'Default container assignment',
          };
        }
      }

      return {
        action: 'open',
        reason: 'No matching rules found',
      };
    }

    // Process rules by type precedence regardless of original order
    const byType = {
      restrict: [] as Rule[],
      exclude: [] as Rule[],
      include: [] as Rule[],
    };
    for (const r of matchingRules) {
      byType[r.ruleType].push(r);
    }
    const order: Rule[][] = [
      byType.restrict.sort((a, b) => b.priority - a.priority),
      byType.exclude.sort((a, b) => b.priority - a.priority),
      byType.include.sort((a, b) => b.priority - a.priority),
    ];

    for (const group of order) for (const rule of group) {
      switch (rule.ruleType) {
        case 'restrict':
          // RESTRICT rules: Always enforce opening in the required container
          if (currentContainer === rule.containerId) {
            return {
              action: 'open',
              containerId: rule.containerId,
              rule,
              reason: 'Already in required container (restrict)',
            };
          }
          return {
            action: 'redirect',
            containerId: rule.containerId,
            rule,
            reason: 'Restricted to required container',
          };

        case 'exclude':
          // EXCLUDE rules: Break out of container. Treat missing container as default.
          const isDefault = !currentContainer || currentContainer === 'firefox-default';
          return {
            action: isDefault ? 'open' : 'exclude',
            containerId: 'firefox-default',
            rule,
            reason: 'URL excluded from container',
          };

        case 'include':
          // INCLUDE rules: Only redirect when in the default/non-container. If in a different
          // container, keep as-is unless a RESTRICT rule dictates otherwise.
          if (currentContainer === rule.containerId) {
            return {
              action: 'open',
              containerId: rule.containerId,
              rule,
              reason: 'Already in correct container',
            };
          }
          if (!currentContainer || currentContainer === 'firefox-default') {
            return {
              action: 'redirect',
              containerId: rule.containerId,
              rule,
              reason: 'Include rule from default context',
            };
          }
          // Different container: do nothing; allow request
          return {
            action: 'open',
            containerId: currentContainer,
            rule,
            reason: 'Include rule ignored in non-default container',
          };
      }
    }

    // If we get here, no rules triggered an action
    return {
      action: 'open',
      reason: 'No applicable rules',
    };
  }

  async importRules(rules: Rule[]): Promise<void> {
    this.log.info('Importing rules', { count: rules.length });

    const validationResult = this.validateRulesInternal(rules);
    if (!validationResult.valid) {
      throw new Error(`Invalid rules: ${validationResult.errors.join(', ')}`);
    }

    await this.storage.setRules(rules);
    this.invalidateCache();

    this.log.info('Rules imported successfully');
  }

  async exportRules(): Promise<Rule[]> {
    const rules = await this.storage.getRules();
    this.log.info('Exporting rules', { count: rules.length });
    return rules;
  }

  async validateRules(): Promise<ValidationResult> {
    const rules = await this.storage.getRules();
    return this.validateRulesInternal(rules);
  }

  private validateRulesInternal(rules: Rule[]): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    rules.forEach((rule, index) => {
      // Validate pattern based on match type
      try {
        switch (rule.matchType) {
          case MatchType.REGEX:
            new RegExp(rule.pattern);
            break;
          case MatchType.DOMAIN:
            // Allow domain rules with path prefixes for path-specific domain matching
            // But disallow protocols to avoid ambiguity
            if (rule.pattern?.includes('://')) {
              warnings.push(`Rule ${index}: Domain patterns should not include protocol`);
            }
            break;
          case MatchType.EXACT:
            if (!this.matcher.isValid(rule.pattern) && !rule.pattern.startsWith('*')) {
              warnings.push(`Rule ${index}: Exact pattern should be a valid URL`);
            }
            break;
          case MatchType.GLOB:
            // Basic glob sanity: should not be an empty pattern
            if (!rule.pattern || rule.pattern.trim().length === 0) {
              errors.push(`Rule ${index}: Glob pattern cannot be empty`);
            }
            break;
        }
      } catch {
        errors.push(`Rule ${index}: Invalid ${rule.matchType} pattern: ${rule.pattern}`);
      }

      // Validate priority
      if (rule.priority < 0 || rule.priority > 100) {
        warnings.push(`Rule ${index}: Priority should be between 0 and 100`);
      }
    });

    // Check for conflicting RESTRICT rules
    const restrictRules = rules.filter(rule => rule.ruleType === 'restrict' && rule.enabled);
    const patternContainers = new Map<string, string[]>();

    restrictRules.forEach(rule => {
      if (!patternContainers.has(rule.pattern)) {
        patternContainers.set(rule.pattern, []);
      }
      const list = patternContainers.get(rule.pattern);
      if (list) {
        list.push(rule.containerId);
      }
    });

    patternContainers.forEach((containers, pattern) => {
      if (containers.length > 1) {
        warnings.push(`Pattern "${pattern}" has conflicting RESTRICT rules for containers: ${containers.join(', ')}`);
      }
    });

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  private generateRuleId(): string {
    return `rule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private setCache(key: string, result: EvaluationResult): void {
    // Remove oldest entries if cache is full
    if (this.cache.size >= this.MAX_CACHE_SIZE) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }

    this.cache.set(key, {
      url: key.split(':')[0],
      result,
      timestamp: Date.now(),
    });
  }

  private invalidateCache(pattern?: string): void {
    if (pattern) {
      // Invalidate cache entries that might be affected by this pattern
      for (const [key, cached] of this.cache.entries()) {
        if (this.matcher.match(cached.url, pattern, MatchType.GLOB)) {
          this.cache.delete(key);
        }
      }
    } else {
      // Clear entire cache
      this.cache.clear();
    }

    this.log.debug('Cache invalidated', { pattern });
  }

  // Clean up expired cache entries
  private cleanupCache(): void {
    const now = Date.now();
    for (const [key, cached] of this.cache.entries()) {
      if (now - cached.timestamp > this.CACHE_TTL) {
        this.cache.delete(key);
      }
    }
  }

  // Start periodic cache cleanup
  startCacheCleanup(): void {
    setInterval(() => this.cleanupCache(), this.CACHE_TTL);
  }
}

export default RulesEngine.getInstance();