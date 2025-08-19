import type { Rule, Container, CreateRuleRequest } from '@/shared/types';
import { MatchType, RuleType } from '@/shared/types';

// Constants for CSV parsing
const MATCH_TYPES = {
  exact: MatchType.EXACT,
  domain: MatchType.DOMAIN,
  glob: MatchType.GLOB,
  regex: MatchType.REGEX,
} as const;

const RULE_TYPES = {
  include: RuleType.INCLUDE,
  exclude: RuleType.EXCLUDE,
  restrict: RuleType.RESTRICT,
} as const;

const VALID_ENABLED_VALUES = ['true', 'false', '1', '0', 'yes', 'no'] as const;
const DEFAULT_PRIORITY = 1;
const MIN_PRIORITY = 1;
const MAX_PRIORITY = 100;

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

export interface CSVParseResult extends CSVImportResult {
  comments?: string[];
  containersToCreate?: string[];
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
export function parseCSV(
  content: string,
  containers: Container[],
  options?: {
    createMissingContainers?: boolean;
    preserveMetadata?: boolean;
    source?: string;
  },
): CSVParseResult {
  const lines = content.split(/\r\n|\r|\n/).map(line => line.trim());
  const result: CSVParseResult = {
    rules: [],
    missingContainers: [],
    errors: [],
    warnings: [],
    skipped: 0,
    comments: [],
    containersToCreate: [],
  };

  const containerMap = createContainerMap(containers);

  const missingContainers = new Set<string>();

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;

    // Skip empty lines, comments, and headers
    if (shouldSkipLine(line)) {
      if (line.startsWith('#')) {
        result.comments?.push(line);
      }
      result.skipped++;
      continue;
    }

    try {
      const parsed = parseCSVLine(line);
      if (!parsed) {
        errors.push({
          line: lineNum,
          message: `Minimum 2 fields required (pattern, container), got: ${line}`,
          data: line,
        });
        continue;
      }

      // Skip header-like rows
      if (isHeaderRow(parsed)) {
        result.skipped++;
        continue;
      }

      // Validate pattern format
      const patternError = validatePatternFormat(parsed.pattern);
      if (patternError) {
        result.errors.push({
          line: lineNum,
          message: patternError,
          data: line,
        });
        continue;
      }

      // Validate container name (unless exclude rule)
      if (!parsed.containerName && (!parsed.ruleType || parsed.ruleType.toLowerCase() !== 'exclude')) {
        errors.push({
          line: lineNum,
          message: 'Container name is required',
          data: line,
        });
        continue;
      }

      // Check if container exists
      const container = containerMap.get(parsed.containerName.toLowerCase());
      if (!container && parsed.containerName) {
        missingContainers.add(parsed.containerName);
        if (options?.createMissingContainers) {
          result.containersToCreate?.push(parsed.containerName);
        } else {
          result.warnings.push({
            line: lineNum,
            message: `Container "${parsed.containerName}" does not exist`,
            data: line,
          });
        }
      }

      // Parse match type and rule type
      const matchType = parseMatchType(parsed.matchType);
      if (parsed.matchType && !matchType) {
        result.warnings.push({
          line: lineNum,
          message: `Unknown match type "${parsed.matchType}", using domain`,
          data: line,
        });
      }

      const ruleType = parseRuleType(parsed.ruleType);
      if (parsed.ruleType && !ruleType) {
        result.warnings.push({
          line: lineNum,
          message: `Unknown rule type "${parsed.ruleType}", using include`,
          data: line,
        });
      }

      // Create rule
      const rule: CreateRuleRequest = {
        pattern: parsed.pattern,
        matchType: matchType || MatchType.DOMAIN,
        ruleType: ruleType || RuleType.INCLUDE,
        containerId: container?.cookieStoreId,
        priority: parsed.priority || DEFAULT_PRIORITY,
        enabled: parsed.enabled !== false,
        metadata: {
          description: parsed.description,
          source: (options?.source as 'user' | 'bookmark' | 'import') || 'import',
          tags: [],
        },
      };

      result.rules.push(rule);

    } catch (error) {
      result.errors.push({
        line: lineNum,
        message: error instanceof Error ? error.message : 'Parse error',
        data: line,
      });
    }
  }

  result.missingContainers = Array.from(missingContainers);
  return result;
}

/**
 * Create a case-insensitive container lookup map
 */
function createContainerMap(containers: Container[]): Map<string, Container> {
  const map = new Map<string, Container>();
  containers.forEach(c => {
    map.set(c.name.toLowerCase(), c);
  });
  return map;
}

/**
 * Check if a line should be skipped during parsing
 */
function shouldSkipLine(line: string): boolean {
  if (!line || line.startsWith('#')) {
    return true;
  }

  // Skip header row if it matches expected column names
  const lowerLine = line.toLowerCase().replace(/"/g, '');
  return (
    (lowerLine.startsWith('pattern') && lowerLine.includes('container')) ||
    (lowerLine.includes('pattern,container') && lowerLine.includes('match_type'))
  );
}

/**
 * Check if parsed CSV data looks like a header row
 */
function isHeaderRow(parsed: CSVRule): boolean {
  return (
    !parsed.pattern ||
    parsed.pattern.toLowerCase() === 'pattern' ||
    (parsed.containerName && parsed.containerName.toLowerCase() === 'container_name')
  );
}

/**
 * Validate pattern format
 */
function validatePatternFormat(pattern: string): string | null {
  if (pattern.includes('[') && !pattern.includes(']')) {
    return `Invalid domain pattern: ${pattern}`;
  }
  return null;
}

/**
 * Parse match type from string
 */
function parseMatchType(matchType?: string): MatchType | null {
  if (!matchType) return null;
  const mt = matchType.toLowerCase();
  return MATCH_TYPES[mt as keyof typeof MATCH_TYPES] || null;
}

/**
 * Parse rule type from string
 */
function parseRuleType(ruleType?: string): RuleType | null {
  if (!ruleType) return null;
  const rt = ruleType.toLowerCase();
  return RULE_TYPES[rt as keyof typeof RULE_TYPES] || null;
}

/**
 * Get container name for a rule
 */
function getContainerName(
  rule: Rule,
  containerMap: Map<string, Container>,
): string {
  if (rule.ruleType === RuleType.EXCLUDE) return '';
  const container = containerMap.get(rule.containerId || '');
  return container?.name || 'No Container';
}

/**
 * Parse a single CSV line
 */
function parseCSVLine(line: string): CSVRule | null {
  // First check if the entire line is wrapped in quotes (malformed CSV)
  let cleanLine = line.trim();
  if (cleanLine.startsWith('"') && cleanLine.endsWith('"') && 
      !cleanLine.includes('","')) {
    // The entire line is wrapped in quotes - remove them
    cleanLine = cleanLine.slice(1, -1);
  }
  
  // Simple CSV parsing - handles quoted fields
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < cleanLine.length; i++) {
    const char = cleanLine[i];

    if (char === '"') {
      if (inQuotes && i + 1 < cleanLine.length && cleanLine[i + 1] === '"') {
        // Escaped quote - add single quote to current field
        current += '"';
        i++; // Skip the next quote
      } else {
        // Toggle quote state
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      fields.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  fields.push(current.trim());

  // Remove outer quotes from fields
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
export function exportToCSV(
  rules: Rule[],
  containers: Container[],
  options: CSVExportOptions = {},
): string {
  const {
    includeComments = false,
    includeHeaders = true,
    includeDisabled = true,
  } = options;

  const lines: string[] = [];

  // Add header comments if requested
  if (includeComments) {
    lines.push(
      '# Silo Rules Export',
      `# Generated on ${new Date().toISOString()}`,
      '# Format: pattern, container_name, match_type, rule_type, priority, enabled, description',
      '#',
    );
  }

  // Add CSV header
  if (includeHeaders) {
    lines.push('pattern,container_name,match_type,rule_type,priority,enabled,description');
  }

  // Create container lookup by cookieStoreId
  const containerMap = new Map<string, Container>();
  containers.forEach(c => {
    containerMap.set(c.cookieStoreId, c);
  });

  // Filter and sort rules
  const filteredRules = filterAndSortRules(rules, containerMap, includeDisabled);

  // Add rules
  for (const rule of filteredRules) {
    const containerName = getContainerName(rule, containerMap);
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
 * Filter and sort rules for export
 */
function filterAndSortRules(
  rules: Rule[],
  containerMap: Map<string, Container>,
  includeDisabled: boolean,
): Rule[] {
  return rules
    .filter(rule => includeDisabled || rule.enabled)
    .sort((a, b) => {
      // Sort by container name, then priority, then pattern
      const containerA = getContainerName(a, containerMap);
      const containerB = getContainerName(b, containerMap);

      if (containerA !== containerB) {
        return containerA.localeCompare(containerB);
      }

      if (a.priority !== b.priority) {
        return b.priority - a.priority; // Higher priority first
      }

      return a.pattern.localeCompare(b.pattern);
    });
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
export function validateCSVRow(
  fields: string[],
  containers: Container[],
): CSVValidationResult {
  if (fields.length < 2) {
    return { isValid: false, error: 'Minimum 2 fields required (pattern, container)' };
  }

  const [pattern, containerName, matchType = 'domain', ruleType = 'include', priorityStr = '1', enabledStr = 'true', description = ''] = fields;

  // Validate pattern
  if (!pattern || pattern.trim() === '') {
    return { isValid: false, error: 'Domain cannot be empty' };
  }

  // Validate pattern format for domain patterns
  if (matchType === 'domain') {
    const invalidPrefixes = ['http://', 'https://', 'ftp://', 'javascript:'];
    if (invalidPrefixes.some(prefix => pattern.startsWith(prefix))) {
      return { isValid: false, error: 'Invalid domain pattern' };
    }
    const patternError = validatePatternFormat(pattern);
    if (patternError) {
      return { isValid: false, error: patternError };
    }
  }

  // Validate container (unless it's an exclude rule)
  const container = containers.find(c => c.name === containerName);
  if (ruleType !== 'exclude' && containerName && !container && containerName !== '') {
    return { isValid: false, error: `Container "${containerName}" does not exist` };
  }

  // Validate match type
  const validMatchTypes = Object.keys(MATCH_TYPES);
  if (!validMatchTypes.includes(matchType.toLowerCase())) {
    return {
      isValid: false,
      error: `Invalid match type "${matchType}". Must be one of: ${validMatchTypes.join(', ')}`,
    };
  }

  // Validate rule type
  const validRuleTypes = Object.keys(RULE_TYPES);
  if (!validRuleTypes.includes(ruleType.toLowerCase())) {
    return {
      isValid: false,
      error: `Invalid rule type "${ruleType}". Must be one of: ${validRuleTypes.join(', ')}`,
    };
  }

  // Validate priority
  const priority = parseInt(priorityStr, 10);
  if (Number.isNaN(priority) || priority < MIN_PRIORITY || priority > MAX_PRIORITY) {
    return {
      isValid: false,
      error: `Priority must be a number between ${MIN_PRIORITY} and ${MAX_PRIORITY}, got "${priorityStr}"`,
    };
  }

  // Validate enabled flag
  const enabledLower = enabledStr.toLowerCase();
  if (!VALID_ENABLED_VALUES.some(v => v === enabledLower)) {
    return {
      isValid: false,
      error: `Enabled flag must be true/false, 1/0, or yes/no, got "${enabledStr}"`,
    };
  }

  const enabled = ['true', '1', 'yes'].includes(enabledLower);

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