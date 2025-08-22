import { MESSAGE_TYPES } from "@/shared/constants"
import { logger } from "@/shared/utils/logger"
import type { Message, MessageResponse } from "@/shared/utils/messaging"
import type { MessageHandler } from "../MessageRouter"
import storageService from "../services/StorageService"

/**
 * Handles user preference and settings operations
 */
export class PreferenceHandler implements MessageHandler {
  private log = logger.withContext("PreferenceHandler")

  private readonly handledTypes = [
    MESSAGE_TYPES.GET_PREFERENCES,
    MESSAGE_TYPES.UPDATE_PREFERENCES,
  ]

  canHandle(type: string): boolean {
    return this.handledTypes.includes(
      type as (typeof this.handledTypes)[number],
    )
  }

  async handle(message: Message): Promise<MessageResponse> {
    switch (message.type) {
      case MESSAGE_TYPES.GET_PREFERENCES:
        return this.getPreferences()

      case MESSAGE_TYPES.UPDATE_PREFERENCES:
        return this.updatePreferences(message)

      default:
        return {
          success: false,
          error: `PreferenceHandler cannot handle message type: ${message.type}`,
        }
    }
  }

  /**
   * Get user preferences
   */
  private async getPreferences(): Promise<MessageResponse> {
    try {
      const preferences = await storageService.getPreferences()
      this.log.debug("Retrieved preferences", {
        theme: preferences.theme,
        syncEnabled: preferences.syncEnabled,
      })
      return { success: true, data: preferences }
    } catch (error) {
      this.log.error("Failed to get preferences", error)
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to get preferences",
      }
    }
  }

  /**
   * Update user preferences
   */
  private async updatePreferences(message: Message): Promise<MessageResponse> {
    try {
      const updates = message.payload

      if (!updates || typeof updates !== "object") {
        return { success: false, error: "Preference updates are required" }
      }

      await storageService.updatePreferences(updates)

      this.log.info("Preferences updated", {
        updatedKeys: Object.keys(updates),
      })

      return { success: true }
    } catch (error) {
      this.log.error("Failed to update preferences", error)
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to update preferences",
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
