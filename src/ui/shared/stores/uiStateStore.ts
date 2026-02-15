import { create } from "zustand"
import { persist } from "zustand/middleware"

// Common UI state that all pages might have
interface BasePageState {
  searchQuery: string
  sortBy: string
  sortOrder: "asc" | "desc"
  viewMode: string
  showFilters: boolean
  filters: Record<string, any>
  selectedItems?: Set<string>
}

// Page-specific state interfaces
interface RulesPageState extends BasePageState {
  showDuplicates: boolean
}

interface ContainersPageState extends BasePageState {
  selectedContainerId: string
}

interface BookmarksPageState {
  searchQuery: string
  sortBy: string
  sortOrder: "asc" | "desc"
  viewMode: "table" | "tree"
  showFilters: boolean
  filters: {
    containers: string[]
    folders: string[]
  }
  selectedBookmarks: string[]
}

// Combined UI state for all pages
interface UIState {
  pages: {
    rules: RulesPageState
    containers: ContainersPageState
    bookmarks: BookmarksPageState
  }
}

// Actions interface
interface UIStateActions {
  // Generic page state update
  updatePageState: <K extends keyof UIState["pages"]>(
    page: K,
    updates: Partial<UIState["pages"][K]>,
  ) => void

  // Set complete page state
  setPageState: <K extends keyof UIState["pages"]>(
    page: K,
    state: UIState["pages"][K],
  ) => void

  // Update specific filter for a page
  updatePageFilter: <K extends keyof UIState["pages"]>(
    page: K,
    filterKey: string,
    value: any,
  ) => void

  // Clear all filters for a page
  clearPageFilters: <K extends keyof UIState["pages"]>(page: K) => void

  // Toggle filter panel visibility
  toggleFiltersPanel: <K extends keyof UIState["pages"]>(page: K) => void

  // Update sort settings
  updatePageSort: <K extends keyof UIState["pages"]>(
    page: K,
    sortBy: string,
    sortOrder?: "asc" | "desc",
  ) => void

  // Update view mode
  updatePageViewMode: <K extends keyof UIState["pages"]>(
    page: K,
    viewMode: string,
  ) => void

  // Reset page to defaults
  resetPageState: <K extends keyof UIState["pages"]>(page: K) => void
}

// Default states for each page
const defaultPageStates: UIState["pages"] = {
  rules: {
    searchQuery: "",
    sortBy: "priority",
    sortOrder: "desc",
    viewMode: "table",
    showFilters: false,
    showDuplicates: false,
    filters: {
      container: "",
      ruleType: "",
      enabled: null,
    },
  },
  containers: {
    searchQuery: "",
    sortBy: "name",
    sortOrder: "asc",
    viewMode: "table",
    showFilters: false,
    selectedContainerId: "",
    filters: {
      hasRules: "",
      color: "",
      lifecycle: "",
    },
  },
  bookmarks: {
    searchQuery: "",
    sortBy: "title",
    sortOrder: "asc",
    viewMode: "tree",
    showFilters: false,
    filters: {
      containers: [],
      folders: [],
    },
    selectedBookmarks: [],
  },
}

// Create the store with persistence
export const useUIStateStore = create<UIState & UIStateActions>()(
  persist(
    (set) => ({
      pages: defaultPageStates,

      updatePageState: (page, updates) =>
        set((state) => ({
          pages: {
            ...state.pages,
            [page]: {
              ...state.pages[page],
              ...updates,
            },
          },
        })),

      setPageState: (page, newState) =>
        set((state) => ({
          pages: {
            ...state.pages,
            [page]: newState,
          },
        })),

      updatePageFilter: (page, filterKey, value) =>
        set((state) => ({
          pages: {
            ...state.pages,
            [page]: {
              ...state.pages[page],
              filters: {
                ...state.pages[page].filters,
                [filterKey]: value,
              },
            },
          },
        })),

      clearPageFilters: (page) =>
        set((state) => ({
          pages: {
            ...state.pages,
            [page]: {
              ...state.pages[page],
              filters: defaultPageStates[page].filters,
              searchQuery: "",
            },
          },
        })),

      toggleFiltersPanel: (page) =>
        set((state) => ({
          pages: {
            ...state.pages,
            [page]: {
              ...state.pages[page],
              showFilters: !state.pages[page].showFilters,
            },
          },
        })),

      updatePageSort: (page, sortBy, sortOrder) =>
        set((state) => {
          const currentPage = state.pages[page]
          const newSortOrder =
            sortOrder ||
            (currentPage.sortBy === sortBy && currentPage.sortOrder === "asc"
              ? "desc"
              : "asc")

          return {
            pages: {
              ...state.pages,
              [page]: {
                ...currentPage,
                sortBy,
                sortOrder: newSortOrder,
              },
            },
          }
        }),

      updatePageViewMode: (page, viewMode) =>
        set((state) => ({
          pages: {
            ...state.pages,
            [page]: {
              ...state.pages[page],
              viewMode,
            },
          },
        })),

      resetPageState: (page) =>
        set((state) => ({
          pages: {
            ...state.pages,
            [page]: defaultPageStates[page],
          },
        })),
    }),
    {
      name: "silo-ui-state", // localStorage key
      partialize: (state) => ({ pages: state.pages }), // Only persist the pages data
    },
  ),
)

// Convenience hooks for each page
export const useRulesPageState = () => {
  const state = useUIStateStore((state) => state.pages.rules)
  const actions = useUIStateStore((state) => ({
    updateState: (updates: Partial<RulesPageState>) =>
      state.updatePageState("rules", updates),
    updateFilter: (key: string, value: any) =>
      state.updatePageFilter("rules", key, value),
    clearFilters: () => state.clearPageFilters("rules"),
    toggleFilters: () => state.toggleFiltersPanel("rules"),
    updateSort: (sortBy: string, sortOrder?: "asc" | "desc") =>
      state.updatePageSort("rules", sortBy, sortOrder),
    updateViewMode: (viewMode: string) =>
      state.updatePageViewMode("rules", viewMode),
    reset: () => state.resetPageState("rules"),
  }))

  return { ...state, ...actions }
}

export const useContainersPageState = () => {
  const state = useUIStateStore((state) => state.pages.containers)
  const actions = useUIStateStore((state) => ({
    updateState: (updates: Partial<ContainersPageState>) =>
      state.updatePageState("containers", updates),
    updateFilter: (key: string, value: any) =>
      state.updatePageFilter("containers", key, value),
    clearFilters: () => state.clearPageFilters("containers"),
    toggleFilters: () => state.toggleFiltersPanel("containers"),
    updateSort: (sortBy: string, sortOrder?: "asc" | "desc") =>
      state.updatePageSort("containers", sortBy, sortOrder),
    updateViewMode: (viewMode: string) =>
      state.updatePageViewMode("containers", viewMode),
    reset: () => state.resetPageState("containers"),
  }))

  return { ...state, ...actions }
}

export const useBookmarksPageState = () => {
  const state = useUIStateStore((state) => state.pages.bookmarks)
  const actions = useUIStateStore((state) => ({
    updateState: (updates: Partial<BookmarksPageState>) =>
      state.updatePageState("bookmarks", updates),
    updateFilter: (key: string, value: any) =>
      state.updatePageFilter("bookmarks", key, value),
    clearFilters: () => state.clearPageFilters("bookmarks"),
    toggleFilters: () => state.toggleFiltersPanel("bookmarks"),
    updateSort: (sortBy: string, sortOrder?: "asc" | "desc") =>
      state.updatePageSort("bookmarks", sortBy, sortOrder),
    updateViewMode: (viewMode: string) =>
      state.updatePageViewMode("bookmarks", viewMode),
    reset: () => state.resetPageState("bookmarks"),
  }))

  return { ...state, ...actions }
}
