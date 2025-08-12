import { RequestInterceptor } from '@/background/services/RequestInterceptor';
import { RulesEngine } from '@/background/services/RulesEngine';
import { ContainerManager } from '@/background/services/ContainerManager';
import browser from 'webextension-polyfill';
import { RuleType } from '@/shared/types';

jest.mock('@/background/services/RulesEngine');
jest.mock('@/background/services/ContainerManager');
jest.mock('@/shared/utils/logger');

describe('RequestInterceptor', () => {
  let requestInterceptor: RequestInterceptor;
  let mockRulesEngine: jest.Mocked<RulesEngine>;
  let mockContainerManager: jest.Mocked<ContainerManager>;

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

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset singleton instance
    (RequestInterceptor as any).instance = null;
    
    mockRulesEngine = RulesEngine.getInstance() as jest.Mocked<RulesEngine>;
    mockContainerManager = ContainerManager.getInstance() as jest.Mocked<ContainerManager>;
    
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
    } as any;
  });

  describe('getInstance', () => {
    it('should return singleton instance', () => {
      const instance1 = RequestInterceptor.getInstance();
      const instance2 = RequestInterceptor.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('register', () => {
    it('should register web request listener', () => {
      requestInterceptor.register();

      expect(browser.webRequest.onBeforeRequest.addListener).toHaveBeenCalledWith(
        expect.any(Function),
        { urls: ['<all_urls>'], types: ['main_frame'] },
        ['blocking']
      );

      expect(browser.tabs.onUpdated.addListener).toHaveBeenCalled();
    });

    it('should not register if already registered', () => {
      requestInterceptor.register();
      requestInterceptor.register();

      expect(browser.webRequest.onBeforeRequest.addListener).toHaveBeenCalledTimes(1);
    });
  });

  describe('unregister', () => {
    it('should remove web request listener', () => {
      requestInterceptor.register();
      requestInterceptor.unregister();

      expect(browser.webRequest.onBeforeRequest.removeListener).toHaveBeenCalled();
      expect(browser.tabs.onUpdated.removeListener).toHaveBeenCalled();
    });
  });

  describe('handleRequest', () => {
    beforeEach(() => {
      (browser.tabs.get as jest.Mock).mockResolvedValue(mockTab);
    });

    it('should open URL in target container when rule matches', async () => {
      const targetContainerId = 'work-container';
      mockRulesEngine.evaluate = jest.fn().mockResolvedValue({
        action: 'redirect',
        containerId: targetContainerId,
        rule: {
          id: 'rule-1',
          pattern: 'example.com',
          containerId: targetContainerId,
          ruleType: RuleType.INCLUDE,
        },
      });

      mockContainerManager.get = jest.fn().mockResolvedValue({
        id: targetContainerId,
        cookieStoreId: 'firefox-container-1',
        name: 'Work',
      });

      (browser.tabs.create as jest.Mock).mockResolvedValue({ id: 2 });

      const result = await requestInterceptor.handleRequest(mockWebRequestDetails);

      expect(mockRulesEngine.evaluate).toHaveBeenCalledWith(
        mockWebRequestDetails.url,
        'firefox-default'
      );

      expect(browser.tabs.create).toHaveBeenCalledWith({
        url: mockWebRequestDetails.url,
        cookieStoreId: 'firefox-container-1',
        index: mockTab.index,
        pinned: mockTab.pinned,
        windowId: mockTab.windowId,
      });

      expect(browser.tabs.remove).toHaveBeenCalledWith(mockTab.id);
      expect(result).toEqual({ cancel: true });
    });

    it('should allow request when no rule matches', async () => {
      mockRulesEngine.evaluate = jest.fn().mockResolvedValue({
        action: 'open',
      });

      const result = await requestInterceptor.handleRequest(mockWebRequestDetails);

      expect(browser.tabs.create).not.toHaveBeenCalled();
      expect(browser.tabs.remove).not.toHaveBeenCalled();
      expect(result).toEqual({});
    });

    it('should block request when restrict rule prevents access', async () => {
      mockRulesEngine.evaluate = jest.fn().mockResolvedValue({
        action: 'block',
        reason: 'Domain restricted to specific container',
        rule: {
          id: 'rule-2',
          pattern: 'secure.example.com',
          containerId: 'secure-container',
          ruleType: RuleType.RESTRICT,
        },
      });

      const result = await requestInterceptor.handleRequest(mockWebRequestDetails);

      expect(browser.tabs.create).not.toHaveBeenCalled();
      expect(result).toEqual({ cancel: true });
    });

    it('should exclude from container when exclude rule matches', async () => {
      const currentContainer = 'firefox-container-1';
      const tabInContainer = { ...mockTab, cookieStoreId: currentContainer };
      
      (browser.tabs.get as jest.Mock).mockResolvedValue(tabInContainer);

      mockRulesEngine.evaluate = jest.fn().mockResolvedValue({
        action: 'exclude',
        rule: {
          id: 'rule-3',
          pattern: 'public.example.com',
          ruleType: RuleType.EXCLUDE,
        },
      });

      (browser.tabs.create as jest.Mock).mockResolvedValue({ id: 3 });

      const result = await requestInterceptor.handleRequest(mockWebRequestDetails);

      expect(browser.tabs.create).toHaveBeenCalledWith({
        url: mockWebRequestDetails.url,
        cookieStoreId: 'firefox-default',
        index: tabInContainer.index,
        pinned: tabInContainer.pinned,
        windowId: tabInContainer.windowId,
      });

      expect(browser.tabs.remove).toHaveBeenCalledWith(tabInContainer.id);
      expect(result).toEqual({ cancel: true });
    });

    it('should handle errors gracefully', async () => {
      const error = new Error('Tab not found');
      (browser.tabs.get as jest.Mock).mockRejectedValue(error);

      const result = await requestInterceptor.handleRequest(mockWebRequestDetails);

      expect(result).toEqual({});
    });

    it('should not intercept if tab ID is missing', async () => {
      const detailsWithoutTab = { ...mockWebRequestDetails, tabId: -1 };

      const result = await requestInterceptor.handleRequest(detailsWithoutTab);

      expect(browser.tabs.get).not.toHaveBeenCalled();
      expect(result).toEqual({});
    });

    it('should handle sub-frame requests', async () => {
      const subFrameDetails = { ...mockWebRequestDetails, type: 'sub_frame' as any };

      const result = await requestInterceptor.handleRequest(subFrameDetails);

      expect(browser.tabs.get).not.toHaveBeenCalled();
      expect(result).toEqual({});
    });
  });

  describe('handleTabUpdate', () => {
    it('should handle tab URL updates', async () => {
      const changeInfo = { url: 'https://updated.com' };
      
      (browser.tabs.get as jest.Mock).mockResolvedValue(mockTab);
      
      mockRulesEngine.evaluate = jest.fn().mockResolvedValue({
        action: 'redirect',
        containerId: 'new-container',
      });

      mockContainerManager.get = jest.fn().mockResolvedValue({
        id: 'new-container',
        cookieStoreId: 'firefox-container-2',
        name: 'New Container',
      });

      (browser.tabs.create as jest.Mock).mockResolvedValue({ id: 4 });

      await requestInterceptor.handleTabUpdate(1, changeInfo);

      expect(mockRulesEngine.evaluate).toHaveBeenCalledWith(changeInfo.url, mockTab.cookieStoreId);
      expect(browser.tabs.create).toHaveBeenCalled();
    });

    it('should ignore updates without URL changes', async () => {
      const changeInfo = { status: 'complete' };

      await requestInterceptor.handleTabUpdate(1, changeInfo);

      expect(browser.tabs.get).not.toHaveBeenCalled();
      expect(mockRulesEngine.evaluate).not.toHaveBeenCalled();
    });

    it('should handle tab update errors', async () => {
      const changeInfo = { url: 'https://error.com' };
      const error = new Error('Tab update failed');
      
      (browser.tabs.get as jest.Mock).mockRejectedValue(error);

      await expect(
        requestInterceptor.handleTabUpdate(1, changeInfo)
      ).resolves.not.toThrow();
    });
  });

  describe('shouldIntercept', () => {
    it('should intercept http and https URLs', () => {
      expect(requestInterceptor.shouldIntercept('https://example.com')).toBe(true);
      expect(requestInterceptor.shouldIntercept('http://example.com')).toBe(true);
    });

    it('should not intercept browser internal URLs', () => {
      expect(requestInterceptor.shouldIntercept('about:blank')).toBe(false);
      expect(requestInterceptor.shouldIntercept('chrome://settings')).toBe(false);
      expect(requestInterceptor.shouldIntercept('moz-extension://abc')).toBe(false);
      expect(requestInterceptor.shouldIntercept('file:///home/user/file.html')).toBe(false);
    });

    it('should not intercept data URLs', () => {
      expect(requestInterceptor.shouldIntercept('data:text/html,<h1>Test</h1>')).toBe(false);
    });

    it('should handle malformed URLs', () => {
      expect(requestInterceptor.shouldIntercept('')).toBe(false);
      expect(requestInterceptor.shouldIntercept('not-a-url')).toBe(false);
    });
  });

  describe('getPreferences', () => {
    it('should retrieve interceptor preferences', async () => {
      const mockPrefs = {
        keepOldTabs: false,
        matchDomainOnly: true,
      };

      global.browser.storage = {
        local: {
          get: jest.fn().mockResolvedValue({ preferences: mockPrefs }),
        },
      } as any;

      const prefs = await (requestInterceptor as any).getPreferences();
      
      expect(prefs).toEqual(mockPrefs);
    });

    it('should return default preferences if none stored', async () => {
      global.browser.storage = {
        local: {
          get: jest.fn().mockResolvedValue({}),
        },
      } as any;

      const prefs = await (requestInterceptor as any).getPreferences();
      
      expect(prefs).toEqual({
        keepOldTabs: false,
        matchDomainOnly: false,
      });
    });
  });

  describe('caching', () => {
    it('should cache tab creation to prevent loops', async () => {
      const url = 'https://cached.com';
      const containerId = 'firefox-container-1';

      // First request should proceed
      const canCreate1 = (requestInterceptor as any).canCreateTab(url, containerId);
      expect(canCreate1).toBe(true);

      // Immediate second request should be blocked
      const canCreate2 = (requestInterceptor as any).canCreateTab(url, containerId);
      expect(canCreate2).toBe(false);

      // After cache expires, should allow again
      jest.advanceTimersByTime(5000);
      const canCreate3 = (requestInterceptor as any).canCreateTab(url, containerId);
      expect(canCreate3).toBe(true);
    });
  });

  describe('integration scenarios', () => {
    it('should handle rapid navigation between containers', async () => {
      const urls = [
        'https://work.example.com',
        'https://personal.example.com',
        'https://shopping.example.com',
      ];

      for (const url of urls) {
        const details = { ...mockWebRequestDetails, url };
        
        mockRulesEngine.evaluate = jest.fn().mockResolvedValue({
          action: 'redirect',
          containerId: `container-${url}`,
        });

        mockContainerManager.get = jest.fn().mockResolvedValue({
          id: `container-${url}`,
          cookieStoreId: `firefox-container-${url}`,
          name: url,
        });

        (browser.tabs.get as jest.Mock).mockResolvedValue(mockTab);
        (browser.tabs.create as jest.Mock).mockResolvedValue({ id: Math.random() });

        await requestInterceptor.handleRequest(details);
      }

      expect(browser.tabs.create).toHaveBeenCalledTimes(3);
    });

    it('should preserve tab properties when redirecting', async () => {
      const pinnedTab = { ...mockTab, pinned: true, index: 5 };
      (browser.tabs.get as jest.Mock).mockResolvedValue(pinnedTab);

      mockRulesEngine.evaluate = jest.fn().mockResolvedValue({
        action: 'redirect',
        containerId: 'target-container',
      });

      mockContainerManager.get = jest.fn().mockResolvedValue({
        id: 'target-container',
        cookieStoreId: 'firefox-container-target',
        name: 'Target',
      });

      (browser.tabs.create as jest.Mock).mockResolvedValue({ id: 10 });

      await requestInterceptor.handleRequest(mockWebRequestDetails);

      expect(browser.tabs.create).toHaveBeenCalledWith(
        expect.objectContaining({
          pinned: true,
          index: 5,
        })
      );
    });
  });
});