import { create } from "zustand"
import { subscribeWithSelector } from "zustand/middleware"
import browser from "webextension-polyfill"
import Fuse from "fuse.js"
import type {
  Bookmark,
  BookmarkTag,
  BookmarkMetadata,
  BookmarkBulkAction,
  BookmarkSearchFilters,
  BookmarkSortOptions,
} from "@/shared/types"
import { MESSAGE_TYPES } from "@/shared/constants"

interface BookmarkState {
  // Data
  bookmarks: Bookmark[]
  flatBookmarks: Bookmark[] // Flattened for table view
  tags: BookmarkTag[]

  // UI State
  view: "table" | "tree"
  selectedBookmarks: Set<string>
  expandedFolders: Set<string>
  searchQuery: string
  filters: BookmarkSearchFilters
  sortOptions: BookmarkSortOptions

  // Loading states
  loading: {
    bookmarks: boolean
    tags: boolean
    bulkOperation: boolean
  }
  error?: string

  // Search
  searchIndex?: Fuse<Bookmark>

  actions: {
    // Data loading
    loadBookmarks: () => Promise<void>
    loadTags: () => Promise<void>
    refreshAll: () => Promise<void>

    // Tag operations
    createTag: (tag: Partial<BookmarkTag>) => Promise<void>
    updateTag: (id: string, updates: Partial<BookmarkTag>) => Promise<void>
    deleteTag: (id: string) => Promise<void>

    // Bookmark metadata
    updateBookmarkMetadata: (
      bookmarkId: string,
      updates: Partial<BookmarkMetadata>,
    ) => Promise<void>
    assignContainer: (bookmarkId: string, containerId: string) => Promise<void>
    removeContainer: (bookmarkId: string) => Promise<void>

    // Tag-bookmark operations
    addTagToBookmark: (bookmarkId: string, tagId: string) => Promise<void>
    removeTagFromBookmark: (bookmarkId: string, tagId: string) => Promise<void>

    // Bulk operations
    selectBookmark: (id: string, multi?: boolean) => void
    selectAll: () => void
    selectFolder: (folderId: string) => void
    clearSelection: () => void
    executeBulkAction: (action: BookmarkBulkAction) => Promise<void>

    // Search and filtering
    setSearchQuery: (query: string) => void
    setFilters: (filters: Partial<BookmarkSearchFilters>) => void
    setSortOptions: (options: Partial<BookmarkSortOptions>) => void
    clearFilters: () => void

    // View management
    setView: (view: "table" | "tree") => void
    toggleFolder: (folderId: string) => void
    expandAllFolders: () => void
    collapseAllFolders: () => void

    // Rule matching
    checkRuleMatch: (url: string) => Promise<string | null>

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

const flattenBookmarks = (bookmarks: Bookmark[]): Bookmark[] => {
  const flat: Bookmark[] = []

  const flatten = (items: Bookmark[]) => {
    for (const item of items) {
      if (item.type === "bookmark" && item.url) {
        flat.push(item)
      }
      if (item.children) {
        flatten(item.children)
      }
    }
  }

  flatten(bookmarks)
  return flat
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
      case "tags":
        aValue = a.tags.length
        bValue = b.tags.length
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
    tags: [],
    view: "table",
    selectedBookmarks: new Set(),
    expandedFolders: new Set(),
    searchQuery: "",
    filters: {},
    sortOptions: { field: "title", order: "asc" },
    loading: {
      bookmarks: false,
      tags: false,
      bulkOperation: false,
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
          const flat = flattenBookmarks(bookmarks)
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

      loadTags: async () => {
        set((state) => ({
          loading: { ...state.loading, tags: true },
          error: undefined,
        }))

        try {
          const response = await browser.runtime.sendMessage({
            type: MESSAGE_TYPES.GET_BOOKMARK_TAGS,
          })

          if (!response?.success) {
            throw new Error(response?.error || "Failed to fetch tags")
          }

          set((state) => ({
            tags: response.data || [],
            loading: { ...state.loading, tags: false },
          }))
        } catch (error) {
          set((state) => ({
            error: error instanceof Error ? error.message : "Unknown error",
            loading: { ...state.loading, tags: false },
          }))
        }
      },

      refreshAll: async () => {
        const { loadBookmarks, loadTags } = get().actions
        await Promise.all([loadBookmarks(), loadTags()])
      },

      createTag: async (tag) => {
        try {
          const response = await browser.runtime.sendMessage({
            type: MESSAGE_TYPES.CREATE_BOOKMARK_TAG,
            payload: tag,
          })

          if (!response?.success) {
            throw new Error(response?.error || "Failed to create tag")
          }

          set((state) => ({
            tags: [...state.tags, response.data],
          }))
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : "Unknown error",
          })
          throw error
        }
      },

      updateTag: async (id, updates) => {
        try {
          const response = await browser.runtime.sendMessage({
            type: MESSAGE_TYPES.UPDATE_BOOKMARK_TAG,
            payload: { id, updates },
          })

          if (!response?.success) {
            throw new Error(response?.error || "Failed to update tag")
          }

          set((state) => ({
            tags: state.tags.map((tag) =>
              tag.id === id ? response.data : tag,
            ),
          }))
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : "Unknown error",
          })
          throw error
        }
      },

      deleteTag: async (id) => {
        try {
          const response = await browser.runtime.sendMessage({
            type: MESSAGE_TYPES.DELETE_BOOKMARK_TAG,
            payload: { id },
          })

          if (!response?.success) {
            throw new Error(response?.error || "Failed to delete tag")
          }

          set((state) => ({
            tags: state.tags.filter((tag) => tag.id !== id),
          }))

          // Refresh bookmarks to update tag associations
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

      addTagToBookmark: async (bookmarkId, tagId) => {
        try {
          const response = await browser.runtime.sendMessage({
            type: MESSAGE_TYPES.BULK_ASSIGN_TAG,
            payload: { bookmarkIds: [bookmarkId], tagId },
          })

          if (!response?.success) {
            throw new Error(response?.error || "Failed to add tag")
          }

          // Refresh bookmarks to show updated tags
          await get().actions.loadBookmarks()
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : "Unknown error",
          })
          throw error
        }
      },

      removeTagFromBookmark: async (bookmarkId, tagId) => {
        try {
          const response = await browser.runtime.sendMessage({
            type: MESSAGE_TYPES.BULK_REMOVE_TAG,
            payload: { bookmarkIds: [bookmarkId], tagId },
          })

          if (!response?.success) {
            throw new Error(response?.error || "Failed to remove tag")
          }

          await get().actions.loadBookmarks()
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : "Unknown error",
          })
          throw error
        }
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

      selectFolder: (folderId) => {
        // Find all bookmarks in this folder and select them
        const findFolderBookmarks = (
          bookmarks: Bookmark[],
          targetId: string,
        ): string[] => {
          const ids: string[] = []

          for (const bookmark of bookmarks) {
            if (bookmark.id === targetId && bookmark.children) {
              // Found the folder, collect all bookmark IDs in it
              const collectIds = (items: Bookmark[]) => {
                for (const item of items) {
                  if (item.type === "bookmark") {
                    ids.push(item.id)
                  }
                  if (item.children) {
                    collectIds(item.children)
                  }
                }
              }
              collectIds(bookmark.children)
              break
            }
            if (bookmark.children) {
              ids.push(...findFolderBookmarks(bookmark.children, targetId))
            }
          }

          return ids
        }

        set((state) => {
          const folderBookmarkIds = findFolderBookmarks(
            state.bookmarks,
            folderId,
          )
          const newSelection = new Set(state.selectedBookmarks)
          folderBookmarkIds.forEach((id) => newSelection.add(id))
          return { selectedBookmarks: newSelection }
        })
      },

      clearSelection: () => {
        set({ selectedBookmarks: new Set() })
      },

      executeBulkAction: async (action) => {
        set((state) => ({ loading: { ...state.loading, bulkOperation: true } }))

        try {
          const response = await browser.runtime.sendMessage({
            type: MESSAGE_TYPES.BULK_UPDATE_BOOKMARKS,
            payload: action,
          })

          if (!response?.success) {
            throw new Error(response?.error || "Bulk operation failed")
          }

          // Clear selection and refresh data
          set({ selectedBookmarks: new Set() })
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

      expandAllFolders: () => {
        const getAllFolderIds = (bookmarks: Bookmark[]): string[] => {
          const ids: string[] = []
          for (const bookmark of bookmarks) {
            if (bookmark.type === "folder") {
              ids.push(bookmark.id)
            }
            if (bookmark.children) {
              ids.push(...getAllFolderIds(bookmark.children))
            }
          }
          return ids
        }

        set((state) => ({
          expandedFolders: new Set(getAllFolderIds(state.bookmarks)),
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
        } catch (error) {
          return null
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
    if (filters.tags && filters.tags.length > 0) {
      filtered = filtered.filter((bookmark) =>
        filters.tags!.some((tagId) => bookmark.tags.includes(tagId)),
      )
    }

    if (filters.containers && filters.containers.length > 0) {
      filtered = filtered.filter(
        (bookmark) =>
          bookmark.containerId &&
          filters.containers!.includes(bookmark.containerId),
      )
    }

    // Apply sorting
    return sortBookmarks(filtered, sortOptions)
  })
}

export const useBookmarkTags = () => useBookmarkStore((state) => state.tags)
export const useBookmarkView = () => useBookmarkStore((state) => state.view)
export const useSelectedBookmarks = () =>
  useBookmarkStore((state) => state.selectedBookmarks)
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
