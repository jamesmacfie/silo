import browser from 'webextension-polyfill';
import storageService from './StorageService';
import containerManager from './ContainerManager';
import type { BookmarkAssociation, Container } from '@/shared/types';
import { logger } from '@/shared/utils/logger';

export interface ProcessedBookmarkUrlResult {
  cleanUrl: string;
  containerId?: string; // Firefox cookieStoreId
}

export class BookmarkIntegration {
  private static instance: BookmarkIntegration | null = null;
  private storage = storageService;
  private log = logger.withContext('BookmarkIntegration');

  private constructor() { }

  static getInstance(): BookmarkIntegration {
    if (!this.instance) {
      this.instance = new BookmarkIntegration();
    }
    return this.instance;
  }

  async associate(bookmarkId: string, containerId: string, url: string, autoOpen = true): Promise<void> {
    const association: BookmarkAssociation = {
      bookmarkId,
      containerId,
      url,
      autoOpen,
      created: Date.now(),
    };
    await this.storage.addBookmarkAssociation(association);
  }

  async disassociate(bookmarkId: string): Promise<void> {
    await this.storage.removeBookmarkAssociation(bookmarkId);
  }

  async getAssociation(bookmarkId: string): Promise<BookmarkAssociation | null> {
    return await this.storage.getBookmarkAssociation(bookmarkId);
  }

  async getAllAssociations(): Promise<BookmarkAssociation[]> {
    return await this.storage.getBookmarkAssociations();
  }

  async syncBookmarks(): Promise<void> {
    // Optional: discover bookmarks with query param and store associations
    try {
      const tree = await browser.bookmarks.getTree();
      const associations: BookmarkAssociation[] = [];

      const walk = (nodes: browser.Bookmarks.BookmarkTreeNode[]) => {
        for (const node of nodes) {
          if (node.url) {
            const { containerHint, cleanUrl } = this.extractContainerFromUrl(node.url);
            if (containerHint) {
              // Resolve asynchronously outside recursion
              // Push placeholder; we'll resolve all hints after traversal
              associations.push({
                bookmarkId: node.id,
                containerId: containerHint, // temporary; will be resolved below
                url: cleanUrl,
                autoOpen: true,
                created: Date.now(),
              });
            }
          }
          if (node.children) {
            walk(node.children);
          }
        }
      };

      walk(tree);

      if (associations.length > 0) {
        // Resolve all container hints to cookieStoreIds
        const resolved = await Promise.all(
          associations.map(async (a) => ({
            ...a,
            containerId: (await this.resolveToCookieStoreId(a.containerId)) || a.containerId,
          }))
        );
        await this.storage.setBookmarkAssociations(resolved);
        this.log.info('Synced bookmark associations from bookmarks tree', { count: associations.length });
      }
    } catch (error) {
      this.log.warn('Bookmark sync failed (continuing)', error);
    }
  }

  async processBookmarkUrl(url: string): Promise<ProcessedBookmarkUrlResult> {
    const { containerHint, cleanUrl } = this.extractContainerFromUrl(url);
    if (!containerHint) {
      return { cleanUrl };
    }
    const cookieStoreId = await this.resolveToCookieStoreId(containerHint);
    return { cleanUrl, containerId: cookieStoreId };
  }

  private extractContainerFromUrl(url: string): { cleanUrl: string; containerHint?: string } {
    try {
      const parsed = new URL(url);
      const params = parsed.searchParams;
      const paramValue = params.get('silo') || params.get('containerize');

      if (!paramValue) {
        return { cleanUrl: url };
      }

      // Remove the parameter from URL
      params.delete('silo');
      params.delete('containerize');
      parsed.search = params.toString();
      const cleanUrl = parsed.toString();
      return { cleanUrl, containerHint: paramValue };
    } catch {
      return { cleanUrl: url };
    }
  }

  // Resolve to Firefox cookieStoreId by name, id, or cookieStoreId
  async resolveToCookieStoreId(value: string): Promise<string | undefined> {
    const normalized = value.trim().toLowerCase();
    const all: Container[] = await containerManager.getAll();

    // Match by exact cookieStoreId
    const byCookieStore = all.find(c => c.cookieStoreId.toLowerCase() === normalized);
    if (byCookieStore) {
      return byCookieStore.cookieStoreId;
    }

    // Match by our internal id
    const byId = all.find(c => c.id.toLowerCase() === normalized);
    if (byId) {
      return byId.cookieStoreId;
    }

    // Match by name (case-insensitive)
    const byName = all.find(c => c.name.toLowerCase() === normalized);
    if (byName) {
      return byName.cookieStoreId;
    }

    return undefined;
  }
}

export default BookmarkIntegration.getInstance();

