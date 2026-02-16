import { MESSAGE_TYPES } from "@/shared/constants"
import type { BackupData } from "@/shared/types"
import { logger } from "@/shared/utils/logger"
import type { Message, MessageResponse } from "@/shared/utils/messaging"
import type { MessageHandler } from "../MessageRouter"
import storageService from "../services/StorageService"

/**
 * Handles data backup and restore operations
 */
export class BackupHandler implements MessageHandler {
  private log = logger.withContext("BackupHandler")

  private readonly handledTypes = [
    MESSAGE_TYPES.BACKUP_DATA,
    MESSAGE_TYPES.RESTORE_DATA,
  ]

  canHandle(type: string): boolean {
    return this.handledTypes.includes(
      type as (typeof this.handledTypes)[number],
    )
  }

  async handle(message: Message): Promise<MessageResponse> {
    switch (message.type) {
      case MESSAGE_TYPES.BACKUP_DATA:
        return this.backupData()

      case MESSAGE_TYPES.RESTORE_DATA:
        return this.restoreData(message)

      default:
        return {
          success: false,
          error: `BackupHandler cannot handle message type: ${message.type}`,
        }
    }
  }

  /**
   * Create a backup of all application data
   */
  private async backupData(): Promise<MessageResponse> {
    try {
      const backup = await storageService.backup()

      this.log.info("Data backup created", {
        version: backup.version,
        timestamp: backup.timestamp,
        containers: backup.containers?.length || 0,
        rules: backup.rules?.length || 0,
        hasPreferences: !!backup.preferences,
        hasBookmarks: !!backup.bookmarks,
        hasCategories: !!backup.categories,
        hasStats: !!backup.stats,
      })

      return { success: true, data: backup }
    } catch (error) {
      this.log.error("Failed to create backup", error)
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to create backup",
      }
    }
  }

  /**
   * Restore data from a backup
   */
  private async restoreData(message: Message): Promise<MessageResponse> {
    try {
      const payload = (message.payload || {}) as
        | BackupData
        | {
            data?: BackupData
            preview?: boolean
          }

      const preview = Boolean((payload as { preview?: boolean }).preview)
      const backupData = (
        "data" in payload ? payload.data : payload
      ) as BackupData

      if (!backupData) {
        return { success: false, error: "Backup data is required" }
      }

      if (
        !backupData.version ||
        !backupData.timestamp ||
        !backupData.containers
      ) {
        return { success: false, error: "Invalid backup data format" }
      }

      const summary = {
        containers: backupData.containers || [],
        rules: backupData.rules || [],
        bookmarks: backupData.bookmarks || [],
        categories: backupData.categories || [],
        errors: [] as Array<{ message: string; data?: string }>,
        warnings: [] as Array<{ message: string; data?: string }>,
      }

      if (preview) {
        this.log.info("Backup restore preview generated", {
          version: backupData.version,
          timestamp: backupData.timestamp,
          containers: summary.containers.length,
          rules: summary.rules.length,
          bookmarks: summary.bookmarks.length,
          categories: summary.categories.length,
        })

        return {
          success: true,
          data: summary,
        }
      }

      await storageService.restore(backupData)

      this.log.info("Data restored from backup", {
        version: backupData.version,
        timestamp: backupData.timestamp,
        containers: backupData.containers?.length || 0,
        rules: backupData.rules?.length || 0,
        hasPreferences: !!backupData.preferences,
        hasBookmarks: !!backupData.bookmarks,
        hasCategories: !!backupData.categories,
        hasStats: !!backupData.stats,
      })

      return {
        success: true,
        data: summary,
      }
    } catch (error) {
      this.log.error("Failed to restore from backup", error)
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to restore from backup",
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
