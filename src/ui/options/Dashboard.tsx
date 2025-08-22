import React, { useEffect } from "react"
import { PageLayout, PageHeader, Button } from "../shared/components/layout"
import { StatsOverviewCard } from "../shared/components/StatsOverviewCard"
import { ActiveContainersCard } from "../shared/components/ActiveContainersCard"
import { RecentActivityCard } from "../shared/components/RecentActivityCard"
import { ContainerStatsTable } from "../shared/components/ContainerStatsTable"
import {
  useStatsActions,
  useStatsLoading,
  useStatsError,
} from "../shared/stores/statsStore"

const PAGE_DESCRIPTION =
  "Overview of your container usage, rules activity, and system statistics. Monitor how effectively Silo is managing your browsing sessions."

export function Dashboard() {
  const { refresh, startRealTimeUpdates, stopRealTimeUpdates, clearError } =
    useStatsActions()
  const loading = useStatsLoading()
  const error = useStatsError()

  // Load stats data when dashboard is opened
  useEffect(() => {
    refresh()
    startRealTimeUpdates()

    return () => {
      stopRealTimeUpdates()
    }
  }, [refresh, startRealTimeUpdates, stopRealTimeUpdates])

  if (loading) {
    return (
      <PageLayout>
        <PageHeader title="Dashboard" description={PAGE_DESCRIPTION} />
        <div className="flex items-center justify-center py-12">
          <div className="text-gray-600 dark:text-gray-400">
            Loading dashboard data...
          </div>
        </div>
      </PageLayout>
    )
  }

  return (
    <PageLayout>
      <PageHeader title="Dashboard" description={PAGE_DESCRIPTION} />

      {error && (
        <div className="mb-4 p-4 bg-red-100 dark:bg-red-900 border border-red-300 dark:border-red-700 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium text-red-800 dark:text-red-200">
                Error loading dashboard data
              </h3>
              <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                {error}
              </p>
            </div>
            <button
              className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-200 text-2xl"
              onClick={clearError}
            >
              ×
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Top Row - Summary Cards */}
        <StatsOverviewCard />
        <ActiveContainersCard />
        <RecentActivityCard />

        {/* Bottom Row - Detailed Table */}
        <ContainerStatsTable className="col-span-full" />
      </div>
    </PageLayout>
  )
}
