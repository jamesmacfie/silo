import { BookmarkIntegration } from '@/background/services/BookmarkIntegration';
import storageService from '@/background/services/StorageService';
import containerManager from '@/background/services/ContainerManager';
import browser from 'webextension-polyfill';
import type { BookmarkAssociation, Container } from '@/shared/types';

jest.mock('@/background/services/StorageService');
jest.mock('@/background/services/ContainerManager');
jest.mock('@/shared/utils/logger');

describe('BookmarkIntegration', () => {
  let bookmarkIntegration: BookmarkIntegration;
  let mockStorageService: jest.Mocked<typeof storageService>;
  let mockContainerManager: jest.Mocked<typeof containerManager>;

  const mockContainer: Container = {
    id: 'container-1',
    name: 'Work',
    icon: 'briefcase',
    color: 'blue',
    cookieStoreId: 'firefox-container-1',
    created: 1640995200000,
    modified: 1640995200000,
    temporary: false,
    syncEnabled: true,
    metadata: {
      description: 'Work container',
    },
  };

  const mockBookmarkAssociation: BookmarkAssociation = {
    bookmarkId: 'bookmark-1',
    containerId: 'firefox-container-1',
    url: 'https://example.com',
    autoOpen: true,
    created: 1640995200000,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset singleton instance
    (BookmarkIntegration as any).instance = null;
    
    mockStorageService = storageService as jest.Mocked<typeof storageService>;
    mockContainerManager = containerManager as jest.Mocked<typeof containerManager>;
    
    // Setup default mocks
    mockContainerManager.getAll = jest.fn().mockResolvedValue([mockContainer]);
    mockStorageService.addBookmarkAssociation = jest.fn().mockResolvedValue(undefined);
    mockStorageService.removeBookmarkAssociation = jest.fn().mockResolvedValue(undefined);
    mockStorageService.getBookmarkAssociation = jest.fn().mockResolvedValue(null);
    mockStorageService.getBookmarkAssociations = jest.fn().mockResolvedValue([]);
    mockStorageService.setBookmarkAssociations = jest.fn().mockResolvedValue(undefined);
    
    // Mock browser APIs
    global.browser.bookmarks = {
      getTree: jest.fn(),
    } as any;
    
    bookmarkIntegration = BookmarkIntegration.getInstance();
  });

  describe('getInstance', () => {
    it('should return singleton instance', () => {
      const instance1 = BookmarkIntegration.getInstance();
      const instance2 = BookmarkIntegration.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('associate', () => {
    it('should create bookmark association with all parameters', async () => {
      const bookmarkId = 'bookmark-1';
      const containerId = 'firefox-container-1';
      const url = 'https://example.com';
      const autoOpen = false;
      
      await bookmarkIntegration.associate(bookmarkId, containerId, url, autoOpen);
      
      expect(mockStorageService.addBookmarkAssociation).toHaveBeenCalledWith({
        bookmarkId,
        containerId,
        url,
        autoOpen,
        created: expect.any(Number),
      });
    });

    it('should default autoOpen to true when not specified', async () => {
      await bookmarkIntegration.associate('bookmark-1', 'container-1', 'https://example.com');
      
      expect(mockStorageService.addBookmarkAssociation).toHaveBeenCalledWith(
        expect.objectContaining({ autoOpen: true })
      );
    });
  });

  describe('disassociate', () => {
    it('should remove bookmark association', async () => {
      const bookmarkId = 'bookmark-1';
      
      await bookmarkIntegration.disassociate(bookmarkId);
      
      expect(mockStorageService.removeBookmarkAssociation).toHaveBeenCalledWith(bookmarkId);
    });
  });

  describe('getAssociation', () => {
    it('should retrieve specific bookmark association', async () => {
      const bookmarkId = 'bookmark-1';
      mockStorageService.getBookmarkAssociation = jest.fn().mockResolvedValue(mockBookmarkAssociation);
      
      const result = await bookmarkIntegration.getAssociation(bookmarkId);
      
      expect(result).toEqual(mockBookmarkAssociation);
      expect(mockStorageService.getBookmarkAssociation).toHaveBeenCalledWith(bookmarkId);
    });

    it('should return null for non-existent association', async () => {
      mockStorageService.getBookmarkAssociation = jest.fn().mockResolvedValue(null);
      
      const result = await bookmarkIntegration.getAssociation('non-existent');
      
      expect(result).toBeNull();
    });
  });

  describe('getAllAssociations', () => {
    it('should retrieve all bookmark associations', async () => {
      const associations = [mockBookmarkAssociation];
      mockStorageService.getBookmarkAssociations = jest.fn().mockResolvedValue(associations);
      
      const result = await bookmarkIntegration.getAllAssociations();
      
      expect(result).toEqual(associations);
      expect(mockStorageService.getBookmarkAssociations).toHaveBeenCalled();
    });

    it('should return empty array when no associations exist', async () => {
      mockStorageService.getBookmarkAssociations = jest.fn().mockResolvedValue([]);
      
      const result = await bookmarkIntegration.getAllAssociations();
      
      expect(result).toEqual([]);
    });
  });

  describe('syncBookmarks', () => {
    const mockBookmarkTree: browser.Bookmarks.BookmarkTreeNode[] = [
      {
        id: 'root',
        title: 'Bookmarks',
        children: [
          {
            id: 'bookmark-1',
            title: 'Work Site',
            url: 'https://work.example.com?silo=Work',
          },
          {
            id: 'bookmark-2',
            title: 'Personal Site',
            url: 'https://personal.example.com?silo=Personal&other=param',
          },
          {
            id: 'bookmark-3',
            title: 'No Container',
            url: 'https://nocontainer.example.com',
          },
          {
            id: 'folder-1',
            title: 'Work Folder',
            children: [
              {
                id: 'bookmark-4',
                title: 'Nested Work Site',
                url: 'https://nested.work.example.com?silo=Work',
              },
            ],
          },
        ],
      },
    ];

    it('should sync bookmarks with container hints', async () => {
      (browser.bookmarks.getTree as jest.Mock).mockResolvedValue(mockBookmarkTree);
      
      await bookmarkIntegration.syncBookmarks();
      
      expect(browser.bookmarks.getTree).toHaveBeenCalled();
      expect(mockStorageService.setBookmarkAssociations).toHaveBeenCalledWith([
        expect.objectContaining({
          bookmarkId: 'bookmark-1',
          containerId: 'firefox-container-1',
          url: 'https://work.example.com/',
          autoOpen: true,
        }),
        expect.objectContaining({
          bookmarkId: 'bookmark-2',
          containerId: 'Personal', // Will be resolved if container exists
          url: 'https://personal.example.com/?other=param',
          autoOpen: true,
        }),
        expect.objectContaining({
          bookmarkId: 'bookmark-4',
          containerId: 'firefox-container-1',
          url: 'https://nested.work.example.com/',
          autoOpen: true,
        }),
      ]);
    });

    it('should handle bookmarks without silo parameters', async () => {
      const treeWithoutSiloParams = [
        {
          id: 'root',
          title: 'Bookmarks',
          children: [
            {
              id: 'bookmark-1',
              title: 'Normal Site',
              url: 'https://example.com',
            },
          ],
        },
      ];
      
      (browser.bookmarks.getTree as jest.Mock).mockResolvedValue(treeWithoutSiloParams);
      
      await bookmarkIntegration.syncBookmarks();
      
      expect(mockStorageService.setBookmarkAssociations).not.toHaveBeenCalled();
    });

    it('should handle empty bookmark tree', async () => {
      (browser.bookmarks.getTree as jest.Mock).mockResolvedValue([]);
      
      await bookmarkIntegration.syncBookmarks();
      
      expect(mockStorageService.setBookmarkAssociations).not.toHaveBeenCalled();
    });

    it('should handle browser API errors gracefully', async () => {
      (browser.bookmarks.getTree as jest.Mock).mockRejectedValue(new Error('Bookmarks API unavailable'));
      
      // Should not throw
      await expect(bookmarkIntegration.syncBookmarks()).resolves.not.toThrow();
      expect(mockStorageService.setBookmarkAssociations).not.toHaveBeenCalled();
    });

    it('should resolve container hints to cookieStoreIds', async () => {
      const personalContainer = {
        ...mockContainer,
        id: 'container-2',
        name: 'Personal',
        cookieStoreId: 'firefox-container-2',
      };
      
      mockContainerManager.getAll = jest.fn().mockResolvedValue([mockContainer, personalContainer]);
      
      const treeWithHints = [
        {
          id: 'root',
          children: [
            {
              id: 'bookmark-1',
              title: 'Personal Site',
              url: 'https://example.com?silo=Personal',
            },
          ],
        },
      ];
      
      (browser.bookmarks.getTree as jest.Mock).mockResolvedValue(treeWithHints);
      
      await bookmarkIntegration.syncBookmarks();
      
      expect(mockStorageService.setBookmarkAssociations).toHaveBeenCalledWith([
        expect.objectContaining({
          containerId: 'firefox-container-2', // Resolved from 'Personal'
        }),
      ]);
    });
  });

  describe('processBookmarkUrl', () => {
    it('should extract and resolve silo parameter', async () => {
      const url = 'https://example.com?silo=Work&foo=bar';
      const result = await bookmarkIntegration.processBookmarkUrl(url);
      
      expect(result.cleanUrl).toBe('https://example.com/?foo=bar');
      expect(result.containerId).toBe('firefox-container-1');
    });

    it('should return original URL when no silo parameter', async () => {
      const url = 'https://example.com/page';
      const result = await bookmarkIntegration.processBookmarkUrl(url);
      
      expect(result.cleanUrl).toBe('https://example.com/page');
      expect(result.containerId).toBeUndefined();
    });

    it('should handle silo parameter with no value', async () => {
      const url = 'https://example.com?silo=';
      const result = await bookmarkIntegration.processBookmarkUrl(url);
      
      expect(result.cleanUrl).toBe('https://example.com?silo=');
      expect(result.containerId).toBeUndefined();
    });

    it('should handle multiple query parameters', async () => {
      const url = 'https://example.com?param1=value1&silo=Work&param2=value2';
      const result = await bookmarkIntegration.processBookmarkUrl(url);
      
      expect(result.cleanUrl).toBe('https://example.com/?param1=value1&param2=value2');
      expect(result.containerId).toBe('firefox-container-1');
    });

    it('should handle silo as only parameter', async () => {
      const url = 'https://example.com?silo=Work';
      const result = await bookmarkIntegration.processBookmarkUrl(url);
      
      expect(result.cleanUrl).toBe('https://example.com/');
      expect(result.containerId).toBe('firefox-container-1');
    });

    it('should handle URL with fragment', async () => {
      const url = 'https://example.com/page?silo=Work#section';
      const result = await bookmarkIntegration.processBookmarkUrl(url);
      
      expect(result.cleanUrl).toBe('https://example.com/page#section');
      expect(result.containerId).toBe('firefox-container-1');
    });

    it('should handle malformed URLs gracefully', async () => {
      const url = 'not-a-valid-url';
      const result = await bookmarkIntegration.processBookmarkUrl(url);
      
      expect(result.cleanUrl).toBe('not-a-valid-url');
      expect(result.containerId).toBeUndefined();
    });

    it('should handle unresolvable container hints', async () => {
      mockContainerManager.getAll = jest.fn().mockResolvedValue([]);
      
      const url = 'https://example.com?silo=NonExistent';
      const result = await bookmarkIntegration.processBookmarkUrl(url);
      
      expect(result.cleanUrl).toBe('https://example.com/');
      expect(result.containerId).toBeUndefined();
    });
  });

  describe('extractContainerFromUrl (private)', () => {
    it('should extract container hint from URL', () => {
      const url = 'https://example.com?silo=Work&other=param';
      const result = (bookmarkIntegration as any).extractContainerFromUrl(url);
      
      expect(result.cleanUrl).toBe('https://example.com/?other=param');
      expect(result.containerHint).toBe('Work');
    });

    it('should return original URL when no silo parameter', () => {
      const url = 'https://example.com?other=param';
      const result = (bookmarkIntegration as any).extractContainerFromUrl(url);
      
      expect(result.cleanUrl).toBe('https://example.com?other=param');
      expect(result.containerHint).toBeUndefined();
    });

    it('should handle URLs without query parameters', () => {
      const url = 'https://example.com/path';
      const result = (bookmarkIntegration as any).extractContainerFromUrl(url);
      
      expect(result.cleanUrl).toBe('https://example.com/path');
      expect(result.containerHint).toBeUndefined();
    });

    it('should handle malformed URLs', () => {
      const url = 'invalid-url';
      const result = (bookmarkIntegration as any).extractContainerFromUrl(url);
      
      expect(result.cleanUrl).toBe('invalid-url');
      expect(result.containerHint).toBeUndefined();
    });

    it('should handle URL with empty silo parameter', () => {
      const url = 'https://example.com?silo=&other=value';
      const result = (bookmarkIntegration as any).extractContainerFromUrl(url);
      
      expect(result.cleanUrl).toBe('https://example.com?silo=&other=value');
      expect(result.containerHint).toBeUndefined();
    });

    it('should handle URL with special characters in container hint', () => {
      const url = 'https://example.com?silo=Work%20Container&other=value';
      const result = (bookmarkIntegration as any).extractContainerFromUrl(url);
      
      expect(result.cleanUrl).toBe('https://example.com/?other=value');
      expect(result.containerHint).toBe('Work Container');
    });
  });

  describe('resolveToCookieStoreId (private)', () => {
    const containers = [
      {
        id: 'container-1',
        name: 'Work Container',
        cookieStoreId: 'firefox-container-1',
      },
      {
        id: 'container-2',
        name: 'Personal',
        cookieStoreId: 'firefox-container-2',
      },
    ];

    beforeEach(() => {
      mockContainerManager.getAll = jest.fn().mockResolvedValue(containers as Container[]);
    });

    it('should resolve by exact cookieStoreId match', async () => {
      const result = await (bookmarkIntegration as any).resolveToCookieStoreId('firefox-container-1');
      expect(result).toBe('firefox-container-1');
    });

    it('should resolve by internal container id', async () => {
      const result = await (bookmarkIntegration as any).resolveToCookieStoreId('container-1');
      expect(result).toBe('firefox-container-1');
    });

    it('should resolve by container name', async () => {
      const result = await (bookmarkIntegration as any).resolveToCookieStoreId('Work Container');
      expect(result).toBe('firefox-container-1');
    });

    it('should be case insensitive', async () => {
      const result1 = await (bookmarkIntegration as any).resolveToCookieStoreId('PERSONAL');
      const result2 = await (bookmarkIntegration as any).resolveToCookieStoreId('work container');
      const result3 = await (bookmarkIntegration as any).resolveToCookieStoreId('FIREFOX-CONTAINER-2');
      
      expect(result1).toBe('firefox-container-2');
      expect(result2).toBe('firefox-container-1');
      expect(result3).toBe('firefox-container-2');
    });

    it('should trim whitespace', async () => {
      const result = await (bookmarkIntegration as any).resolveToCookieStoreId('  Personal  ');
      expect(result).toBe('firefox-container-2');
    });

    it('should return undefined for non-existent containers', async () => {
      const result = await (bookmarkIntegration as any).resolveToCookieStoreId('NonExistent');
      expect(result).toBeUndefined();
    });

    it('should return undefined for empty string', async () => {
      const result = await (bookmarkIntegration as any).resolveToCookieStoreId('');
      expect(result).toBeUndefined();
    });

    it('should prioritize cookieStoreId over id over name', async () => {
      const ambiguousContainers = [
        {
          id: 'firefox-container-1',
          name: 'container-2',
          cookieStoreId: 'test-value',
        },
        {
          id: 'container-2',
          name: 'test-value',
          cookieStoreId: 'firefox-container-2',
        },
        {
          id: 'other',
          name: 'other',
          cookieStoreId: 'test-value-exact',
        },
      ];
      
      mockContainerManager.getAll = jest.fn().mockResolvedValue(ambiguousContainers as Container[]);
      
      // Should match by cookieStoreId first (exact match)
      const result = await (bookmarkIntegration as any).resolveToCookieStoreId('test-value-exact');
      expect(result).toBe('test-value-exact');
    });
  });

  describe('error handling', () => {
    it('should handle storage errors in associate', async () => {
      mockStorageService.addBookmarkAssociation = jest.fn().mockRejectedValue(new Error('Storage error'));
      
      await expect(
        bookmarkIntegration.associate('bookmark-1', 'container-1', 'https://example.com')
      ).rejects.toThrow('Storage error');
    });

    it('should handle storage errors in disassociate', async () => {
      mockStorageService.removeBookmarkAssociation = jest.fn().mockRejectedValue(new Error('Storage error'));
      
      await expect(
        bookmarkIntegration.disassociate('bookmark-1')
      ).rejects.toThrow('Storage error');
    });

    it('should handle container manager errors in resolution', async () => {
      mockContainerManager.getAll = jest.fn().mockRejectedValue(new Error('Container error'));
      
      await expect(
        bookmarkIntegration.processBookmarkUrl('https://example.com?silo=Work')
      ).rejects.toThrow('Container error');
    });
  });
});


