import { MatchType } from '@/shared/types';

export interface ValidationResult {
  valid: boolean;
  error?: string;
  warning?: string;
  suggestion?: string;
}

/**
 * Validate a URL pattern based on match type
 */
export function validatePattern(pattern: string, matchType: MatchType): ValidationResult {
  if (!pattern || pattern.trim().length === 0) {
    return {
      valid: false,
      error: 'Pattern cannot be empty'
    };
  }

  const trimmedPattern = pattern.trim();

  switch (matchType) {
    case MatchType.EXACT:
      return validateExactPattern(trimmedPattern);
    case MatchType.DOMAIN:
      return validateDomainPattern(trimmedPattern);
    case MatchType.GLOB:
      return validateGlobPattern(trimmedPattern);
    case MatchType.REGEX:
      return validateRegexPattern(trimmedPattern);
    default:
      return {
        valid: false,
        error: 'Unknown match type'
      };
  }
}

function validateExactPattern(pattern: string): ValidationResult {
  try {
    new URL(pattern);
    return { valid: true };
  } catch {
    return {
      valid: false,
      error: 'Pattern must be a valid URL for exact matching',
      suggestion: 'Try: https://example.com/path'
    };
  }
}

function validateDomainPattern(pattern: string): ValidationResult {
  // Check for common mistakes
  if (pattern.startsWith('http://') || pattern.startsWith('https://')) {
    return {
      valid: false,
      error: 'Domain patterns should not include protocol',
      suggestion: pattern.replace(/^https?:\/\//, '')
    };
  }

  if (pattern.includes('/') && !pattern.startsWith('*.')) {
    return {
      valid: true,
      warning: 'Domain patterns typically don\'t include paths. Consider using exact or glob matching.'
    };
  }

  // Basic domain validation
  const domainRegex = /^(\*\.)?[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  
  if (!domainRegex.test(pattern)) {
    return {
      valid: false,
      error: 'Invalid domain format',
      suggestion: 'Try: example.com or *.example.com'
    };
  }

  // Check for suspicious patterns
  if (pattern.includes('*') && !pattern.startsWith('*.')) {
    return {
      valid: false,
      error: 'Wildcards in domain patterns must be at the start (*.example.com)',
      suggestion: pattern.startsWith('*') ? pattern : `*.${pattern}`
    };
  }

  return { valid: true };
}

function validateGlobPattern(pattern: string): ValidationResult {
  // Remove leading ! if present (handled by matcher)
  const cleanPattern = pattern.startsWith('!') ? pattern.slice(1) : pattern;

  // Check for common glob syntax errors
  if (cleanPattern.includes('**') && !cleanPattern.includes('/')) {
    return {
      valid: true,
      warning: '** is typically used with paths. For domains, consider using *'
    };
  }

  // Check for unescaped regex characters that might be mistakes
  const regexChars = /[+^${}()|[\]\\]/;
  if (regexChars.test(cleanPattern)) {
    return {
      valid: true,
      warning: 'Pattern contains regex characters. Consider using regex match type if this is intentional.'
    };
  }

  // Basic validation - glob patterns are quite flexible
  if (cleanPattern.includes('***')) {
    return {
      valid: false,
      error: 'Invalid glob pattern: too many consecutive wildcards'
    };
  }

  return { valid: true };
}

function validateRegexPattern(pattern: string): ValidationResult {
  // Remove leading @ if present (handled by matcher)
  const cleanPattern = pattern.startsWith('@') ? pattern.slice(1) : pattern;

  try {
    new RegExp(cleanPattern);
  } catch (error) {
    return {
      valid: false,
      error: `Invalid regular expression: ${error instanceof Error ? error.message : 'Unknown error'}`,
      suggestion: 'Check your regex syntax'
    };
  }

  // Check for common performance issues
  if (cleanPattern.includes('.*.*') || cleanPattern.includes('.+.+')) {
    return {
      valid: true,
      warning: 'Pattern may cause performance issues. Consider optimizing.'
    };
  }

  // Check for overly broad patterns
  if (cleanPattern === '.*' || cleanPattern === '.+' || cleanPattern === '.*?') {
    return {
      valid: true,
      warning: 'Very broad pattern. This will match almost any URL.'
    };
  }

  return { valid: true };
}

/**
 * Get example patterns for each match type
 */
export function getPatternExamples(matchType: MatchType): string[] {
  switch (matchType) {
    case MatchType.EXACT:
      return [
        'https://example.com',
        'https://github.com/user/repo',
        'https://mail.google.com/mail/u/0/'
      ];
    case MatchType.DOMAIN:
      return [
        'example.com',
        '*.google.com',
        'github.com',
        'localhost:3000'
      ];
    case MatchType.GLOB:
      return [
        '*.example.com/api/*',
        'github.com/*/settings',
        '*.google.com/*/admin',
        'example.com/user/*/profile'
      ];
    case MatchType.REGEX:
      return [
        'github\\.com/[^/]+/settings',
        '.*\\.dev$',
        '^https://.*\\.example\\.com',
        'localhost:\\d+/admin'
      ];
    default:
      return [];
  }
}

/**
 * Suggest match type based on pattern
 */
export function suggestMatchType(pattern: string): MatchType | null {
  const trimmedPattern = pattern.trim();

  // If it looks like a full URL
  if (trimmedPattern.match(/^https?:\/\//)) {
    return MatchType.EXACT;
  }

  // If it has regex special characters
  if (trimmedPattern.match(/[+^${}()|[\]\\]/)) {
    return MatchType.REGEX;
  }

  // If it has glob patterns
  if (trimmedPattern.includes('*') || trimmedPattern.includes('?')) {
    return MatchType.GLOB;
  }

  // If it looks like a domain
  if (trimmedPattern.match(/^[a-zA-Z0-9.-]+(\.[a-zA-Z]{2,})?$/)) {
    return MatchType.DOMAIN;
  }

  return null;
}