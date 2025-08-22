import { BarChart3 } from "lucide-react"
import { useCallback, useMemo, useState } from "react"
import { useContainers } from "../stores"
import useStatsStore from "../stores/statsStore"
import { Card } from "./Card"
import { containerColorToCss } from "./ColorSelector"
import { DataView, EmptyState, type SortOption } from "./layout"

interface ContainerStatsData {
  id: string
  container: any
  stats: any
  activeTabCount: number
  tabsOpened: number
  rulesMatched: number
  lastUsed: number
}

const SORT_OPTIONS: SortOption[] = [
  { value: "name", label: "Container Name" },
  { value: "active", label: "Active Tabs" },
  { value: "tabs", label: "Total Tabs" },
  { value: "rules", label: "Rules Matched" },
  { value: "lastUsed", label: "Last Used" },
]

interface ContainerStatsTableProps {
  className?: string
}

export function ContainerStatsTable({
  className = "",
}: ContainerStatsTableProps) {
  const stats = useStatsStore((state) => state.containerStats)
  const containers = useContainers()
  const activeTabs = useStatsStore((state) => state.activeTabs)
  const [sortBy, setSortBy] = useState<string>("tabs")

  const tableData = useMemo((): ContainerStatsData[] => {
    return containers.map((container) => {
      const containerStats = stats[container.cookieStoreId]
      const activeTabCount = activeTabs[container.cookieStoreId] || 0

      return {
        id: container.id,
        container,
        stats: containerStats,
        activeTabCount,
        tabsOpened: containerStats?.tabsOpened || 0,
        rulesMatched: containerStats?.rulesMatched || 0,
        lastUsed: containerStats?.lastUsed || 0,
      }
    })
  }, [containers, stats, activeTabs])

  const sortedData = useMemo(() => {
    return [...tableData].sort((a, b) => {
      switch (sortBy) {
        case "name":
          return a.container.name
            .toLowerCase()
            .localeCompare(b.container.name.toLowerCase())
        case "tabs":
          return b.tabsOpened - a.tabsOpened
        case "rules":
          return b.rulesMatched - a.rulesMatched
        case "active":
          return b.activeTabCount - a.activeTabCount
        case "lastUsed":
          return b.lastUsed - a.lastUsed
        default:
          return 0
      }
    })
  }, [tableData, sortBy])

  const formatLastUsed = useCallback((timestamp: number) => {
    if (!timestamp) return "Never"

    const now = Date.now()
    const diff = now - timestamp

    if (diff < 60000) return "Just now"
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
    if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`
    return new Date(timestamp).toLocaleDateString()
  }, [])

  const columns = useMemo(
    () => [
      {
        key: "container",
        header: "Container",
        render: (data: ContainerStatsData) => (
          <div className="flex items-center gap-3">
            <div
              className="w-3 h-3 rounded-full flex-shrink-0"
              style={{
                backgroundColor: containerColorToCss(data.container.color),
              }}
            />
            <span className="text-sm font-medium">{data.container.name}</span>
          </div>
        ),
      },
      {
        key: "active",
        header: "Active Tabs",
        render: (data: ContainerStatsData) => (
          <span
            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
              data.activeTabCount > 0
                ? "bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100"
                : "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300"
            }`}
          >
            {data.activeTabCount}
          </span>
        ),
        width: "w-28",
      },
      {
        key: "tabs",
        header: "Total Tabs",
        render: (data: ContainerStatsData) => (
          <span className="text-sm">{data.tabsOpened.toLocaleString()}</span>
        ),
        width: "w-24",
      },
      {
        key: "rules",
        header: "Rules Matched",
        render: (data: ContainerStatsData) => (
          <span className="text-sm">{data.rulesMatched.toLocaleString()}</span>
        ),
        width: "w-32",
      },
      {
        key: "lastUsed",
        header: "Last Used",
        render: (data: ContainerStatsData) => (
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {formatLastUsed(data.lastUsed)}
          </span>
        ),
        width: "w-32",
      },
    ],
    [formatLastUsed],
  )

  return (
    <Card className={className}>
      <div className="p-6 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-gray-500 dark:text-gray-400" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Container Statistics
            </h3>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600 dark:text-gray-400">
              Sort by:
            </label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="text-sm border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-800"
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <DataView
        items={sortedData}
        viewMode="table"
        columns={columns}
        emptyState={
          <EmptyState
            icon={<BarChart3 className="w-12 h-12" />}
            title="No container data available"
            description="Container statistics will appear here once containers are used"
          />
        }
        className="border-0"
      />
    </Card>
  )
}
