import { MESSAGE_TYPES } from "@/shared/constants"
import { logger } from "@/shared/utils/logger"
import type { Message, MessageResponse } from "@/shared/utils/messaging"
import type { MessageHandler } from "../MessageRouter"
import statsService from "../services/StatsService"
import storageService from "../services/StorageService"

/**
 * Handles statistics and analytics operations
 */
export class StatsHandler implements MessageHandler {
  private log = logger.withContext("StatsHandler")

  private readonly handledTypes = [
    MESSAGE_TYPES.GET_STATS,
    MESSAGE_TYPES.RESET_STATS,
    MESSAGE_TYPES.GET_GLOBAL_STATS,
    MESSAGE_TYPES.GET_DAILY_STATS,
    MESSAGE_TYPES.GET_ACTIVE_TABS,
    MESSAGE_TYPES.GET_RECENT_ACTIVITY,
    MESSAGE_TYPES.GET_CONTAINER_TRENDS,
    MESSAGE_TYPES.RECORD_STAT_EVENT,
  ]

  canHandle(type: string): boolean {
    return this.handledTypes.includes(
      type as (typeof this.handledTypes)[number],
    )
  }

  async handle(message: Message): Promise<MessageResponse> {
    switch (message.type) {
      case MESSAGE_TYPES.GET_STATS:
        return this.getStats()

      case MESSAGE_TYPES.RESET_STATS:
        return this.resetStats()

      case MESSAGE_TYPES.GET_GLOBAL_STATS:
        return this.getGlobalStats()

      case MESSAGE_TYPES.GET_DAILY_STATS:
        return this.getDailyStats(message)

      case MESSAGE_TYPES.GET_ACTIVE_TABS:
        return this.getActiveTabs()

      case MESSAGE_TYPES.GET_RECENT_ACTIVITY:
        return this.getRecentActivity()

      case MESSAGE_TYPES.GET_CONTAINER_TRENDS:
        return this.getContainerTrends(message)

      case MESSAGE_TYPES.RECORD_STAT_EVENT:
        return this.recordStatEvent(message)

      default:
        return {
          success: false,
          error: `StatsHandler cannot handle message type: ${message.type}`,
        }
    }
  }

  /**
   * Get basic statistics
   */
  private async getStats(): Promise<MessageResponse> {
    try {
      const stats = await storageService.getStats()
      this.log.debug("Retrieved basic stats")
      return { success: true, data: stats }
    } catch (error) {
      this.log.error("Failed to get stats", error)
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to get stats",
      }
    }
  }

  /**
   * Reset all statistics
   */
  private async resetStats(): Promise<MessageResponse> {
    try {
      await statsService.resetStats()
      this.log.info("Statistics reset")
      return { success: true }
    } catch (error) {
      this.log.error("Failed to reset stats", error)
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to reset stats",
      }
    }
  }

  /**
   * Get global statistics
   */
  private async getGlobalStats(): Promise<MessageResponse> {
    try {
      const globalStats = await statsService.getGlobalStats()
      this.log.debug("Retrieved global stats")
      return { success: true, data: globalStats }
    } catch (error) {
      this.log.error("Failed to get global stats", error)
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to get global stats",
      }
    }
  }

  /**
   * Get daily statistics for a specified period
   */
  private async getDailyStats(message: Message): Promise<MessageResponse> {
    try {
      const { days } = (message.payload || {}) as { days?: number }
      const dailyStats = await statsService.getDailyStats(days)

      this.log.debug("Retrieved daily stats", {
        requestedDays: days,
        returnedDays: dailyStats?.length || 0,
      })

      return { success: true, data: dailyStats }
    } catch (error) {
      this.log.error("Failed to get daily stats", error)
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to get daily stats",
      }
    }
  }

  /**
   * Get currently active tabs by container
   */
  private async getActiveTabs(): Promise<MessageResponse> {
    try {
      const activeTabs = await statsService.getCurrentActiveTabs()
      this.log.debug("Retrieved active tabs", {
        tabCount: Object.values(activeTabs).reduce(
          (sum, tabs: any) => sum + (Array.isArray(tabs) ? tabs.length : 0),
          0,
        ),
      })
      return { success: true, data: activeTabs }
    } catch (error) {
      this.log.error("Failed to get active tabs", error)
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to get active tabs",
      }
    }
  }

  /**
   * Get recent activity
   */
  private async getRecentActivity(): Promise<MessageResponse> {
    try {
      const activity = await statsService.getRecentActivity()
      this.log.debug("Retrieved recent activity", {
        activityCount: activity?.length || 0,
      })
      return { success: true, data: activity }
    } catch (error) {
      this.log.error("Failed to get recent activity", error)
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to get recent activity",
      }
    }
  }

  /**
   * Get container usage trends
   */
  private async getContainerTrends(message: Message): Promise<MessageResponse> {
    try {
      const { days } = (message.payload || {}) as { days?: number }
      const trends = await statsService.getContainerTrends(days)

      this.log.debug("Retrieved container trends", {
        requestedDays: days,
        containerCount: Object.keys(trends || {}).length,
      })

      return { success: true, data: trends }
    } catch (error) {
      this.log.error("Failed to get container trends", error)
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to get container trends",
      }
    }
  }

  /**
   * Record a statistics event
   */
  private async recordStatEvent(message: Message): Promise<MessageResponse> {
    try {
      const { containerId, event, metadata } = (message.payload || {}) as {
        containerId: string
        event: string
        metadata?: Record<string, unknown>
      }

      if (!containerId || !event) {
        return {
          success: false,
          error: "Container ID and event type are required",
        }
      }

      await statsService.recordEvent(containerId, event as any, metadata)

      this.log.debug("Stat event recorded", {
        containerId,
        event,
        hasMetadata: !!metadata,
      })

      return { success: true }
    } catch (error) {
      this.log.error("Failed to record stat event", error)
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to record stat event",
      }
    }
  }

  /**
   * Get the list of message types this handler can process
   */
  getHandledTypes(): string[] {
    return [...this.handledTypes]
  }
}
