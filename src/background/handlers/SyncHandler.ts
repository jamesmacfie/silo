import { MESSAGE_TYPES } from "@/shared/constants"
import { logger } from "@/shared/utils/logger"
import type { Message, MessageResponse } from "@/shared/utils/messaging"
import type { MessageHandler } from "../MessageRouter"

/**
 * Handles sync operations (currently not implemented)
 */
export class SyncHandler implements MessageHandler {
  private log = logger.withContext("SyncHandler")

  private readonly handledTypes = [
    MESSAGE_TYPES.SYNC_PUSH,
    MESSAGE_TYPES.SYNC_PULL,
    MESSAGE_TYPES.GET_SYNC_STATE,
  ]

  canHandle(type: string): boolean {
    return this.handledTypes.includes(
      type as (typeof this.handledTypes)[number],
    )
  }

  async handle(message: Message): Promise<MessageResponse> {
    switch (message.type) {
      case MESSAGE_TYPES.SYNC_PUSH:
        return this.syncPush()

      case MESSAGE_TYPES.SYNC_PULL:
        return this.syncPull()

      case MESSAGE_TYPES.GET_SYNC_STATE:
        return this.getSyncState()

      default:
        return {
          success: false,
          error: `SyncHandler cannot handle message type: ${message.type}`,
        }
    }
  }

  /**
   * Push local data to sync service (not implemented)
   */
  private async syncPush(): Promise<MessageResponse> {
    this.log.warn("Sync push requested but sync is not implemented")
    return { success: false, error: "Sync not implemented" }
  }

  /**
   * Pull data from sync service (not implemented)
   */
  private async syncPull(): Promise<MessageResponse> {
    this.log.warn("Sync pull requested but sync is not implemented")
    return { success: false, error: "Sync not implemented" }
  }

  /**
   * Get sync state (not implemented)
   */
  private async getSyncState(): Promise<MessageResponse> {
    this.log.warn("Sync state requested but sync is not implemented")
    return { success: false, error: "Sync not implemented" }
  }

  /**
   * Get the list of message types this handler can process
   */
  getHandledTypes(): string[] {
    return [...this.handledTypes]
  }
}
