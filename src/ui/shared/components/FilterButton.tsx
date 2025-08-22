import type React from "react"

interface FilterOption {
  value: string
  label: string
  color?: string
}

interface FilterButtonProps {
  options: FilterOption[]
  selectedValues: string[]
  onToggle: (value: string) => void
  multiSelect?: boolean
  icon?: React.ReactNode
  title: string
  showSelectedCount?: boolean
}

export function FilterButton({
  options,
  selectedValues,
  onToggle,
  multiSelect = false,
  icon,
  title,
  showSelectedCount = true,
}: FilterButtonProps): JSX.Element {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        {icon}
        <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100">
          {title}
        </h4>
        {showSelectedCount && selectedValues.length > 0 && (
          <span className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-2 py-0.5 rounded-full">
            {multiSelect ? `${selectedValues.length} selected` : "Selected"}
          </span>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const isSelected = selectedValues.includes(option.value)
          return (
            <button
              key={option.value}
              onClick={() => onToggle(option.value)}
              className={`px-3 py-1.5 text-sm rounded-full border transition-colors ${
                isSelected
                  ? `border-blue-500 ${option.color || "bg-blue-50 dark:bg-blue-900 text-blue-700 dark:text-blue-300"}`
                  : "border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600"
              }`}
            >
              {option.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
