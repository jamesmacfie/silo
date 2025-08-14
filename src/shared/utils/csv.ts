import type { Rule, Container, CreateRuleRequest } from '@/shared/types';
import { MatchType, RuleType } from '@/shared/types';

export interface CSVRule {
  pattern: string;
  containerName: string;
  matchType?: string;
  ruleType?: string;
  priority?: number;
  enabled?: boolean;
  description?: string;
}

export interface CSVImportResult {
  rules: CreateRuleRequest[];
  missingContainers: string[];
  errors: CSVError[];
  warnings: CSVWarning[];
  skipped: number;
}

export interface CSVError {
  line: number;
  message: string;
  data?: string;
}

export interface CSVWarning {
  line: number;
  message: string;
  data?: string;
}

export interface CSVExportOptions {
  includeComments?: boolean;
  includeHeaders?: boolean;
  includeDisabled?: boolean;
}

/**
 * Parse CSV content into rules
 */
export function parseCSV(content: string, containers: Container[]): CSVImportResult {
  const lines = content.split('\n').map(line => line.trim());
  const rules: CreateRuleRequest[] = [];
  const missingContainers = new Set<string>();
  const errors: CSVError[] = [];
  const warnings: CSVWarning[] = [];
  let skipped = 0;

  const containerMap = new Map<string, Container>();
  containers.forEach(c => {
    containerMap.set(c.name.toLowerCase(), c);
  });

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;

    // Skip empty lines and comments
    if (!line || line.startsWith('#')) {
      skipped++;
      continue;
    }

    try {
      const parsed = parseCSVLine(line);
      if (!parsed) {
        skipped++;
        continue;
      }

      // Validate pattern
      if (!parsed.pattern) {
        errors.push({
          line: lineNum,
          message: 'Pattern is required',
          data: line,
        });
        continue;
      }

      // Validate container name
      if (!parsed.containerName) {
        errors.push({
          line: lineNum,
          message: 'Container name is required',
          data: line,
        });
        continue;
      }

      // Check if container exists
      const container = containerMap.get(parsed.containerName.toLowerCase());
      if (!container) {
        missingContainers.add(parsed.containerName);
        warnings.push({
          line: lineNum,
          message: `Container "${parsed.containerName}" does not exist`,
          data: line,
        });
      }

      // Parse match type
      let matchType = MatchType.DOMAIN;
      if (parsed.matchType) {
        const mt = parsed.matchType.toLowerCase();
        if (mt === 'exact') matchType = MatchType.EXACT;
        else if (mt === 'domain') matchType = MatchType.DOMAIN;
        else if (mt === 'glob') matchType = MatchType.GLOB;
        else if (mt === 'regex') matchType = MatchType.REGEX;
        else {
          warnings.push({
            line: lineNum,
            message: `Unknown match type "${parsed.matchType}", using domain`,
            data: line,
          });
        }
      }

      // Parse rule type
      let ruleType = RuleType.INCLUDE;
      if (parsed.ruleType) {
        const rt = parsed.ruleType.toLowerCase();
        if (rt === 'include') ruleType = RuleType.INCLUDE;
        else if (rt === 'exclude') ruleType = RuleType.EXCLUDE;
        else if (rt === 'restrict') ruleType = RuleType.RESTRICT;
        else {
          warnings.push({
            line: lineNum,
            message: `Unknown rule type "${parsed.ruleType}", using include`,
            data: line,
          });
        }
      }

      // Create rule
      const rule: CreateRuleRequest = {
        pattern: parsed.pattern,
        matchType,
        ruleType,
        containerId: container?.cookieStoreId,
        priority: parsed.priority || 1,
        enabled: parsed.enabled !== false,
        metadata: {
          description: parsed.description,
          source: 'import',
        },
      };

      rules.push(rule);

    } catch (error) {
      errors.push({
        line: lineNum,
        message: error instanceof Error ? error.message : 'Parse error',
        data: line,
      });
    }
  }

  return {
    rules,
    missingContainers: Array.from(missingContainers),
    errors,
    warnings,
    skipped,
  };
}

/**
 * Parse a single CSV line
 */
function parseCSVLine(line: string): CSVRule | null {
  // Simple CSV parsing - handles quoted fields
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      fields.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  fields.push(current.trim());

  // Remove quotes from fields
  const cleanFields = fields.map(field => {
    if (field.startsWith('"') && field.endsWith('"')) {
      return field.slice(1, -1);
    }
    return field;
  });

  if (cleanFields.length < 2) {
    return null;
  }

  return {
    pattern: cleanFields[0] || '',
    containerName: cleanFields[1] || '',
    matchType: cleanFields[2] || undefined,
    ruleType: cleanFields[3] || undefined,
    priority: cleanFields[4] ? parseInt(cleanFields[4], 10) : undefined,
    enabled: cleanFields[5] ? cleanFields[5].toLowerCase() !== 'false' : undefined,
    description: cleanFields[6] || undefined,
  };
}

/**
 * Export rules to CSV format
 */
export function exportToCSV(rules: Rule[], containers: Container[], options: CSVExportOptions = {}): string {
  const {
    includeComments = true,
    includeHeaders = true,
    includeDisabled = true,
  } = options;

  const lines: string[] = [];

  // Add header comment
  if (includeComments) {
    lines.push('# Silo Rules Export');
    lines.push(`# Generated on ${new Date().toISOString()}`);
    lines.push('# Format: pattern, container_name, match_type, rule_type, priority, enabled, description');
    lines.push('#');
  }

  // Add CSV header
  if (includeHeaders) {
    lines.push('pattern,container_name,match_type,rule_type,priority,enabled,description');
  }

  // Create container lookup
  const containerMap = new Map<string, Container>();
  containers.forEach(c => {
    containerMap.set(c.cookieStoreId, c);
  });

  // Filter and sort rules
  const filteredRules = rules
    .filter(rule => includeDisabled || rule.enabled)
    .sort((a, b) => {
      // Sort by container name, then priority, then pattern
      const containerA = a.ruleType === RuleType.EXCLUDE ? '' : (containerMap.get(a.containerId || '')?.name || 'No Container');
      const containerB = b.ruleType === RuleType.EXCLUDE ? '' : (containerMap.get(b.containerId || '')?.name || 'No Container');

      if (containerA !== containerB) {
        return containerA.localeCompare(containerB);
      }

      if (a.priority !== b.priority) {
        return b.priority - a.priority; // Higher priority first
      }

      return a.pattern.localeCompare(b.pattern);
    });

  // Add rules
  for (const rule of filteredRules) {
    const container = containerMap.get(rule.containerId || '');
    const containerName = rule.ruleType === RuleType.EXCLUDE ? '' : (container?.name || 'No Container');

    const fields = [
      escapeCSVField(rule.pattern),
      escapeCSVField(containerName),
      rule.matchType,
      rule.ruleType,
      rule.priority.toString(),
      rule.enabled.toString(),
      escapeCSVField(rule.metadata.description || ''),
    ];

    lines.push(fields.join(','));
  }

  return lines.join('\n');
}

/**
 * Escape a field for CSV output
 */
function escapeCSVField(field: string): string {
  if (!field) return '';

  // If field contains comma, quote, or newline, wrap in quotes and escape quotes
  if (field.includes(',') || field.includes('"') || field.includes('\n')) {
    return `"${field.replace(/"/g, '""')}"`;
  }

  return field;
}

/**
 * Generate CSV template with examples
 */
/**
 * Validation result for CSV row
 */
export interface CSVValidationResult {
  isValid: boolean;
  error?: string;
  rule?: CreateRuleRequest;
}

/**
 * Validate a single CSV row
 */
export function validateCSVRow(fields: string[], containers: Container[]): CSVValidationResult {
  if (fields.length < 2) {
    return { isValid: false, error: 'Minimum 2 fields required (pattern, container)' };
  }

  const [pattern, containerName, matchType = 'domain', ruleType = 'include', priorityStr = '1', enabledStr = 'true', description = ''] = fields;

  // Validate pattern
  if (!pattern || pattern.trim() === '') {
    return { isValid: false, error: 'Pattern cannot be empty' };
  }

  // Validate container (unless it's an exclude rule)
  const container = containers.find(c => c.name === containerName);
  if (ruleType !== 'exclude' && containerName && !container && containerName !== '') {
    return { isValid: false, error: `Container "${containerName}" does not exist` };
  }

  // Validate match type
  const validMatchTypes = ['exact', 'domain', 'glob', 'regex'];
  if (!validMatchTypes.includes(matchType.toLowerCase())) {
    return { isValid: false, error: `Invalid match type "${matchType}". Must be one of: ${validMatchTypes.join(', ')}` };
  }

  // Validate rule type
  const validRuleTypes = ['include', 'exclude', 'restrict'];
  if (!validRuleTypes.includes(ruleType.toLowerCase())) {
    return { isValid: false, error: `Invalid rule type "${ruleType}". Must be one of: ${validRuleTypes.join(', ')}` };
  }

  // Validate priority
  const priority = parseInt(priorityStr, 10);
  if (isNaN(priority) || priority < 1 || priority > 100) {
    return { isValid: false, error: `Priority must be a number between 1 and 100, got "${priorityStr}"` };
  }

  // Validate enabled flag
  const enabledLower = enabledStr.toLowerCase();
  if (!['true', 'false', '1', '0', 'yes', 'no'].includes(enabledLower)) {
    return { isValid: false, error: `Enabled flag must be true/false, 1/0, or yes/no, got "${enabledStr}"` };
  }

  const enabled = enabledLower === 'true' || enabledLower === '1' || enabledLower === 'yes';

  const rule: CreateRuleRequest = {
    pattern: pattern.trim(),
    containerId: ruleType === 'exclude' ? undefined : (container?.cookieStoreId || undefined),
    matchType: matchType.toLowerCase() as MatchType,
    ruleType: ruleType.toLowerCase() as RuleType,
    priority,
    enabled,
    metadata: {
      description: description.trim() || undefined,
      source: 'import',
    },
  };

  return { isValid: true, rule };
}

export function generateCSVTemplate(): string {
  const lines = [
    '# Silo Rules Import Template',
    '# Lines starting with # are comments and will be ignored',
    '#',
    '# Format: pattern, container_name, [match_type], [rule_type], [priority], [enabled], [description]',
    '#',
    '# Match types: exact, domain, glob, regex (default: domain)',
    '# Rule types: include, exclude, restrict (default: include)',
    '# Priority: 1-100 (default: 1)',
    '# Enabled: true, false (default: true)',
    '#',
    '# Examples:',
    'pattern,container_name,match_type,rule_type,priority,enabled,description',
    'github.com,Work,domain,include,1,true,GitHub for work',
    'gmail.com,Personal,domain,include,1,true,Personal email',
    'facebook.com,Social,domain,include,2,true,Social media',
    '*.google.com,Work,glob,include,1,true,Google services',
    '@.*\\.dev$,Development,regex,include,3,true,Development domains',
    'example.com/admin,Work,exact,restrict,10,true,Admin area restricted to Work',
    'ads.example.com,,domain,exclude,5,true,Break out of container for ads',
  ];

  return lines.join('\n');
}