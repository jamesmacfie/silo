import { getContainerColor } from "@/shared/utils/containerColors"
import { useContainers } from "@/ui/shared/stores"
import useStatsStore from "@/ui/shared/stores/statsStore"

export function RecentActivityCard(): JSX.Element {
  const recentActivity = useStatsStore((state) => state.recentActivity)
  const containers = useContainers()

  const getEventIcon = (event: string) => {
    switch (event) {
      case "tab-created":
        return "📱"
      case "tab-closed":
        return "✖️"
      case "tab-activated":
        return "👁️"
      case "navigation":
        return "🧭"
      case "rule-match":
        return "⚡"
      default:
        return "📄"
    }
  }

  const getEventLabel = (event: string) => {
    switch (event) {
      case "tab-created":
        return "Tab opened"
      case "tab-closed":
        return "Tab closed"
      case "tab-activated":
        return "Tab activated"
      case "navigation":
        return "Navigation"
      case "rule-match":
        return "Rule matched"
      default:
        return "Activity"
    }
  }

  const formatTimestamp = (timestamp: number) => {
    const now = Date.now()
    const diff = now - timestamp

    if (diff < 60000) return "Just now"
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
    return new Date(timestamp).toLocaleDateString()
  }

  if (recentActivity.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 border border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
          Recent Activity
        </h3>
        <div className="text-center text-gray-500 dark:text-gray-400 py-8">
          No recent activity
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 border border-gray-200 dark:border-gray-700">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
        Recent Activity
      </h3>

      <div className="space-y-3">
        {recentActivity.slice(0, 8).map((activity) => {
          const container = containers.find(
            (c) => c.cookieStoreId === activity.containerId,
          )

          return (
            <div key={activity.id} className="flex items-center gap-3">
              <span className="text-lg flex-shrink-0">
                {getEventIcon(activity.event)}
              </span>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <div
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{
                      backgroundColor: getContainerColor(container?.color),
                    }}
                  />
                  <span className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                    {container?.name || "Unknown Container"}
                  </span>
                </div>
                <div className="text-xs text-gray-600 dark:text-gray-400">
                  {getEventLabel(activity.event)}
                  {activity.metadata?.domain && (
                    <span className="ml-1">• {activity.metadata.domain}</span>
                  )}
                </div>
              </div>

              <span className="text-xs text-gray-500 dark:text-gray-400 flex-shrink-0">
                {formatTimestamp(activity.timestamp)}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
