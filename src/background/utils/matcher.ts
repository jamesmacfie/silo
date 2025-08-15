import { MatchType } from '@/shared/types';
import { logger } from '@/shared/utils/logger';

const log = logger.withContext('URLMatcher');

export interface ParsedURL {
  protocol: string;
  hostname: string;
  port: string;
  pathname: string;
  search: string;
  hash: string;
  origin: string;
  href: string;
}

export function match(url: string, pattern: string, type: MatchType): boolean {
  try {
    // Inline prefix overrides for convenience: '@' => REGEX, '!' => GLOB
    let effectiveType = type;
    let effectivePattern = pattern;

    if (effectiveType === MatchType.DOMAIN) {
      // For domain rules, ignore inline prefix markers and treat as domain
      if (effectivePattern.startsWith('@') || effectivePattern.startsWith('!')) {
        effectivePattern = effectivePattern.slice(1);
      }
    } else {
      if (effectivePattern.startsWith('@')) {
        effectiveType = MatchType.REGEX;
        effectivePattern = effectivePattern.slice(1);
      } else if (effectivePattern.startsWith('!')) {
        effectiveType = MatchType.GLOB;
        effectivePattern = effectivePattern.slice(1);
      }
    }

    switch (effectiveType) {
      case MatchType.EXACT:
        return matchExact(url, effectivePattern);
      case MatchType.DOMAIN:
        return matchDomain(url, effectivePattern);
      case MatchType.GLOB:
        return matchGlob(url, effectivePattern);
      case MatchType.REGEX:
        return matchRegex(url, effectivePattern);
      default:
        log.warn('Unknown match type', { type: effectiveType, pattern: effectivePattern });
        return false;
    }
  } catch {
    log.error('Pattern matching failed', { url, pattern, type });
    return false;
  }
}

export function parse(url: string): ParsedURL {
  try {
    const parsed = new URL(url);
    return {
      protocol: parsed.protocol,
      hostname: parsed.hostname,
      port: parsed.port,
      pathname: parsed.pathname,
      search: parsed.search,
      hash: parsed.hash,
      origin: parsed.origin,
      href: parsed.href,
    };
  } catch {
    throw new Error(`Invalid URL: ${url}`);
  }
}

export function normalize(url: string): string {
  try {
    const parsed = new URL(url);

    // Remove default ports
    if ((parsed.protocol === 'http:' && parsed.port === '80') ||
      (parsed.protocol === 'https:' && parsed.port === '443')) {
      parsed.port = '';
    }

    // Remove trailing slash from pathname if it's just "/"
    if (parsed.pathname === '/' && !parsed.search && !parsed.hash) {
      // Preserve trailing slash when a non-default port is present
      if (parsed.port && !['80', '443'].includes(parsed.port)) {
        return `${parsed.protocol}//${parsed.host}/`;
      }
      return `${parsed.protocol}//${parsed.host}`;
    }

    return parsed.href;
  } catch {
    return url; // Return original if parsing fails
  }
}

export function extractDomain(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.hostname;
  } catch {
    // Try to extract domain from incomplete URLs
    const match = url.match(/^(?:https?:\/\/)?([^/?#]+)/i);
    return match ? match[1] : url;
  }
}

export function isValid(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

function matchExact(url: string, pattern: string): boolean {
  const normalizedUrl = normalize(url);
  const normalizedPattern = normalize(pattern);
  return normalizedUrl === normalizedPattern;
}

function matchDomain(url: string, pattern: string): boolean {
  const { hostname: urlDomain, pathname: urlPathname } = parse(url);

  // Attempt to extract a hostname and optional path from the pattern.
  // Accept inputs like:
  // - example.com
  // - *.example.com
  // - example.com/admin
  // - https://example.com/admin
  let patternHostname = extractDomain(pattern).toLowerCase();
  let patternPathname = '';
  try {
    // Try to parse fully as a URL first
    const tmp = new URL(pattern.includes('://') ? pattern : `https://${pattern}`);
    patternHostname = tmp.hostname.toLowerCase();
    patternPathname = tmp.pathname || '';
  } catch {
    // Fallback: best-effort path extraction if string contains '/'
    const slashIdx = pattern.indexOf('/');
    if (slashIdx !== -1) {
      patternHostname = pattern.slice(0, slashIdx).toLowerCase();
      patternPathname = pattern.slice(slashIdx);
    }
  }

  const urlDomainLc = urlDomain.toLowerCase();

  // Support wildcard subdomains (*.example.com)
  if (patternHostname.startsWith('*.')) {
    const baseDomain = patternHostname.slice(2);

    // Enhanced wildcard matching: *.example.com should match:
    // 1. Any subdomain of example.com (www.example.com, api.example.com)
    // 2. The base domain itself (example.com) - NEW BEHAVIOR
    const isBaseDomainMatch = urlDomainLc === baseDomain;
    const isSubdomainMatch = urlDomainLc.endsWith('.' + baseDomain);

    if (!(isBaseDomainMatch || isSubdomainMatch)) {
      return false;
    }
  } else {
    // For bare domains, support both exact match and subdomain match
    // So "example.com" matches both "example.com" and "www.example.com"
    const isExactMatch = urlDomainLc === patternHostname;
    const isSubdomainMatch = urlDomainLc.endsWith('.' + patternHostname);

    if (!(isExactMatch || isSubdomainMatch)) {
      return false;
    }
  }

  // Path-specific match: if a path is provided in the pattern, require prefix match
  if (patternPathname && patternPathname !== '/' && patternPathname !== '/*') {
    const normalizedPatternPath = patternPathname.endsWith('/') ? patternPathname : `${patternPathname}/`;
    const normalizedUrlPath = urlPathname.endsWith('/') ? urlPathname : `${urlPathname}/`;
    return normalizedUrlPath.startsWith(normalizedPatternPath);
  }

  return true;
}

function matchGlob(url: string, pattern: string): boolean {
  // Convert glob pattern to regex
  const regexPattern = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&') // Escape regex special chars except * and ?
    .replace(/\*/g, '.*') // * matches any characters
    .replace(/\?/g, '.'); // ? matches single character

  const regex = new RegExp(`^${regexPattern}$`, 'i');
  return regex.test(url);
}

function matchRegex(url: string, pattern: string): boolean {
  try {
    const regex = new RegExp(pattern, 'i');
    return regex.test(url);
  } catch (error) {
    log.error('Invalid regex pattern', { pattern, error });
    return false;
  }
}
