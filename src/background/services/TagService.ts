// Generate UUID using browser crypto
const uuidv4 = (): string => {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === "x" ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

import browser from "webextension-polyfill"
import { STORAGE_KEYS } from "@/shared/constants"
import type {
  BookmarkMetadata,
  BookmarkTag,
  BookmarkTagCapabilities,
} from "@/shared/types"
import { logger } from "@/shared/utils/logger"
import storageService from "./StorageService"

export class TagService {
  private storage = storageService
  private log = logger.withContext("TagService")

  async getTagCapabilities(): Promise<BookmarkTagCapabilities> {
    const browserName = await this.detectBrowserName()

    return {
      backend: "custom",
      nativeSupported: false,
      browser: browserName,
      reason:
        "Browser bookmark APIs do not expose native bookmark tags. Silo uses its own tag metadata for cross-browser support.",
    }
  }

  // Tag CRUD operations
  async getAllTags(): Promise<BookmarkTag[]> {
    try {
      const tags = await this.storage.get<BookmarkTag[]>(
        STORAGE_KEYS.BOOKMARK_TAGS,
      )
      return tags || []
    } catch (error) {
      this.log.error("Failed to get tags", error)
      return []
    }
  }

  async getTag(id: string): Promise<BookmarkTag | null> {
    const tags = await this.getAllTags()
    return tags.find((tag) => tag.id === id) || null
  }

  async createTag(data: Partial<BookmarkTag>): Promise<BookmarkTag> {
    const tags = await this.getAllTags()

    // Check for duplicate names
    if (
      data.name &&
      tags.some((tag) => tag.name.toLowerCase() === data.name?.toLowerCase())
    ) {
      throw new Error(`Tag with name "${data.name}" already exists`)
    }

    const newTag: BookmarkTag = {
      id: uuidv4(),
      name: data.name || "New Tag",
      color: data.color || "#4A90E2",
      created: Date.now(),
      modified: Date.now(),
    }

    tags.push(newTag)
    await this.storage.set(STORAGE_KEYS.BOOKMARK_TAGS, tags)

    this.log.info("Created tag", { tag: newTag })
    return newTag
  }

  async updateTag(
    id: string,
    updates: Partial<BookmarkTag>,
  ): Promise<BookmarkTag> {
    const tags = await this.getAllTags()
    const index = tags.findIndex((tag) => tag.id === id)

    if (index === -1) {
      throw new Error(`Tag with id "${id}" not found`)
    }

    // Check for duplicate names (excluding current tag)
    if (
      updates.name &&
      tags.some(
        (tag, i) =>
          i !== index && tag.name.toLowerCase() === updates.name?.toLowerCase(),
      )
    ) {
      throw new Error(`Tag with name "${updates.name}" already exists`)
    }

    const updatedTag: BookmarkTag = {
      ...tags[index],
      ...updates,
      id: tags[index].id, // Ensure ID cannot be changed
      created: tags[index].created, // Preserve created timestamp
      modified: Date.now(),
    }

    tags[index] = updatedTag
    await this.storage.set(STORAGE_KEYS.BOOKMARK_TAGS, tags)

    this.log.info("Updated tag", { tag: updatedTag })
    return updatedTag
  }

  async deleteTag(id: string): Promise<void> {
    const tags = await this.getAllTags()
    const filtered = tags.filter((tag) => tag.id !== id)

    if (filtered.length === tags.length) {
      throw new Error(`Tag with id "${id}" not found`)
    }

    await this.storage.set(STORAGE_KEYS.BOOKMARK_TAGS, filtered)

    // Remove tag from all bookmarks
    await this.removeTagFromAllBookmarks(id)

    this.log.info("Deleted tag", { id })
  }

  // Bookmark metadata operations
  async getBookmarkMetadata(
    bookmarkId: string,
  ): Promise<BookmarkMetadata | null> {
    const metadataList =
      (await this.storage.get<BookmarkMetadata[]>(
        STORAGE_KEYS.BOOKMARK_METADATA,
      )) || []
    return metadataList.find((m) => m.bookmarkId === bookmarkId) || null
  }

  async setBookmarkMetadata(
    bookmarkId: string,
    updates: Partial<BookmarkMetadata>,
  ): Promise<BookmarkMetadata> {
    const metadataList =
      (await this.storage.get<BookmarkMetadata[]>(
        STORAGE_KEYS.BOOKMARK_METADATA,
      )) || []
    const existingIndex = metadataList.findIndex(
      (m) => m.bookmarkId === bookmarkId,
    )

    const now = Date.now()
    let metadata: BookmarkMetadata

    if (existingIndex !== -1) {
      metadata = {
        ...metadataList[existingIndex],
        ...updates,
        bookmarkId, // Ensure ID cannot be changed
        modified: now,
      }
      metadataList[existingIndex] = metadata
    } else {
      metadata = {
        bookmarkId,
        tags: [],
        autoOpen: true,
        metadata: {},
        created: now,
        modified: now,
        ...updates,
      }
      metadataList.push(metadata)
    }

    await this.storage.set(STORAGE_KEYS.BOOKMARK_METADATA, metadataList)
    return metadata
  }

  // Tag-Bookmark associations
  async addTagToBookmark(bookmarkId: string, tagId: string): Promise<void> {
    const metadata = (await this.getBookmarkMetadata(bookmarkId)) || {
      bookmarkId,
      tags: [],
      autoOpen: true,
      metadata: {},
      created: Date.now(),
      modified: Date.now(),
    }

    if (!metadata.tags.includes(tagId)) {
      metadata.tags.push(tagId)
      await this.setBookmarkMetadata(bookmarkId, metadata)
      this.log.info("Added tag to bookmark", { bookmarkId, tagId })
    }
  }

  async removeTagFromBookmark(
    bookmarkId: string,
    tagId: string,
  ): Promise<void> {
    const metadata = await this.getBookmarkMetadata(bookmarkId)
    if (!metadata) return

    const index = metadata.tags.indexOf(tagId)
    if (index !== -1) {
      metadata.tags.splice(index, 1)
      await this.setBookmarkMetadata(bookmarkId, metadata)
      this.log.info("Removed tag from bookmark", { bookmarkId, tagId })
    }
  }

  async removeTagFromAllBookmarks(tagId: string): Promise<void> {
    const metadataList =
      (await this.storage.get<BookmarkMetadata[]>(
        STORAGE_KEYS.BOOKMARK_METADATA,
      )) || []
    let modified = false

    for (const metadata of metadataList) {
      const index = metadata.tags.indexOf(tagId)
      if (index !== -1) {
        metadata.tags.splice(index, 1)
        metadata.modified = Date.now()
        modified = true
      }
    }

    if (modified) {
      await this.storage.set(STORAGE_KEYS.BOOKMARK_METADATA, metadataList)
      this.log.info("Removed tag from all bookmarks", { tagId })
    }
  }

  // Bulk tag operations
  async bulkAddTag(bookmarkIds: string[], tagId: string): Promise<void> {
    const metadataList =
      (await this.storage.get<BookmarkMetadata[]>(
        STORAGE_KEYS.BOOKMARK_METADATA,
      )) || []
    const metadataMap = new Map(metadataList.map((m) => [m.bookmarkId, m]))
    let modified = false

    for (const bookmarkId of bookmarkIds) {
      let metadata = metadataMap.get(bookmarkId)

      if (!metadata) {
        metadata = {
          bookmarkId,
          tags: [tagId],
          autoOpen: true,
          metadata: {},
          created: Date.now(),
          modified: Date.now(),
        }
        metadataList.push(metadata)
        modified = true
      } else if (!metadata.tags.includes(tagId)) {
        metadata.tags.push(tagId)
        metadata.modified = Date.now()
        modified = true
      }
    }

    if (modified) {
      await this.storage.set(STORAGE_KEYS.BOOKMARK_METADATA, metadataList)
      this.log.info("Bulk added tag", { bookmarkIds, tagId })
    }
  }

  async bulkRemoveTag(bookmarkIds: string[], tagId: string): Promise<void> {
    const metadataList =
      (await this.storage.get<BookmarkMetadata[]>(
        STORAGE_KEYS.BOOKMARK_METADATA,
      )) || []
    let modified = false

    for (const metadata of metadataList) {
      if (bookmarkIds.includes(metadata.bookmarkId)) {
        const index = metadata.tags.indexOf(tagId)
        if (index !== -1) {
          metadata.tags.splice(index, 1)
          metadata.modified = Date.now()
          modified = true
        }
      }
    }

    if (modified) {
      await this.storage.set(STORAGE_KEYS.BOOKMARK_METADATA, metadataList)
      this.log.info("Bulk removed tag", { bookmarkIds, tagId })
    }
  }

  // Tag statistics
  async getTagUsageStats(): Promise<Map<string, number>> {
    const metadataList =
      (await this.storage.get<BookmarkMetadata[]>(
        STORAGE_KEYS.BOOKMARK_METADATA,
      )) || []
    const stats = new Map<string, number>()

    for (const metadata of metadataList) {
      for (const tagId of metadata.tags) {
        stats.set(tagId, (stats.get(tagId) || 0) + 1)
      }
    }

    return stats
  }

  // Tag colors
  getDefaultTagColors(): string[] {
    return [
      "#4A90E2", // Blue
      "#5CB85C", // Green
      "#F0AD4E", // Yellow
      "#FF8C42", // Orange
      "#D9534F", // Red
      "#FF69B4", // Pink
      "#7B68EE", // Purple
      "#30D5C8", // Turquoise
      "#999999", // Gray
      "#333333", // Dark Gray
    ]
  }

  private async detectBrowserName(): Promise<
    BookmarkTagCapabilities["browser"]
  > {
    try {
      const runtimeWithBrowserInfo =
        browser.runtime as typeof browser.runtime & {
          getBrowserInfo?: () => Promise<{ name?: string }>
        }

      const info = runtimeWithBrowserInfo.getBrowserInfo
        ? await runtimeWithBrowserInfo.getBrowserInfo()
        : null
      const name = info?.name?.toLowerCase() || ""

      if (name.includes("firefox")) return "firefox"
      if (name.includes("edg")) return "edge"
      if (name.includes("chrome") || name.includes("chromium")) return "chrome"
    } catch {
      // Ignore and try fallback below.
    }

    const ua =
      typeof navigator !== "undefined" ? navigator.userAgent.toLowerCase() : ""
    if (ua.includes("firefox")) return "firefox"
    if (ua.includes("edg")) return "edge"
    if (ua.includes("chrome") || ua.includes("chromium")) return "chrome"
    return "unknown"
  }
}

export const tagService = new TagService()
export default tagService
