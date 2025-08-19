import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import browser from 'webextension-polyfill';
import type { BookmarkAssociation } from '@/shared/types';
import { MESSAGE_TYPES } from '@/shared/constants';

interface BookmarkState {
  associations: BookmarkAssociation[];
  bookmarksTree: browser.Bookmarks.BookmarkTreeNode[];
  loading: {
    associations: boolean;
    tree: boolean;
  };
  error?: string;
  
  actions: {
    loadAssociations: () => Promise<void>;
    loadBookmarksTree: () => Promise<void>;
    addAssociation: (bookmarkId: string, containerId: string, url: string, autoOpen?: boolean) => Promise<void>;
    removeAssociation: (bookmarkId: string) => Promise<void>;
    processBookmarkUrl: (url: string) => Promise<any>;
    clearError: () => void;
  };
}

export const useBookmarkStore = create<BookmarkState>()(
  subscribeWithSelector((set, get) => ({
    associations: [],
    bookmarksTree: [],
    loading: {
      associations: false,
      tree: false,
    },
    error: undefined,
    
    actions: {
      loadAssociations: async () => {
        set(state => ({ 
          loading: { ...state.loading, associations: true },
          error: undefined 
        }));
        
        try {
          const response = await browser.runtime.sendMessage({
            type: MESSAGE_TYPES.GET_BOOKMARK_ASSOCIATIONS,
          });
          
          if (!response?.success) {
            throw new Error(response?.error || 'Failed to fetch bookmark associations');
          }
          
          set(state => ({ 
            associations: response.data || [],
            loading: { ...state.loading, associations: false }
          }));
        } catch (error) {
          set(state => ({ 
            error: error instanceof Error ? error.message : 'Unknown error',
            loading: { ...state.loading, associations: false }
          }));
        }
      },
      
      loadBookmarksTree: async () => {
        set(state => ({ 
          loading: { ...state.loading, tree: true },
          error: undefined 
        }));
        
        try {
          const tree = await browser.bookmarks.getTree();
          set(state => ({ 
            bookmarksTree: tree,
            loading: { ...state.loading, tree: false }
          }));
        } catch (error) {
          set(state => ({ 
            error: error instanceof Error ? error.message : 'Failed to fetch bookmarks tree',
            loading: { ...state.loading, tree: false }
          }));
        }
      },
      
      addAssociation: async (bookmarkId, containerId, url, autoOpen = true) => {
        try {
          const response = await browser.runtime.sendMessage({
            type: MESSAGE_TYPES.ADD_BOOKMARK_ASSOCIATION,
            payload: { bookmarkId, containerId, url, autoOpen },
          });
          
          if (!response?.success) {
            throw new Error(response?.error || 'Failed to add bookmark association');
          }
          
          // Optimistically update associations
          const newAssociation: BookmarkAssociation = {
            bookmarkId,
            containerId,
            url,
            autoOpen,
            created: Date.now(),
          };
          
          set(state => {
            const existingIndex = state.associations.findIndex(a => a.bookmarkId === bookmarkId);
            if (existingIndex !== -1) {
              // Update existing
              const updated = [...state.associations];
              updated[existingIndex] = newAssociation;
              return { associations: updated };
            } else {
              // Add new
              return { associations: [...state.associations, newAssociation] };
            }
          });
        } catch (error) {
          set({ error: error instanceof Error ? error.message : 'Unknown error' });
          throw error;
        }
      },
      
      removeAssociation: async (bookmarkId) => {
        try {
          const response = await browser.runtime.sendMessage({
            type: MESSAGE_TYPES.REMOVE_BOOKMARK_ASSOCIATION,
            payload: { bookmarkId },
          });
          
          if (!response?.success) {
            throw new Error(response?.error || 'Failed to remove bookmark association');
          }
          
          // Optimistically remove from state
          set(state => ({
            associations: state.associations.filter(a => a.bookmarkId !== bookmarkId)
          }));
        } catch (error) {
          set({ error: error instanceof Error ? error.message : 'Unknown error' });
          // Refresh on error to revert optimistic update
          await get().actions.loadAssociations();
          throw error;
        }
      },
      
      processBookmarkUrl: async (url) => {
        try {
          const response = await browser.runtime.sendMessage({
            type: MESSAGE_TYPES.PROCESS_BOOKMARK_URL,
            payload: { url },
          });
          
          if (!response?.success) {
            throw new Error(response?.error || 'Failed to process bookmark URL');
          }
          
          return response.data;
        } catch (error) {
          throw error;
        }
      },
      
      clearError: () => set({ error: undefined }),
    },
  }))
);

export const useBookmarkAssociations = () => useBookmarkStore(state => state.associations);
export const useBookmarksTree = () => useBookmarkStore(state => state.bookmarksTree);
export const useBookmarkActions = () => useBookmarkStore(state => state.actions);
export const useBookmarkLoading = () => useBookmarkStore(state => state.loading);
export const useBookmarkError = () => useBookmarkStore(state => state.error);