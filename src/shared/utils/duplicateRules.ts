import type { Rule } from '@/shared/types/rule';

export interface DuplicateGroup {
  id: string;
  rules: Rule[];
  pattern: string;
  matchType: string;
  ruleType: string;
  containerId?: string;
}

/**
 * Identifies duplicate rules based on pattern, matchType, ruleType, and containerId
 * Rules are considered duplicates if they match on all these fields
 */
export function findDuplicateRules(rules: Rule[]): DuplicateGroup[] {
  const groups = new Map<string, Rule[]>();

  // Group rules by their identifying characteristics
  for (const rule of rules) {
    const key = createDuplicateKey(rule);
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(rule);
  }

  // Filter to only groups with duplicates (2+ rules)
  const duplicateGroups: DuplicateGroup[] = [];
  for (const [key, groupRules] of groups.entries()) {
    if (groupRules.length > 1) {
      const firstRule = groupRules[0];
      duplicateGroups.push({
        id: key,
        rules: groupRules,
        pattern: firstRule.pattern,
        matchType: firstRule.matchType,
        ruleType: firstRule.ruleType,
        containerId: firstRule.containerId,
      });
    }
  }

  return duplicateGroups;
}

/**
 * Creates a unique key for a rule based on the fields that determine duplicates
 */
function createDuplicateKey(rule: Rule): string {
  // Normalize pattern by trimming whitespace and converting to lowercase for comparison
  const normalizedPattern = rule.pattern.trim().toLowerCase();
  
  // Include containerId in the key, using empty string for undefined/null
  const containerKey = rule.containerId || '';
  
  return `${normalizedPattern}|${rule.matchType}|${rule.ruleType}|${containerKey}`;
}

/**
 * Returns the total number of duplicate rules (excluding one from each group)
 */
export function getDuplicateCount(rules: Rule[]): number {
  const duplicateGroups = findDuplicateRules(rules);
  return duplicateGroups.reduce((total, group) => total + (group.rules.length - 1), 0);
}

/**
 * Suggests which rules to keep from each duplicate group
 * Keeps the rule with the highest priority, or the most recently modified if priorities are equal
 */
export function suggestRulesToKeep(duplicateGroups: DuplicateGroup[]): { keep: Rule[]; remove: Rule[] } {
  const keep: Rule[] = [];
  const remove: Rule[] = [];

  for (const group of duplicateGroups) {
    // Sort rules by priority (desc), then by modified date (desc)
    const sorted = [...group.rules].sort((a, b) => {
      if (a.priority !== b.priority) {
        return b.priority - a.priority; // Higher priority first
      }
      return b.modified - a.modified; // More recent first
    });

    // Keep the first (highest priority/most recent)
    keep.push(sorted[0]);
    // Mark the rest for removal
    remove.push(...sorted.slice(1));
  }

  return { keep, remove };
}