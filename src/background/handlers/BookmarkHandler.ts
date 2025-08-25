import browser from "webextension-polyfill"
import { MESSAGE_TYPES } from "@/shared/constants"
import { logger } from "@/shared/utils/logger"
import type { Message, MessageResponse } from "@/shared/utils/messaging"
import type { MessageHandler } from "../MessageRouter"
import bookmarkIntegration from "../services/BookmarkIntegration"
import bookmarkService from "../services/BookmarkService"
import rulesEngine from "../services/RulesEngine"
import storageService from "../services/StorageService"
import tagService from "../services/TagService"

/**
 * Handles all bookmark-related operations
 */
export class BookmarkHandler implements MessageHandler {
  private log = logger.withContext("BookmarkHandler")

  private readonly handledTypes = [
    // Bookmark associations (legacy)
    MESSAGE_TYPES.GET_BOOKMARK_ASSOCIATIONS,
    MESSAGE_TYPES.ADD_BOOKMARK_ASSOCIATION,
    MESSAGE_TYPES.REMOVE_BOOKMARK_ASSOCIATION,
    MESSAGE_TYPES.PROCESS_BOOKMARK_URL,

    // Modern bookmark operations
    MESSAGE_TYPES.GET_BOOKMARKS,
    MESSAGE_TYPES.CREATE_BOOKMARK,
    MESSAGE_TYPES.UPDATE_BOOKMARK,
    MESSAGE_TYPES.UPDATE_BOOKMARK_NATIVE,
    MESSAGE_TYPES.DELETE_BOOKMARK_NATIVE,
    MESSAGE_TYPES.BULK_UPDATE_BOOKMARKS,
    MESSAGE_TYPES.CHECK_BOOKMARK_RULE_MATCH,

    // Bookmark tags
    MESSAGE_TYPES.GET_BOOKMARK_TAGS,
    MESSAGE_TYPES.CREATE_BOOKMARK_TAG,
    MESSAGE_TYPES.UPDATE_BOOKMARK_TAG,
    MESSAGE_TYPES.DELETE_BOOKMARK_TAG,

    // Bulk tag operations
    MESSAGE_TYPES.BULK_ASSIGN_TAG,
    MESSAGE_TYPES.BULK_REMOVE_TAG,
    MESSAGE_TYPES.BULK_ASSIGN_CONTAINER,
    MESSAGE_TYPES.BULK_REMOVE_CONTAINER,
    MESSAGE_TYPES.BULK_OPEN_IN_CONTAINER,

    // Bookmark folders
    MESSAGE_TYPES.CREATE_BOOKMARK_FOLDER,
    MESSAGE_TYPES.DELETE_BOOKMARK_FOLDERS,

    // Bookmark reordering
    MESSAGE_TYPES.REORDER_BOOKMARKS,
    MESSAGE_TYPES.MOVE_BOOKMARK,

    // Bookmark migration
    MESSAGE_TYPES.MIGRATE_BOOKMARKS,
  ]

  canHandle(type: string): boolean {
    return this.handledTypes.includes(
      type as (typeof this.handledTypes)[number],
    )
  }

  async handle(message: Message): Promise<MessageResponse> {
    switch (message.type) {
      // Legacy bookmark associations
      case MESSAGE_TYPES.GET_BOOKMARK_ASSOCIATIONS:
        return this.getBookmarkAssociations()
      case MESSAGE_TYPES.ADD_BOOKMARK_ASSOCIATION:
        return this.addBookmarkAssociation(message)
      case MESSAGE_TYPES.REMOVE_BOOKMARK_ASSOCIATION:
        return this.removeBookmarkAssociation(message)
      case MESSAGE_TYPES.PROCESS_BOOKMARK_URL:
        return this.processBookmarkUrl(message)

      // Modern bookmark operations
      case MESSAGE_TYPES.GET_BOOKMARKS:
        return this.getBookmarks()
      case MESSAGE_TYPES.CREATE_BOOKMARK:
        return this.createBookmark(message)
      case MESSAGE_TYPES.UPDATE_BOOKMARK:
        return this.updateBookmark(message)
      case MESSAGE_TYPES.UPDATE_BOOKMARK_NATIVE:
        return this.updateBookmarkNative(message)
      case MESSAGE_TYPES.DELETE_BOOKMARK_NATIVE:
        return this.deleteBookmarkNative(message)
      case MESSAGE_TYPES.BULK_UPDATE_BOOKMARKS:
        return this.bulkUpdateBookmarks(message)
      case MESSAGE_TYPES.CHECK_BOOKMARK_RULE_MATCH:
        return this.checkBookmarkRuleMatch(message)

      // Bookmark tags
      case MESSAGE_TYPES.GET_BOOKMARK_TAGS:
        return this.getBookmarkTags()
      case MESSAGE_TYPES.CREATE_BOOKMARK_TAG:
        return this.createBookmarkTag(message)
      case MESSAGE_TYPES.UPDATE_BOOKMARK_TAG:
        return this.updateBookmarkTag(message)
      case MESSAGE_TYPES.DELETE_BOOKMARK_TAG:
        return this.deleteBookmarkTag(message)

      // Bulk operations
      case MESSAGE_TYPES.BULK_ASSIGN_TAG:
        return this.bulkAssignTag(message)
      case MESSAGE_TYPES.BULK_REMOVE_TAG:
        return this.bulkRemoveTag(message)
      case MESSAGE_TYPES.BULK_ASSIGN_CONTAINER:
        return this.bulkAssignContainer(message)
      case MESSAGE_TYPES.BULK_REMOVE_CONTAINER:
        return this.bulkRemoveContainer(message)
      case MESSAGE_TYPES.BULK_OPEN_IN_CONTAINER:
        return this.bulkOpenInContainer(message)

      // Bookmark folders
      case MESSAGE_TYPES.CREATE_BOOKMARK_FOLDER:
        return this.createBookmarkFolder(message)
      case MESSAGE_TYPES.DELETE_BOOKMARK_FOLDERS:
        return this.deleteBookmarkFolders(message)

      // Bookmark reordering
      case MESSAGE_TYPES.REORDER_BOOKMARKS:
        return this.reorderBookmarks(message)
      case MESSAGE_TYPES.MOVE_BOOKMARK:
        return this.moveBookmark(message)

      // Migration
      case MESSAGE_TYPES.MIGRATE_BOOKMARKS:
        return this.migrateBookmarks()

      default:
        return {
          success: false,
          error: `BookmarkHandler cannot handle message type: ${message.type}`,
        }
    }
  }

  // Legacy bookmark associations
  private async getBookmarkAssociations(): Promise<MessageResponse> {
    try {
      const associations = await storageService.getBookmarkAssociations()
      this.log.debug("Retrieved bookmark associations", {
        count: associations.length,
      })
      return { success: true, data: associations }
    } catch (error) {
      this.log.error("Failed to get bookmark associations", error)
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to get bookmark associations",
      }
    }
  }

  private async addBookmarkAssociation(
    message: Message,
  ): Promise<MessageResponse> {
    try {
      const { bookmarkId, containerId, url, autoOpen } = (message.payload ||
        {}) as {
        bookmarkId: string
        containerId: string
        url: string
        autoOpen?: boolean
      }

      if (!bookmarkId || !containerId || !url) {
        return {
          success: false,
          error: "Bookmark ID, container ID, and URL are required",
        }
      }

      await storageService.addBookmarkAssociation({
        bookmarkId,
        containerId,
        url,
        autoOpen: !!autoOpen,
        created: Date.now(),
      })

      this.log.info("Bookmark association added", {
        bookmarkId,
        containerId,
        autoOpen: !!autoOpen,
      })
      return { success: true }
    } catch (error) {
      this.log.error("Failed to add bookmark association", error)
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to add bookmark association",
      }
    }
  }

  private async removeBookmarkAssociation(
    message: Message,
  ): Promise<MessageResponse> {
    try {
      const { bookmarkId } = (message.payload || {}) as { bookmarkId: string }

      if (!bookmarkId) {
        return { success: false, error: "Bookmark ID is required" }
      }

      await storageService.removeBookmarkAssociation(bookmarkId)
      this.log.info("Bookmark association removed", { bookmarkId })
      return { success: true }
    } catch (error) {
      this.log.error("Failed to remove bookmark association", error)
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to remove bookmark association",
      }
    }
  }

  private async processBookmarkUrl(message: Message): Promise<MessageResponse> {
    try {
      const { url } = (message.payload || {}) as { url: string }

      if (!url) {
        return { success: false, error: "URL is required" }
      }

      const result = await bookmarkIntegration.processBookmarkUrl(url)
      this.log.debug("Bookmark URL processed", {
        url: url.substring(0, 100),
        result,
      })
      return { success: true, data: result }
    } catch (error) {
      this.log.error("Failed to process bookmark URL", error)
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to process bookmark URL",
      }
    }
  }

  // Modern bookmark operations
  private async getBookmarks(): Promise<MessageResponse> {
    try {
      const bookmarks = await bookmarkService.getBookmarks()
      this.log.debug("Retrieved bookmarks", { count: bookmarks.length })
      return { success: true, data: bookmarks }
    } catch (error) {
      this.log.error("Failed to get bookmarks", error)
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to get bookmarks",
      }
    }
  }

  private async updateBookmark(message: Message): Promise<MessageResponse> {
    try {
      const { bookmarkId, updates } = message.payload as {
        bookmarkId: string
        updates: any
      }

      if (!bookmarkId) {
        return { success: false, error: "Bookmark ID is required" }
      }

      if (!updates || typeof updates !== "object") {
        return { success: false, error: "Updates are required" }
      }

      await bookmarkService.updateBookmarkMetadata(bookmarkId, updates)
      this.log.info("Bookmark updated", {
        bookmarkId,
        updates: Object.keys(updates),
      })
      return { success: true, data: null }
    } catch (error) {
      this.log.error("Failed to update bookmark", error)
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to update bookmark",
      }
    }
  }

  private async updateBookmarkNative(
    message: Message,
  ): Promise<MessageResponse> {
    try {
      const { bookmarkId, updates } = message.payload as {
        bookmarkId: string
        updates: { title?: string; url?: string }
      }

      if (!bookmarkId) {
        return { success: false, error: "Bookmark ID is required" }
      }

      if (!updates || typeof updates !== "object") {
        return { success: false, error: "Updates are required" }
      }

      await browser.bookmarks.update(bookmarkId, updates)
      this.log.info("Native bookmark updated", {
        bookmarkId,
        updates: Object.keys(updates),
      })
      return { success: true, data: null }
    } catch (error) {
      this.log.error("Failed to update native bookmark", error)
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to update native bookmark",
      }
    }
  }

  private async deleteBookmarkNative(
    message: Message,
  ): Promise<MessageResponse> {
    try {
      const { bookmarkId } = message.payload as { bookmarkId: string }

      if (!bookmarkId) {
        return { success: false, error: "Bookmark ID is required" }
      }

      await browser.bookmarks.remove(bookmarkId)
      this.log.info("Native bookmark deleted", { bookmarkId })
      return { success: true, data: null }
    } catch (error) {
      this.log.error("Failed to delete native bookmark", error)
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to delete native bookmark",
      }
    }
  }

  private async bulkUpdateBookmarks(
    message: Message,
  ): Promise<MessageResponse> {
    try {
      const action = message.payload // BookmarkBulkAction type

      if (!action || typeof action !== "object" || !(action as any).type) {
        return { success: false, error: "Bulk action is required" }
      }

      await bookmarkService.executeBulkAction(action as any)
      this.log.info("Bulk bookmark update completed", {
        actionType: (action as any).type,
        bookmarkCount: (action as any).bookmarkIds?.length || 0,
      })
      return { success: true, data: null }
    } catch (error) {
      this.log.error("Failed to execute bulk bookmark update", error)
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to execute bulk bookmark update",
      }
    }
  }

  private async checkBookmarkRuleMatch(
    message: Message,
  ): Promise<MessageResponse> {
    try {
      const { url } = message.payload as { url: string }

      if (!url) {
        return { success: false, error: "URL is required" }
      }

      const match = await rulesEngine.evaluate(url)
      this.log.debug("Bookmark rule match checked", {
        url: url.substring(0, 100),
        containerId: match?.containerId || null,
      })
      return {
        success: true,
        data: { containerId: match?.containerId || null },
      }
    } catch (error) {
      this.log.error("Failed to check bookmark rule match", error)
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to check bookmark rule match",
      }
    }
  }

  // Bookmark tags
  private async getBookmarkTags(): Promise<MessageResponse> {
    try {
      const tags = await tagService.getAllTags()
      this.log.debug("Retrieved bookmark tags", { count: tags.length })
      return { success: true, data: tags }
    } catch (error) {
      this.log.error("Failed to get bookmark tags", error)
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to get bookmark tags",
      }
    }
  }

  private async createBookmarkTag(message: Message): Promise<MessageResponse> {
    try {
      const tagData = message.payload

      if (!tagData || typeof tagData !== "object" || !(tagData as any).name) {
        return { success: false, error: "Tag name is required" }
      }

      const tag = await tagService.createTag(tagData)
      this.log.info("Bookmark tag created", { name: tag.name, id: tag.id })
      return { success: true, data: tag }
    } catch (error) {
      this.log.error("Failed to create bookmark tag", error)
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to create bookmark tag",
      }
    }
  }

  private async updateBookmarkTag(message: Message): Promise<MessageResponse> {
    try {
      const { id, updates } = message.payload as { id: string; updates: any }

      if (!id) {
        return { success: false, error: "Tag ID is required" }
      }

      if (!updates || typeof updates !== "object") {
        return { success: false, error: "Updates are required" }
      }

      const tag = await tagService.updateTag(id, updates)
      this.log.info("Bookmark tag updated", {
        id,
        updates: Object.keys(updates),
      })
      return { success: true, data: tag }
    } catch (error) {
      this.log.error("Failed to update bookmark tag", error)
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to update bookmark tag",
      }
    }
  }

  private async deleteBookmarkTag(message: Message): Promise<MessageResponse> {
    try {
      const { id } = message.payload as { id: string }

      if (!id) {
        return { success: false, error: "Tag ID is required" }
      }

      await tagService.deleteTag(id)
      this.log.info("Bookmark tag deleted", { id })
      return { success: true, data: null }
    } catch (error) {
      this.log.error("Failed to delete bookmark tag", error)
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to delete bookmark tag",
      }
    }
  }

  // Bulk operations
  private async bulkAssignTag(message: Message): Promise<MessageResponse> {
    try {
      const { bookmarkIds, tagId } = message.payload as {
        bookmarkIds: string[]
        tagId: string
      }

      if (!bookmarkIds || !Array.isArray(bookmarkIds) || !tagId) {
        return {
          success: false,
          error: "Bookmark IDs array and tag ID are required",
        }
      }

      await tagService.bulkAddTag(bookmarkIds, tagId)
      this.log.info("Bulk tag assignment completed", {
        bookmarkCount: bookmarkIds.length,
        tagId,
      })
      return { success: true, data: null }
    } catch (error) {
      this.log.error("Failed to bulk assign tag", error)
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to bulk assign tag",
      }
    }
  }

  private async bulkRemoveTag(message: Message): Promise<MessageResponse> {
    try {
      const { bookmarkIds, tagId } = message.payload as {
        bookmarkIds: string[]
        tagId: string
      }

      if (!bookmarkIds || !Array.isArray(bookmarkIds) || !tagId) {
        return {
          success: false,
          error: "Bookmark IDs array and tag ID are required",
        }
      }

      await tagService.bulkRemoveTag(bookmarkIds, tagId)
      this.log.info("Bulk tag removal completed", {
        bookmarkCount: bookmarkIds.length,
        tagId,
      })
      return { success: true, data: null }
    } catch (error) {
      this.log.error("Failed to bulk remove tag", error)
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to bulk remove tag",
      }
    }
  }

  private async bulkAssignContainer(
    message: Message,
  ): Promise<MessageResponse> {
    try {
      const { bookmarkIds, containerId } = message.payload as {
        bookmarkIds: string[]
        containerId: string
      }

      if (!bookmarkIds || !Array.isArray(bookmarkIds) || !containerId) {
        return {
          success: false,
          error: "Bookmark IDs array and container ID are required",
        }
      }

      for (const bookmarkId of bookmarkIds) {
        await bookmarkService.assignContainer(bookmarkId, containerId)
      }

      this.log.info("Bulk container assignment completed", {
        bookmarkCount: bookmarkIds.length,
        containerId,
      })
      return { success: true, data: null }
    } catch (error) {
      this.log.error("Failed to bulk assign container", error)
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to bulk assign container",
      }
    }
  }

  private async bulkRemoveContainer(
    message: Message,
  ): Promise<MessageResponse> {
    try {
      const { bookmarkIds } = message.payload as { bookmarkIds: string[] }

      if (!bookmarkIds || !Array.isArray(bookmarkIds)) {
        return { success: false, error: "Bookmark IDs array is required" }
      }

      for (const bookmarkId of bookmarkIds) {
        await bookmarkService.removeContainer(bookmarkId)
      }

      this.log.info("Bulk container removal completed", {
        bookmarkCount: bookmarkIds.length,
      })
      return { success: true, data: null }
    } catch (error) {
      this.log.error("Failed to bulk remove container", error)
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to bulk remove container",
      }
    }
  }

  private async bulkOpenInContainer(
    message: Message,
  ): Promise<MessageResponse> {
    try {
      const { bookmarkIds, containerId } = message.payload as {
        bookmarkIds: string[]
        containerId: string
      }

      if (!bookmarkIds || !Array.isArray(bookmarkIds) || !containerId) {
        return {
          success: false,
          error: "Bookmark IDs array and container ID are required",
        }
      }

      await bookmarkService.executeBulkAction({
        type: "openInContainer",
        bookmarkIds,
        payload: { containerId },
      })

      this.log.info("Bulk open in container completed", {
        bookmarkCount: bookmarkIds.length,
        containerId,
      })
      return { success: true, data: null }
    } catch (error) {
      this.log.error("Failed to bulk open in container", error)
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to bulk open in container",
      }
    }
  }

  // Bookmark folders
  private async deleteBookmarkFolders(
    message: Message,
  ): Promise<MessageResponse> {
    try {
      const { folderIds } = message.payload as { folderIds: string[] }

      if (!folderIds || !Array.isArray(folderIds)) {
        return { success: false, error: "Folder IDs array is required" }
      }

      await bookmarkService.deleteFolders(folderIds)
      this.log.info("Bookmark folders deleted", {
        folderCount: folderIds.length,
      })
      return { success: true, data: null }
    } catch (error) {
      this.log.error("Failed to delete bookmark folders", error)
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to delete bookmark folders",
      }
    }
  }

  // Bookmark reordering
  private async reorderBookmarks(message: Message): Promise<MessageResponse> {
    try {
      const { parentId, bookmarkIds } = message.payload as {
        parentId: string
        bookmarkIds: string[]
      }

      if (!parentId || !bookmarkIds || !Array.isArray(bookmarkIds)) {
        return {
          success: false,
          error: "Parent ID and bookmark IDs array are required",
        }
      }

      await bookmarkService.reorderBookmarks(parentId, bookmarkIds)
      this.log.info("Bookmarks reordered", {
        parentId,
        bookmarkCount: bookmarkIds.length,
      })
      return { success: true, data: null }
    } catch (error) {
      this.log.error("Failed to reorder bookmarks", error)
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to reorder bookmarks",
      }
    }
  }

  private async moveBookmark(message: Message): Promise<MessageResponse> {
    try {
      const { bookmarkId, parentId, index } = message.payload as {
        bookmarkId: string
        parentId?: string
        index?: number
      }

      if (!bookmarkId) {
        return { success: false, error: "Bookmark ID is required" }
      }

      await bookmarkService.moveBookmark(bookmarkId, parentId, index)
      this.log.info("Bookmark moved", {
        bookmarkId,
        parentId,
        index,
      })
      return { success: true, data: null }
    } catch (error) {
      this.log.error("Failed to move bookmark", error)
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to move bookmark",
      }
    }
  }

  // Migration
  private async migrateBookmarks(): Promise<MessageResponse> {
    try {
      await bookmarkService.migrateLegacyBookmarks()
      this.log.info("Bookmark migration completed")
      return { success: true, data: null }
    } catch (error) {
      this.log.error("Failed to migrate bookmarks", error)
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to migrate bookmarks",
      }
    }
  }

  // Bookmark creation
  private async createBookmark(message: Message): Promise<MessageResponse> {
    try {
      const { title, url, parentId, containerId, tags } = message.payload as {
        title: string
        url: string
        parentId?: string
        containerId?: string
        tags?: string[]
      }

      if (!title || !url) {
        return { success: false, error: "Title and URL are required" }
      }

      const bookmark = await bookmarkService.createBookmark({
        title: title.trim(),
        url: url.trim(),
        parentId,
        containerId,
        tags: tags || [],
      })

      this.log.info("Bookmark created", {
        bookmarkId: bookmark.id,
        title: bookmark.title,
        parentId,
        containerId,
        tagCount: tags?.length || 0,
      })

      return { success: true, data: bookmark }
    } catch (error) {
      this.log.error("Failed to create bookmark", error)
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to create bookmark",
      }
    }
  }

  private async createBookmarkFolder(
    message: Message,
  ): Promise<MessageResponse> {
    try {
      const { title, parentId } = message.payload as {
        title: string
        parentId?: string
      }

      if (!title) {
        return { success: false, error: "Title is required" }
      }

      const folder = await bookmarkService.createFolder({
        title: title.trim(),
        parentId,
      })

      this.log.info("Bookmark folder created", {
        folderId: folder.id,
        title: folder.title,
        parentId,
      })

      return { success: true, data: folder }
    } catch (error) {
      this.log.error("Failed to create bookmark folder", error)
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to create bookmark folder",
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
