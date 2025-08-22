import { ArrowUpDown, Filter, Search, X } from "lucide-react"
import React, { useCallback, useState } from "react"
import { type ViewMode, ViewToggle } from "./ViewToggle"

export interface ToolBarSortOption {
  value: string
  label: string
}

interface ToolBarProps {
  // Search
  searchValue: string
  onSearchChange: (value: string) => void
  searchPlaceholder?: string

  // Sort
  sortOptions?: ToolBarSortOption[]
  currentSort?: string
  sortOrder?: "asc" | "desc"
  onSortChange?: (value: string) => void
  onSortOrderToggle?: () => void

  // View Toggle
  viewMode?: ViewMode
  availableViews?: ViewMode[]
  onViewChange?: (view: ViewMode) => void

  // Filters
  showFilters?: boolean
  onToggleFilters?: () => void
  filtersActive?: boolean

  // Clear all
  hasActiveFilters?: boolean
  onClearAll?: () => void

  className?: string
}

export function ToolBar({
  searchValue,
  onSearchChange,
  searchPlaceholder = "Search...",
  sortOptions,
  currentSort,
  sortOrder = "desc",
  onSortChange,
  onSortOrderToggle,
  viewMode,
  availableViews,
  onViewChange,
  showFilters = false,
  onToggleFilters,
  filtersActive = false,
  hasActiveFilters = false,
  onClearAll,
  className = "",
}: ToolBarProps) {
  const [localQuery, setLocalQuery] = useState(searchValue)
  const [showSortMenu, setShowSortMenu] = useState(false)

  // Debounced search
  React.useEffect(() => {
    const timer = setTimeout(() => {
      onSearchChange(localQuery)
    }, 300)

    return () => clearTimeout(timer)
  }, [localQuery, onSearchChange])

  // Sync with external query changes
  React.useEffect(() => {
    setLocalQuery(searchValue)
  }, [searchValue])

  const handleClearSearch = useCallback(() => {
    setLocalQuery("")
    onSearchChange("")
  }, [onSearchChange])

  const handleSortChange = useCallback(
    (value: string) => {
      if (currentSort === value && onSortOrderToggle) {
        onSortOrderToggle()
      } else if (onSortChange) {
        onSortChange(value)
      }
      setShowSortMenu(false)
    },
    [currentSort, onSortChange, onSortOrderToggle],
  )

  const currentSortLabel =
    sortOptions?.find((opt) => opt.value === currentSort)?.label || "Sort"

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {/* Search Input */}
      <div className="flex-1 relative">
        <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
          <Search className="w-4 h-4 text-gray-400 dark:text-gray-500" />
        </div>
        <input
          type="text"
          placeholder={searchPlaceholder}
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
      {sortOptions && sortOptions.length > 0 && (
        <div className="relative">
          <button
            onClick={() => setShowSortMenu(!showSortMenu)}
            className="flex items-center gap-2 px-3 h-9 text-sm font-medium border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
            title="Sort options"
          >
            <ArrowUpDown className="w-4 h-4" />
            <span>{currentSortLabel}</span>
            <span className="text-xs opacity-70">
              {sortOrder === "asc" ? "↑" : "↓"}
            </span>
          </button>

          {showSortMenu && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setShowSortMenu(false)}
              />

              <div className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg z-20">
                <div className="py-1">
                  {sortOptions.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => handleSortChange(option.value)}
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors ${
                        currentSort === option.value
                          ? "bg-blue-50 dark:bg-blue-900 text-blue-700 dark:text-blue-300"
                          : "text-gray-700 dark:text-gray-300"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span>{option.label}</span>
                        {currentSort === option.value && (
                          <span className="text-xs">
                            {sortOrder === "asc" ? "↑" : "↓"}
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
      )}

      {/* Filters Toggle */}
      {onToggleFilters && (
        <button
          onClick={onToggleFilters}
          className={`flex items-center gap-2 px-3 h-9 text-sm font-medium rounded-lg transition-colors ${
            showFilters || filtersActive
              ? "bg-blue-500 text-white"
              : "bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600"
          }`}
          title="Filters"
        >
          <Filter className="w-4 h-4" />
          Filters
          {filtersActive && (
            <span className="px-1.5 py-0.5 text-xs bg-white/20 rounded-full">
              Active
            </span>
          )}
        </button>
      )}

      {/* View Toggle */}
      {viewMode && availableViews && onViewChange && (
        <ViewToggle
          currentView={viewMode}
          onChange={onViewChange}
          availableViews={availableViews}
        />
      )}

      {/* Clear All Button */}
      {hasActiveFilters && onClearAll && (
        <button
          onClick={onClearAll}
          className="px-3 h-9 text-sm font-medium text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 border border-red-300 dark:border-red-600 rounded-lg hover:bg-red-50 dark:hover:bg-red-950 transition-colors"
          title="Clear all filters and search"
        >
          Clear All
        </button>
      )}
    </div>
  )
}
