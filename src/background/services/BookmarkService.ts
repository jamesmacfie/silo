import browser from "webextension-polyfill"
import { STORAGE_KEYS } from "@/shared/constants"
import type {
  Bookmark,
  BookmarkBulkAction,
  BookmarkMetadata,
  FolderMetadata,
} from "@/shared/types"
import { logger } from "@/shared/utils/logger"
import rulesEngine from "./RulesEngine"
import storageService from "./StorageService"
import tagService from "./TagService"

export class BookmarkService {
  private storage = storageService
  private tags = tagService
  private rules = rulesEngine
  private log = logger.withContext("BookmarkService")

  // Core bookmark operations that merge Firefox bookmarks with our metadata
  async getBookmarks(): Promise<Bookmark[]> {
    try {
      // Get Firefox bookmarks
      const firefoxBookmarks = await browser.bookmarks.getTree()

      // Get our metadata
      const metadata =
        (await this.storage.get<BookmarkMetadata[]>(
          STORAGE_KEYS.BOOKMARK_METADATA,
        )) || []
      const folderMetadata =
        (await this.storage.get<FolderMetadata[]>(
          STORAGE_KEYS.FOLDER_METADATA,
        )) || []

      // Create lookup maps
      const metadataMap = new Map(metadata.map((m) => [m.bookmarkId, m]))
      const folderMetadataMap = new Map(
        folderMetadata.map((fm) => [fm.folderId, fm]),
      )

      // Convert Firefox bookmarks to our bookmark format
      const bookmarks = await this.processBookmarkTree(
        firefoxBookmarks,
        metadataMap,
        folderMetadataMap,
        [],
        true,
      )

      return bookmarks
    } catch (error) {
      this.log.error("Failed to get bookmarks", error)
      return []
    }
  }

  private async processBookmarkTree(
    firefoxBookmarks: browser.Bookmarks.BookmarkTreeNode[],
    metadataMap: Map<string, BookmarkMetadata>,
    folderMetadataMap: Map<string, FolderMetadata>,
    folderPath: string[] = [],
    isRoot: boolean = false,
  ): Promise<Bookmark[]> {
    const bookmarks: Bookmark[] = []

    for (const firefoxBookmark of firefoxBookmarks) {
      const metadata = metadataMap.get(firefoxBookmark.id)
      const folderMeta = folderMetadataMap.get(firefoxBookmark.id)

      // Determine bookmark type
      let type: "bookmark" | "folder" | "separator" = "bookmark"
      if (firefoxBookmark.type === "folder") type = "folder"
      else if (firefoxBookmark.type === "separator") type = "separator"

      // Build bookmark object
      const bookmark: Bookmark = {
        // Firefox properties
        id: firefoxBookmark.id,
        title: firefoxBookmark.title || "Untitled",
        url: firefoxBookmark.url,
        parentId: firefoxBookmark.parentId,
        index: firefoxBookmark.index || 0,
        dateAdded: firefoxBookmark.dateAdded,
        dateGroupModified: firefoxBookmark.dateGroupModified,
        type,

        // Our metadata
        containerId: metadata?.containerId || folderMeta?.containerId,
        tags: metadata?.tags || [],
        autoOpen: metadata?.autoOpen,
        description: metadata?.metadata.description,
        lastAccessed: metadata?.metadata.lastAccessed,
        accessCount: metadata?.metadata.accessCount,
        notes: metadata?.metadata.notes,

        // Computed properties
        folderPath: [...folderPath],
      }

      // Check if bookmark URL matches any rules for container suggestion
      if (bookmark.url && !bookmark.containerId) {
        try {
          const ruleMatch = await this.rules.evaluate(bookmark.url)
          if (ruleMatch?.containerId) {
            bookmark.matchedContainer = ruleMatch.containerId
          }
        } catch (error) {
          this.log.warn("Rule evaluation failed for bookmark", {
            id: firefoxBookmark.id,
            error,
          })
        }
      }

      // Process children for folders
      if (firefoxBookmark.children) {
        // For root folders (like "Bookmarks Toolbar"), don't include them in the path
        const isRootFolder = isRoot || folderPath.length === 0
        const currentPath = isRootFolder
          ? folderPath
          : [...folderPath, firefoxBookmark.title || "Untitled"]
        bookmark.children = await this.processBookmarkTree(
          firefoxBookmark.children,
          metadataMap,
          folderMetadataMap,
          currentPath,
          false,
        )
      }

      bookmarks.push(bookmark)
    }

    return bookmarks
  }

  // Flatten bookmarks for table view
  async getFlatBookmarkList(): Promise<Bookmark[]> {
    const bookmarkTree = await this.getBookmarks()
    const flat: Bookmark[] = []

    const flatten = (bookmarks: Bookmark[]) => {
      for (const bookmark of bookmarks) {
        if (bookmark.type === "bookmark" && bookmark.url) {
          flat.push(bookmark)
        }
        if (bookmark.children) {
          flatten(bookmark.children)
        }
      }
    }

    flatten(bookmarkTree)
    return flat
  }

  // Bookmark metadata operations
  async updateBookmarkMetadata(
    bookmarkId: string,
    updates: Partial<BookmarkMetadata>,
  ): Promise<void> {
    await this.tags.setBookmarkMetadata(bookmarkId, updates)
    this.log.info("Updated bookmark metadata", { bookmarkId, updates })
  }

  async getBookmarkMetadata(
    bookmarkId: string,
  ): Promise<BookmarkMetadata | null> {
    return await this.tags.getBookmarkMetadata(bookmarkId)
  }

  // Container associations
  async assignContainer(
    bookmarkId: string,
    containerId: string,
  ): Promise<void> {
    await this.updateBookmarkMetadata(bookmarkId, { containerId })
  }

  async removeContainer(bookmarkId: string): Promise<void> {
    const metadata = await this.getBookmarkMetadata(bookmarkId)
    if (metadata) {
      const { containerId: _, ...rest } = metadata
      await this.tags.setBookmarkMetadata(bookmarkId, rest)
    }
  }

  // Tag operations
  async addTag(bookmarkId: string, tagId: string): Promise<void> {
    await this.tags.addTagToBookmark(bookmarkId, tagId)
  }

  async removeTag(bookmarkId: string, tagId: string): Promise<void> {
    await this.tags.removeTagFromBookmark(bookmarkId, tagId)
  }

  // Bulk operations
  async executeBulkAction(action: BookmarkBulkAction): Promise<void> {
    const { type, bookmarkIds, payload } = action

    this.log.info("Executing bulk action", { type, count: bookmarkIds.length })

    switch (type) {
      case "delete":
        for (const id of bookmarkIds) {
          try {
            await browser.bookmarks.remove(id)
          } catch (error) {
            this.log.warn("Failed to delete bookmark", { id, error })
          }
        }
        break

      case "assignTag":
        if (payload?.tagId) {
          await this.tags.bulkAddTag(bookmarkIds, payload.tagId)
        }
        break

      case "removeTag":
        if (payload?.tagId) {
          await this.tags.bulkRemoveTag(bookmarkIds, payload.tagId)
        }
        break

      case "assignContainer":
        if (payload?.containerId) {
          for (const id of bookmarkIds) {
            await this.assignContainer(id, payload.containerId)
          }
        }
        break

      case "removeContainer":
        for (const id of bookmarkIds) {
          await this.removeContainer(id)
        }
        break

      case "openInContainer":
        if (payload?.containerId) {
          // Get bookmark URLs and open them
          const bookmarks = await this.getFlatBookmarkList()
          const selectedBookmarks = bookmarks.filter((b) =>
            bookmarkIds.includes(b.id),
          )

          for (const bookmark of selectedBookmarks) {
            if (bookmark.url) {
              // Add silo parameter to URL
              const url = new URL(bookmark.url)
              url.searchParams.set("silo", payload.containerId)

              await browser.tabs.create({
                url: url.toString(),
                cookieStoreId: payload.containerId,
              })
            }
          }
        }
        break
    }
  }

  // Search and filtering
  async searchBookmarks(
    query: string,
    filters?: {
      tags?: string[]
      containers?: string[]
      folders?: string[]
    },
  ): Promise<Bookmark[]> {
    const allBookmarks = await this.getFlatBookmarkList()

    return allBookmarks.filter((bookmark) => {
      // Text search
      if (query) {
        const searchText = query.toLowerCase()
        const matchesTitle = bookmark.title.toLowerCase().includes(searchText)
        const matchesUrl = bookmark.url?.toLowerCase().includes(searchText)
        const matchesDescription = bookmark.description
          ?.toLowerCase()
          .includes(searchText)

        if (!matchesTitle && !matchesUrl && !matchesDescription) {
          return false
        }
      }

      // Tag filter
      if (filters?.tags && filters.tags.length > 0) {
        const hasMatchingTag = filters.tags.some((tagId) =>
          bookmark.tags.includes(tagId),
        )
        if (!hasMatchingTag) return false
      }

      // Container filter
      if (filters?.containers && filters.containers.length > 0) {
        if (
          !bookmark.containerId ||
          !filters.containers.includes(bookmark.containerId)
        ) {
          return false
        }
      }

      // Folder filter (based on folder path)
      if (filters?.folders && filters.folders.length > 0) {
        const hasMatchingFolder = filters.folders.some((folderId) =>
          bookmark.folderPath?.some((pathItem) => pathItem.includes(folderId)),
        )
        if (!hasMatchingFolder) return false
      }

      return true
    })
  }

  // Folder operations
  async deleteFolders(folderIds: string[]): Promise<void> {
    this.log.info("Deleting folders", { count: folderIds.length, folderIds })

    for (const folderId of folderIds) {
      try {
        // Firefox bookmarks.removeTree() will delete the folder and all its contents
        await browser.bookmarks.removeTree(folderId)
        this.log.info("Deleted folder", { folderId })
      } catch (error) {
        this.log.warn("Failed to delete folder", { folderId, error })
        // Try to continue with other folders even if one fails
      }
    }

    // Clean up any folder metadata we have stored
    try {
      const folderMetadata =
        (await this.storage.get<FolderMetadata[]>(
          STORAGE_KEYS.FOLDER_METADATA,
        )) || []
      const updatedMetadata = folderMetadata.filter(
        (fm) => !folderIds.includes(fm.folderId),
      )
      await this.storage.set(STORAGE_KEYS.FOLDER_METADATA, updatedMetadata)
    } catch (error) {
      this.log.warn("Failed to clean up folder metadata", error)
    }
  }

  async setFolderMetadata(
    folderId: string,
    metadata: Partial<FolderMetadata>,
  ): Promise<void> {
    const folderMetadata =
      (await this.storage.get<FolderMetadata[]>(
        STORAGE_KEYS.FOLDER_METADATA,
      )) || []
    const existingIndex = folderMetadata.findIndex(
      (fm) => fm.folderId === folderId,
    )

    if (existingIndex !== -1) {
      folderMetadata[existingIndex] = {
        ...folderMetadata[existingIndex],
        ...metadata,
        folderId,
        modified: Date.now(),
      }
    } else {
      folderMetadata.push({
        folderId,
        created: Date.now(),
        modified: Date.now(),
        ...metadata,
      })
    }

    await this.storage.set(STORAGE_KEYS.FOLDER_METADATA, folderMetadata)
  }

  async getFolderMetadata(folderId: string): Promise<FolderMetadata | null> {
    const folderMetadata =
      (await this.storage.get<FolderMetadata[]>(
        STORAGE_KEYS.FOLDER_METADATA,
      )) || []
    return folderMetadata.find((fm) => fm.folderId === folderId) || null
  }

  // Migration from legacy bookmark associations
  async migrateLegacyBookmarks(): Promise<void> {
    try {
      const legacyAssociations =
        (await this.storage.get<any[]>(STORAGE_KEYS.BOOKMARKS)) || []
      const metadata: BookmarkMetadata[] = []

      for (const legacy of legacyAssociations) {
        metadata.push({
          bookmarkId: legacy.bookmarkId,
          containerId: legacy.containerId,
          tags: [], // No tags in legacy
          autoOpen: legacy.autoOpen,
          metadata: {},
          created: legacy.created || Date.now(),
          modified: Date.now(),
        })
      }

      if (metadata.length > 0) {
        await this.storage.set(STORAGE_KEYS.BOOKMARK_METADATA, metadata)
        this.log.info("Migrated legacy bookmarks", { count: metadata.length })
      }
    } catch (error) {
      this.log.error("Failed to migrate legacy bookmarks", error)
    }
  }
}

export const bookmarkService = new BookmarkService()
export default bookmarkService
