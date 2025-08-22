import { Palette } from "lucide-react"

interface ColorOption {
  value: string
  name?: string
  displayName?: string
}

interface ColorFilterSelectorProps {
  colors: ColorOption[]
  selectedColor: string
  onToggle: (color: string) => void
  title?: string
  getColorValue: (color: string) => string
  columns?: number
}

export function ColorFilterSelector({
  colors,
  selectedColor,
  onToggle,
  title = "Colors",
  getColorValue,
  columns = 6,
}: ColorFilterSelectorProps): JSX.Element {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <Palette className="w-4 h-4 text-gray-600 dark:text-gray-400" />
        <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100">
          {title}
        </h4>
        {selectedColor && (
          <span className="text-xs bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200 px-2 py-0.5 rounded-full">
            Selected
          </span>
        )}
      </div>

      <div
        className={`grid gap-2`}
        style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}
      >
        {colors.map((colorOption) => {
          const isSelected = selectedColor === colorOption.value
          return (
            <button
              key={colorOption.value}
              onClick={() => onToggle(colorOption.value)}
              className={`flex items-center gap-2 p-2 text-sm rounded-lg border transition-colors text-left ${
                isSelected
                  ? "border-purple-500 bg-purple-50 dark:bg-purple-900 text-purple-700 dark:text-purple-300"
                  : "border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600"
              }`}
            >
              <div
                className="w-4 h-4 rounded-full border border-gray-300 dark:border-gray-500"
                style={{ backgroundColor: getColorValue(colorOption.value) }}
              />
              <div className="flex-1 min-w-0">
                <div className="truncate font-medium text-xs">
                  {colorOption.displayName ||
                    colorOption.name ||
                    colorOption.value}
                </div>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
