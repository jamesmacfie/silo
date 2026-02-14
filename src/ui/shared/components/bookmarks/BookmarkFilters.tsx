import { Tag, X } from "lucide-react"
import type { Container } from "@/shared/types"
import {
  useBookmarkActions,
  useBookmarkSearchState,
  useBookmarkTags,
  useTagCapabilities,
} from "../../stores/bookmarkStore"
import { Card } from "../Card"
import { ContainerSelector } from "../ContainerSelector"

interface BookmarkFiltersProps {
  className?: string
  containers: Container[]
  onClose: () => void
}

export function BookmarkFilters({
  className = "",
  containers,
  onClose,
}: BookmarkFiltersProps): JSX.Element {
  const { filters } = useBookmarkSearchState()
  const tags = useBookmarkTags()
  const tagCapabilities = useTagCapabilities()
  const { setFilters } = useBookmarkActions()

  const handleTagToggle = (tagId: string) => {
    const currentTags = filters.tags || []
    const newTags = currentTags.includes(tagId)
      ? currentTags.filter((id) => id !== tagId)
      : [...currentTags, tagId]

    setFilters({ tags: newTags })
  }

  const handleContainerToggle = (containerId: string) => {
    const currentContainers = filters.containers || []
    const newContainers = currentContainers.includes(containerId)
      ? currentContainers.filter((id) => id !== containerId)
      : [...currentContainers, containerId]

    setFilters({ containers: newContainers })
  }

  const clearAllFilters = () => {
    setFilters({ tags: [], containers: [], folders: [] })
  }

  const hasActiveFilters =
    (filters.tags && filters.tags.length > 0) ||
    (filters.containers && filters.containers.length > 0)

  // Get tag by ID helper
  const getTag = (id: string) => tags.find((tag) => tag.id === id)
  const getContainer = (id: string) =>
    containers.find((container) => container.cookieStoreId === id)

  return (
    <Card className={`bookmark-filters ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          Filters
        </h3>
        <div className="flex items-center gap-2">
          {hasActiveFilters && (
            <button
              onClick={clearAllFilters}
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
        {/* Tags Filter */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Tag className="w-4 h-4 text-gray-600 dark:text-gray-400" />
            <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100">
              Tags
            </h4>
            {filters.tags && filters.tags.length > 0 && (
              <span className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-2 py-0.5 rounded-full">
                {filters.tags.length} selected
              </span>
            )}
          </div>

          {tags.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400 italic">
              No tags available. Create tags to filter bookmarks.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {tags.map((tag) => {
                const isSelected = filters.tags?.includes(tag.id) || false
                return (
                  <button
                    key={tag.id}
                    onClick={() => handleTagToggle(tag.id)}
                    className={`inline-flex items-center gap-2 px-3 py-1.5 text-sm rounded-full border transition-colors ${
                      isSelected
                        ? "border-blue-500 bg-blue-50 dark:bg-blue-900 text-blue-700 dark:text-blue-300"
                        : "border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600"
                    }`}
                  >
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: tag.color }}
                    />
                    <span>{tag.name}</span>
                  </button>
                )
              })}
            </div>
          )}

          {tagCapabilities && !tagCapabilities.nativeSupported && (
            <p className="mt-3 text-xs text-amber-700 dark:text-amber-300">
              {tagCapabilities.reason}
            </p>
          )}
        </div>

        {/* Containers Filter */}
        <ContainerSelector
          containers={containers}
          selectedContainers={filters.containers || []}
          onToggle={handleContainerToggle}
          multiSelect={true}
        />

        {/* Active Filters Summary */}
        {hasActiveFilters && (
          <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
            <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
              Active Filters
            </h4>
            <div className="space-y-2">
              {/* Selected Tags */}
              {filters.tags && filters.tags.length > 0 && (
                <div>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">
                    Tags:
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {filters.tags.map((tagId) => {
                      const tag = getTag(tagId)
                      if (!tag) return null
                      return (
                        <span
                          key={tagId}
                          className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded"
                        >
                          <div
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: tag.color }}
                          />
                          {tag.name}
                        </span>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Selected Containers */}
              {filters.containers && filters.containers.length > 0 && (
                <div>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">
                    Containers:
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {filters.containers.map((containerId) => {
                      const container = getContainer(containerId)
                      if (!container) return null
                      return (
                        <span
                          key={containerId}
                          className="inline-block px-2 py-0.5 text-xs bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded"
                        >
                          {container.name}
                        </span>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <style>{`
        .bookmark-filters {
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
          .grid.grid-cols-1.sm\\:grid-cols-2.lg\\:grid-cols-3 {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </Card>
  )
}
