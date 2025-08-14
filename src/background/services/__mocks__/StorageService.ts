// Jest manual mock for StorageService used in unit tests
import type { Rule, Container, BackupData, Preferences } from '@/shared/types';

const mockedInstance = {
  // Rule operations
  getRules: jest.fn(async () => []),
  setRules: jest.fn(async (_rules: Rule[]) => { }),
  addRule: jest.fn(async (_rule: Rule) => { }),
  updateRule: jest.fn(async (_id: string, _updates: Partial<Rule>) => { }),
  removeRule: jest.fn(async (_id: string) => { }),

  // Container operations
  getContainers: jest.fn(async () => []),
  setContainers: jest.fn(async (_containers: Container[]) => { }),
  addContainer: jest.fn(async (_container: Container) => { }),
  updateContainer: jest.fn(async (_id: string, _updates: Partial<Container>) => { }),
  removeContainer: jest.fn(async (_id: string) => { }),

  // Preferences
  getPreferences: jest.fn(async (): Promise<Preferences> => ({
    theme: 'auto',
    keepOldTabs: false,
    matchDomainOnly: true,
    defaultContainer: undefined,
    syncEnabled: false,
    syncOptions: { syncRules: true, syncContainers: true, syncPreferences: true },
    notifications: { showOnRuleMatch: false, showOnRestrict: true, showOnExclude: false },
    advanced: { debugMode: false, performanceMode: false, cacheTimeout: 60000 },
  })),

  // No-op placeholders used by background/index.ts handlers in some tests
  backup: jest.fn(async (): Promise<BackupData> => ({
    version: '2.0.0',
    timestamp: Date.now(),
    containers: [],
    rules: [],
    preferences: {
      theme: 'auto',
      keepOldTabs: false,
      matchDomainOnly: true,
      defaultContainer: undefined,
      syncEnabled: false,
      syncOptions: { syncRules: true, syncContainers: true, syncPreferences: true },
      notifications: { showOnRuleMatch: false, showOnRestrict: true, showOnExclude: false },
      advanced: { debugMode: false, performanceMode: false, cacheTimeout: 60000 },
    },
    bookmarks: [],
  })),
  restore: jest.fn(async (_backup: BackupData) => { }),
};

interface StorageServiceInstance {
  getRules: jest.MockedFunction<() => Promise<Rule[]>>;
  setRules: jest.MockedFunction<(rules: Rule[]) => Promise<void>>;
  addRule: jest.MockedFunction<(rule: Rule) => Promise<void>>;
  updateRule: jest.MockedFunction<(id: string, updates: Partial<Rule>) => Promise<void>>;
  removeRule: jest.MockedFunction<(id: string) => Promise<void>>;
  getContainers: jest.MockedFunction<() => Promise<Container[]>>;
  setContainers: jest.MockedFunction<(containers: Container[]) => Promise<void>>;
  addContainer: jest.MockedFunction<(container: Container) => Promise<void>>;
  updateContainer: jest.MockedFunction<(id: string, updates: Partial<Container>) => Promise<void>>;
  removeContainer: jest.MockedFunction<(id: string) => Promise<void>>;
  getPreferences: jest.MockedFunction<() => Promise<Preferences>>;
  backup: jest.MockedFunction<() => Promise<BackupData>>;
  restore: jest.MockedFunction<(backup: BackupData) => Promise<void>>;
}

export class StorageService {
  static getInstance(): StorageServiceInstance {
    return mockedInstance;
  }
}

export default mockedInstance;

