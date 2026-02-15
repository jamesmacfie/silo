import { X } from "lucide-react"
import type { Container } from "@/shared/types"
import {
  useBookmarkActions,
  useBookmarkSearchState,
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
  const { setFilters } = useBookmarkActions()

  const handleContainerToggle = (containerId: string) => {
    const currentContainers = filters.containers || []
    const newContainers = currentContainers.includes(containerId)
      ? currentContainers.filter((id) => id !== containerId)
      : [...currentContainers, containerId]

    setFilters({ containers: newContainers })
  }

  const clearAllFilters = () => {
    setFilters({ containers: [], folders: [] })
  }

  const hasActiveFilters =
    (filters.containers && filters.containers.length > 0) ||
    (filters.folders && filters.folders.length > 0)

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
        <ContainerSelector
          containers={containers}
          selectedContainers={filters.containers || []}
          onToggle={handleContainerToggle}
          multiSelect={true}
        />

        {hasActiveFilters && (
          <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
            <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
              Active Filters
            </h4>
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

        @media (max-width: 640px) {
          .grid.grid-cols-1.sm\\:grid-cols-2.lg\\:grid-cols-3 {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </Card>
  )
}
