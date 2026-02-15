import Fuse from "fuse.js"
import browser from "webextension-polyfill"
import { create } from "zustand"
import { subscribeWithSelector } from "zustand/middleware"
import { MESSAGE_TYPES } from "@/shared/constants"
import type {
  Bookmark,
  BookmarkBulkAction,
  BookmarkMetadata,
  BookmarkSearchFilters,
  BookmarkSortOptions,
} from "@/shared/types"
import {
  flattenBookmarkTree,
  getBookmarkIdsInFolder,
  getBookmarkIdsInFolders,
  getFolderIds,
} from "@/shared/utils/bookmarkTree"

interface BookmarkState {
  // Data
  bookmarks: Bookmark[]
  flatBookmarks: Bookmark[] // Flattened for table view

  // UI State
  view: "table" | "tree"
  selectedBookmarks: Set<string>
  selectedFolders: Set<string>
  expandedFolders: Set<string>
  searchQuery: string
  filters: BookmarkSearchFilters
  sortOptions: BookmarkSortOptions
  newlyCreatedItems: Set<string> // Track newly created items for highlighting

  // Loading states
  loading: {
    bookmarks: boolean
    bulkOperation: boolean
    dragOperation: boolean
  }
  error?: string

  // Search
  searchIndex?: Fuse<Bookmark>

  actions: {
    // Data loading
    loadBookmarks: () => Promise<void>
    refreshAll: () => Promise<void>

    // Bookmark operations
    createBookmark: (options: {
      title: string
      url: string
      parentId?: string
      containerId?: string
    }) => Promise<void>
    createFolder: (options: {
      title: string
      parentId?: string
    }) => Promise<void>
    updateBookmark: (
      bookmarkId: string,
      updates: { title?: string; url?: string },
    ) => Promise<void>
    deleteBookmark: (bookmarkId: string) => Promise<void>

    // Bookmark metadata
    updateBookmarkMetadata: (
      bookmarkId: string,
      updates: Partial<BookmarkMetadata>,
    ) => Promise<void>
    assignContainer: (bookmarkId: string, containerId: string) => Promise<void>
    removeContainer: (bookmarkId: string) => Promise<void>

    // Bulk operations
    selectBookmark: (id: string, multi?: boolean) => void
    selectAll: () => void
    selectFolder: (folderId: string, multi?: boolean) => void
    toggleFolderSelection: (folderId: string) => void
    clearSelection: () => void
    executeBulkAction: (action: BookmarkBulkAction) => Promise<void>
    deleteFolders: (folderIds: string[]) => Promise<void>

    // Search and filtering
    setSearchQuery: (query: string) => void
    setFilters: (filters: Partial<BookmarkSearchFilters>) => void
    setSortOptions: (options: Partial<BookmarkSortOptions>) => void
    clearFilters: () => void

    // View management
    setView: (view: "table" | "tree") => void
    toggleFolder: (folderId: string) => void
    highlightNewItem: (itemId: string) => void
    clearHighlights: () => void
    expandAllFolders: () => void
    collapseAllFolders: () => void

    // Rule matching
    checkRuleMatch: (url: string) => Promise<string | null>

    // Drag and drop reordering
    reorderBookmarks: (parentId: string, bookmarkIds: string[]) => Promise<void>
    moveBookmark: (
      bookmarkId: string,
      parentId?: string,
      index?: number,
    ) => Promise<void>

    // Error handling
    clearError: () => void
  }
}

const createSearchIndex = (bookmarks: Bookmark[]) => {
  return new Fuse(bookmarks, {
    keys: [
      { name: "title", weight: 0.4 },
      { name: "url", weight: 0.3 },
      { name: "description", weight: 0.2 },
      { name: "notes", weight: 0.1 },
    ],
    threshold: 0.4,
    includeScore: true,
  })
}

const sortBookmarks = (
  bookmarks: Bookmark[],
  sortOptions: BookmarkSortOptions,
): Bookmark[] => {
  return [...bookmarks].sort((a, b) => {
    let aValue: any
    let bValue: any

    switch (sortOptions.field) {
      case "title":
        aValue = a.title.toLowerCase()
        bValue = b.title.toLowerCase()
        break
      case "url":
        aValue = a.url?.toLowerCase() || ""
        bValue = b.url?.toLowerCase() || ""
        break
      case "created":
        aValue = a.dateAdded || 0
        bValue = b.dateAdded || 0
        break
      case "modified":
        aValue = a.dateGroupModified || 0
        bValue = b.dateGroupModified || 0
        break
      case "container":
        aValue = a.containerId || ""
        bValue = b.containerId || ""
        break
      default:
        return 0
    }

    if (typeof aValue === "string") {
      const result = aValue.localeCompare(bValue)
      return sortOptions.order === "asc" ? result : -result
    } else {
      const result = aValue - bValue
      return sortOptions.order === "asc" ? result : -result
    }
  })
}

export const useBookmarkStore = create<BookmarkState>()(
  subscribeWithSelector((set, get) => ({
    // Initial state
    bookmarks: [],
    flatBookmarks: [],
    view: "table",
    selectedBookmarks: new Set(),
    selectedFolders: new Set(),
    expandedFolders: new Set(),
    searchQuery: "",
    filters: {},
    sortOptions: { field: "title", order: "asc" },
    newlyCreatedItems: new Set(),
    loading: {
      bookmarks: false,
      bulkOperation: false,
      dragOperation: false,
    },
    error: undefined,
    searchIndex: undefined,

    actions: {
      loadBookmarks: async () => {
        set((state) => ({
          loading: { ...state.loading, bookmarks: true },
          error: undefined,
        }))

        try {
          const response = await browser.runtime.sendMessage({
            type: MESSAGE_TYPES.GET_BOOKMARKS,
          })

          if (!response?.success) {
            throw new Error(response?.error || "Failed to fetch bookmarks")
          }

          const bookmarks = response.data || []
          const flat = flattenBookmarkTree(bookmarks)
          const searchIndex = createSearchIndex(flat)

          set((state) => ({
            bookmarks,
            flatBookmarks: flat,
            searchIndex,
            loading: { ...state.loading, bookmarks: false },
          }))
        } catch (error) {
          set((state) => ({
            error: error instanceof Error ? error.message : "Unknown error",
            loading: { ...state.loading, bookmarks: false },
          }))
        }
      },

      refreshAll: async () => {
        await get().actions.loadBookmarks()
      },

      createBookmark: async (options) => {
        try {
          const response = await browser.runtime.sendMessage({
            type: MESSAGE_TYPES.CREATE_BOOKMARK,
            payload: options,
          })

          if (!response?.success) {
            throw new Error(response?.error || "Failed to create bookmark")
          }

          const createdBookmark = response.data

          // If no parent specified, ensure "Other Bookmarks" folder is expanded
          if (!options.parentId) {
            set((state) => {
              const newExpanded = new Set(state.expandedFolders)
              newExpanded.add("unfiled_____") // "Other Bookmarks" folder
              return { expandedFolders: newExpanded }
            })
          }

          // Refresh bookmarks to get updated data with new bookmark
          await get().actions.loadBookmarks()

          // Highlight the new item
          if (createdBookmark?.id) {
            get().actions.highlightNewItem(createdBookmark.id)
          }

          return createdBookmark
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : "Unknown error",
          })
          throw error
        }
      },

      createFolder: async (options) => {
        try {
          const response = await browser.runtime.sendMessage({
            type: MESSAGE_TYPES.CREATE_BOOKMARK_FOLDER,
            payload: options,
          })

          if (!response?.success) {
            throw new Error(response?.error || "Failed to create folder")
          }

          const createdFolder = response.data

          // If no parent specified, ensure "Other Bookmarks" folder is expanded
          if (!options.parentId) {
            set((state) => {
              const newExpanded = new Set(state.expandedFolders)
              newExpanded.add("unfiled_____") // "Other Bookmarks" folder
              return { expandedFolders: newExpanded }
            })
          }

          // Refresh bookmarks to get updated data with new folder
          await get().actions.loadBookmarks()

          // Highlight the new item
          if (createdFolder?.id) {
            get().actions.highlightNewItem(createdFolder.id)
          }

          return createdFolder
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : "Unknown error",
          })
          throw error
        }
      },

      updateBookmark: async (bookmarkId, updates) => {
        try {
          // Use Firefox's bookmarks API to update title and URL
          const response = await browser.runtime.sendMessage({
            type: MESSAGE_TYPES.UPDATE_BOOKMARK_NATIVE,
            payload: { bookmarkId, updates },
          })

          if (!response?.success) {
            throw new Error(response?.error || "Failed to update bookmark")
          }

          // Refresh bookmarks to get updated data
          await get().actions.loadBookmarks()
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : "Unknown error",
          })
          throw error
        }
      },

      deleteBookmark: async (bookmarkId) => {
        try {
          // Use Firefox's bookmarks API to delete the bookmark
          const response = await browser.runtime.sendMessage({
            type: MESSAGE_TYPES.DELETE_BOOKMARK_NATIVE,
            payload: { bookmarkId },
          })

          if (!response?.success) {
            throw new Error(response?.error || "Failed to delete bookmark")
          }

          // Remove from local state immediately
          set((state) => ({
            flatBookmarks: state.flatBookmarks.filter(
              (b) => b.id !== bookmarkId,
            ),
            selectedBookmarks: new Set(
              [...state.selectedBookmarks].filter((id) => id !== bookmarkId),
            ),
          }))

          // Refresh bookmarks to get updated tree
          await get().actions.loadBookmarks()
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : "Unknown error",
          })
          throw error
        }
      },

      updateBookmarkMetadata: async (bookmarkId, updates) => {
        try {
          const response = await browser.runtime.sendMessage({
            type: MESSAGE_TYPES.UPDATE_BOOKMARK,
            payload: { bookmarkId, updates },
          })

          if (!response?.success) {
            throw new Error(response?.error || "Failed to update bookmark")
          }

          // Refresh bookmarks to get updated data
          await get().actions.loadBookmarks()
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : "Unknown error",
          })
          throw error
        }
      },

      assignContainer: async (bookmarkId, containerId) => {
        await get().actions.updateBookmarkMetadata(bookmarkId, { containerId })
      },

      removeContainer: async (bookmarkId) => {
        const response = await browser.runtime.sendMessage({
          type: MESSAGE_TYPES.BULK_REMOVE_CONTAINER,
          payload: { bookmarkIds: [bookmarkId] },
        })

        if (!response?.success) {
          throw new Error(response?.error || "Failed to remove container")
        }

        await get().actions.loadBookmarks()
      },

      selectBookmark: (id, multi = false) => {
        set((state) => {
          const newSelection = new Set(multi ? state.selectedBookmarks : [])
          if (newSelection.has(id)) {
            newSelection.delete(id)
          } else {
            newSelection.add(id)
          }
          return { selectedBookmarks: newSelection }
        })
      },

      selectAll: () => {
        set((state) => ({
          selectedBookmarks: new Set(state.flatBookmarks.map((b) => b.id)),
        }))
      },

      selectFolder: (folderId, multi = false) => {
        set((state) => {
          const folderBookmarkIds = getBookmarkIdsInFolder(
            state.bookmarks,
            folderId,
          )
          const newBookmarkSelection = new Set(
            multi ? state.selectedBookmarks : [],
          )
          folderBookmarkIds.forEach((id) => newBookmarkSelection.add(id))
          return { selectedBookmarks: newBookmarkSelection }
        })
      },

      toggleFolderSelection: (folderId) => {
        set((state) => {
          const newFolderSelection = new Set(state.selectedFolders)
          if (newFolderSelection.has(folderId)) {
            newFolderSelection.delete(folderId)
          } else {
            newFolderSelection.add(folderId)
          }
          return { selectedFolders: newFolderSelection }
        })
      },

      clearSelection: () => {
        set({ selectedBookmarks: new Set(), selectedFolders: new Set() })
      },

      executeBulkAction: async (action) => {
        set((state) => ({ loading: { ...state.loading, bulkOperation: true } }))

        try {
          const state = get()
          const selectedFolderIds = Array.from(state.selectedFolders)
          const folderBookmarkIds = getBookmarkIdsInFolders(
            state.bookmarks,
            selectedFolderIds,
          )

          // Combine selected bookmarks with bookmarks from selected folders
          const allBookmarkIds = [
            ...Array.from(state.selectedBookmarks),
            ...folderBookmarkIds,
          ]

          // Remove duplicates
          const uniqueBookmarkIds = [...new Set(allBookmarkIds)]

          const enhancedAction = {
            ...action,
            bookmarkIds: uniqueBookmarkIds,
          }

          const response = await browser.runtime.sendMessage({
            type: MESSAGE_TYPES.BULK_UPDATE_BOOKMARKS,
            payload: enhancedAction,
          })

          if (!response?.success) {
            throw new Error(response?.error || "Bulk operation failed")
          }

          // Clear selection and refresh data
          set({ selectedBookmarks: new Set(), selectedFolders: new Set() })
          await get().actions.loadBookmarks()
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : "Unknown error",
          })
          throw error
        } finally {
          set((state) => ({
            loading: { ...state.loading, bulkOperation: false },
          }))
        }
      },

      deleteFolders: async (folderIds) => {
        set((state) => ({ loading: { ...state.loading, bulkOperation: true } }))

        try {
          const response = await browser.runtime.sendMessage({
            type: MESSAGE_TYPES.DELETE_BOOKMARK_FOLDERS,
            payload: { folderIds },
          })

          if (!response?.success) {
            throw new Error(response?.error || "Failed to delete folders")
          }

          // Clear selection and refresh data
          set({ selectedFolders: new Set(), selectedBookmarks: new Set() })
          await get().actions.loadBookmarks()
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : "Unknown error",
          })
          throw error
        } finally {
          set((state) => ({
            loading: { ...state.loading, bulkOperation: false },
          }))
        }
      },

      setSearchQuery: (query) => {
        set({ searchQuery: query })
      },

      setFilters: (filters) => {
        set((state) => ({
          filters: { ...state.filters, ...filters },
        }))
      },

      setSortOptions: (options) => {
        set((state) => ({
          sortOptions: { ...state.sortOptions, ...options },
        }))
      },

      clearFilters: () => {
        set({
          searchQuery: "",
          filters: {},
          sortOptions: { field: "title", order: "asc" },
        })
      },

      setView: (view) => {
        set({ view })
      },

      toggleFolder: (folderId) => {
        set((state) => {
          const newExpanded = new Set(state.expandedFolders)
          if (newExpanded.has(folderId)) {
            newExpanded.delete(folderId)
          } else {
            newExpanded.add(folderId)
          }
          return { expandedFolders: newExpanded }
        })
      },

      highlightNewItem: (itemId) => {
        set((state) => {
          const newHighlights = new Set(state.newlyCreatedItems)
          newHighlights.add(itemId)
          return { newlyCreatedItems: newHighlights }
        })

        // Clear highlight after 3 seconds
        setTimeout(() => {
          set((state) => {
            const newHighlights = new Set(state.newlyCreatedItems)
            newHighlights.delete(itemId)
            return { newlyCreatedItems: newHighlights }
          })
        }, 3000)
      },

      clearHighlights: () => {
        set({ newlyCreatedItems: new Set() })
      },

      expandAllFolders: () => {
        set((state) => ({
          expandedFolders: new Set(getFolderIds(state.bookmarks)),
        }))
      },

      collapseAllFolders: () => {
        set({ expandedFolders: new Set() })
      },

      checkRuleMatch: async (url) => {
        try {
          const response = await browser.runtime.sendMessage({
            type: MESSAGE_TYPES.CHECK_BOOKMARK_RULE_MATCH,
            payload: { url },
          })

          return response?.success ? response.data?.containerId || null : null
        } catch (_error) {
          return null
        }
      },

      reorderBookmarks: async (parentId, bookmarkIds) => {
        set((state) => ({
          loading: { ...state.loading, dragOperation: true },
          error: undefined,
        }))

        try {
          const response = await browser.runtime.sendMessage({
            type: MESSAGE_TYPES.REORDER_BOOKMARKS,
            payload: { parentId, bookmarkIds },
          })

          if (!response?.success) {
            throw new Error(response?.error || "Failed to reorder bookmarks")
          }

          // Refresh bookmarks to show updated order
          await get().actions.loadBookmarks()
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : "Unknown error",
          })
          throw error
        } finally {
          set((state) => ({
            loading: { ...state.loading, dragOperation: false },
          }))
        }
      },

      moveBookmark: async (bookmarkId, parentId, index) => {
        set((state) => ({
          loading: { ...state.loading, dragOperation: true },
          error: undefined,
        }))

        try {
          const response = await browser.runtime.sendMessage({
            type: MESSAGE_TYPES.MOVE_BOOKMARK,
            payload: { bookmarkId, parentId, index },
          })

          if (!response?.success) {
            throw new Error(response?.error || "Failed to move bookmark")
          }

          // Refresh bookmarks to show updated position
          await get().actions.loadBookmarks()
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : "Unknown error",
          })
          throw error
        } finally {
          set((state) => ({
            loading: { ...state.loading, dragOperation: false },
          }))
        }
      },

      clearError: () => set({ error: undefined }),
    },
  })),
)

// Computed selectors
export const useFilteredBookmarks = () => {
  return useBookmarkStore((state) => {
    const { flatBookmarks, searchQuery, filters, sortOptions, searchIndex } =
      state

    let filtered = flatBookmarks

    // Apply search
    if (searchQuery.trim() && searchIndex) {
      const searchResults = searchIndex.search(searchQuery)
      filtered = searchResults.map((result) => result.item)
    }

    // Apply filters
    if (filters.containers && filters.containers.length > 0) {
      filtered = filtered.filter(
        (bookmark) =>
          bookmark.containerId &&
          filters.containers?.includes(bookmark.containerId),
      )
    }

    // Apply sorting
    return sortBookmarks(filtered, sortOptions)
  })
}

export const useBookmarkView = () => useBookmarkStore((state) => state.view)
export const useSelectedBookmarks = () =>
  useBookmarkStore((state) => state.selectedBookmarks)
export const useSelectedFolders = () =>
  useBookmarkStore((state) => state.selectedFolders)
export const useBookmarkActions = () =>
  useBookmarkStore((state) => state.actions)
export const useBookmarkLoading = () =>
  useBookmarkStore((state) => state.loading)
export const useBookmarkError = () => useBookmarkStore((state) => state.error)
export const useBookmarkSearchState = () =>
  useBookmarkStore((state) => ({
    query: state.searchQuery,
    filters: state.filters,
    sortOptions: state.sortOptions,
  }))
