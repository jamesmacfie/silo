import { X } from "lucide-react"
import type React from "react"

export interface FilterConfig {
  key: string
  label: string
  type: "select" | "multiselect" | "toggle" | "custom"
  options?: Array<{ value: string; label: string }>
  render?: () => React.ReactNode
}

interface FilterPanelProps {
  isOpen: boolean
  filters: FilterConfig[]
  values: Record<string, any>
  onChange: (key: string, value: any) => void
  onClear: () => void
  className?: string
}

export function FilterPanel({
  isOpen,
  filters,
  values,
  onChange,
  onClear,
  className = "",
}: FilterPanelProps) {
  if (!isOpen) return null

  const hasActiveFilters = Object.values(values).some(
    (v) =>
      v !== undefined &&
      v !== null &&
      v !== "" &&
      (!Array.isArray(v) || v.length > 0),
  )

  return (
    <div
      className={`bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 mb-4 ${className}`}
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-medium text-gray-900 dark:text-gray-100">
          Filters
        </h3>
        {hasActiveFilters && (
          <button
            onClick={onClear}
            className="text-sm text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
          >
            <X className="w-3 h-3" />
            Clear all
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filters.map((filter) => (
          <div key={filter.key}>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {filter.label}
            </label>

            {filter.type === "select" && filter.options && (
              <select
                value={values[filter.key] || ""}
                onChange={(e) => onChange(filter.key, e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800"
              >
                <option value="">All</option>
                {filter.options.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            )}

            {filter.type === "multiselect" && filter.options && (
              <div className="space-y-1 max-h-32 overflow-y-auto border border-gray-300 dark:border-gray-600 rounded-lg p-2 bg-white dark:bg-gray-800">
                {filter.options.map((option) => {
                  const isSelected = (values[filter.key] || []).includes(
                    option.value,
                  )
                  return (
                    <label
                      key={option.value}
                      className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 p-1 rounded"
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => {
                          const current = values[filter.key] || []
                          const updated = e.target.checked
                            ? [...current, option.value]
                            : current.filter((v: string) => v !== option.value)
                          onChange(filter.key, updated)
                        }}
                        className="rounded border-gray-300 dark:border-gray-600"
                      />
                      <span className="text-sm">{option.label}</span>
                    </label>
                  )
                })}
              </div>
            )}

            {filter.type === "toggle" && (
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={values[filter.key] || false}
                  onChange={(e) => onChange(filter.key, e.target.checked)}
                  className="rounded border-gray-300 dark:border-gray-600"
                />
                <span className="text-sm">Enabled</span>
              </label>
            )}

            {filter.type === "custom" && filter.render && filter.render()}
          </div>
        ))}
      </div>
    </div>
  )
}
