import { Shield, Tag, X } from "lucide-react"
import type { Container } from "@/shared/types"
import { Card } from "./Card"
import { ContainerSelector } from "./ContainerSelector"
import { FilterButton } from "./FilterButton"

interface RuleFiltersProps {
  className?: string
  containers: Container[]
  onClose: () => void
  filters: {
    container: string
    ruleType: string
    enabled: string | null
    tags: string[]
  }
  onChange: (key: string, value: any) => void
  onClear: () => void
  availableTags: string[]
}

const RULE_TYPES = [
  {
    value: "INCLUDE",
    label: "Include",
    color: "bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300",
  },
  {
    value: "EXCLUDE",
    label: "Exclude",
    color:
      "bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-300",
  },
  {
    value: "RESTRICT",
    label: "Restrict",
    color: "bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300",
  },
]

const ENABLED_OPTIONS = [
  {
    value: "true",
    label: "Enabled",
    color: "bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300",
  },
  {
    value: "false",
    label: "Disabled",
    color: "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400",
  },
]

export function RuleFilters({
  className = "",
  containers,
  onClose,
  filters,
  onChange,
  onClear,
  availableTags,
}: RuleFiltersProps): JSX.Element {
  const handleContainerToggle = (containerId: string) => {
    onChange("container", filters.container === containerId ? "" : containerId)
  }

  const handleRuleTypeToggle = (ruleType: string) => {
    onChange("ruleType", filters.ruleType === ruleType ? "" : ruleType)
  }

  const handleEnabledToggle = (enabled: string) => {
    onChange("enabled", filters.enabled === enabled ? null : enabled)
  }

  const handleTagToggle = (tag: string) => {
    const currentTags = filters.tags || []
    const newTags = currentTags.includes(tag)
      ? currentTags.filter((t) => t !== tag)
      : [...currentTags, tag]
    onChange("tags", newTags)
  }

  const hasActiveFilters =
    filters.container ||
    filters.ruleType ||
    filters.enabled !== null ||
    (filters.tags && filters.tags.length > 0)

  return (
    <Card className={`rule-filters ${className}`}>
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
        {/* Rule Type Filter */}
        <FilterButton
          options={RULE_TYPES}
          selectedValues={filters.ruleType ? [filters.ruleType] : []}
          onToggle={handleRuleTypeToggle}
          multiSelect={false}
          icon={<Shield className="w-4 h-4 text-gray-600 dark:text-gray-400" />}
          title="Rule Type"
        />

        {/* Status Filter */}
        <FilterButton
          options={ENABLED_OPTIONS}
          selectedValues={filters.enabled !== null ? [filters.enabled] : []}
          onToggle={handleEnabledToggle}
          multiSelect={false}
          icon={<Tag className="w-4 h-4 text-gray-600 dark:text-gray-400" />}
          title="Status"
        />

        {/* Containers Filter */}
        <ContainerSelector
          containers={containers}
          selectedContainers={filters.container ? [filters.container] : []}
          onToggle={handleContainerToggle}
          multiSelect={false}
        />

        {/* Tags Filter */}
        {availableTags.length > 0 && (
          <FilterButton
            options={availableTags.map((tag) => ({ value: tag, label: tag }))}
            selectedValues={filters.tags || []}
            onToggle={handleTagToggle}
            multiSelect={true}
            icon={<Tag className="w-4 h-4 text-gray-600 dark:text-gray-400" />}
            title="Tags"
          />
        )}

        {/* Active Filters Summary */}
        {hasActiveFilters && (
          <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
            <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
              Active Filters
            </h4>
            <div className="space-y-2">
              {filters.ruleType && (
                <div>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">
                    Rule Type:
                  </p>
                  <span className="inline-block px-2 py-0.5 text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded">
                    {
                      RULE_TYPES.find((t) => t.value === filters.ruleType)
                        ?.label
                    }
                  </span>
                </div>
              )}

              {filters.enabled !== null && (
                <div>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">
                    Status:
                  </p>
                  <span className="inline-block px-2 py-0.5 text-xs bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded">
                    {
                      ENABLED_OPTIONS.find((o) => o.value === filters.enabled)
                        ?.label
                    }
                  </span>
                </div>
              )}

              {filters.container && (
                <div>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">
                    Container:
                  </p>
                  <span className="inline-block px-2 py-0.5 text-xs bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded">
                    {
                      containers.find(
                        (c) => c.cookieStoreId === filters.container,
                      )?.name
                    }
                  </span>
                </div>
              )}

              {filters.tags && filters.tags.length > 0 && (
                <div>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">
                    Tags:
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {filters.tags.map((tag) => (
                      <span
                        key={tag}
                        className="inline-block px-2 py-0.5 text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <style>{`
        .rule-filters {
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
