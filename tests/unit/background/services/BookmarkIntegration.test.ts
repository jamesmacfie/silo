import bookmarkIntegration from '@/background/services/BookmarkIntegration';
import storageService from '@/background/services/StorageService';

describe('BookmarkIntegration', () => {
  beforeEach(() => {
    jest.spyOn(storageService, 'getContainers').mockResolvedValue([
      { id: 'c1', name: 'Work', icon: 'briefcase', color: 'blue', cookieStoreId: 'firefox-container-1', created: Date.now(), modified: Date.now(), temporary: false, syncEnabled: true },
    ] as any);
  });

  it('extracts and resolves silo param', async () => {
    const url = 'https://example.com?silo=Work&foo=bar';
    const result = await bookmarkIntegration.processBookmarkUrl(url);
    expect(result.cleanUrl).toBe('https://example.com/?foo=bar');
    expect(result.containerId).toBe('firefox-container-1');
  });

  it('returns original when no param present', async () => {
    const url = 'https://example.com/page';
    const result = await bookmarkIntegration.processBookmarkUrl(url);
    expect(result.cleanUrl).toBe('https://example.com/page');
    expect(result.containerId).toBeUndefined();
  });
});


