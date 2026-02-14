import { Bookmark, X } from "lucide-react"
import { Card } from "./Card"
import { ColorFilterSelector } from "./ColorFilterSelector"
import { TAG_COLORS } from "./ColorSelector"
import { FilterButton } from "./FilterButton"

interface TagFiltersProps {
  className?: string
  onClose: () => void
  filters: {
    hasBookmarks: string
    color: string
  }
  onChange: (key: string, value: any) => void
  onClear: () => void
}

const HAS_BOOKMARKS_OPTIONS = [
  {
    value: "yes",
    label: "With Bookmarks",
    color: "bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300",
  },
  {
    value: "no",
    label: "Without Bookmarks",
    color:
      "bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-300",
  },
]

export function TagFilters({
  className = "",
  onClose,
  filters,
  onChange,
  onClear,
}: TagFiltersProps): JSX.Element {
  const handleHasBookmarksToggle = (value: string) => {
    onChange("hasBookmarks", filters.hasBookmarks === value ? "" : value)
  }

  const handleColorToggle = (color: string) => {
    onChange("color", filters.color === color ? "" : color)
  }

  const hasActiveFilters = filters.hasBookmarks || filters.color

  return (
    <Card className={`tag-filters ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          Filters
        </h3>
        <div className="flex items-center gap-2">
          {hasActiveFilters && (
            <button
              onClick={onClear}
              className="text-sm text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300"
            >
              Clear All
            </button>
          )}
          <button
            onClick={onClose}
            className="text-gray-500 dark:text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            title="Close filters"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="space-y-6">
        {/* Has Bookmarks Filter */}
        <FilterButton
          options={HAS_BOOKMARKS_OPTIONS}
          selectedValues={filters.hasBookmarks ? [filters.hasBookmarks] : []}
          onToggle={handleHasBookmarksToggle}
          multiSelect={false}
          icon={
            <Bookmark className="w-4 h-4 text-gray-600 dark:text-gray-400" />
          }
          title="Bookmark Usage"
        />

        {/* Color Filter */}
        <ColorFilterSelector
          colors={TAG_COLORS}
          selectedColor={filters.color}
          onToggle={handleColorToggle}
          getColorValue={(color) => color}
          columns={5}
        />

        {/* Active Filters Summary */}
        {hasActiveFilters && (
          <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
            <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
              Active Filters
            </h4>
            <div className="space-y-2">
              {filters.hasBookmarks && (
                <div>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">
                    Bookmark Usage:
                  </p>
                  <span className="inline-block px-2 py-0.5 text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded">
                    {
                      HAS_BOOKMARKS_OPTIONS.find(
                        (o) => o.value === filters.hasBookmarks,
                      )?.label
                    }
                  </span>
                </div>
              )}

              {filters.color && (
                <div>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">
                    Color:
                  </p>
                  <div className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200 rounded">
                    <div
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: filters.color }}
                    />
                    {TAG_COLORS.find((c) => c.value === filters.color)
                      ?.displayName || filters.color}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <style>{`
        .tag-filters {
          animation: slideDown 0.2s ease-out;
        }

        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        /* Mobile responsive adjustments */
        @media (max-width: 640px) {
          .grid.grid-cols-3.sm\\:grid-cols-5.lg\\:grid-cols-7 {
            grid-template-columns: repeat(3, 1fr);
          }
        }
      `}</style>
    </Card>
  )
}
