import React from "react"

export interface ColorOption {
  name: string
  value: string
  displayName?: string
}

interface ColorSelectorProps {
  selectedColor: string
  onColorChange: (color: string) => void
  colors: ColorOption[]
  className?: string
  size?: "small" | "medium" | "large"
  layout?: "grid" | "list"
  columns?: number
}

/**
 * Reusable color selector component with flexible color options and layouts.
 *
 * @example
 * ```tsx
 * const containerColors = [
 *   { name: 'blue', value: '#4A90E2', displayName: 'Blue' },
 *   { name: 'green', value: '#5CB85C', displayName: 'Green' },
 * ];
 *
 * <ColorSelector
 *   selectedColor={selectedColor}
 *   onColorChange={setSelectedColor}
 *   colors={containerColors}
 *   layout="list"
 *   columns={3}
 * />
 * ```
 */
export function ColorSelector({
  selectedColor,
  onColorChange,
  colors,
  className = "",
  size = "medium",
  layout = "list",
  columns = 3,
}: ColorSelectorProps): JSX.Element {
  const sizeClasses = {
    small: {
      colorDot: "w-3 h-3",
      button: "px-2 py-1 text-xs",
      circleButton: "w-8 h-8",
    },
    medium: {
      colorDot: "w-4 h-4",
      button: "px-3 py-2 text-sm",
      circleButton: "w-10 h-10",
    },
    large: {
      colorDot: "w-5 h-5",
      button: "px-4 py-3 text-base",
      circleButton: "w-12 h-12",
    },
  }

  const sizes = sizeClasses[size]

  if (layout === "grid") {
    // Grid layout - just colored circles (like TagModal)
    return (
      <div
        className={`grid gap-3 ${className}`}
        style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}
      >
        {colors.map((colorOption) => (
          <button
            key={colorOption.name}
            className={`${sizes.circleButton} rounded-full border-4 transition-all hover:scale-110 ${
              selectedColor === colorOption.name
                ? "border-gray-800 dark:border-gray-200 shadow-lg"
                : "border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500"
            }`}
            style={{ backgroundColor: colorOption.value }}
            onClick={() => onColorChange(colorOption.name)}
            title={colorOption.displayName || colorOption.name}
            type="button"
          />
        ))}
      </div>
    )
  }

  // List layout - color dot with label (like ContainerModal)
  return (
    <div
      className={`grid gap-2 ${className}`}
      style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}
    >
      {colors.map((colorOption) => (
        <button
          key={colorOption.name}
          className={`flex items-center gap-2 ${sizes.button} rounded-lg border transition-colors ${
            selectedColor === colorOption.name
              ? "border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
              : "border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700"
          }`}
          onClick={() => onColorChange(colorOption.name)}
          type="button"
        >
          <span
            className={`${sizes.colorDot} rounded-full border border-gray-300 dark:border-gray-600`}
            style={{ backgroundColor: colorOption.value }}
          />
          <span className="capitalize">
            {colorOption.displayName || colorOption.name}
          </span>
        </button>
      ))}
    </div>
  )
}

// Predefined color sets for common use cases
export const CONTAINER_COLORS: ColorOption[] = [
  { name: "blue", value: "#4A90E2", displayName: "Blue" },
  { name: "turquoise", value: "#30D5C8", displayName: "Turquoise" },
  { name: "green", value: "#5CB85C", displayName: "Green" },
  { name: "yellow", value: "#F0AD4E", displayName: "Yellow" },
  { name: "orange", value: "#FF8C42", displayName: "Orange" },
  { name: "red", value: "#D9534F", displayName: "Red" },
  { name: "pink", value: "#FF69B4", displayName: "Pink" },
  { name: "purple", value: "#7B68EE", displayName: "Purple" },
  { name: "toolbar", value: "#999999", displayName: "Gray" },
]

export const TAG_COLORS: ColorOption[] = [
  { name: "#4A90E2", value: "#4A90E2", displayName: "Blue" },
  { name: "#5CB85C", value: "#5CB85C", displayName: "Green" },
  { name: "#F0AD4E", value: "#F0AD4E", displayName: "Yellow" },
  { name: "#FF8C42", value: "#FF8C42", displayName: "Orange" },
  { name: "#D9534F", value: "#D9534F", displayName: "Red" },
  { name: "#FF69B4", value: "#FF69B4", displayName: "Pink" },
  { name: "#7B68EE", value: "#7B68EE", displayName: "Purple" },
  { name: "#30D5C8", value: "#30D5C8", displayName: "Turquoise" },
  { name: "#999999", value: "#999999", displayName: "Gray" },
  { name: "#333333", value: "#333333", displayName: "Dark Gray" },
]

/**
 * Helper function to convert container color names to CSS values
 */
export function containerColorToCss(color: string): string {
  const colorOption = CONTAINER_COLORS.find((c) => c.name === color)
  return colorOption?.value || "#ccc"
}

/**
 * Helper function to get display name for a color
 */
export function getColorDisplayName(
  color: string,
  colors: ColorOption[],
): string {
  const colorOption = colors.find((c) => c.name === color || c.value === color)
  return colorOption?.displayName || color
}
