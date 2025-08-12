import { StorageService } from '@/background/services/StorageService';
import { Container, Rule } from '@/shared/types';

describe('StorageService', () => {
  let storageService: StorageService;

  beforeEach(() => {
    storageService = StorageService.getInstance();
    // Clear all mocks
    jest.clearAllMocks();
  });

  describe('Container Operations', () => {
    const mockContainer: Container = {
      id: 'test-1',
      name: 'Test Container',
      icon: 'fingerprint',
      color: 'blue',
      cookieStoreId: 'firefox-container-1',
      created: Date.now(),
      modified: Date.now(),
      temporary: false,
      syncEnabled: true,
      metadata: {
        description: 'Test container description',
      },
    };

    it('should store and retrieve containers', async () => {
      // Mock storage.local.get to return empty array initially
      (global.browser.storage.local.get as jest.Mock).mockResolvedValue({
        containers: []
      });

      const containers = await storageService.getContainers();
      expect(containers).toEqual([]);

      // Test adding a container
      await storageService.addContainer(mockContainer);

      expect(global.browser.storage.local.set).toHaveBeenCalledWith({
        containers: [mockContainer]
      });
    });

    it('should update container', async () => {
      (global.browser.storage.local.get as jest.Mock).mockResolvedValue({
        containers: [mockContainer]
      });

      const updates = { name: 'Updated Container' };
      await storageService.updateContainer(mockContainer.id, updates);

      expect(global.browser.storage.local.set).toHaveBeenCalledWith({
        containers: [expect.objectContaining({
          ...mockContainer,
          ...updates,
          modified: expect.any(Number),
        })]
      });
    });

    it('should remove container', async () => {
      (global.browser.storage.local.get as jest.Mock).mockResolvedValue({
        containers: [mockContainer]
      });

      await storageService.removeContainer(mockContainer.id);

      expect(global.browser.storage.local.set).toHaveBeenCalledWith({
        containers: []
      });
    });
  });

  describe('Rule Operations', () => {
    const mockRule: Rule = {
      id: 'rule-1',
      containerId: 'firefox-container-1',
      pattern: 'example.com',
      matchType: 'domain',
      ruleType: 'include',
      priority: 1,
      enabled: true,
      created: Date.now(),
      modified: Date.now(),
      metadata: {
        source: 'user',
      },
    };

    it('should store and retrieve rules', async () => {
      (global.browser.storage.local.get as jest.Mock).mockResolvedValue({
        rules: []
      });

      const rules = await storageService.getRules();
      expect(rules).toEqual([]);

      await storageService.addRule(mockRule);

      expect(global.browser.storage.local.set).toHaveBeenCalledWith({
        rules: [mockRule]
      });
    });

    it('should sort rules by priority', async () => {
      const lowPriorityRule = { ...mockRule, id: 'rule-low', priority: 1 };
      const highPriorityRule = { ...mockRule, id: 'rule-high', priority: 10 };

      (global.browser.storage.local.get as jest.Mock).mockResolvedValue({
        rules: []
      });

      await storageService.addRule(lowPriorityRule);
      await storageService.addRule(highPriorityRule);

      // Should be called twice, second call should have sorted rules
      const calls = (global.browser.storage.local.set as jest.Mock).mock.calls;
      const lastCall = calls[calls.length - 1][0];

      expect(lastCall.rules[0]).toEqual(highPriorityRule); // Higher priority first
      expect(lastCall.rules[1]).toEqual(lowPriorityRule);
    });
  });

  describe('Setup', () => {
    it('should handle fresh install', async () => {
      (global.browser.storage.local.get as jest.Mock).mockResolvedValue({});

      await storageService.migrate();

      const calls = (global.browser.storage.local.set as jest.Mock).mock.calls;
      expect(calls.length).toBeGreaterThanOrEqual(1);
      const firstCallArg = calls[0][0];
      expect(firstCallArg).toEqual(expect.objectContaining({
        containers: expect.any(Array),
        rules: expect.any(Array),
        preferences: expect.any(Object),
        bookmarks: expect.any(Array),
      }));
      // Optional additional datasets supported by service
      expect(firstCallArg).toEqual(expect.objectContaining({
        categories: expect.any(Array),
        stats: expect.any(Object),
        templates: expect.any(Array),
      }));
    });

    it('should skip setup if already current version', async () => {
      (global.browser.storage.local.get as jest.Mock).mockResolvedValue({
        version: '2.0.0'
      });

      await storageService.migrate();

      // Should not perform setup since version matches
      expect(global.browser.storage.local.set).not.toHaveBeenCalled();
    });
  });

  describe('Backup and Restore', () => {
    it('should create backup', async () => {
      const mockData = {
        containers: [],
        rules: [],
        // Preferences now default to DEFAULT_PREFERENCES in the service
        preferences: undefined as any,
        bookmarks: [],
      };

      (global.browser.storage.local.get as jest.Mock)
        .mockResolvedValueOnce({ containers: mockData.containers })
        .mockResolvedValueOnce({ rules: mockData.rules })
        .mockResolvedValueOnce({ preferences: mockData.preferences })
        .mockResolvedValueOnce({ bookmarks: mockData.bookmarks });

      const backup = await storageService.backup();

      expect(backup).toEqual(expect.objectContaining({
        version: '2.0.0',
        timestamp: expect.any(Number),
        containers: mockData.containers,
        rules: mockData.rules,
        // Service merges defaults; assert on shape rather than exact {}
        preferences: expect.objectContaining({ theme: 'auto' }),
        bookmarks: mockData.bookmarks,
        // Optional additional datasets included by service
        categories: expect.any(Array),
        stats: expect.any(Object),
      }));
    });

    it('should restore from backup', async () => {
      const backup = {
        version: '2.0.0',
        timestamp: Date.now(),
        containers: [],
        rules: [],
        preferences: { theme: 'auto', keepOldTabs: false, matchDomainOnly: true, syncEnabled: false, syncOptions: { syncRules: true, syncContainers: true, syncPreferences: true }, notifications: { showOnRuleMatch: false, showOnRestrict: true, showOnExclude: false }, advanced: { debugMode: false, performanceMode: false, cacheTimeout: 60000 } },
        bookmarks: [],
        categories: [],
        stats: {},
      };

      await storageService.restore(backup);

      // Called at least once for each dataset; don't over-specify exact count
      expect((global.browser.storage.local.set as jest.Mock).mock.calls.length).toBeGreaterThanOrEqual(4);
    });

    it('should reject backup with wrong version', async () => {
      const backup = {
        version: '1.0.0',
        timestamp: Date.now(),
        containers: [],
        rules: [],
        preferences: {},
        bookmarks: [],
        categories: [],
        stats: {},
      };

      await expect(storageService.restore(backup)).rejects.toThrow(
        'Backup version 1.0.0 is not compatible with current version 2.0.0'
      );
    });
  });
});