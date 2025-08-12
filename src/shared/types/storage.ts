export interface Preferences {
  theme: 'light' | 'dark' | 'auto';
  keepOldTabs: boolean;
  matchDomainOnly: boolean;
  defaultContainer?: string;
  syncEnabled: boolean;
  syncOptions: {
    syncRules: boolean;
    syncContainers: boolean;
    syncPreferences: boolean;
  };
  notifications: {
    showOnRuleMatch: boolean;
    showOnRestrict: boolean;
    showOnExclude: boolean;
  };
  advanced: {
    debugMode: boolean;
    performanceMode: boolean;
    cacheTimeout: number;
  };
  stats?: {
    enabled: boolean;
    retentionDays: number;
  };
}

export interface BookmarkAssociation {
  bookmarkId: string;
  containerId: string;
  url: string;
  autoOpen: boolean;
  created: number;
}

export interface BackupData {
  version: string;
  timestamp: number;
  containers: any[];
  rules: any[];
  preferences: Preferences;
  bookmarks: BookmarkAssociation[];
  categories?: string[];
  stats?: Record<string, ContainerStats>;
}

export interface SyncState {
  lastSync: number;
  deviceId: string;
  version: string;
  conflicts: SyncConflict[];
}

export interface SyncConflict {
  type: 'container' | 'rule' | 'preference';
  id: string;
  local: any;
  remote: any;
  timestamp: number;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface ContainerStats {
  containerId: string; // cookieStoreId
  tabsOpened: number;
  rulesMatched: number;
  lastUsed?: number;
  activeTabCount?: number;
  history: Array<{ timestamp: number; event: 'open' | 'match' | 'close' | 'touch' }>;
}