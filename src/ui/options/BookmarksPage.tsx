import React, { useMemo, useEffect } from "react"
import { Bookmark } from "lucide-react"
import {
  PageLayout,
  PageHeader,
  ViewToggle,
  ViewMode,
  EmptyState,
  StatusBar,
} from "../shared/components/layout"
import { Card } from "../shared/components/Card"
import { BookmarkTableView } from "../shared/components/bookmarks/BookmarkTableView"
import { BookmarkTreeView } from "../shared/components/bookmarks/BookmarkTreeView"
import { BookmarkSearchBar } from "../shared/components/bookmarks/BookmarkSearchBar"
import { BookmarkFilters } from "../shared/components/bookmarks/BookmarkFilters"
import { BulkActionsBar } from "../shared/components/bookmarks/BulkActionsBar"
import {
  useBookmarkView,
  useBookmarkActions,
  useBookmarkLoading,
  useBookmarkError,
  useSelectedBookmarks,
  useBookmarkSearchState,
  useFilteredBookmarks,
} from "../shared/stores/bookmarkStore"
import { useContainers, useBookmarksPageState } from "../shared/stores"

const PAGE_DESCRIPTION =
  "Manage your bookmarks with tags, containers, and advanced search. Organize bookmarks across different containers and apply tags for easy categorization."

export function BookmarksPage() {
  const view = useBookmarkView()
  const selectedBookmarks = useSelectedBookmarks()
  const loading = useBookmarkLoading()
  const error = useBookmarkError()
  const searchState = useBookmarkSearchState()
  const containers = useContainers()
  const filteredBookmarks = useFilteredBookmarks()

  const { setView, clearError, loadBookmarks, loadTags } = useBookmarkActions()

  // Use persistent UI state
  const pageState = useBookmarksPageState()
  const { showFilters, toggleFilters, updateViewMode, viewMode } = pageState

  // Initialize data on mount
  useEffect(() => {
    const initialize = async () => {
      await Promise.all([loadBookmarks(), loadTags()])
    }
    initialize()
  }, [loadBookmarks, loadTags])

  // Sync persistent view mode with bookmark store
  useEffect(() => {
    if (viewMode !== view) {
      setView(viewMode as "table" | "tree")
    }
  }, [viewMode, view, setView])

  const hasActiveFilters = useMemo(() => {
    return (
      searchState.query ||
      (searchState.filters.tags && searchState.filters.tags.length > 0) ||
      (searchState.filters.containers &&
        searchState.filters.containers.length > 0)
    )
  }, [searchState])

  const selectedCount = selectedBookmarks.size

  const isLoading = loading.bookmarks || loading.tags
  const isEmpty = !isLoading && !error && filteredBookmarks.length === 0

  return (
    <PageLayout className="bookmark-manager">
      <PageHeader title="Bookmarks" description={PAGE_DESCRIPTION} />

      {/* Error Message */}
      {error && (
        <Card className="mb-4 border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950">
          <div className="flex items-center justify-between p-4">
            <div>
              <h3 className="text-sm font-medium text-red-800 dark:text-red-200">
                Error Loading Bookmarks
              </h3>
              <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                {error}
              </p>
            </div>
            <button
              onClick={clearError}
              className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-200 text-2xl"
            >
              ×
            </button>
          </div>
        </Card>
      )}

      {/* Search and Controls Bar */}
      <div className="flex items-center gap-3 mb-4">
        <div className="flex-1">
          <BookmarkSearchBar />
        </div>

        <button
          type="button"
          onClick={toggleFilters}
          className={`flex items-center gap-2 px-3 h-9 text-sm font-medium rounded-lg transition-colors ${
            showFilters || hasActiveFilters
              ? "bg-blue-500 text-white"
              : "bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600"
          }`}
          title="Filters"
        >
          Filters
          {hasActiveFilters && (
            <span className="px-1.5 py-0.5 text-xs bg-white/20 rounded-full">
              Active
            </span>
          )}
        </button>

        <ViewToggle
          currentView={view as ViewMode}
          onChange={(v) => {
            updateViewMode(v)
            setView(v as "table" | "tree")
          }}
          availableViews={["table", "tree"] as ViewMode[]}
        />
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <BookmarkFilters
          className="mb-4"
          containers={containers}
          onClose={toggleFilters}
        />
      )}

      {/* Bulk Actions Bar */}
      {selectedCount > 0 && (
        <BulkActionsBar
          selectedCount={selectedCount}
          containers={containers}
          className="mb-4"
        />
      )}

      {/* Loading State */}
      {isLoading && (
        <Card>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            <span className="ml-3 text-sm text-gray-500 dark:text-gray-400">
              Loading bookmarks...
            </span>
          </div>
        </Card>
      )}

      {/* Empty State */}
      {isEmpty && (
        <EmptyState
          icon={<Bookmark className="w-12 h-12" />}
          title={hasActiveFilters ? "No bookmarks found" : "No bookmarks yet"}
          description={
            hasActiveFilters
              ? "Try adjusting your search or filters"
              : "Your bookmarks will appear here once you start adding them"
          }
          hasSearch={!!hasActiveFilters}
          searchQuery={searchState.query}
        />
      )}

      {/* Main Content */}
      {!isLoading && !error && !isEmpty && (
        <div className="bookmark-content">
          {view === "table" ? <BookmarkTableView /> : <BookmarkTreeView />}
        </div>
      )}

      {/* Status Bar */}
      {!isLoading && !error && (
        <StatusBar>
          {filteredBookmarks.length} bookmark
          {filteredBookmarks.length !== 1 ? "s" : ""}
          {selectedCount > 0 && ` (${selectedCount} selected)`}
          {hasActiveFilters && " (filtered)"}
        </StatusBar>
      )}

      <style>{`
        .bookmark-manager {
          max-width: 1200px;
          margin: 0 auto;
        }

        .bookmark-content {
          min-height: 400px;
        }

        /* Responsive adjustments */
        @media (max-width: 768px) {
          .bookmark-manager {
            padding: 0 1rem;
          }
        }
      `}</style>
    </PageLayout>
  )
}
