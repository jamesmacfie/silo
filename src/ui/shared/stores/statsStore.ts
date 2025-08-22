import { create } from "zustand"
import messagingService from "@/shared/utils/messaging"
import { MESSAGE_TYPES } from "@/shared/constants"
import type {
  ContainerStats,
  GlobalStats,
  DailyStats,
  ActivityEvent,
  TrendData,
} from "@/shared/types/storage"
import { logger } from "@/shared/utils/logger"

interface StatsState {
  // Data
  containerStats: Record<string, ContainerStats>
  globalStats: GlobalStats | null
  activeTabs: Record<string, number>
  recentActivity: ActivityEvent[]
  dailyStats: DailyStats[]
  trends: TrendData | null

  // UI State
  loading: boolean
  error: string | null
  refreshInterval: number | null

  // Actions
  load: () => Promise<void>
  loadGlobalStats: () => Promise<void>
  loadActiveTabs: () => Promise<void>
  loadRecentActivity: () => Promise<void>
  loadDailyStats: (days?: number) => Promise<void>
  loadTrends: (days?: number) => Promise<void>
  refresh: () => Promise<void>
  reset: () => Promise<void>
  startRealTimeUpdates: () => void
  stopRealTimeUpdates: () => void
  clearError: () => void
}

const useStatsStore = create<StatsState>((set, get) => ({
  // Initial state
  containerStats: {},
  globalStats: null,
  activeTabs: {},
  recentActivity: [],
  dailyStats: [],
  trends: null,
  loading: false,
  error: null,
  refreshInterval: null,

  // Actions
  load: async () => {
    const { loading } = get()
    if (loading) return

    set({ loading: true, error: null })

    try {
      const response = await messagingService.sendMessage(
        MESSAGE_TYPES.GET_STATS,
      )

      if (response.success) {
        set({
          containerStats:
            (response.data as Record<string, ContainerStats>) || {},
          loading: false,
        })
      } else {
        throw new Error(response.error || "Failed to load stats")
      }
    } catch (error) {
      logger.error("Failed to load container stats", error)
      set({
        error: error instanceof Error ? error.message : "Failed to load stats",
        loading: false,
      })
    }
  },

  loadGlobalStats: async () => {
    try {
      const response = await messagingService.sendMessage(
        MESSAGE_TYPES.GET_GLOBAL_STATS,
      )

      if (response.success) {
        set({ globalStats: response.data as GlobalStats })
      } else {
        throw new Error(response.error || "Failed to load global stats")
      }
    } catch (error) {
      logger.error("Failed to load global stats", error)
      set({
        error:
          error instanceof Error
            ? error.message
            : "Failed to load global stats",
      })
    }
  },

  loadActiveTabs: async () => {
    try {
      const response = await messagingService.sendMessage(
        MESSAGE_TYPES.GET_ACTIVE_TABS,
      )

      if (response.success) {
        set({ activeTabs: (response.data as Record<string, number>) || {} })
      } else {
        throw new Error(response.error || "Failed to load active tabs")
      }
    } catch (error) {
      logger.error("Failed to load active tabs", error)
      set({
        error:
          error instanceof Error ? error.message : "Failed to load active tabs",
      })
    }
  },

  loadRecentActivity: async () => {
    try {
      const response = await messagingService.sendMessage(
        MESSAGE_TYPES.GET_RECENT_ACTIVITY,
      )

      if (response.success) {
        set({ recentActivity: (response.data as ActivityEvent[]) || [] })
      } else {
        throw new Error(response.error || "Failed to load recent activity")
      }
    } catch (error) {
      logger.error("Failed to load recent activity", error)
      set({
        error:
          error instanceof Error
            ? error.message
            : "Failed to load recent activity",
      })
    }
  },

  loadDailyStats: async (days = 7) => {
    try {
      const response = await messagingService.sendMessage(
        MESSAGE_TYPES.GET_DAILY_STATS,
        { days },
      )

      if (response.success) {
        set({ dailyStats: (response.data as DailyStats[]) || [] })
      } else {
        throw new Error(response.error || "Failed to load daily stats")
      }
    } catch (error) {
      logger.error("Failed to load daily stats", error)
      set({
        error:
          error instanceof Error ? error.message : "Failed to load daily stats",
      })
    }
  },

  loadTrends: async (days = 30) => {
    try {
      const response = await messagingService.sendMessage(
        MESSAGE_TYPES.GET_CONTAINER_TRENDS,
        { days },
      )

      if (response.success) {
        set({ trends: response.data as TrendData })
      } else {
        throw new Error(response.error || "Failed to load trends")
      }
    } catch (error) {
      logger.error("Failed to load trends", error)
      set({
        error: error instanceof Error ? error.message : "Failed to load trends",
      })
    }
  },

  refresh: async () => {
    const state = get()
    await Promise.all([
      state.load(),
      state.loadGlobalStats(),
      state.loadActiveTabs(),
      state.loadRecentActivity(),
      state.loadDailyStats(),
      state.loadTrends(),
    ])
  },

  reset: async () => {
    try {
      const response = await messagingService.sendMessage(
        MESSAGE_TYPES.RESET_STATS,
      )

      if (response.success) {
        set({
          containerStats: {},
          globalStats: null,
          activeTabs: {},
          recentActivity: [],
          dailyStats: [],
          trends: null,
        })
      } else {
        throw new Error(response.error || "Failed to reset stats")
      }
    } catch (error) {
      logger.error("Failed to reset stats", error)
      set({
        error: error instanceof Error ? error.message : "Failed to reset stats",
      })
    }
  },

  startRealTimeUpdates: () => {
    const { refreshInterval, stopRealTimeUpdates } = get()

    if (refreshInterval) {
      stopRealTimeUpdates()
    }

    const interval = setInterval(() => {
      const state = get()
      // Only update real-time data (active tabs and recent activity)
      Promise.all([state.loadActiveTabs(), state.loadRecentActivity()]).catch(
        (error) => {
          logger.error("Failed to update real-time stats", error)
        },
      )
    }, 5000) as unknown as number // Update every 5 seconds

    set({ refreshInterval: interval })
  },

  stopRealTimeUpdates: () => {
    const { refreshInterval } = get()

    if (refreshInterval) {
      clearInterval(refreshInterval)
      set({ refreshInterval: null })
    }
  },

  clearError: () => {
    set({ error: null })
  },
}))

// Selector hooks for components
export const useStats = () => useStatsStore((state) => state.containerStats)
export const useGlobalStats = () => useStatsStore((state) => state.globalStats)
export const useActiveTabs = () => useStatsStore((state) => state.activeTabs)
export const useRecentActivity = () =>
  useStatsStore((state) => state.recentActivity)
export const useDailyStats = () => useStatsStore((state) => state.dailyStats)
export const useTrends = () => useStatsStore((state) => state.trends)
export const useStatsLoading = () => useStatsStore((state) => state.loading)
export const useStatsError = () => useStatsStore((state) => state.error)

export const useStatsActions = () =>
  useStatsStore((state) => ({
    load: state.load,
    loadGlobalStats: state.loadGlobalStats,
    loadActiveTabs: state.loadActiveTabs,
    loadRecentActivity: state.loadRecentActivity,
    loadDailyStats: state.loadDailyStats,
    loadTrends: state.loadTrends,
    refresh: state.refresh,
    reset: state.reset,
    startRealTimeUpdates: state.startRealTimeUpdates,
    stopRealTimeUpdates: state.stopRealTimeUpdates,
    clearError: state.clearError,
  }))

export default useStatsStore
