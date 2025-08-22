import React from "react"
import { useContainers } from "@/ui/shared/stores"
import useStatsStore from "@/ui/shared/stores/statsStore"
import { getContainerColor } from "@/shared/utils/containerColors"

export function ActiveContainersCard(): JSX.Element {
  const activeTabs = useStatsStore((state) => state.activeTabs)
  const containers = useContainers()

  const activeContainerData = Object.entries(activeTabs)
    .map(([cookieStoreId, tabCount]) => {
      const container = containers.find(
        (c) => c.cookieStoreId === cookieStoreId,
      )
      return {
        container,
        tabCount,
        cookieStoreId,
      }
    })
    .filter((item) => item.container && item.tabCount > 0)
    .sort((a, b) => b.tabCount - a.tabCount)

  if (activeContainerData.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 border border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
          Active Containers
        </h3>
        <div className="text-center text-gray-500 dark:text-gray-400 py-8">
          No active container tabs
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 border border-gray-200 dark:border-gray-700">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
        Active Containers
      </h3>

      <div className="space-y-3">
        {activeContainerData
          .slice(0, 6)
          .map(({ container, tabCount, cookieStoreId }) => (
            <div
              key={cookieStoreId}
              className="flex items-center justify-between"
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{
                    backgroundColor: getContainerColor(container?.color),
                  }}
                  title={`Container: ${container?.name || "Unknown"}`}
                />
                <span className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                  {container?.name || "Unknown Container"}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {tabCount} tab{tabCount !== 1 ? "s" : ""}
                </span>
                <div className="w-12 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <div
                    className="h-2 rounded-full transition-all duration-300"
                    style={{
                      width: `${Math.min(100, (tabCount / Math.max(...activeContainerData.map((d) => d.tabCount))) * 100)}%`,
                      backgroundColor: getContainerColor(container?.color),
                    }}
                  />
                </div>
              </div>
            </div>
          ))}

        {activeContainerData.length > 6 && (
          <div className="text-xs text-gray-500 dark:text-gray-400 text-center pt-2 border-t border-gray-200 dark:border-gray-600">
            +{activeContainerData.length - 6} more container
            {activeContainerData.length - 6 !== 1 ? "s" : ""}
          </div>
        )}
      </div>
    </div>
  )
}
