import { useContainers } from "@/ui/shared/stores"
import useStatsStore from "@/ui/shared/stores/statsStore"
import { Card } from "./Card"

export function StatsOverviewCard(): JSX.Element {
  const globalStats = useStatsStore((state) => state.globalStats)
  const activeTabs = useStatsStore((state) => state.activeTabs)
  const containers = useContainers()

  const totalActiveTabs = Object.values(activeTabs).reduce(
    (sum, count) => sum + count,
    0,
  )
  const activeContainers = Object.keys(activeTabs).length

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
        Overview
      </h3>

      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-600 dark:text-gray-400">
            Active Tabs
          </span>
          <span className="text-xl font-bold text-blue-600 dark:text-blue-400">
            {totalActiveTabs}
          </span>
        </div>

        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-600 dark:text-gray-400">
            Active Containers
          </span>
          <span className="text-xl font-bold text-green-600 dark:text-green-400">
            {activeContainers}
          </span>
        </div>

        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-600 dark:text-gray-400">
            Total Containers
          </span>
          <span className="text-xl font-bold text-purple-600 dark:text-purple-400">
            {containers.length}
          </span>
        </div>

        {globalStats && (
          <>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600 dark:text-gray-400">
                Total Rules
              </span>
              <span className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {globalStats.totalRules}
              </span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600 dark:text-gray-400">
                Tabs Opened (All Time)
              </span>
              <span className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {globalStats.totalTabsEverOpened.toLocaleString()}
              </span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600 dark:text-gray-400">
                Rules Matched (All Time)
              </span>
              <span className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {globalStats.totalRulesMatched.toLocaleString()}
              </span>
            </div>
          </>
        )}
      </div>
    </Card>
  )
}
