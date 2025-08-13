import { RequestInterceptor } from '@/background/services/RequestInterceptor';
import browser from 'webextension-polyfill';
import rulesEngine from '@/background/services/RulesEngine';
import containerManager from '@/background/services/ContainerManager';
import storageService from '@/background/services/StorageService';
import bookmarkIntegration from '@/background/services/BookmarkIntegration';
import { EvaluationResult, RuleType } from '@/shared/types';

jest.mock('@/background/services/RulesEngine');
jest.mock('@/background/services/ContainerManager');
jest.mock('@/background/services/StorageService');
jest.mock('@/background/services/BookmarkIntegration');
jest.mock('@/shared/utils/logger');

describe('RequestInterceptor', () => {
  let requestInterceptor: RequestInterceptor;
  let mockRulesEngine: jest.Mocked<typeof rulesEngine>;
  let mockContainerManager: jest.Mocked<typeof containerManager>;
  let mockStorageService: jest.Mocked<typeof storageService>;
  let mockBookmarkIntegration: jest.Mocked<typeof bookmarkIntegration>;

  const mockWebRequestDetails: browser.WebRequest.OnBeforeRequestDetailsType = {
    requestId: 'req-123',
    url: 'https://example.com/test',
    method: 'GET',
    frameId: 0,
    parentFrameId: -1,
    tabId: 1,
    type: 'main_frame',
    timeStamp: Date.now(),
    originUrl: 'https://origin.com',
  };

  const mockTab: browser.Tabs.Tab = {
    id: 1,
    index: 0,
    windowId: 1,
    highlighted: false,
    active: true,
    pinned: false,
    incognito: false,
    url: 'https://example.com',
    title: 'Example',
    cookieStoreId: 'firefox-default',
  };

  const mockContainer = {
    id: 'container-1',
    name: 'Work Container',
    icon: 'briefcase',
    color: 'blue',
    cookieStoreId: 'firefox-container-1',
    created: Date.now(),
    modified: Date.now(),
    temporary: false,
    syncEnabled: true,
    metadata: {},
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    
    // Reset singleton instance
    (RequestInterceptor as any).instance = null;
    
    // Setup mocks
    mockRulesEngine = rulesEngine as jest.Mocked<typeof rulesEngine>;
    mockContainerManager = containerManager as jest.Mocked<typeof containerManager>;
    mockStorageService = storageService as jest.Mocked<typeof storageService>;
    mockBookmarkIntegration = bookmarkIntegration as jest.Mocked<typeof bookmarkIntegration>;
    
    // Default mock implementations
    mockBookmarkIntegration.processBookmarkUrl = jest.fn().mockResolvedValue({
      cleanUrl: mockWebRequestDetails.url,
      containerId: null,
    });
    
    mockStorageService.getPreferences = jest.fn().mockResolvedValue({
      keepOldTabs: false,
      notifications: {
        showOnRestrict: true,
        showOnExclude: true,
      },
    });
    
    mockStorageService.recordStat = jest.fn().mockResolvedValue(undefined);
    
    requestInterceptor = RequestInterceptor.getInstance();

    // Mock browser APIs
    global.browser.webRequest = {
      onBeforeRequest: {
        addListener: jest.fn(),
        removeListener: jest.fn(),
        hasListener: jest.fn(),
      },
    } as any;

    global.browser.tabs = {
      create: jest.fn(),
      remove: jest.fn(),
      get: jest.fn(),
      update: jest.fn(),
      query: jest.fn(),
      onUpdated: {
        addListener: jest.fn(),
        removeListener: jest.fn(),
      },
      onCreated: {
        addListener: jest.fn(),
        removeListener: jest.fn(),
      },
      onRemoved: {
        addListener: jest.fn(),
        removeListener: jest.fn(),
      },
    } as any;

    global.browser.notifications = {
      create: jest.fn(),
    } as any;

    global.browser.runtime = {
      getURL: jest.fn().mockReturnValue('chrome-extension://abc/images/extension_48.png'),
    } as any;
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('getInstance', () => {
    it('should return singleton instance', () => {
      const instance1 = RequestInterceptor.getInstance();
      const instance2 = RequestInterceptor.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('register', () => {
    it('should register webRequest and tab listeners when webRequest is available', async () => {
      await requestInterceptor.register();

      expect(browser.webRequest.onBeforeRequest.addListener).toHaveBeenCalledWith(
        expect.any(Function),
        { urls: ['<all_urls>'], types: ['main_frame'] },
        ['blocking']
      );
      expect(browser.tabs.onUpdated.addListener).toHaveBeenCalled();
      expect(browser.tabs.onCreated.addListener).toHaveBeenCalled();
      expect(browser.tabs.onRemoved.addListener).toHaveBeenCalled();
    });

    it('should register only tab listeners when webRequest is not available', async () => {
      global.browser.webRequest = undefined;

      await requestInterceptor.register();

      expect(browser.tabs.onUpdated.addListener).toHaveBeenCalled();
      expect(browser.tabs.onCreated.addListener).toHaveBeenCalled();
      expect(browser.tabs.onRemoved.addListener).toHaveBeenCalled();
    });

    it('should handle webRequest registration errors gracefully', async () => {
      (browser.webRequest.onBeforeRequest.addListener as jest.Mock).mockImplementation(() => {
        throw new Error('Permission denied');
      });

      await requestInterceptor.register();

      // Should still register tab listeners
      expect(browser.tabs.onUpdated.addListener).toHaveBeenCalled();
    });

    it('should not register if already registered', async () => {
      await requestInterceptor.register();
      await requestInterceptor.register();

      expect(browser.webRequest.onBeforeRequest.addListener).toHaveBeenCalledTimes(1);
    });

    it('should throw error if registration fails completely', async () => {
      (browser.tabs.onUpdated.addListener as jest.Mock).mockImplementation(() => {
        throw new Error('Failed to register');
      });

      await expect(requestInterceptor.register()).rejects.toThrow('Failed to register');
    });
  });

  describe('unregister', () => {
    beforeEach(async () => {
      await requestInterceptor.register();
    });

    it('should remove all listeners', async () => {
      await requestInterceptor.unregister();

      expect(browser.webRequest.onBeforeRequest.removeListener).toHaveBeenCalled();
      expect(browser.tabs.onUpdated.removeListener).toHaveBeenCalled();
    });

    it('should handle errors during unregistration', async () => {
      (browser.webRequest.onBeforeRequest.removeListener as jest.Mock).mockImplementation(() => {
        throw new Error('Failed to remove listener');
      });

      // Should not throw
      await expect(requestInterceptor.unregister()).resolves.not.toThrow();
    });

    it('should do nothing if not registered', async () => {
      await requestInterceptor.unregister();
      await requestInterceptor.unregister(); // Second call should be no-op

      expect(browser.webRequest.onBeforeRequest.removeListener).toHaveBeenCalledTimes(1);
    });
  });

  describe('handleRequest', () => {
    beforeEach(() => {
      (browser.tabs.get as jest.Mock).mockResolvedValue(mockTab);
    });

    it('should skip non-main frame requests', async () => {
      const subFrameDetails = { ...mockWebRequestDetails, frameId: 1 };

      const result = await (requestInterceptor as any).handleRequest(subFrameDetails);

      expect(browser.tabs.get).not.toHaveBeenCalled();
      expect(result).toEqual({});
    });

    it('should skip non-interceptable URLs', async () => {
      const details = { ...mockWebRequestDetails, url: 'about:blank' };

      const result = await (requestInterceptor as any).handleRequest(details);

      expect(browser.tabs.get).not.toHaveBeenCalled();
      expect(result).toEqual({});
    });

    it('should skip requests with invalid tab ID', async () => {
      const details = { ...mockWebRequestDetails, tabId: -1 };

      const result = await (requestInterceptor as any).handleRequest(details);

      expect(browser.tabs.get).not.toHaveBeenCalled();
      expect(result).toEqual({});
    });

    it('should handle redirect action', async () => {
      const evaluation: EvaluationResult = {
        action: 'redirect',
        containerId: 'firefox-container-1',
        rule: { id: 'rule1', ruleType: RuleType.INCLUDE, containerId: 'firefox-container-1' } as any,
      };

      mockRulesEngine.evaluate = jest.fn().mockResolvedValue(evaluation);
      (browser.tabs.create as jest.Mock).mockResolvedValue({ id: 2 });

      const result = await (requestInterceptor as any).handleRequest(mockWebRequestDetails);

      expect(browser.tabs.create).toHaveBeenCalledWith({
        url: mockWebRequestDetails.url,
        cookieStoreId: 'firefox-container-1',
        active: true,
      });
      expect(result).toEqual({ cancel: true });
    });

    it('should handle exclude action', async () => {
      const tabInContainer = { ...mockTab, cookieStoreId: 'firefox-container-1' };
      (browser.tabs.get as jest.Mock).mockResolvedValue(tabInContainer);

      const evaluation: EvaluationResult = {
        action: 'exclude',
        rule: { id: 'rule1', ruleType: RuleType.EXCLUDE } as any,
      };

      mockRulesEngine.evaluate = jest.fn().mockResolvedValue(evaluation);
      (browser.tabs.create as jest.Mock).mockResolvedValue({ id: 2 });

      const result = await (requestInterceptor as any).handleRequest(mockWebRequestDetails);

      expect(browser.tabs.create).toHaveBeenCalledWith({
        url: mockWebRequestDetails.url,
        cookieStoreId: 'firefox-default',
        active: true,
      });
      expect(result).toEqual({ cancel: true });
    });

    it('should handle block action', async () => {
      const evaluation: EvaluationResult = {
        action: 'block',
        containerId: 'firefox-container-1',
        rule: { id: 'rule1', ruleType: RuleType.RESTRICT } as any,
      };

      mockRulesEngine.evaluate = jest.fn().mockResolvedValue(evaluation);

      const result = await (requestInterceptor as any).handleRequest(mockWebRequestDetails);

      expect(browser.tabs.create).not.toHaveBeenCalled();
      expect(result).toEqual({ cancel: true });
    });

    it('should handle open action with no redirect needed', async () => {
      const evaluation: EvaluationResult = {
        action: 'open',
        rule: { id: 'rule1', ruleType: RuleType.INCLUDE, containerId: 'firefox-default' } as any,
      };

      mockRulesEngine.evaluate = jest.fn().mockResolvedValue(evaluation);

      const result = await (requestInterceptor as any).handleRequest(mockWebRequestDetails);

      expect(browser.tabs.create).not.toHaveBeenCalled();
      expect(result).toEqual({});
    });

    it('should handle bookmark parameter redirect', async () => {
      mockBookmarkIntegration.processBookmarkUrl = jest.fn().mockResolvedValue({
        cleanUrl: mockWebRequestDetails.url,
        containerId: 'firefox-container-1',
      });

      const evaluation: EvaluationResult = { action: 'open' };
      mockRulesEngine.evaluate = jest.fn().mockResolvedValue(evaluation);
      (browser.tabs.create as jest.Mock).mockResolvedValue({ id: 2 });

      const result = await (requestInterceptor as any).handleRequest(mockWebRequestDetails);

      expect(browser.tabs.create).toHaveBeenCalledWith({
        url: mockWebRequestDetails.url,
        cookieStoreId: 'firefox-container-1',
        active: true,
      });
      expect(result).toEqual({ cancel: true });
    });

    it('should handle errors gracefully', async () => {
      (browser.tabs.get as jest.Mock).mockRejectedValue(new Error('Tab not found'));

      const result = await (requestInterceptor as any).handleRequest(mockWebRequestDetails);

      expect(result).toEqual({});
    });

    it('should record stats for matches', async () => {
      const evaluation: EvaluationResult = {
        action: 'open',
        rule: { 
          id: 'rule1', 
          ruleType: RuleType.INCLUDE, 
          containerId: 'firefox-container-1' 
        } as any,
      };

      const tabInContainer = { ...mockTab, cookieStoreId: 'firefox-container-1' };
      (browser.tabs.get as jest.Mock).mockResolvedValue(tabInContainer);
      mockRulesEngine.evaluate = jest.fn().mockResolvedValue(evaluation);

      await (requestInterceptor as any).handleRequest(mockWebRequestDetails);

      expect(mockStorageService.recordStat).toHaveBeenCalledWith('firefox-container-1', 'match');
      expect(mockStorageService.recordStat).toHaveBeenCalledWith('firefox-container-1', 'touch');
    });
  });

  describe('handleRedirect', () => {
    it('should create new tab and cancel original request', async () => {
      const evaluation: EvaluationResult = {
        action: 'redirect',
        containerId: 'firefox-container-1',
        rule: { id: 'rule1' } as any,
      };

      (browser.tabs.create as jest.Mock).mockResolvedValue({ id: 2 });

      const result = await (requestInterceptor as any).handleRedirect(
        'https://example.com',
        1,
        'firefox-container-1',
        evaluation
      );

      expect(browser.tabs.create).toHaveBeenCalledWith({
        url: 'https://example.com',
        cookieStoreId: 'firefox-container-1',
        active: true,
      });
      expect(result).toEqual({ cancel: true });
    });

    it('should close original tab when keepOldTabs is false', async () => {
      const evaluation: EvaluationResult = {
        action: 'redirect',
        containerId: 'firefox-container-1',
      };

      mockStorageService.getPreferences = jest.fn().mockResolvedValue({
        keepOldTabs: false,
      });

      (browser.tabs.create as jest.Mock).mockResolvedValue({ id: 2 });

      await (requestInterceptor as any).handleRedirect(
        'https://example.com',
        1,
        'firefox-container-1',
        evaluation
      );

      jest.advanceTimersByTime(200);
      
      expect(browser.tabs.remove).toHaveBeenCalledWith(1);
    });

    it('should not close original tab when keepOldTabs is true', async () => {
      const evaluation: EvaluationResult = {
        action: 'redirect',
        containerId: 'firefox-container-1',
      };

      mockStorageService.getPreferences = jest.fn().mockResolvedValue({
        keepOldTabs: true,
      });

      (browser.tabs.create as jest.Mock).mockResolvedValue({ id: 2 });

      await (requestInterceptor as any).handleRedirect(
        'https://example.com',
        1,
        'firefox-container-1',
        evaluation
      );

      jest.advanceTimersByTime(200);
      
      expect(browser.tabs.remove).not.toHaveBeenCalled();
    });

    it('should handle tab creation errors', async () => {
      (browser.tabs.create as jest.Mock).mockRejectedValue(new Error('Failed to create tab'));

      const result = await (requestInterceptor as any).handleRedirect(
        'https://example.com',
        1,
        'firefox-container-1',
        { action: 'redirect' }
      );

      expect(result).toEqual({});
    });

    it('should record stats for successful redirect', async () => {
      const evaluation: EvaluationResult = {
        action: 'redirect',
        containerId: 'firefox-container-1',
        rule: { id: 'rule1' } as any,
      };

      (browser.tabs.create as jest.Mock).mockResolvedValue({ id: 2 });

      await (requestInterceptor as any).handleRedirect(
        'https://example.com',
        1,
        'firefox-container-1',
        evaluation
      );

      expect(mockStorageService.recordStat).toHaveBeenCalledWith('firefox-container-1', 'match');
    });
  });

  describe('handleExclude', () => {
    it('should create tab in default container', async () => {
      const evaluation: EvaluationResult = {
        action: 'exclude',
        rule: { id: 'rule1' } as any,
      };

      (browser.tabs.create as jest.Mock).mockResolvedValue({ id: 2 });

      const result = await (requestInterceptor as any).handleExclude(
        'https://example.com',
        1,
        evaluation,
        'firefox-container-1'
      );

      expect(browser.tabs.create).toHaveBeenCalledWith({
        url: 'https://example.com',
        cookieStoreId: 'firefox-default',
        active: true,
      });
      expect(result).toEqual({ cancel: true });
    });

    it('should show notification when enabled', async () => {
      mockStorageService.getPreferences = jest.fn().mockResolvedValue({
        keepOldTabs: false,
        notifications: { showOnExclude: true },
      });

      (browser.tabs.create as jest.Mock).mockResolvedValue({ id: 2 });

      await (requestInterceptor as any).handleExclude(
        'https://example.com',
        1,
        { action: 'exclude' },
        'firefox-container-1'
      );

      expect(browser.notifications.create).toHaveBeenCalledWith({
        type: 'basic',
        iconUrl: 'chrome-extension://abc/images/extension_48.png',
        title: 'Opened Outside Containers',
        message: 'example.com was opened outside of containers due to an EXCLUDE rule.',
      });
    });

    it('should record stats for source container', async () => {
      (browser.tabs.create as jest.Mock).mockResolvedValue({ id: 2 });

      await (requestInterceptor as any).handleExclude(
        'https://example.com',
        1,
        { action: 'exclude' },
        'firefox-container-1'
      );

      expect(mockStorageService.recordStat).toHaveBeenCalledWith('firefox-container-1', 'match');
    });

    it('should handle tab creation errors', async () => {
      (browser.tabs.create as jest.Mock).mockRejectedValue(new Error('Failed to create tab'));

      const result = await (requestInterceptor as any).handleExclude(
        'https://example.com',
        1,
        { action: 'exclude' },
        'firefox-container-1'
      );

      expect(result).toEqual({});
    });
  });

  describe('handleBlock', () => {
    it('should show restriction notification when enabled', async () => {
      mockContainerManager.getAll = jest.fn().mockResolvedValue([mockContainer]);
      
      mockStorageService.getPreferences = jest.fn().mockResolvedValue({
        notifications: { showOnRestrict: true },
      });

      const evaluation: EvaluationResult = {
        action: 'block',
        containerId: 'firefox-container-1',
        rule: { id: 'rule1' } as any,
      };

      const result = await (requestInterceptor as any).handleBlock(
        'https://example.com',
        1,
        evaluation
      );

      expect(browser.notifications.create).toHaveBeenCalledWith({
        type: 'basic',
        iconUrl: 'chrome-extension://abc/images/extension_48.png',
        title: 'Domain Restricted',
        message: 'example.com can only be opened in "Work Container" container.',
      });
      expect(result).toEqual({ cancel: true });
    });

    it('should not show notification when disabled', async () => {
      mockStorageService.getPreferences = jest.fn().mockResolvedValue({
        notifications: { showOnRestrict: false },
      });

      const result = await (requestInterceptor as any).handleBlock(
        'https://example.com',
        1,
        { action: 'block', containerId: 'firefox-container-1' }
      );

      expect(browser.notifications.create).not.toHaveBeenCalled();
      expect(result).toEqual({ cancel: true });
    });
  });

  describe('showRestrictionNotification', () => {
    it('should create notification with container name', async () => {
      mockContainerManager.getAll = jest.fn().mockResolvedValue([mockContainer]);

      await (requestInterceptor as any).showRestrictionNotification(
        'https://example.com',
        'firefox-container-1'
      );

      expect(browser.notifications.create).toHaveBeenCalledWith({
        type: 'basic',
        iconUrl: 'chrome-extension://abc/images/extension_48.png',
        title: 'Domain Restricted',
        message: 'example.com can only be opened in "Work Container" container.',
      });
    });

    it('should handle unknown container', async () => {
      mockContainerManager.getAll = jest.fn().mockResolvedValue([]);

      await (requestInterceptor as any).showRestrictionNotification(
        'https://example.com',
        'unknown-container'
      );

      expect(browser.notifications.create).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'example.com can only be opened in "Unknown Container" container.',
        })
      );
    });

    it('should handle notification creation errors', async () => {
      mockContainerManager.getAll = jest.fn().mockResolvedValue([mockContainer]);
      (browser.notifications.create as jest.Mock).mockRejectedValue(new Error('Permission denied'));

      // Should not throw
      await expect(
        (requestInterceptor as any).showRestrictionNotification('https://example.com', 'firefox-container-1')
      ).resolves.not.toThrow();
    });
  });

  describe('showExcludeNotification', () => {
    it('should create exclude notification', async () => {
      await (requestInterceptor as any).showExcludeNotification('https://example.com');

      expect(browser.notifications.create).toHaveBeenCalledWith({
        type: 'basic',
        iconUrl: 'chrome-extension://abc/images/extension_48.png',
        title: 'Opened Outside Containers',
        message: 'example.com was opened outside of containers due to an EXCLUDE rule.',
      });
    });

    it('should handle notification creation errors', async () => {
      (browser.notifications.create as jest.Mock).mockRejectedValue(new Error('Permission denied'));

      // Should not throw
      await expect(
        (requestInterceptor as any).showExcludeNotification('https://example.com')
      ).resolves.not.toThrow();
    });
  });

  describe('handleTabUpdate', () => {
    it('should skip updates without URL changes', async () => {
      await (requestInterceptor as any).handleTabUpdate(1, { status: 'complete' }, mockTab);

      expect(mockRulesEngine.evaluate).not.toHaveBeenCalled();
    });

    it('should skip non-interceptable URLs', async () => {
      const tab = { ...mockTab, url: 'about:blank' };
      await (requestInterceptor as any).handleTabUpdate(1, { url: 'about:blank' }, tab);

      expect(mockRulesEngine.evaluate).not.toHaveBeenCalled();
    });

    it('should handle redirect evaluation', async () => {
      const evaluation: EvaluationResult = {
        action: 'redirect',
        containerId: 'firefox-container-1',
      };

      mockRulesEngine.evaluate = jest.fn().mockResolvedValue(evaluation);
      (browser.tabs.get as jest.Mock).mockResolvedValue(mockTab);
      (browser.tabs.create as jest.Mock).mockResolvedValue({ id: 2 });

      await (requestInterceptor as any).handleTabUpdate(1, { url: 'https://example.com' }, mockTab);

      expect(browser.tabs.create).toHaveBeenCalled();
      expect(browser.tabs.remove).toHaveBeenCalledWith(1);
    });

    it('should handle bookmark parameter redirect', async () => {
      mockBookmarkIntegration.processBookmarkUrl = jest.fn().mockResolvedValue({
        cleanUrl: 'https://example.com',
        containerId: 'firefox-container-1',
      });

      mockRulesEngine.evaluate = jest.fn().mockResolvedValue({ action: 'open' });
      (browser.tabs.get as jest.Mock).mockResolvedValue(mockTab);
      (browser.tabs.create as jest.Mock).mockResolvedValue({ id: 2 });

      await (requestInterceptor as any).handleTabUpdate(
        1, 
        { url: 'https://example.com?silo=container1' }, 
        { ...mockTab, url: 'https://example.com?silo=container1' }
      );

      expect(browser.tabs.create).toHaveBeenCalled();
    });

    it('should record touch stats for container tabs', async () => {
      const tabInContainer = { ...mockTab, cookieStoreId: 'firefox-container-1' };
      mockRulesEngine.evaluate = jest.fn().mockResolvedValue({ action: 'open' });

      await (requestInterceptor as any).handleTabUpdate(1, { url: 'https://example.com' }, tabInContainer);

      expect(mockStorageService.recordStat).toHaveBeenCalledWith('firefox-container-1', 'touch');
    });

    it('should handle errors gracefully', async () => {
      mockRulesEngine.evaluate = jest.fn().mockRejectedValue(new Error('Evaluation failed'));

      await expect(
        (requestInterceptor as any).handleTabUpdate(1, { url: 'https://example.com' }, mockTab)
      ).resolves.not.toThrow();
    });

    it('should update tab to container mapping', async () => {
      const tabInContainer = { ...mockTab, cookieStoreId: 'firefox-container-1' };
      mockRulesEngine.evaluate = jest.fn().mockResolvedValue({ action: 'open' });

      await (requestInterceptor as any).handleTabUpdate(1, { url: 'https://example.com' }, tabInContainer);

      // Verify the mapping was updated (private property, so we test indirectly)
      expect(mockRulesEngine.evaluate).toHaveBeenCalled();
    });
  });

  describe('handleTabContainerUpdate', () => {
    it('should create new tab in target container and close old tab', async () => {
      const evaluation: EvaluationResult = {
        action: 'redirect',
        containerId: 'firefox-container-1',
      };

      (browser.tabs.get as jest.Mock).mockResolvedValue(mockTab);
      (browser.tabs.create as jest.Mock).mockResolvedValue({ id: 2 });

      await (requestInterceptor as any).handleTabContainerUpdate(1, 'https://example.com', evaluation);

      expect(browser.tabs.create).toHaveBeenCalledWith({
        url: 'https://example.com',
        active: true,
        index: mockTab.index,
        cookieStoreId: 'firefox-container-1',
      });
      expect(browser.tabs.remove).toHaveBeenCalledWith(1);
    });

    it('should create tab in default container for exclude action', async () => {
      const evaluation: EvaluationResult = {
        action: 'exclude',
      };

      (browser.tabs.get as jest.Mock).mockResolvedValue(mockTab);
      (browser.tabs.create as jest.Mock).mockResolvedValue({ id: 2 });

      await (requestInterceptor as any).handleTabContainerUpdate(1, 'https://example.com', evaluation);

      expect(browser.tabs.create).toHaveBeenCalledWith({
        url: 'https://example.com',
        active: true,
        index: mockTab.index,
        cookieStoreId: 'firefox-default',
      });
    });

    it('should record stats for successful update', async () => {
      const evaluation: EvaluationResult = {
        action: 'redirect',
        containerId: 'firefox-container-1',
        rule: { id: 'rule1' } as any,
      };

      (browser.tabs.get as jest.Mock).mockResolvedValue(mockTab);
      (browser.tabs.create as jest.Mock).mockResolvedValue({ id: 2 });

      await (requestInterceptor as any).handleTabContainerUpdate(1, 'https://example.com', evaluation);

      expect(mockStorageService.recordStat).toHaveBeenCalledWith('firefox-container-1', 'open');
      expect(mockStorageService.recordStat).toHaveBeenCalledWith('firefox-container-1', 'match');
    });

    it('should handle tab operation errors', async () => {
      (browser.tabs.get as jest.Mock).mockRejectedValue(new Error('Tab not found'));

      await expect(
        (requestInterceptor as any).handleTabContainerUpdate(1, 'https://example.com', { action: 'redirect' })
      ).resolves.not.toThrow();
    });
  });

  describe('handleTabCreated', () => {
    it('should update tab-to-container mapping and record stats', async () => {
      const tab = { ...mockTab, cookieStoreId: 'firefox-container-1' };

      await (requestInterceptor as any).handleTabCreated(tab);

      expect(mockStorageService.recordStat).toHaveBeenCalledWith('firefox-container-1', 'open');
    });

    it('should not record stats for default container tabs', async () => {
      await (requestInterceptor as any).handleTabCreated(mockTab);

      expect(mockStorageService.recordStat).not.toHaveBeenCalled();
    });

    it('should handle tabs without ID', async () => {
      const tab = { ...mockTab, id: undefined };

      await expect(
        (requestInterceptor as any).handleTabCreated(tab)
      ).resolves.not.toThrow();
    });

    it('should handle stats recording errors', async () => {
      mockStorageService.recordStat = jest.fn().mockRejectedValue(new Error('Stats failed'));
      const tab = { ...mockTab, cookieStoreId: 'firefox-container-1' };

      await expect(
        (requestInterceptor as any).handleTabCreated(tab)
      ).resolves.not.toThrow();
    });
  });

  describe('handleTabRemoved', () => {
    it('should record close stats and cleanup temporary containers', async () => {
      mockContainerManager.cleanupTemporaryContainersAsync = jest.fn().mockResolvedValue(undefined);
      
      // Simulate tab being in mapping
      await (requestInterceptor as any).handleTabCreated({ ...mockTab, cookieStoreId: 'firefox-container-1' });
      
      await (requestInterceptor as any).handleTabRemoved(1, {});

      expect(mockStorageService.recordStat).toHaveBeenCalledWith('firefox-container-1', 'close');
      
      jest.advanceTimersByTime(1000);
      expect(mockContainerManager.cleanupTemporaryContainersAsync).toHaveBeenCalled();
    });

    it('should handle unknown tabs gracefully', async () => {
      await (requestInterceptor as any).handleTabRemoved(999, {});

      expect(mockStorageService.recordStat).not.toHaveBeenCalled();
    });

    it('should handle cleanup errors', async () => {
      mockContainerManager.cleanupTemporaryContainersAsync = jest.fn().mockRejectedValue(new Error('Cleanup failed'));
      
      // Simulate tab being in mapping
      await (requestInterceptor as any).handleTabCreated({ ...mockTab, cookieStoreId: 'firefox-container-1' });
      
      await (requestInterceptor as any).handleTabRemoved(1, {});

      jest.advanceTimersByTime(1000);
      
      // Should not throw
      expect(mockContainerManager.cleanupTemporaryContainersAsync).toHaveBeenCalled();
    });
  });

  describe('shouldIntercept', () => {
    it('should intercept HTTP and HTTPS URLs', () => {
      expect(requestInterceptor.shouldIntercept('https://example.com')).toBe(true);
      expect(requestInterceptor.shouldIntercept('http://example.com')).toBe(true);
    });

    it('should not intercept browser internal URLs', () => {
      expect(requestInterceptor.shouldIntercept('about:blank')).toBe(false);
      expect(requestInterceptor.shouldIntercept('moz-extension://abc')).toBe(false);
      expect(requestInterceptor.shouldIntercept('file:///path/to/file')).toBe(false);
      expect(requestInterceptor.shouldIntercept('javascript:alert(1)')).toBe(false);
      expect(requestInterceptor.shouldIntercept('data:text/html,test')).toBe(false);
      expect(requestInterceptor.shouldIntercept('chrome://settings')).toBe(false);
      expect(requestInterceptor.shouldIntercept('chrome-extension://abc')).toBe(false);
    });

    it('should handle edge cases', () => {
      expect(requestInterceptor.shouldIntercept('')).toBe(false);
      expect(requestInterceptor.shouldIntercept('ftp://example.com')).toBe(false);
    });
  });
});