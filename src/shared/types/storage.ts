export interface Preferences {
  theme: "light" | "dark" | "auto"
  keepOldTabs: boolean
  matchDomainOnly: boolean
  defaultContainer?: string
  syncEnabled: boolean
  syncOptions: {
    syncRules: boolean
    syncContainers: boolean
    syncPreferences: boolean
  }
  notifications: {
    showOnRuleMatch: boolean
    showOnRestrict: boolean
    showOnExclude: boolean
  }
  advanced: {
    debugMode: boolean
    performanceMode: boolean
    cacheTimeout: number
  }
  stats?: {
    enabled: boolean
    retentionDays: number
  }
}

export interface BookmarkAssociation {
  bookmarkId: string
  containerId: string
  url: string
  autoOpen: boolean
  created: number
}

// Import bookmark types
export type {
  Bookmark,
  BookmarkBulkAction,
  BookmarkExportOptions,
  BookmarkImportData,
  BookmarkMetadata,
  BookmarkSearchFilters,
  BookmarkSortOptions,
  FolderMetadata,
} from "./bookmark"

import type { Container } from "./container"
import type { Rule } from "./rule"

export interface BackupData {
  version: string
  timestamp: number
  containers: Container[]
  rules: Rule[]
  preferences: Preferences
  bookmarks: BookmarkAssociation[]
  categories?: string[]
  stats?: Record<string, ContainerStats>
}

export interface SyncState {
  lastSync: number
  deviceId: string
  version: string
  conflicts: SyncConflict[]
}

export interface SyncConflict {
  type: "container" | "rule" | "preference"
  id: string
  local: unknown
  remote: unknown
  timestamp: number
}

export interface ValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
}

export interface ContainerStats {
  containerId: string // cookieStoreId
  tabsOpened: number
  rulesMatched: number
  lastUsed?: number
  activeTabCount?: number
  history: Array<{
    timestamp: number
    event: "open" | "match" | "close" | "touch"
  }>
}

export interface SessionData {
  startTime: number
  tabIds: Set<number>
  activeTime: number
}

export interface DailyStats {
  date: string // YYYY-MM-DD
  containerId: string
  tabsOpened: number
  rulesMatched: number
  totalActiveTime: number
  peakConcurrentTabs: number
  firstActivity?: number
  lastActivity?: number
  uniqueDomains: number
}

export interface GlobalStats {
  totalContainers: number
  totalRules: number
  totalTabsEverOpened: number
  totalRulesMatched: number
  mostUsedContainer?: string
  averageContainersPerDay: number
  dataRetentionDays: number
  lastUpdated: number
}

export interface ContainerStatsDetailed extends ContainerStats {
  // Time-based metrics
  totalActiveTime: number
  currentSession?: SessionData

  // Usage patterns
  dailyStats: Record<string, Omit<DailyStats, "containerId">> // YYYY-MM-DD -> stats
  peakConcurrentTabs: number
  averageSessionDuration: number

  // Advanced tracking
  urlDomains: Record<string, number> // domain -> visit count
  ruleEfficiency: {
    matches: number
    redirects: number
    excludes: number
  }
}

export interface ActivityEvent {
  id: string
  containerId: string
  timestamp: number
  event:
    | "tab-created"
    | "tab-closed"
    | "tab-activated"
    | "navigation"
    | "rule-match"
  metadata?: {
    tabId?: number
    url?: string
    domain?: string
    ruleId?: string
  }
}

export interface TrendData {
  containerUsage: Array<{
    containerId: string
    dates: string[]
    values: number[]
  }>
  totalTrend: Array<{
    date: string
    value: number
  }>
}

export interface StatEvent {
  containerId: string
  event:
    | "tab-created"
    | "tab-closed"
    | "tab-activated"
    | "navigation"
    | "rule-match"
  timestamp: number
  metadata?: Record<string, unknown>
}
