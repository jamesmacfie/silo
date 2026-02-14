import browser from "webextension-polyfill"
import { MESSAGE_TYPES } from "@/shared/constants"
import type { CreateContainerRequest } from "@/shared/types"
import { logger } from "@/shared/utils/logger"
import type { Message, MessageResponse } from "@/shared/utils/messaging"
import type { MessageHandler } from "../MessageRouter"
import containerManager from "../services/ContainerManager"
import storageService from "../services/StorageService"

/**
 * Handles all container-related operations
 */
export class ContainerHandler implements MessageHandler {
  private log = logger.withContext("ContainerHandler")

  private readonly handledTypes = [
    MESSAGE_TYPES.GET_CONTAINERS,
    MESSAGE_TYPES.CREATE_CONTAINER,
    MESSAGE_TYPES.UPDATE_CONTAINER,
    MESSAGE_TYPES.DELETE_CONTAINER,
    MESSAGE_TYPES.SYNC_CONTAINERS,
    MESSAGE_TYPES.CLEAR_CONTAINER_COOKIES,
    MESSAGE_TYPES.OPEN_IN_CONTAINER,
  ]

  canHandle(type: string): boolean {
    return this.handledTypes.includes(
      type as (typeof this.handledTypes)[number],
    )
  }

  async handle(message: Message): Promise<MessageResponse> {
    switch (message.type) {
      case MESSAGE_TYPES.GET_CONTAINERS:
        return this.getContainers()

      case MESSAGE_TYPES.CREATE_CONTAINER:
        return this.createContainer(message)

      case MESSAGE_TYPES.UPDATE_CONTAINER:
        return this.updateContainer(message)

      case MESSAGE_TYPES.DELETE_CONTAINER:
        return this.deleteContainer(message)

      case MESSAGE_TYPES.SYNC_CONTAINERS:
        return this.syncContainers()

      case MESSAGE_TYPES.CLEAR_CONTAINER_COOKIES:
        return this.clearContainerCookies(message)

      case MESSAGE_TYPES.OPEN_IN_CONTAINER:
        return this.openInContainer(message)

      default:
        return {
          success: false,
          error: `ContainerHandler cannot handle message type: ${message.type}`,
        }
    }
  }

  /**
   * Get all containers
   */
  private async getContainers(): Promise<MessageResponse> {
    try {
      const containers = await storageService.getContainers()
      this.log.debug("Retrieved containers", { count: containers.length })
      return { success: true, data: containers }
    } catch (error) {
      this.log.error("Failed to get containers", error)
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to get containers",
      }
    }
  }

  /**
   * Create a new container
   */
  private async createContainer(message: Message): Promise<MessageResponse> {
    try {
      const request = message.payload as CreateContainerRequest

      if (!request || !request.name) {
        return { success: false, error: "Container name is required" }
      }

      const container = await containerManager.create(request)
      this.log.info("Container created", {
        name: container.name,
        cookieStoreId: container.cookieStoreId,
      })

      return { success: true, data: container }
    } catch (error) {
      this.log.error("Failed to create container", error)
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to create container",
      }
    }
  }

  /**
   * Update an existing container
   */
  private async updateContainer(message: Message): Promise<MessageResponse> {
    try {
      const { id, updates } = (message.payload || {}) as {
        id: string
        updates: Partial<browser.ContextualIdentities.ContextualIdentity> &
          Record<string, unknown>
      }

      if (!id) {
        return { success: false, error: "Container ID is required" }
      }

      if (!updates || Object.keys(updates).length === 0) {
        return { success: false, error: "Updates are required" }
      }

      await containerManager.update(
        id,
        updates as Partial<browser.ContextualIdentities.ContextualIdentity>,
      )

      this.log.info("Container updated", { id, updates: Object.keys(updates) })
      return { success: true }
    } catch (error) {
      this.log.error("Failed to update container", error)
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to update container",
      }
    }
  }

  /**
   * Delete a container
   */
  private async deleteContainer(message: Message): Promise<MessageResponse> {
    try {
      const { id } = (message.payload || {}) as { id: string }

      if (!id) {
        return { success: false, error: "Container ID is required" }
      }

      await containerManager.delete(id)
      this.log.info("Container deleted", { id })
      return { success: true }
    } catch (error) {
      this.log.error("Failed to delete container", error)
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to delete container",
      }
    }
  }

  /**
   * Sync containers with Firefox
   */
  private async syncContainers(): Promise<MessageResponse> {
    try {
      await containerManager.syncWithFirefox()
      this.log.info("Containers synced with Firefox")
      return { success: true }
    } catch (error) {
      this.log.error("Failed to sync containers", error)
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to sync containers",
      }
    }
  }

  /**
   * Clear cookies for a specific container
   */
  private async clearContainerCookies(
    message: Message,
  ): Promise<MessageResponse> {
    try {
      const { id } = (message.payload || {}) as { id: string }

      if (!id) {
        return { success: false, error: "Container ID is required" }
      }

      await containerManager.clearContainerCookies(id)
      this.log.info("Container cookies cleared", { id })
      return { success: true }
    } catch (error) {
      this.log.error("Failed to clear container cookies", error)
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to clear container cookies",
      }
    }
  }

  /**
   * Open URL in a specific container
   */
  private async openInContainer(message: Message): Promise<MessageResponse> {
    try {
      const { url, cookieStoreId, index, closeTabId } = (message.payload ||
        {}) as {
        url?: string
        cookieStoreId?: string
        index?: number
        closeTabId?: number
      }

      const createTabOptions: browser.Tabs.CreateCreatePropertiesType = {
        active: true,
        ...(url ? { url } : {}),
        ...(index !== undefined ? { index } : {}),
        ...(cookieStoreId ? { cookieStoreId } : {}),
      }

      const newTab = await browser.tabs.create(createTabOptions)

      // Close the source tab if requested
      if (closeTabId) {
        try {
          await browser.tabs.remove(closeTabId)
          this.log.debug("Source tab closed", { closeTabId })
        } catch (error) {
          this.log.warn("Failed to close source tab", { closeTabId, error })
          // Don't fail the whole operation if we can't close the source tab
        }
      }

      this.log.info("URL opened in container", {
        url: url ? url.substring(0, 100) : "(new tab)", // Limit URL length in logs
        cookieStoreId,
        tabId: newTab.id,
      })

      return { success: true, data: { tabId: newTab.id } }
    } catch (error) {
      this.log.error("Failed to open URL in container", error)
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to open URL in container",
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
