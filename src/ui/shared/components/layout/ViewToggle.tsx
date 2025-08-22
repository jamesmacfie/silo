import { FolderTree, LayoutGrid, List } from "lucide-react"
import type { ViewMode } from "./DataView"

export type { ViewMode }

interface ViewToggleProps {
  currentView: ViewMode
  onChange: (view: ViewMode) => void
  availableViews: ViewMode[]
  className?: string
}

export function ViewToggle({
  currentView,
  onChange,
  availableViews,
  className = "",
}: ViewToggleProps) {
  const getIcon = (view: ViewMode) => {
    switch (view) {
      case "table":
        return <List className="w-4 h-4" />
      case "cards":
        return <LayoutGrid className="w-4 h-4" />
      case "tree":
        return <FolderTree className="w-4 h-4" />
    }
  }

  const getLabel = (view: ViewMode) => {
    switch (view) {
      case "table":
        return "Table"
      case "cards":
        return "Cards"
      case "tree":
        return "Tree"
    }
  }

  if (availableViews.length <= 1) return null

  return (
    <div
      className={`inline-flex rounded-lg border border-gray-300 dark:border-gray-600 h-9 ${className}`}
    >
      {availableViews.map((view, index) => (
        <button
          key={view}
          onClick={() => onChange(view)}
          className={`px-3 h-9 flex items-center gap-2 text-sm transition-colors ${
            currentView === view
              ? "bg-blue-500 text-white"
              : "bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600"
          } ${
            index === 0
              ? "rounded-l-[7px]"
              : "border-l border-gray-300 dark:border-gray-600"
          } ${index === availableViews.length - 1 ? "rounded-r-[7px]" : ""}`}
          title={getLabel(view)}
        >
          {getIcon(view)}
          <span>{getLabel(view)}</span>
        </button>
      ))}
    </div>
  )
}
