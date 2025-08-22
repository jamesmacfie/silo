import React from "react"
import { Search, X, ArrowUpDown } from "lucide-react"
import {
  useBookmarkActions,
  useBookmarkSearchState,
} from "../../stores/bookmarkStore"
import type { BookmarkSortOptions } from "@/shared/types"

interface BookmarkSearchBarProps {
  className?: string
}

const SORT_OPTIONS = [
  { field: "title" as const, label: "Title" },
  { field: "url" as const, label: "URL" },
  { field: "created" as const, label: "Date Added" },
  { field: "modified" as const, label: "Last Modified" },
  { field: "container" as const, label: "Container" },
  { field: "tags" as const, label: "Tag Count" },
]

export function BookmarkSearchBar({
  className = "",
}: BookmarkSearchBarProps): JSX.Element {
  const { query, sortOptions } = useBookmarkSearchState()
  const { setSearchQuery, setSortOptions, clearFilters } = useBookmarkActions()

  const [localQuery, setLocalQuery] = React.useState(query)
  const [showSortMenu, setShowSortMenu] = React.useState(false)

  // Debounced search
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setSearchQuery(localQuery)
    }, 300)

    return () => clearTimeout(timer)
  }, [localQuery, setSearchQuery])

  // Sync with external query changes
  React.useEffect(() => {
    setLocalQuery(query)
  }, [query])

  const handleClearSearch = () => {
    setLocalQuery("")
    setSearchQuery("")
  }

  const handleSortChange = (field: BookmarkSortOptions["field"]) => {
    const newOrder =
      sortOptions.field === field && sortOptions.order === "asc"
        ? "desc"
        : "asc"
    setSortOptions({ field, order: newOrder })
    setShowSortMenu(false)
  }

  const handleClearAll = () => {
    clearFilters()
    setLocalQuery("")
    setShowSortMenu(false)
  }

  const currentSortLabel =
    SORT_OPTIONS.find((opt) => opt.field === sortOptions.field)?.label ||
    "Title"
  const hasFilters = query || Object.keys(sortOptions).length > 0

  return (
    <div className={`bookmark-search-bar ${className}`}>
      <div className="flex items-center gap-3">
        {/* Search Input */}
        <div className="flex-1 relative">
          <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
            <Search className="w-4 h-4 text-gray-400 dark:text-gray-500" />
          </div>
          <input
            type="text"
            placeholder="Search bookmarks by title, URL, or description..."
            value={localQuery}
            onChange={(e) => setLocalQuery(e.target.value)}
            className="w-full pl-10 pr-10 py-2 h-9 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          {localQuery && (
            <button
              onClick={handleClearSearch}
              className="absolute inset-y-0 right-0 flex items-center pr-3"
              title="Clear search"
            >
              <X className="w-4 h-4 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300" />
            </button>
          )}
        </div>

        {/* Sort Dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowSortMenu(!showSortMenu)}
            className="flex items-center gap-2 px-3 py-2 h-9 text-sm font-medium border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
            title="Sort options"
          >
            <ArrowUpDown className="w-4 h-4" />
            <span>{currentSortLabel}</span>
            <span className="text-xs opacity-70">
              {sortOptions.order === "asc" ? "↑" : "↓"}
            </span>
          </button>

          {showSortMenu && (
            <>
              {/* Backdrop */}
              <div
                className="fixed inset-0 z-10"
                onClick={() => setShowSortMenu(false)}
              />

              {/* Dropdown Menu */}
              <div className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg z-20">
                <div className="py-1">
                  {SORT_OPTIONS.map((option) => (
                    <button
                      key={option.field}
                      onClick={() => handleSortChange(option.field)}
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors ${
                        sortOptions.field === option.field
                          ? "bg-blue-50 dark:bg-blue-900 text-blue-700 dark:text-blue-300"
                          : "text-gray-700 dark:text-gray-300"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span>{option.label}</span>
                        {sortOptions.field === option.field && (
                          <span className="text-xs">
                            {sortOptions.order === "asc" ? "↑" : "↓"}
                          </span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Clear All Button */}
        {hasFilters && (
          <button
            onClick={handleClearAll}
            className="px-3 py-2 h-9 text-sm font-medium text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 border border-red-300 dark:border-red-600 rounded-lg hover:bg-red-50 dark:hover:bg-red-950 transition-colors"
            title="Clear all filters and search"
          >
            Clear All
          </button>
        )}
      </div>

      {/* Search Stats */}
      {query && (
        <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
          <div className="flex items-center gap-2">
            <Search className="w-3 h-3" />
            <span>Searching for: "{query}"</span>
          </div>
        </div>
      )}

      <style>{`
        .bookmark-search-bar {
          position: relative;
        }

        /* Mobile responsive adjustments */
        @media (max-width: 640px) {
          .flex.items-center.gap-3 {
            flex-direction: column;
            align-items: stretch;
            gap: 0.5rem;
          }
          
          .relative:has(button[title="Sort options"]) {
            align-self: flex-start;
          }
        }
      `}</style>
    </div>
  )
}
