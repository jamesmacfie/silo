import { MESSAGE_TYPES } from "@/shared/constants"
import { logger } from "@/shared/utils/logger"
import type { Message, MessageResponse } from "@/shared/utils/messaging"
import type { MessageHandler } from "../MessageRouter"
import storageService from "../services/StorageService"

/**
 * Handles container category operations
 */
export class CategoryHandler implements MessageHandler {
  private log = logger.withContext("CategoryHandler")

  private readonly handledTypes = [
    MESSAGE_TYPES.GET_CATEGORIES,
    MESSAGE_TYPES.ADD_CATEGORY,
    MESSAGE_TYPES.RENAME_CATEGORY,
    MESSAGE_TYPES.DELETE_CATEGORY,
  ]

  canHandle(type: string): boolean {
    return this.handledTypes.includes(
      type as (typeof this.handledTypes)[number],
    )
  }

  async handle(message: Message): Promise<MessageResponse> {
    switch (message.type) {
      case MESSAGE_TYPES.GET_CATEGORIES:
        return this.getCategories()

      case MESSAGE_TYPES.ADD_CATEGORY:
        return this.addCategory(message)

      case MESSAGE_TYPES.RENAME_CATEGORY:
        return this.renameCategory(message)

      case MESSAGE_TYPES.DELETE_CATEGORY:
        return this.deleteCategory(message)

      default:
        return {
          success: false,
          error: `CategoryHandler cannot handle message type: ${message.type}`,
        }
    }
  }

  /**
   * Get all categories
   */
  private async getCategories(): Promise<MessageResponse> {
    try {
      const categories = await storageService.getCategories()
      this.log.debug("Retrieved categories", { count: categories.length })
      return { success: true, data: categories }
    } catch (error) {
      this.log.error("Failed to get categories", error)
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to get categories",
      }
    }
  }

  /**
   * Add a new category
   */
  private async addCategory(message: Message): Promise<MessageResponse> {
    try {
      const { name } = (message.payload || {}) as { name: string }

      if (!name || typeof name !== "string" || name.trim().length === 0) {
        return { success: false, error: "Category name is required" }
      }

      await storageService.addCategory(name.trim())
      this.log.info("Category added", { name: name.trim() })
      return { success: true }
    } catch (error) {
      this.log.error("Failed to add category", error)
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to add category",
      }
    }
  }

  /**
   * Rename an existing category
   */
  private async renameCategory(message: Message): Promise<MessageResponse> {
    try {
      const { oldName, newName } = (message.payload || {}) as {
        oldName: string
        newName: string
      }

      if (!oldName || !newName) {
        return {
          success: false,
          error: "Both old and new category names are required",
        }
      }

      if (typeof oldName !== "string" || typeof newName !== "string") {
        return { success: false, error: "Category names must be strings" }
      }

      if (newName.trim().length === 0) {
        return { success: false, error: "New category name cannot be empty" }
      }

      await storageService.renameCategory(oldName, newName.trim())
      this.log.info("Category renamed", {
        oldName,
        newName: newName.trim(),
      })
      return { success: true }
    } catch (error) {
      this.log.error("Failed to rename category", error)
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to rename category",
      }
    }
  }

  /**
   * Delete a category
   */
  private async deleteCategory(message: Message): Promise<MessageResponse> {
    try {
      const { name } = (message.payload || {}) as { name: string }

      if (!name || typeof name !== "string" || name.trim().length === 0) {
        return { success: false, error: "Category name is required" }
      }

      await storageService.deleteCategory(name.trim())
      this.log.info("Category deleted", { name: name.trim() })
      return { success: true }
    } catch (error) {
      this.log.error("Failed to delete category", error)
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to delete category",
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
