import { useQuery, useQueryClient } from '@tanstack/react-query';
import browser from 'webextension-polyfill';
import { MESSAGE_TYPES } from '@/shared/constants';
import type { BookmarkAssociation } from '@/shared/types';

export function useBookmarkAssociations() {
  return useQuery({
    queryKey: ['bookmarkAssociations'],
    queryFn: async (): Promise<BookmarkAssociation[]> => {
      const response = await browser.runtime.sendMessage({
        type: MESSAGE_TYPES.GET_BOOKMARK_ASSOCIATIONS,
      });

      if (!response?.success) {
        throw new Error(response?.error || 'Failed to fetch bookmark associations');
      }

      return response.data || [];
    },
    staleTime: 60000, // 1 minute
  });
}

export function useBookmarkActions() {
  const queryClient = useQueryClient();

  const invalidateBookmarks = () => {
    queryClient.invalidateQueries({ queryKey: ['bookmarkAssociations'] });
  };

  const addAssociation = async (bookmarkId: string, containerId: string, url: string, autoOpen = true) => {
    const response = await browser.runtime.sendMessage({
      type: MESSAGE_TYPES.ADD_BOOKMARK_ASSOCIATION,
      payload: { bookmarkId, containerId, url, autoOpen },
    });

    if (!response?.success) {
      throw new Error(response?.error || 'Failed to add bookmark association');
    }

    invalidateBookmarks();
  };

  const removeAssociation = async (bookmarkId: string) => {
    const response = await browser.runtime.sendMessage({
      type: MESSAGE_TYPES.REMOVE_BOOKMARK_ASSOCIATION,
      payload: { bookmarkId },
    });

    if (!response?.success) {
      throw new Error(response?.error || 'Failed to remove bookmark association');
    }

    invalidateBookmarks();
  };

  const processBookmarkUrl = async (url: string) => {
    const response = await browser.runtime.sendMessage({
      type: MESSAGE_TYPES.PROCESS_BOOKMARK_URL,
      payload: { url },
    });

    if (!response?.success) {
      throw new Error(response?.error || 'Failed to process bookmark URL');
    }

    return response.data;
  };

  return {
    addAssociation,
    removeAssociation,
    processBookmarkUrl,
    invalidateBookmarks,
  };
}

export function useBookmarksTree() {
  return useQuery({
    queryKey: ['bookmarksTree'],
    queryFn: async (): Promise<browser.Bookmarks.BookmarkTreeNode[]> => {
      try {
        return await browser.bookmarks.getTree();
      } catch (error) {
        throw new Error('Failed to fetch bookmarks tree');
      }
    },
    staleTime: 300000, // 5 minutes - bookmarks don't change often
  });
}