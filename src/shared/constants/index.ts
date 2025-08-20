export const STORAGE_KEYS = {
  CONTAINERS: 'containers',
  RULES: 'rules',
  PREFERENCES: 'preferences',
  BOOKMARKS: 'bookmarks',
  SYNC_STATE: 'syncState',
  CACHE: 'cache',
  CATEGORIES: 'categories',
  STATS: 'stats',
  TEMPLATES: 'templates',
  DAILY_STATS: 'dailyStats',
  GLOBAL_STATS: 'globalStats',
  ACTIVE_SESSIONS: 'activeSessions',
  RECENT_ACTIVITY: 'recentActivity',
} as const;

export const DEFAULT_PREFERENCES = {
  theme: 'auto' as const,
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
    cacheTimeout: 60000, // 1 minute
  },
  stats: {
    enabled: true,
    retentionDays: 30,
  },
};

export const MESSAGE_TYPES = {
  // Container operations
  GET_CONTAINERS: 'GET_CONTAINERS',
  CREATE_CONTAINER: 'CREATE_CONTAINER',
  UPDATE_CONTAINER: 'UPDATE_CONTAINER',
  DELETE_CONTAINER: 'DELETE_CONTAINER',
  SYNC_CONTAINERS: 'SYNC_CONTAINERS',
  CLEAR_CONTAINER_COOKIES: 'CLEAR_CONTAINER_COOKIES',
  OPEN_IN_CONTAINER: 'OPEN_IN_CONTAINER',

  // Rule operations
  GET_RULES: 'GET_RULES',
  CREATE_RULE: 'CREATE_RULE',
  UPDATE_RULE: 'UPDATE_RULE',
  DELETE_RULE: 'DELETE_RULE',
  EVALUATE_URL: 'EVALUATE_URL',
  TEST_PATTERN: 'TEST_PATTERN',

  // Storage operations
  GET_PREFERENCES: 'GET_PREFERENCES',
  UPDATE_PREFERENCES: 'UPDATE_PREFERENCES',
  BACKUP_DATA: 'BACKUP_DATA',
  RESTORE_DATA: 'RESTORE_DATA',

  // Sync operations
  SYNC_PUSH: 'SYNC_PUSH',
  SYNC_PULL: 'SYNC_PULL',
  GET_SYNC_STATE: 'GET_SYNC_STATE',

  // Logging
  LOG: 'LOG',

  // Bookmarks
  GET_BOOKMARK_ASSOCIATIONS: 'GET_BOOKMARK_ASSOCIATIONS',
  ADD_BOOKMARK_ASSOCIATION: 'ADD_BOOKMARK_ASSOCIATION',
  REMOVE_BOOKMARK_ASSOCIATION: 'REMOVE_BOOKMARK_ASSOCIATION',
  PROCESS_BOOKMARK_URL: 'PROCESS_BOOKMARK_URL',

  // Categories
  GET_CATEGORIES: 'GET_CATEGORIES',
  ADD_CATEGORY: 'ADD_CATEGORY',
  RENAME_CATEGORY: 'RENAME_CATEGORY',
  DELETE_CATEGORY: 'DELETE_CATEGORY',

  // Stats
  GET_STATS: 'GET_STATS',
  RESET_STATS: 'RESET_STATS',
  GET_GLOBAL_STATS: 'GET_GLOBAL_STATS',
  GET_DAILY_STATS: 'GET_DAILY_STATS',
  GET_ACTIVE_TABS: 'GET_ACTIVE_TABS',
  GET_RECENT_ACTIVITY: 'GET_RECENT_ACTIVITY',
  GET_CONTAINER_TRENDS: 'GET_CONTAINER_TRENDS',
  RECORD_STAT_EVENT: 'RECORD_STAT_EVENT',

  // Templates
  GET_TEMPLATES: 'GET_TEMPLATES',
  APPLY_TEMPLATE: 'APPLY_TEMPLATE',
  SAVE_TEMPLATE: 'SAVE_TEMPLATE',
  DELETE_TEMPLATE: 'DELETE_TEMPLATE',
  EXPORT_CONTAINER: 'EXPORT_CONTAINER',
  IMPORT_CONTAINER: 'IMPORT_CONTAINER',

  // CSV Import/Export
  EXPORT_CSV: 'EXPORT_CSV',
  IMPORT_CSV: 'IMPORT_CSV',
  GENERATE_CSV_TEMPLATE: 'GENERATE_CSV_TEMPLATE',
} as const;

export const DEFAULT_CONTAINER_ICONS = [
  'fingerprint',
  'briefcase',
  'dollar',
  'cart',
  'fence',
  'fruit',
  'gift',
  'vacation',
  'tree',
  'chill',
] as const;

export const DEFAULT_CONTAINER_COLORS = [
  'blue',
  'turquoise',
  'green',
  'yellow',
  'orange',
  'red',
  'pink',
  'purple',
  'toolbar',
] as const;