import { Container as ContainerIcon } from "lucide-react"
import type { Container } from "@/shared/types"
import { containerColorToCss } from "./ColorSelector"

interface ContainerSelectorProps {
  containers: Container[]
  selectedContainers: string[]
  onToggle: (containerId: string) => void
  multiSelect?: boolean
  emptyMessage?: string
  title?: string
  showSelectedCount?: boolean
}

export function ContainerSelector({
  containers,
  selectedContainers,
  onToggle,
  multiSelect = false,
  emptyMessage = "No containers available.",
  title = "Containers",
  showSelectedCount = true,
}: ContainerSelectorProps): JSX.Element {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <ContainerIcon className="w-4 h-4 text-gray-600 dark:text-gray-400" />
        <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100">
          {title}
        </h4>
        {showSelectedCount && selectedContainers.length > 0 && (
          <span className="text-xs bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 px-2 py-0.5 rounded-full">
            {multiSelect ? `${selectedContainers.length} selected` : "Selected"}
          </span>
        )}
      </div>

      {containers.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400 italic">
          {emptyMessage}
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {containers.map((container) => {
            const isSelected = selectedContainers.includes(
              container.cookieStoreId,
            )
            return (
              <button
                key={container.cookieStoreId}
                onClick={() => onToggle(container.cookieStoreId)}
                className={`flex items-center gap-2 p-2 text-sm rounded-lg border transition-colors text-left ${
                  isSelected
                    ? "border-green-500 bg-green-50 dark:bg-green-900 text-green-700 dark:text-green-300"
                    : "border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600"
                }`}
              >
                <div
                  className="w-4 h-4 rounded-full"
                  style={{
                    backgroundColor: containerColorToCss(container.color),
                  }}
                />
                <div className="flex-1 min-w-0">
                  <div className="truncate font-medium">{container.name}</div>
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
