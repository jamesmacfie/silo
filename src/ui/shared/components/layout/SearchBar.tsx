import { ChevronDown, Filter, X } from "lucide-react"
import type React from "react"
import { useCallback, useState } from "react"
import { SearchInput } from "../SearchInput"

export interface SortOption {
  value: string
  label: string
}

interface SearchBarProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  sortOptions?: SortOption[]
  currentSort?: string
  onSort?: (value: string) => void
  showFilters?: boolean
  onToggleFilters?: () => void
  filtersActive?: boolean
  additionalActions?: React.ReactNode
  className?: string
}

export function SearchBar({
  value,
  onChange,
  placeholder = "Search...",
  sortOptions,
  currentSort,
  onSort,
  showFilters = false,
  onToggleFilters,
  filtersActive = false,
  additionalActions,
  className = "",
}: SearchBarProps) {
  const [isSortOpen, setIsSortOpen] = useState(false)

  const handleClear = useCallback(() => {
    onChange("")
  }, [onChange])

  return (
    <div className={`toolbar ${className}`}>
      <div className="flex items-center gap-2 flex-1">
        <SearchInput
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          className="flex-1"
        />

        {value && (
          <button
            onClick={handleClear}
            className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            title="Clear search"
          >
            <X className="w-4 h-4" />
          </button>
        )}

        {showFilters && (
          <button
            onClick={onToggleFilters}
            className={`btn ghost flex items-center gap-2 ${
              filtersActive
                ? "bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400"
                : ""
            }`}
          >
            <Filter className="w-4 h-4" />
            Filters
            {filtersActive && (
              <span className="px-1.5 py-0.5 text-xs bg-blue-600 text-white rounded-full">
                Active
              </span>
            )}
          </button>
        )}

        {sortOptions && sortOptions.length > 0 && (
          <div className="relative">
            <button
              onClick={() => setIsSortOpen(!isSortOpen)}
              className="btn ghost flex items-center gap-2"
            >
              Sort
              <ChevronDown className="w-4 h-4" />
            </button>

            {isSortOpen && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setIsSortOpen(false)}
                />
                <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-20">
                  {sortOptions.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => {
                        onSort?.(option.value)
                        setIsSortOpen(false)
                      }}
                      className={`w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 ${
                        currentSort === option.value
                          ? "bg-gray-50 dark:bg-gray-700/50 font-medium"
                          : ""
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {additionalActions}
      </div>
    </div>
  )
}
