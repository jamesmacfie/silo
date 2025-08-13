import { StorageService } from '@/background/services/StorageService';
import { Container, Rule, Preferences, BookmarkAssociation, ContainerStats } from '@/shared/types';
import { STORAGE_KEYS, DEFAULT_PREFERENCES } from '@/shared/constants';
import { z } from 'zod';

jest.mock('@/shared/utils/logger');

describe('StorageService', () => {
  let storageService: StorageService;

  const mockContainer: Container = {
    id: 'test-1',
    name: 'Test Container',
    icon: 'fingerprint',
    color: 'blue',
    cookieStoreId: 'firefox-container-1',
    created: 1640995200000,
    modified: 1640995200000,
    temporary: false,
    syncEnabled: true,
    metadata: {
      description: 'Test container description',
      lifetime: 'permanent',
      categories: ['Work'],
    },
  };

  const mockRule: Rule = {
    id: 'rule-1',
    containerId: 'firefox-container-1',
    pattern: 'example.com',
    matchType: 'domain',
    ruleType: 'include',
    priority: 1,
    enabled: true,
    created: 1640995200000,
    modified: 1640995200000,
    metadata: {
      description: 'Test rule',
      source: 'user',
      tags: ['test'],
    },
  };

  const mockBookmark: BookmarkAssociation = {
    bookmarkId: 'bookmark-1',
    containerId: 'firefox-container-1',
    url: 'https://example.com',
    created: 1640995200000,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset singleton instance
    (StorageService as any).instance = null;
    
    // Setup default browser storage mocks
    global.browser.storage = {
      local: {
        get: jest.fn(),
        set: jest.fn(),
        remove: jest.fn(),
        clear: jest.fn(),
      },
      sync: {
        get: jest.fn(),
        set: jest.fn(),
        remove: jest.fn(),
      },
    } as any;
    
    storageService = StorageService.getInstance();
  });

  describe('getInstance', () => {
    it('should return singleton instance', () => {
      const instance1 = StorageService.getInstance();
      const instance2 = StorageService.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('Generic Storage Operations', () => {
    it('should get and set values', async () => {
      const testData = { foo: 'bar' };
      (browser.storage.local.get as jest.Mock).mockResolvedValue({ testKey: testData });
      
      const result = await storageService.get<typeof testData>('testKey');
      expect(result).toEqual(testData);
      expect(browser.storage.local.get).toHaveBeenCalledWith('testKey');
      
      await storageService.set('testKey', testData);
      expect(browser.storage.local.set).toHaveBeenCalledWith({ testKey: testData });
    });

    it('should return null for missing keys', async () => {
      (browser.storage.local.get as jest.Mock).mockResolvedValue({});
      
      const result = await storageService.get('missingKey');
      expect(result).toBeNull();
    });

    it('should remove keys', async () => {
      await storageService.remove('testKey');
      expect(browser.storage.local.remove).toHaveBeenCalledWith('testKey');
    });

    it('should clear all storage', async () => {
      await storageService.clear();
      expect(browser.storage.local.clear).toHaveBeenCalled();
    });
  });

  describe('Sync Storage Operations', () => {
    it('should handle sync get operations', async () => {
      const testData = { synced: true };
      (browser.storage.sync.get as jest.Mock).mockResolvedValue({ syncKey: testData });
      
      const result = await storageService.syncGet<typeof testData>('syncKey');
      expect(result).toEqual(testData);
      expect(browser.storage.sync.get).toHaveBeenCalledWith('syncKey');
    });

    it('should return null for sync get failures', async () => {
      (browser.storage.sync.get as jest.Mock).mockRejectedValue(new Error('Sync not available'));
      
      const result = await storageService.syncGet('syncKey');
      expect(result).toBeNull();
    });

    it('should handle sync set operations', async () => {
      const testData = { synced: true };
      
      await storageService.syncSet('syncKey', testData);
      expect(browser.storage.sync.set).toHaveBeenCalledWith({ syncKey: testData });
    });

    it('should throw on sync set failures', async () => {
      (browser.storage.sync.set as jest.Mock).mockRejectedValue(new Error('Sync quota exceeded'));
      
      await expect(storageService.syncSet('syncKey', {})).rejects.toThrow('Sync quota exceeded');
    });

    it('should handle sync remove operations', async () => {
      await storageService.syncRemove('syncKey');
      expect(browser.storage.sync.remove).toHaveBeenCalledWith('syncKey');
    });

    it('should not throw on sync remove failures', async () => {
      (browser.storage.sync.remove as jest.Mock).mockRejectedValue(new Error('Sync error'));
      
      await expect(storageService.syncRemove('syncKey')).resolves.not.toThrow();
    });
  });

  describe('Container Operations', () => {

    it('should store and retrieve containers', async () => {
      (browser.storage.local.get as jest.Mock).mockResolvedValue({ [STORAGE_KEYS.CONTAINERS]: [] });

      const containers = await storageService.getContainers();
      expect(containers).toEqual([]);
      expect(browser.storage.local.get).toHaveBeenCalledWith(STORAGE_KEYS.CONTAINERS);
    });

    it('should add containers', async () => {
      (browser.storage.local.get as jest.Mock).mockResolvedValue({ [STORAGE_KEYS.CONTAINERS]: [] });
      
      await storageService.addContainer(mockContainer);
      
      expect(browser.storage.local.set).toHaveBeenCalledWith({
        [STORAGE_KEYS.CONTAINERS]: [mockContainer]
      });
    });

    it('should set containers with validation', async () => {
      await storageService.setContainers([mockContainer]);
      
      expect(browser.storage.local.set).toHaveBeenCalledWith({
        [STORAGE_KEYS.CONTAINERS]: [mockContainer]
      });
    });

    it('should reject invalid containers', async () => {
      const invalidContainer = { ...mockContainer, id: 123 as any }; // Invalid: number instead of string
      
      await expect(storageService.setContainers([invalidContainer])).rejects.toThrow('Invalid containers');
    });

    it('should reject duplicate container IDs', async () => {
      const duplicate = { ...mockContainer };
      
      await expect(storageService.setContainers([mockContainer, duplicate])).rejects.toThrow('Duplicate container ID');
    });

    it('should update container', async () => {
      (browser.storage.local.get as jest.Mock).mockResolvedValue({
        [STORAGE_KEYS.CONTAINERS]: [mockContainer]
      });

      const updates = { name: 'Updated Container' };
      await storageService.updateContainer(mockContainer.id, updates);

      expect(browser.storage.local.set).toHaveBeenCalledWith({
        [STORAGE_KEYS.CONTAINERS]: [expect.objectContaining({
          ...mockContainer,
          ...updates,
          modified: expect.any(Number),
        })]
      });
    });

    it('should throw error when updating non-existent container', async () => {
      (browser.storage.local.get as jest.Mock).mockResolvedValue({ [STORAGE_KEYS.CONTAINERS]: [] });
      
      await expect(storageService.updateContainer('non-existent', { name: 'Test' })).rejects.toThrow('Container not found: non-existent');
    });

    it('should remove container', async () => {
      (browser.storage.local.get as jest.Mock).mockResolvedValue({
        [STORAGE_KEYS.CONTAINERS]: [mockContainer]
      });

      await storageService.removeContainer(mockContainer.id);

      expect(browser.storage.local.set).toHaveBeenCalledWith({
        [STORAGE_KEYS.CONTAINERS]: []
      });
    });
  });

  describe('Rule Operations', () => {

    it('should store and retrieve rules', async () => {
      (browser.storage.local.get as jest.Mock).mockResolvedValue({ [STORAGE_KEYS.RULES]: [] });

      const rules = await storageService.getRules();
      expect(rules).toEqual([]);
      expect(browser.storage.local.get).toHaveBeenCalledWith(STORAGE_KEYS.RULES);
    });

    it('should add rules', async () => {
      (browser.storage.local.get as jest.Mock).mockResolvedValue({ [STORAGE_KEYS.RULES]: [] });
      
      await storageService.addRule(mockRule);
      
      expect(browser.storage.local.set).toHaveBeenCalledWith({
        [STORAGE_KEYS.RULES]: [mockRule]
      });
    });

    it('should set rules with validation', async () => {
      await storageService.setRules([mockRule]);
      
      expect(browser.storage.local.set).toHaveBeenCalledWith({
        [STORAGE_KEYS.RULES]: [mockRule]
      });
    });

    it('should reject invalid rules', async () => {
      const invalidRule = { ...mockRule, pattern: 123 as any }; // Invalid: number instead of string
      
      await expect(storageService.setRules([invalidRule])).rejects.toThrow('Invalid rules');
    });

    it('should reject duplicate rule IDs', async () => {
      const duplicate = { ...mockRule };
      
      await expect(storageService.setRules([mockRule, duplicate])).rejects.toThrow('Duplicate rule ID');
    });

    it('should validate INCLUDE rules require containerId', async () => {
      const includeRule = { ...mockRule, ruleType: 'include' as const, containerId: undefined };
      
      await expect(storageService.setRules([includeRule])).rejects.toThrow('Missing containerId');
    });

    it('should validate RESTRICT rules require containerId', async () => {
      const restrictRule = { ...mockRule, ruleType: 'restrict' as const, containerId: undefined };
      
      await expect(storageService.setRules([restrictRule])).rejects.toThrow('Missing containerId');
    });

    it('should warn about containerId on EXCLUDE rules', async () => {
      const excludeRule = { ...mockRule, ruleType: 'exclude' as const, containerId: 'some-container' };
      
      // Should not throw, but validation should warn (we test this indirectly)
      await expect(storageService.setRules([excludeRule])).resolves.not.toThrow();
    });

    it('should validate regex patterns', async () => {
      const regexRule = { ...mockRule, matchType: 'regex' as const, pattern: '(unclosed' };
      
      await expect(storageService.setRules([regexRule])).rejects.toThrow('Invalid regex pattern');
    });

    it('should update rules', async () => {
      (browser.storage.local.get as jest.Mock).mockResolvedValue({ [STORAGE_KEYS.RULES]: [mockRule] });
      
      const updates = { pattern: 'updated.com' };
      await storageService.updateRule(mockRule.id, updates);
      
      expect(browser.storage.local.set).toHaveBeenCalledWith({
        [STORAGE_KEYS.RULES]: [expect.objectContaining({
          ...mockRule,
          ...updates,
          modified: expect.any(Number),
        })]
      });
    });

    it('should resort rules when priority changes', async () => {
      const rule1 = { ...mockRule, id: 'rule1', priority: 1 };
      const rule2 = { ...mockRule, id: 'rule2', priority: 5 };
      (browser.storage.local.get as jest.Mock).mockResolvedValue({ [STORAGE_KEYS.RULES]: [rule1, rule2] });
      
      await storageService.updateRule('rule1', { priority: 10 });
      
      const calls = (browser.storage.local.set as jest.Mock).mock.calls;
      const lastCall = calls[calls.length - 1][0];
      expect(lastCall[STORAGE_KEYS.RULES][0].id).toBe('rule1'); // Should be first due to higher priority
    });

    it('should throw error when updating non-existent rule', async () => {
      (browser.storage.local.get as jest.Mock).mockResolvedValue({ [STORAGE_KEYS.RULES]: [] });
      
      await expect(storageService.updateRule('non-existent', { priority: 5 })).rejects.toThrow('Rule not found: non-existent');
    });

    it('should remove rules', async () => {
      (browser.storage.local.get as jest.Mock).mockResolvedValue({ [STORAGE_KEYS.RULES]: [mockRule] });
      
      await storageService.removeRule(mockRule.id);
      
      expect(browser.storage.local.set).toHaveBeenCalledWith({
        [STORAGE_KEYS.RULES]: []
      });
    });

    it('should sort rules by priority when adding', async () => {
      const lowPriorityRule = { ...mockRule, id: 'rule-low', priority: 1 };
      const highPriorityRule = { ...mockRule, id: 'rule-high', priority: 10 };

      (browser.storage.local.get as jest.Mock).mockResolvedValue({ [STORAGE_KEYS.RULES]: [] });

      await storageService.addRule(lowPriorityRule);
      await storageService.addRule(highPriorityRule);

      const calls = (browser.storage.local.set as jest.Mock).mock.calls;
      const lastCall = calls[calls.length - 1][0];

      expect(lastCall[STORAGE_KEYS.RULES][0]).toEqual(highPriorityRule); // Higher priority first
      expect(lastCall[STORAGE_KEYS.RULES][1]).toEqual(lowPriorityRule);
    });
  });

  describe('Preferences Operations', () => {
    it('should get preferences with defaults', async () => {
      (browser.storage.local.get as jest.Mock).mockResolvedValue({});
      
      const prefs = await storageService.getPreferences();
      expect(prefs).toEqual(DEFAULT_PREFERENCES);
    });

    it('should merge saved preferences with defaults', async () => {
      const savedPrefs = { theme: 'dark' as const };
      (browser.storage.local.get as jest.Mock).mockResolvedValue({ [STORAGE_KEYS.PREFERENCES]: savedPrefs });
      
      const prefs = await storageService.getPreferences();
      expect(prefs).toEqual({ ...DEFAULT_PREFERENCES, ...savedPrefs });
    });

    it('should update preferences', async () => {
      const currentPrefs = { ...DEFAULT_PREFERENCES, theme: 'light' as const };
      (browser.storage.local.get as jest.Mock).mockResolvedValue({ [STORAGE_KEYS.PREFERENCES]: currentPrefs });
      
      const updates = { theme: 'dark' as const, keepOldTabs: true };
      await storageService.updatePreferences(updates);
      
      expect(browser.storage.local.set).toHaveBeenCalledWith({
        [STORAGE_KEYS.PREFERENCES]: { ...currentPrefs, ...updates }
      });
    });
  });

  describe('Bookmark Associations', () => {
    it('should get bookmark associations', async () => {
      (browser.storage.local.get as jest.Mock).mockResolvedValue({ [STORAGE_KEYS.BOOKMARKS]: [mockBookmark] });
      
      const bookmarks = await storageService.getBookmarkAssociations();
      expect(bookmarks).toEqual([mockBookmark]);
    });

    it('should return empty array when no bookmarks', async () => {
      (browser.storage.local.get as jest.Mock).mockResolvedValue({});
      
      const bookmarks = await storageService.getBookmarkAssociations();
      expect(bookmarks).toEqual([]);
    });

    it('should set bookmark associations', async () => {
      await storageService.setBookmarkAssociations([mockBookmark]);
      
      expect(browser.storage.local.set).toHaveBeenCalledWith({
        [STORAGE_KEYS.BOOKMARKS]: [mockBookmark]
      });
    });

    it('should add bookmark association', async () => {
      (browser.storage.local.get as jest.Mock).mockResolvedValue({ [STORAGE_KEYS.BOOKMARKS]: [] });
      
      await storageService.addBookmarkAssociation(mockBookmark);
      
      expect(browser.storage.local.set).toHaveBeenCalledWith({
        [STORAGE_KEYS.BOOKMARKS]: [mockBookmark]
      });
    });

    it('should update existing bookmark association', async () => {
      const existingBookmark = { ...mockBookmark, containerId: 'old-container' };
      const updatedBookmark = { ...mockBookmark, containerId: 'new-container' };
      
      (browser.storage.local.get as jest.Mock).mockResolvedValue({ [STORAGE_KEYS.BOOKMARKS]: [existingBookmark] });
      
      await storageService.addBookmarkAssociation(updatedBookmark);
      
      expect(browser.storage.local.set).toHaveBeenCalledWith({
        [STORAGE_KEYS.BOOKMARKS]: [updatedBookmark]
      });
    });

    it('should remove bookmark association', async () => {
      (browser.storage.local.get as jest.Mock).mockResolvedValue({ [STORAGE_KEYS.BOOKMARKS]: [mockBookmark] });
      
      await storageService.removeBookmarkAssociation(mockBookmark.bookmarkId);
      
      expect(browser.storage.local.set).toHaveBeenCalledWith({
        [STORAGE_KEYS.BOOKMARKS]: []
      });
    });

    it('should get specific bookmark association', async () => {
      (browser.storage.local.get as jest.Mock).mockResolvedValue({ [STORAGE_KEYS.BOOKMARKS]: [mockBookmark] });
      
      const result = await storageService.getBookmarkAssociation(mockBookmark.bookmarkId);
      expect(result).toEqual(mockBookmark);
    });

    it('should return null for non-existent bookmark association', async () => {
      (browser.storage.local.get as jest.Mock).mockResolvedValue({ [STORAGE_KEYS.BOOKMARKS]: [] });
      
      const result = await storageService.getBookmarkAssociation('non-existent');
      expect(result).toBeNull();
    });
  });

  describe('Category Operations', () => {
    it('should get categories', async () => {
      const categories = ['Work', 'Personal'];
      (browser.storage.local.get as jest.Mock).mockResolvedValue({ [STORAGE_KEYS.CATEGORIES]: categories });
      
      const result = await storageService.getCategories();
      expect(result).toEqual(categories);
    });

    it('should return empty array when no categories', async () => {
      (browser.storage.local.get as jest.Mock).mockResolvedValue({});
      
      const result = await storageService.getCategories();
      expect(result).toEqual([]);
    });

    it('should set categories with deduplication', async () => {
      const categories = ['Work', 'Personal', 'Work', '', 'Gaming'];
      
      await storageService.setCategories(categories);
      
      expect(browser.storage.local.set).toHaveBeenCalledWith({
        [STORAGE_KEYS.CATEGORIES]: ['Work', 'Personal', 'Gaming']
      });
    });

    it('should add new category', async () => {
      (browser.storage.local.get as jest.Mock).mockResolvedValue({ [STORAGE_KEYS.CATEGORIES]: ['Work'] });
      
      await storageService.addCategory('Personal');
      
      expect(browser.storage.local.set).toHaveBeenCalledWith({
        [STORAGE_KEYS.CATEGORIES]: ['Work', 'Personal']
      });
    });

    it('should not add duplicate category', async () => {
      (browser.storage.local.get as jest.Mock).mockResolvedValue({ [STORAGE_KEYS.CATEGORIES]: ['Work'] });
      
      await storageService.addCategory('Work');
      
      expect(browser.storage.local.set).not.toHaveBeenCalled();
    });

    it('should rename category and update container references', async () => {
      const categories = ['Work', 'Personal'];
      const containerWithCategory = { ...mockContainer, metadata: { ...mockContainer.metadata, categories: ['Work'] } };
      
      (browser.storage.local.get as jest.Mock)
        .mockResolvedValueOnce({ [STORAGE_KEYS.CATEGORIES]: categories })
        .mockResolvedValueOnce({ [STORAGE_KEYS.CONTAINERS]: [containerWithCategory] });
      
      await storageService.renameCategory('Work', 'Business');
      
      expect(browser.storage.local.set).toHaveBeenCalledWith({
        [STORAGE_KEYS.CATEGORIES]: ['Business', 'Personal']
      });
      expect(browser.storage.local.set).toHaveBeenCalledWith({
        [STORAGE_KEYS.CONTAINERS]: [expect.objectContaining({
          metadata: expect.objectContaining({
            categories: ['Business']
          })
        })]
      });
    });

    it('should delete category and remove from container references', async () => {
      const categories = ['Work', 'Personal'];
      const containerWithCategory = { ...mockContainer, metadata: { ...mockContainer.metadata, categories: ['Work', 'Personal'] } };
      
      (browser.storage.local.get as jest.Mock)
        .mockResolvedValueOnce({ [STORAGE_KEYS.CATEGORIES]: categories })
        .mockResolvedValueOnce({ [STORAGE_KEYS.CONTAINERS]: [containerWithCategory] });
      
      await storageService.deleteCategory('Work');
      
      expect(browser.storage.local.set).toHaveBeenCalledWith({
        [STORAGE_KEYS.CATEGORIES]: ['Personal']
      });
      expect(browser.storage.local.set).toHaveBeenCalledWith({
        [STORAGE_KEYS.CONTAINERS]: [expect.objectContaining({
          metadata: expect.objectContaining({
            categories: ['Personal']
          })
        })]
      });
    });
  });

  describe('Stats Operations', () => {
    const mockStats: ContainerStats = {
      containerId: 'firefox-container-1',
      tabsOpened: 5,
      rulesMatched: 3,
      lastUsed: 1640995200000,
      activeTabCount: 2,
      history: [
        { timestamp: 1640995200000, event: 'open' },
        { timestamp: 1640995300000, event: 'match' },
      ],
    };

    it('should get stats', async () => {
      const statsData = { 'firefox-container-1': mockStats };
      (browser.storage.local.get as jest.Mock).mockResolvedValue({ [STORAGE_KEYS.STATS]: statsData });
      
      const result = await storageService.getStats();
      expect(result).toEqual(statsData);
    });

    it('should return empty object when no stats', async () => {
      (browser.storage.local.get as jest.Mock).mockResolvedValue({});
      
      const result = await storageService.getStats();
      expect(result).toEqual({});
    });

    it('should set stats', async () => {
      const statsData = { 'firefox-container-1': mockStats };
      
      await storageService.setStats(statsData);
      
      expect(browser.storage.local.set).toHaveBeenCalledWith({
        [STORAGE_KEYS.STATS]: statsData
      });
    });

    it('should record open stat', async () => {
      (browser.storage.local.get as jest.Mock)
        .mockResolvedValueOnce({ [STORAGE_KEYS.PREFERENCES]: { stats: { enabled: true } } })
        .mockResolvedValueOnce({ [STORAGE_KEYS.STATS]: {} });
      
      await storageService.recordStat('firefox-container-1', 'open');
      
      const calls = (browser.storage.local.set as jest.Mock).mock.calls;
      const statsCall = calls.find(call => call[0][STORAGE_KEYS.STATS]);
      const stats = statsCall[0][STORAGE_KEYS.STATS]['firefox-container-1'];
      
      expect(stats.tabsOpened).toBe(1);
      expect(stats.activeTabCount).toBe(1);
      expect(stats.lastUsed).toBeDefined();
      expect(stats.history).toHaveLength(1);
      expect(stats.history[0].event).toBe('open');
    });

    it('should record match stat', async () => {
      (browser.storage.local.get as jest.Mock)
        .mockResolvedValueOnce({ [STORAGE_KEYS.PREFERENCES]: { stats: { enabled: true } } })
        .mockResolvedValueOnce({ [STORAGE_KEYS.STATS]: {} });
      
      await storageService.recordStat('firefox-container-1', 'match');
      
      const calls = (browser.storage.local.set as jest.Mock).mock.calls;
      const statsCall = calls.find(call => call[0][STORAGE_KEYS.STATS]);
      const stats = statsCall[0][STORAGE_KEYS.STATS]['firefox-container-1'];
      
      expect(stats.rulesMatched).toBe(1);
    });

    it('should record close stat', async () => {
      const existingStats = { ...mockStats, activeTabCount: 2 };
      (browser.storage.local.get as jest.Mock)
        .mockResolvedValueOnce({ [STORAGE_KEYS.PREFERENCES]: { stats: { enabled: true } } })
        .mockResolvedValueOnce({ [STORAGE_KEYS.STATS]: { 'firefox-container-1': existingStats } });
      
      await storageService.recordStat('firefox-container-1', 'close');
      
      const calls = (browser.storage.local.set as jest.Mock).mock.calls;
      const statsCall = calls.find(call => call[0][STORAGE_KEYS.STATS]);
      const stats = statsCall[0][STORAGE_KEYS.STATS]['firefox-container-1'];
      
      expect(stats.activeTabCount).toBe(1);
    });

    it('should record touch stat', async () => {
      (browser.storage.local.get as jest.Mock)
        .mockResolvedValueOnce({ [STORAGE_KEYS.PREFERENCES]: { stats: { enabled: true } } })
        .mockResolvedValueOnce({ [STORAGE_KEYS.STATS]: {} });
      
      await storageService.recordStat('firefox-container-1', 'touch');
      
      const calls = (browser.storage.local.set as jest.Mock).mock.calls;
      const statsCall = calls.find(call => call[0][STORAGE_KEYS.STATS]);
      const stats = statsCall[0][STORAGE_KEYS.STATS]['firefox-container-1'];
      
      expect(stats.lastUsed).toBeDefined();
    });

    it('should not record stats when disabled', async () => {
      (browser.storage.local.get as jest.Mock).mockResolvedValue({ 
        [STORAGE_KEYS.PREFERENCES]: { stats: { enabled: false } }
      });
      
      await storageService.recordStat('firefox-container-1', 'open');
      
      expect(browser.storage.local.set).not.toHaveBeenCalled();
    });

    it('should handle preferences fetch errors gracefully', async () => {
      (browser.storage.local.get as jest.Mock)
        .mockRejectedValueOnce(new Error('Preferences error'))
        .mockResolvedValueOnce({ [STORAGE_KEYS.STATS]: {} });
      
      await storageService.recordStat('firefox-container-1', 'open');
      
      // Should still record the stat despite preferences error
      expect(browser.storage.local.set).toHaveBeenCalled();
    });

    it('should trim history when it exceeds 1000 entries', async () => {
      const largeHistory = Array.from({ length: 1001 }, (_, i) => ({ timestamp: i, event: 'open' as const }));
      const existingStats = { ...mockStats, history: largeHistory };
      
      (browser.storage.local.get as jest.Mock)
        .mockResolvedValueOnce({ [STORAGE_KEYS.PREFERENCES]: { stats: { enabled: true } } })
        .mockResolvedValueOnce({ [STORAGE_KEYS.STATS]: { 'firefox-container-1': existingStats } });
      
      await storageService.recordStat('firefox-container-1', 'open');
      
      const calls = (browser.storage.local.set as jest.Mock).mock.calls;
      const statsCall = calls.find(call => call[0][STORAGE_KEYS.STATS]);
      const stats = statsCall[0][STORAGE_KEYS.STATS]['firefox-container-1'];
      
      expect(stats.history).toHaveLength(1000);
    });

    it('should reset stats', async () => {
      await storageService.resetStats();
      
      expect(browser.storage.local.set).toHaveBeenCalledWith({
        [STORAGE_KEYS.STATS]: {}
      });
    });
  });

  describe('Template Operations', () => {
    const mockTemplate = {
      name: 'Work Template',
      color: 'blue' as const,
      icon: 'briefcase' as const,
      metadata: { lifetime: 'permanent' as const }
    };

    it('should get templates', async () => {
      (browser.storage.local.get as jest.Mock).mockResolvedValue({ [STORAGE_KEYS.TEMPLATES]: [mockTemplate] });
      
      const result = await storageService.getTemplates();
      expect(result).toEqual([mockTemplate]);
    });

    it('should return empty array when no templates', async () => {
      (browser.storage.local.get as jest.Mock).mockResolvedValue({});
      
      const result = await storageService.getTemplates();
      expect(result).toEqual([]);
    });

    it('should save new template', async () => {
      (browser.storage.local.get as jest.Mock).mockResolvedValue({ [STORAGE_KEYS.TEMPLATES]: [] });
      
      await storageService.saveTemplate(mockTemplate);
      
      expect(browser.storage.local.set).toHaveBeenCalledWith({
        [STORAGE_KEYS.TEMPLATES]: [mockTemplate]
      });
    });

    it('should update existing template', async () => {
      const existingTemplate = { ...mockTemplate, color: 'red' as const };
      const updatedTemplate = { ...mockTemplate, color: 'green' as const };
      
      (browser.storage.local.get as jest.Mock).mockResolvedValue({ [STORAGE_KEYS.TEMPLATES]: [existingTemplate] });
      
      await storageService.saveTemplate(updatedTemplate);
      
      expect(browser.storage.local.set).toHaveBeenCalledWith({
        [STORAGE_KEYS.TEMPLATES]: [updatedTemplate]
      });
    });

    it('should delete template', async () => {
      (browser.storage.local.get as jest.Mock).mockResolvedValue({ [STORAGE_KEYS.TEMPLATES]: [mockTemplate] });
      
      await storageService.deleteTemplate(mockTemplate.name);
      
      expect(browser.storage.local.set).toHaveBeenCalledWith({
        [STORAGE_KEYS.TEMPLATES]: []
      });
    });
  });

  describe('Migration and Setup', () => {
    it('should handle fresh install', async () => {
      (browser.storage.local.get as jest.Mock).mockResolvedValue({});

      await storageService.migrate();

      const calls = (browser.storage.local.set as jest.Mock).mock.calls;
      expect(calls.length).toBeGreaterThanOrEqual(1);
      
      // Check that setupDefaults was called
      const setupCall = calls.find(call => call[0][STORAGE_KEYS.CONTAINERS] !== undefined);
      expect(setupCall).toBeDefined();
      expect(setupCall[0]).toEqual(expect.objectContaining({
        [STORAGE_KEYS.CONTAINERS]: expect.any(Array),
        [STORAGE_KEYS.RULES]: expect.any(Array),
        [STORAGE_KEYS.PREFERENCES]: expect.any(Object),
        [STORAGE_KEYS.BOOKMARKS]: expect.any(Array),
        [STORAGE_KEYS.CATEGORIES]: expect.arrayContaining(['Work', 'Personal']),
        [STORAGE_KEYS.STATS]: expect.any(Object),
        [STORAGE_KEYS.TEMPLATES]: expect.arrayContaining([
          expect.objectContaining({ name: 'Work' }),
          expect.objectContaining({ name: 'Personal' }),
        ]),
      }));
      
      // Check that version was set
      expect(browser.storage.local.set).toHaveBeenCalledWith({ version: '2.0.0' });
    });

    it('should skip setup if already current version', async () => {
      (browser.storage.local.get as jest.Mock).mockResolvedValue({ version: '2.0.0' });

      await storageService.migrate();

      // Should not perform setup since version matches
      expect(browser.storage.local.set).not.toHaveBeenCalled();
    });

    it('should update version for existing installations', async () => {
      (browser.storage.local.get as jest.Mock).mockResolvedValue({ version: '1.9.0' });

      await storageService.migrate();

      expect(browser.storage.local.set).toHaveBeenCalledWith({ version: '2.0.0' });
    });
  });

  describe('Backup and Restore', () => {
    it('should create backup', async () => {
      const mockData = {
        containers: [mockContainer],
        rules: [mockRule],
        preferences: { theme: 'dark' as const },
        bookmarks: [mockBookmark],
        categories: ['Work'],
        stats: { 'container-1': { tabsOpened: 5 } },
      };

      (browser.storage.local.get as jest.Mock)
        .mockResolvedValueOnce({ [STORAGE_KEYS.CONTAINERS]: mockData.containers })
        .mockResolvedValueOnce({ [STORAGE_KEYS.RULES]: mockData.rules })
        .mockResolvedValueOnce({ [STORAGE_KEYS.PREFERENCES]: mockData.preferences })
        .mockResolvedValueOnce({ [STORAGE_KEYS.BOOKMARKS]: mockData.bookmarks })
        .mockResolvedValueOnce({ [STORAGE_KEYS.CATEGORIES]: mockData.categories })
        .mockResolvedValueOnce({ [STORAGE_KEYS.STATS]: mockData.stats });

      const backup = await storageService.backup();

      expect(backup).toEqual(expect.objectContaining({
        version: '2.0.0',
        timestamp: expect.any(Number),
        containers: mockData.containers,
        rules: mockData.rules,
        preferences: expect.objectContaining({ theme: 'dark' }),
        bookmarks: mockData.bookmarks,
        categories: mockData.categories,
        stats: mockData.stats,
      }));
    });

    it('should handle missing data in backup', async () => {
      (browser.storage.local.get as jest.Mock)
        .mockResolvedValue({}); // All get calls return empty

      const backup = await storageService.backup();

      expect(backup).toEqual(expect.objectContaining({
        version: '2.0.0',
        containers: [],
        rules: [],
        preferences: DEFAULT_PREFERENCES,
        bookmarks: [],
        categories: [],
        stats: {},
      }));
    });

    it('should restore from backup', async () => {
      const backup = {
        version: '2.0.0',
        timestamp: Date.now(),
        containers: [mockContainer],
        rules: [mockRule],
        preferences: DEFAULT_PREFERENCES,
        bookmarks: [mockBookmark],
        categories: ['Work'],
        stats: { 'container-1': { tabsOpened: 5 } },
      };

      await storageService.restore(backup);

      // Verify all data was restored
      expect(browser.storage.local.set).toHaveBeenCalledWith({ [STORAGE_KEYS.CONTAINERS]: backup.containers });
      expect(browser.storage.local.set).toHaveBeenCalledWith({ [STORAGE_KEYS.RULES]: backup.rules });
      expect(browser.storage.local.set).toHaveBeenCalledWith({ [STORAGE_KEYS.PREFERENCES]: backup.preferences });
      expect(browser.storage.local.set).toHaveBeenCalledWith({ [STORAGE_KEYS.BOOKMARKS]: backup.bookmarks });
      expect(browser.storage.local.set).toHaveBeenCalledWith({ [STORAGE_KEYS.CATEGORIES]: backup.categories });
      expect(browser.storage.local.set).toHaveBeenCalledWith({ [STORAGE_KEYS.STATS]: backup.stats });
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

    it('should reject backup with no version', async () => {
      const backup = {
        timestamp: Date.now(),
        containers: [],
        rules: [],
        preferences: {},
        bookmarks: [],
        categories: [],
        stats: {},
      } as any;

      await expect(storageService.restore(backup)).rejects.toThrow(
        'Backup version unknown is not compatible with current version 2.0.0'
      );
    });
  });
});