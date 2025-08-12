// Jest manual mock for StorageService used in unit tests
const mockedInstance = {
  // Rule operations
  getRules: jest.fn(async () => []),
  setRules: jest.fn(async (_rules: any[]) => { }),
  addRule: jest.fn(async (_rule: any) => { }),
  updateRule: jest.fn(async (_id: string, _updates: any) => { }),
  removeRule: jest.fn(async (_id: string) => { }),

  // Container operations
  getContainers: jest.fn(async () => []),
  setContainers: jest.fn(async (_containers: any[]) => { }),
  addContainer: jest.fn(async (_container: any) => { }),
  updateContainer: jest.fn(async (_id: string, _updates: any) => { }),
  removeContainer: jest.fn(async (_id: string) => { }),

  // Preferences
  getPreferences: jest.fn(async () => ({
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
  backup: jest.fn(async () => ({ version: '2.0.0', timestamp: Date.now(), containers: [], rules: [], preferences: { theme: 'auto', keepOldTabs: false, matchDomainOnly: true, syncEnabled: false, syncOptions: { syncRules: true, syncContainers: true, syncPreferences: true }, notifications: { showOnRuleMatch: false, showOnRestrict: true, showOnExclude: false }, advanced: { debugMode: false, performanceMode: false, cacheTimeout: 60000 } }, bookmarks: [] })),
  restore: jest.fn(async (_backup: any) => { }),
};

export class StorageService {
  static getInstance(): any {
    return mockedInstance;
  }
}

export default mockedInstance as any;

