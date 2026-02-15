import { Filter, Grid3X3, List } from "lucide-react"
import React from "react"
import { useContainers } from "../../stores"
import {
  useBookmarkActions,
  useBookmarkError,
  useBookmarkLoading,
  useBookmarkSearchState,
  useBookmarkView,
  useSelectedBookmarks,
} from "../../stores/bookmarkStore"
import { Card } from "../Card"
import { BookmarkFilters } from "./BookmarkFilters"
import { BookmarkSearchBar } from "./BookmarkSearchBar"
import { BookmarkTableView } from "./BookmarkTableView"
import { BookmarkTreeView } from "./BookmarkTreeView"
import { BulkActionsBar } from "./BulkActionsBar"

interface BookmarkManagerProps {
  className?: string
}

export function BookmarkManager({
  className = "",
}: BookmarkManagerProps): JSX.Element {
  const view = useBookmarkView()
  const selectedBookmarks = useSelectedBookmarks()
  const loading = useBookmarkLoading()
  const error = useBookmarkError()
  const searchState = useBookmarkSearchState()
  const containers = useContainers()

  const { setView, refreshAll, clearError, loadBookmarks } =
    useBookmarkActions()

  // State for modals and panels
  const [showFilters, setShowFilters] = React.useState(false)

  // Initialize data on mount
  React.useEffect(() => {
    const initialize = async () => {
      await loadBookmarks()
    }
    initialize()
  }, [loadBookmarks])

  const handleRefresh = React.useCallback(async () => {
    await refreshAll()
  }, [refreshAll])

  const hasActiveFilters = React.useMemo(() => {
    return (
      searchState.query ||
      (searchState.filters.containers &&
        searchState.filters.containers.length > 0)
    )
  }, [searchState])

  const selectedCount = selectedBookmarks.size

  return (
    <div className={`bookmark-manager ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
            Bookmark Manager
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Manage your bookmarks with containers and advanced search
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* View Toggle */}
          <div className="flex rounded-lg border border-gray-300 dark:border-gray-600 overflow-hidden">
            <button
              onClick={() => setView("table")}
              className={`px-3 py-2 text-sm font-medium transition-colors ${
                view === "table"
                  ? "bg-blue-500 text-white"
                  : "bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600"
              }`}
              title="Table View"
            >
              <List className="w-4 h-4" />
            </button>
            <button
              onClick={() => setView("tree")}
              className={`px-3 py-2 text-sm font-medium transition-colors ${
                view === "tree"
                  ? "bg-blue-500 text-white"
                  : "bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600"
              }`}
              title="Tree View"
            >
              <Grid3X3 className="w-4 h-4" />
            </button>
          </div>

          {/* Actions */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
              showFilters || hasActiveFilters
                ? "bg-blue-500 text-white"
                : "bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600"
            }`}
            title="Filters"
          >
            <Filter className="w-4 h-4" />
          </button>

          <button
            onClick={handleRefresh}
            disabled={loading.bookmarks}
            className="px-3 py-2 text-sm font-medium rounded-lg transition-colors bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Refresh"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <Card className="mb-4 border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950">
          <div className="flex items-center justify-between">
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
              className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-200"
            >
              ×
            </button>
          </div>
        </Card>
      )}

      {/* Search Bar */}
      <BookmarkSearchBar className="mb-4" />

      {/* Filters Panel */}
      {showFilters && (
        <BookmarkFilters
          className="mb-4"
          containers={containers}
          onClose={() => setShowFilters(false)}
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
      {loading.bookmarks && (
        <Card className="mb-4">
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            <span className="ml-3 text-sm text-gray-500 dark:text-gray-400">
              Loading bookmarks...
            </span>
          </div>
        </Card>
      )}

      {/* Main Content */}
      {!loading.bookmarks && !error && (
        <div className="bookmark-content">
          {view === "table" ? <BookmarkTableView /> : <BookmarkTreeView />}
        </div>
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
          
          .flex.items-center.justify-between {
            flex-direction: column;
            align-items: stretch;
            gap: 1rem;
          }
          
          .flex.items-center.gap-2 {
            justify-content: center;
            flex-wrap: wrap;
          }
        }
      `}</style>
    </div>
  )
}
