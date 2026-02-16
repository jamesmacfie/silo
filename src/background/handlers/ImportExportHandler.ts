import { MESSAGE_TYPES } from "@/shared/constants"
import type { Bookmark, Container } from "@/shared/types"
import {
  convertStandardToSilo,
  exportToNetscapeFormat,
  parseNetscapeFormat,
} from "@/shared/utils/bookmarkFormats"
import { logger } from "@/shared/utils/logger"
import type { Message, MessageResponse } from "@/shared/utils/messaging"
import type { MessageHandler } from "../MessageRouter"
import bookmarkService from "../services/BookmarkService"
import containerManager from "../services/ContainerManager"
import rulesEngine from "../services/RulesEngine"
import storageService from "../services/StorageService"

interface ImportIssue {
  message: string
  data?: string
}

interface ImportedContainerProfile {
  sourceContainerId: string
  name: string
  icon?: string
  color?: string
  temporary?: boolean
  syncEnabled?: boolean
  metadata?: Container["metadata"]
}

interface ParsedSiloImport {
  bookmarks: Bookmark[]
  containerProfiles: ImportedContainerProfile[]
  errors: ImportIssue[]
  warnings: ImportIssue[]
}

/**
 * Handles JSON import/export operations for all data types
 */
export class ImportExportHandler implements MessageHandler {
  private log = logger.withContext("ImportExportHandler")

  private readonly handledTypes = [
    MESSAGE_TYPES.EXPORT_RULES,
    MESSAGE_TYPES.IMPORT_RULES,
    MESSAGE_TYPES.GENERATE_TEMPLATE,
    MESSAGE_TYPES.EXPORT_CONTAINERS,
    MESSAGE_TYPES.IMPORT_CONTAINERS,
    MESSAGE_TYPES.EXPORT_BOOKMARKS_SILO,
    MESSAGE_TYPES.IMPORT_BOOKMARKS_SILO,
    MESSAGE_TYPES.EXPORT_BOOKMARKS_STANDARD,
    MESSAGE_TYPES.IMPORT_BOOKMARKS_STANDARD,
  ]

  canHandle(type: string): boolean {
    return this.handledTypes.includes(
      type as (typeof this.handledTypes)[number],
    )
  }

  async handle(message: Message): Promise<MessageResponse> {
    switch (message.type) {
      case MESSAGE_TYPES.EXPORT_RULES:
        return this.exportRules(message)

      case MESSAGE_TYPES.IMPORT_RULES:
        return this.importRules(message)

      case MESSAGE_TYPES.GENERATE_TEMPLATE:
        return this.generateTemplate(message)

      case MESSAGE_TYPES.EXPORT_CONTAINERS:
        return this.exportContainers(message)

      case MESSAGE_TYPES.IMPORT_CONTAINERS:
        return this.importContainers(message)

      case MESSAGE_TYPES.EXPORT_BOOKMARKS_SILO:
        return this.exportBookmarksSilo(message)

      case MESSAGE_TYPES.IMPORT_BOOKMARKS_SILO:
        return this.importBookmarksSilo(message)

      case MESSAGE_TYPES.EXPORT_BOOKMARKS_STANDARD:
        return this.exportBookmarksStandard(message)

      case MESSAGE_TYPES.IMPORT_BOOKMARKS_STANDARD:
        return this.importBookmarksStandard(message)

      default:
        return {
          success: false,
          error: `ImportExportHandler cannot handle message type: ${message.type}`,
        }
    }
  }

  /**
   * Export rules to JSON format
   */
  private async exportRules(message: Message): Promise<MessageResponse> {
    try {
      const { options } = (message.payload || {}) as {
        options?: { includeDisabled?: boolean; includeMetadata?: boolean }
      }

      let rules = await storageService.getRules()

      // Filter based on options
      if (options?.includeDisabled === false) {
        rules = rules.filter((rule) => rule.enabled)
      }

      // Optionally strip metadata
      if (options?.includeMetadata === false) {
        rules = rules.map((rule) => {
          const { metadata: _metadata, ...ruleWithoutMetadata } = rule
          return ruleWithoutMetadata as any
        })
      }

      this.log.info("Rules export completed", {
        rulesCount: rules.length,
      })

      return { success: true, data: rules }
    } catch (error) {
      this.log.error("Failed to export rules", error)
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to export rules",
      }
    }
  }

  /**
   * Import rules from JSON format
   */
  private async importRules(message: Message): Promise<MessageResponse> {
    try {
      const { data: rulesData, preview } = (message.payload || {}) as {
        data: any[]
        preview?: boolean
        createMissingContainers?: boolean
      }

      if (!rulesData || !Array.isArray(rulesData)) {
        return {
          success: false,
          error: "Rules data is required and must be an array",
        }
      }

      if (preview) {
        // Just validate and return preview info
        const errors: Array<{ message: string; data?: string }> = []
        const warnings: Array<{ message: string; data?: string }> = []

        // Basic validation
        rulesData.forEach((rule, index) => {
          if (!rule.pattern) {
            errors.push({
              message: `Rule ${index + 1}: Pattern is required`,
              data: JSON.stringify(rule),
            })
          }
          if (!rule.matchType) {
            warnings.push({
              message: `Rule ${index + 1}: Match type not specified, defaulting to domain`,
              data: JSON.stringify(rule),
            })
          }
        })

        return {
          success: true,
          data: {
            rules: rulesData,
            errors,
            warnings,
            missingContainers: [],
          },
        }
      }

      // Import rules
      let importedCount = 0
      const errors: Array<{ message: string; data?: string }> = []

      for (const ruleData of rulesData) {
        try {
          await rulesEngine.addRule(ruleData)
          importedCount++
        } catch (error) {
          this.log.warn("Failed to import rule", { ruleData, error })
          errors.push({
            message: `Failed to import rule: ${ruleData.pattern || "Unknown"}`,
            data: JSON.stringify(ruleData),
          })
        }
      }

      this.log.info("Rules import completed", {
        totalRules: rulesData.length,
        importedRules: importedCount,
        errors: errors.length,
      })

      return {
        success: true,
        data: {
          rules: rulesData,
          importedCount,
          errors,
        },
      }
    } catch (error) {
      this.log.error("Failed to import rules", error)
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to import rules",
      }
    }
  }

  /**
   * Generate a JSON template for import
   */
  private async generateTemplate(message: Message): Promise<MessageResponse> {
    try {
      const { type } = (message.payload || {}) as { type: string }

      let template: any

      switch (type) {
        case "IMPORT_RULES":
          template = [
            {
              pattern: "example.com",
              matchType: "domain",
              ruleType: "include",
              containerId: "firefox-container-1",
              priority: 1,
              enabled: true,
              metadata: {
                description: "Example rule for example.com",
                source: "user",
              },
            },
          ]
          break

        case "IMPORT_CONTAINERS":
          template = [
            {
              name: "Work",
              icon: "briefcase",
              color: "blue",
              temporary: false,
              metadata: {
                description: "Container for work-related browsing",
              },
            },
          ]
          break

        default:
          template = {}
          break
      }

      this.log.debug("Template generated", { type })
      return { success: true, data: { template } }
    } catch (error) {
      this.log.error("Failed to generate template", error)
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to generate template",
      }
    }
  }

  /**
   * Export containers to JSON format
   */
  private async exportContainers(_message: Message): Promise<MessageResponse> {
    try {
      const containers = await storageService.getContainers()

      this.log.info("Container export completed", {
        containersCount: containers.length,
      })

      return { success: true, data: containers }
    } catch (error) {
      this.log.error("Failed to export containers", error)
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to export containers",
      }
    }
  }

  /**
   * Import containers from JSON format
   */
  private async importContainers(message: Message): Promise<MessageResponse> {
    try {
      const { data, preview } = (message.payload || {}) as {
        data: any[]
        preview?: boolean
      }

      if (!data || !Array.isArray(data)) {
        return {
          success: false,
          error: "Container data is required and must be an array",
        }
      }

      if (preview) {
        // Just validate and return preview info
        return {
          success: true,
          data: {
            containers: data,
            errors: [],
            warnings: [],
          },
        }
      }

      // Import containers
      let importedCount = 0
      const errors: Array<{ message: string; data?: string }> = []

      for (const containerData of data) {
        try {
          await containerManager.create(containerData)
          importedCount++
        } catch (error) {
          this.log.warn("Failed to import container", { containerData, error })
          errors.push({
            message: `Failed to import container: ${containerData.name || "Unknown"}`,
            data: JSON.stringify(containerData),
          })
        }
      }

      this.log.info("Container import completed", {
        totalContainers: data.length,
        importedContainers: importedCount,
        errors: errors.length,
      })

      return {
        success: true,
        data: {
          containers: data,
          importedCount,
          errors,
        },
      }
    } catch (error) {
      this.log.error("Failed to import containers", error)
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to import containers",
      }
    }
  }

  private sanitizeBookmarks(
    rawBookmarks: unknown,
    errors: ImportIssue[],
    warnings: ImportIssue[],
    path: string = "bookmarks",
  ): Bookmark[] {
    if (!Array.isArray(rawBookmarks)) {
      errors.push({
        message: `${path} must be an array`,
      })
      return []
    }

    const bookmarks: Bookmark[] = []

    rawBookmarks.forEach((entry, index) => {
      const nodePath = `${path}[${index}]`

      if (!entry || typeof entry !== "object") {
        errors.push({
          message: `${nodePath} must be an object`,
          data: JSON.stringify(entry),
        })
        return
      }

      const node = entry as Record<string, unknown>
      const rawType = node.type
      let type: Bookmark["type"] = "bookmark"

      if (
        rawType === "bookmark" ||
        rawType === "folder" ||
        rawType === "separator"
      ) {
        type = rawType
      } else if (rawType !== undefined) {
        warnings.push({
          message: `${nodePath}: unsupported type "${String(rawType)}", defaulting to bookmark`,
          data: JSON.stringify(node),
        })
      }

      const rawTitle = typeof node.title === "string" ? node.title.trim() : ""
      const title =
        rawTitle.length > 0
          ? rawTitle
          : type === "separator"
            ? "Separator"
            : "Untitled"

      if (!rawTitle && type !== "separator") {
        warnings.push({
          message: `${nodePath}: title missing, defaulting to "Untitled"`,
          data: JSON.stringify(node),
        })
      }

      const bookmark: Bookmark = {
        id:
          typeof node.id === "string" && node.id.trim().length > 0
            ? node.id
            : `${nodePath}-imported`,
        title,
        type,
        index: typeof node.index === "number" ? node.index : index,
      }

      if (typeof node.parentId === "string") {
        bookmark.parentId = node.parentId
      }
      if (typeof node.dateAdded === "number") {
        bookmark.dateAdded = node.dateAdded
      }
      if (typeof node.dateGroupModified === "number") {
        bookmark.dateGroupModified = node.dateGroupModified
      }
      if (typeof node.containerId === "string" && node.containerId.trim()) {
        bookmark.containerId = node.containerId
      }
      if (typeof node.autoOpen === "boolean") {
        bookmark.autoOpen = node.autoOpen
      }
      if (typeof node.description === "string" && node.description.trim()) {
        bookmark.description = node.description
      }
      if (typeof node.lastAccessed === "number") {
        bookmark.lastAccessed = node.lastAccessed
      }
      if (typeof node.accessCount === "number") {
        bookmark.accessCount = node.accessCount
      }
      if (typeof node.notes === "string" && node.notes.trim()) {
        bookmark.notes = node.notes
      }
      if (typeof node.inheritSettings === "boolean") {
        ;(bookmark as any).inheritSettings = node.inheritSettings
      }

      if (type === "bookmark") {
        if (typeof node.url !== "string" || !node.url.trim()) {
          errors.push({
            message: `${nodePath}: url is required for bookmark entries`,
            data: JSON.stringify(node),
          })
          return
        }
        bookmark.url = node.url
      }

      if (type === "folder") {
        if (node.children !== undefined && !Array.isArray(node.children)) {
          warnings.push({
            message: `${nodePath}: folder children should be an array, treating as empty`,
            data: JSON.stringify(node),
          })
        }

        bookmark.children = this.sanitizeBookmarks(
          Array.isArray(node.children) ? node.children : [],
          errors,
          warnings,
          `${nodePath}.children`,
        )
      }

      if (type === "separator") {
        bookmark.url = undefined
      }

      bookmarks.push(bookmark)
    })

    return bookmarks
  }

  private sanitizeContainerProfiles(
    rawProfiles: unknown,
    warnings: ImportIssue[],
  ): ImportedContainerProfile[] {
    if (!Array.isArray(rawProfiles)) {
      return []
    }

    const profiles: ImportedContainerProfile[] = []

    rawProfiles.forEach((entry, index) => {
      if (!entry || typeof entry !== "object") {
        warnings.push({
          message: `containerProfiles[${index}] is not an object, skipping`,
          data: JSON.stringify(entry),
        })
        return
      }

      const profile = entry as Record<string, unknown>
      const sourceContainerId =
        typeof profile.sourceContainerId === "string" &&
        profile.sourceContainerId.trim()
          ? profile.sourceContainerId
          : typeof profile.cookieStoreId === "string" &&
              profile.cookieStoreId.trim()
            ? profile.cookieStoreId
            : null

      if (!sourceContainerId) {
        warnings.push({
          message: `containerProfiles[${index}] missing source container id, skipping`,
          data: JSON.stringify(entry),
        })
        return
      }

      const name =
        typeof profile.name === "string" && profile.name.trim()
          ? profile.name
          : `Imported ${sourceContainerId}`

      profiles.push({
        sourceContainerId,
        name,
        icon:
          typeof profile.icon === "string" && profile.icon.trim()
            ? profile.icon
            : undefined,
        color:
          typeof profile.color === "string" && profile.color.trim()
            ? profile.color
            : undefined,
        temporary:
          typeof profile.temporary === "boolean"
            ? profile.temporary
            : undefined,
        syncEnabled:
          typeof profile.syncEnabled === "boolean"
            ? profile.syncEnabled
            : undefined,
        metadata:
          profile.metadata && typeof profile.metadata === "object"
            ? (profile.metadata as Container["metadata"])
            : undefined,
      })
    })

    return profiles
  }

  private parseSiloBookmarksData(data: unknown): ParsedSiloImport {
    const errors: ImportIssue[] = []
    const warnings: ImportIssue[] = []

    let rawBookmarks: unknown = []
    let rawContainerProfiles: unknown = []

    if (Array.isArray(data)) {
      rawBookmarks = data
    } else if (data && typeof data === "object") {
      const payload = data as Record<string, unknown>
      rawBookmarks = payload.bookmarks
      rawContainerProfiles = payload.containerProfiles

      if (!Array.isArray(rawBookmarks)) {
        errors.push({
          message:
            'Silo bookmark import expects either an array or an object with a "bookmarks" array',
          data: JSON.stringify(data),
        })
        rawBookmarks = []
      }
    } else {
      errors.push({
        message: "Silo bookmark import requires bookmark data",
        data: JSON.stringify(data),
      })
    }

    const bookmarks = this.sanitizeBookmarks(rawBookmarks, errors, warnings)
    const containerProfiles = this.sanitizeContainerProfiles(
      rawContainerProfiles,
      warnings,
    )

    if (bookmarks.length === 0 && errors.length === 0) {
      warnings.push({
        message: "No bookmarks found in import data",
      })
    }

    return {
      bookmarks,
      containerProfiles,
      errors,
      warnings,
    }
  }

  private collectContainerIds(bookmarks: Bookmark[]): string[] {
    const containerIds = new Set<string>()

    const visit = (nodes: Bookmark[]): void => {
      for (const node of nodes) {
        if (node.containerId) {
          containerIds.add(node.containerId)
        }

        if (node.children?.length) {
          visit(node.children)
        }
      }
    }

    visit(bookmarks)
    return [...containerIds]
  }

  private findMissingContainerIds(
    containerIds: string[],
    containers: Container[],
    containerProfiles: ImportedContainerProfile[],
  ): string[] {
    const knownContainerIds = new Set<string>()
    for (const container of containers) {
      knownContainerIds.add(container.id)
      knownContainerIds.add(container.cookieStoreId)
    }

    const byName = new Set(
      containers.map((container) => container.name.toLowerCase()),
    )
    const profileBySource = new Map(
      containerProfiles.map((profile) => [profile.sourceContainerId, profile]),
    )

    return containerIds.filter((containerId) => {
      if (knownContainerIds.has(containerId)) {
        return false
      }

      const profile = profileBySource.get(containerId)
      if (!profile) {
        return true
      }

      return !byName.has(profile.name.toLowerCase())
    })
  }

  private async resolveContainerMappings({
    containerIds,
    existingContainers,
    containerProfiles,
    createMissingContainers,
    errors,
  }: {
    containerIds: string[]
    existingContainers: Container[]
    containerProfiles: ImportedContainerProfile[]
    createMissingContainers: boolean
    errors: ImportIssue[]
  }): Promise<{
    containerMap: Map<string, string>
    unresolvedContainers: string[]
  }> {
    const containerMap = new Map<string, string>()
    const unresolvedContainers: string[] = []

    const byCookieStoreId = new Map<string, Container>()
    const byId = new Map<string, Container>()
    const byName = new Map<string, Container>()
    const profileBySource = new Map(
      containerProfiles.map((profile) => [profile.sourceContainerId, profile]),
    )

    for (const container of existingContainers) {
      byCookieStoreId.set(container.cookieStoreId, container)
      byId.set(container.id, container)
      byName.set(container.name.toLowerCase(), container)
    }

    for (const containerId of containerIds) {
      const existingByCookieStore = byCookieStoreId.get(containerId)
      if (existingByCookieStore) {
        containerMap.set(containerId, existingByCookieStore.cookieStoreId)
        continue
      }

      const existingById = byId.get(containerId)
      if (existingById) {
        containerMap.set(containerId, existingById.cookieStoreId)
        continue
      }

      const profile = profileBySource.get(containerId)
      const existingByName = profile
        ? byName.get(profile.name.toLowerCase())
        : undefined
      if (existingByName) {
        containerMap.set(containerId, existingByName.cookieStoreId)
        continue
      }

      if (!createMissingContainers) {
        unresolvedContainers.push(containerId)
        continue
      }

      try {
        const created = await containerManager.create({
          name:
            profile?.name ||
            `Imported ${containerId.replace(/[^a-z0-9]/gi, "").slice(0, 12) || "Container"}`,
          icon: profile?.icon,
          color: profile?.color,
          temporary: profile?.temporary,
          syncEnabled: profile?.syncEnabled,
          metadata: profile?.metadata,
        })

        byCookieStoreId.set(created.cookieStoreId, created)
        byId.set(created.id, created)
        byName.set(created.name.toLowerCase(), created)
        containerMap.set(containerId, created.cookieStoreId)
      } catch (error) {
        errors.push({
          message: `Failed to create missing container for "${containerId}"`,
          data: JSON.stringify({
            containerId,
            error: error instanceof Error ? error.message : String(error),
          }),
        })
        unresolvedContainers.push(containerId)
      }
    }

    return { containerMap, unresolvedContainers }
  }

  private async importBookmarkTree({
    bookmarks,
    parentId,
    containerMap,
    errors,
    warnings,
  }: {
    bookmarks: Bookmark[]
    parentId?: string
    containerMap: Map<string, string>
    errors: ImportIssue[]
    warnings: ImportIssue[]
  }): Promise<number> {
    let importedCount = 0

    for (const bookmark of bookmarks) {
      try {
        if (bookmark.type === "separator") {
          warnings.push({
            message: `Skipped separator "${bookmark.title}" because separator import is not supported`,
          })
          continue
        }

        const mappedContainerId = bookmark.containerId
          ? containerMap.get(bookmark.containerId)
          : undefined

        if (bookmark.containerId && !mappedContainerId) {
          warnings.push({
            message: `Container "${bookmark.containerId}" was not available for "${bookmark.title}", importing without container assignment`,
          })
        }

        if (bookmark.type === "folder") {
          const createdFolder = await bookmarkService.createFolder({
            title: bookmark.title,
            parentId,
          })
          importedCount++

          const inheritSettings = (bookmark as any).inheritSettings
          if (mappedContainerId || typeof inheritSettings === "boolean") {
            await bookmarkService.setFolderMetadata(createdFolder.id, {
              containerId: mappedContainerId,
              inheritSettings:
                typeof inheritSettings === "boolean" ? inheritSettings : true,
            })
          }

          if (bookmark.children?.length) {
            importedCount += await this.importBookmarkTree({
              bookmarks: bookmark.children,
              parentId: createdFolder.id,
              containerMap,
              errors,
              warnings,
            })
          }

          continue
        }

        if (!bookmark.url) {
          errors.push({
            message: `Bookmark "${bookmark.title}" has no URL and was skipped`,
            data: JSON.stringify(bookmark),
          })
          continue
        }

        const createdBookmark = await bookmarkService.createBookmark({
          title: bookmark.title,
          url: bookmark.url,
          parentId,
          containerId: mappedContainerId,
        })
        importedCount++

        const metadataUpdates: any = {}
        const metadata: Record<string, unknown> = {}

        if (mappedContainerId) {
          metadataUpdates.containerId = mappedContainerId
        }
        if (typeof bookmark.autoOpen === "boolean") {
          metadataUpdates.autoOpen = bookmark.autoOpen
        }
        if (bookmark.description) {
          metadata.description = bookmark.description
        }
        if (typeof bookmark.lastAccessed === "number") {
          metadata.lastAccessed = bookmark.lastAccessed
        }
        if (typeof bookmark.accessCount === "number") {
          metadata.accessCount = bookmark.accessCount
        }
        if (bookmark.notes) {
          metadata.notes = bookmark.notes
        }

        if (Object.keys(metadata).length > 0) {
          metadataUpdates.metadata = metadata
        }

        if (Object.keys(metadataUpdates).length > 0) {
          await bookmarkService.updateBookmarkMetadata(
            createdBookmark.id,
            metadataUpdates,
          )
        }
      } catch (error) {
        errors.push({
          message: `Failed to import bookmark "${bookmark.title}"`,
          data: JSON.stringify({
            bookmark,
            error: error instanceof Error ? error.message : String(error),
          }),
        })
      }
    }

    return importedCount
  }

  /**
   * Export bookmarks in Silo format with full metadata
   */
  private async exportBookmarksSilo(
    _message: Message,
  ): Promise<MessageResponse> {
    try {
      const [bookmarks, containers] = await Promise.all([
        bookmarkService.getBookmarks(),
        storageService.getContainers(),
      ])

      const containerProfiles: ImportedContainerProfile[] = containers.map(
        (container) => ({
          sourceContainerId: container.cookieStoreId,
          name: container.name,
          icon: container.icon,
          color: container.color,
          temporary: container.temporary,
          syncEnabled: container.syncEnabled,
          metadata: container.metadata,
        }),
      )

      this.log.info("Silo bookmark export completed", {
        bookmarksCount: bookmarks.length,
        containerProfilesCount: containerProfiles.length,
      })

      return {
        success: true,
        data: {
          bookmarks,
          containerProfiles,
          metadata: {
            source: "silo",
            format: "silo-bookmarks",
            version: "2.0.0",
            exportDate: new Date().toISOString(),
          },
        },
      }
    } catch (error) {
      this.log.error("Failed to export bookmarks in Silo format", error)
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to export bookmarks",
      }
    }
  }

  /**
   * Import bookmarks in Silo format
   */
  private async importBookmarksSilo(
    message: Message,
  ): Promise<MessageResponse> {
    try {
      const {
        data,
        preview,
        createMissingContainers = true,
      } = (message.payload || {}) as {
        data: unknown
        preview?: boolean
        createMissingContainers?: boolean
      }

      if (data === undefined || data === null) {
        return {
          success: false,
          error: "Bookmark import data is required",
        }
      }

      const parsed = this.parseSiloBookmarksData(data)
      const containerIds = this.collectContainerIds(parsed.bookmarks)
      const existingContainers = await storageService.getContainers()
      const missingContainers = this.findMissingContainerIds(
        containerIds,
        existingContainers,
        parsed.containerProfiles,
      )

      if (!createMissingContainers && missingContainers.length > 0) {
        parsed.warnings.push({
          message: `${missingContainers.length} missing container association(s) will be skipped`,
        })
      }

      if (preview) {
        return {
          success: true,
          data: {
            bookmarks: parsed.bookmarks,
            errors: parsed.errors,
            warnings: parsed.warnings,
            missingContainers,
          },
        }
      }

      const { containerMap, unresolvedContainers } =
        await this.resolveContainerMappings({
          containerIds,
          existingContainers,
          containerProfiles: parsed.containerProfiles,
          createMissingContainers,
          errors: parsed.errors,
        })

      const importedCount = await this.importBookmarkTree({
        bookmarks: parsed.bookmarks,
        containerMap,
        errors: parsed.errors,
        warnings: parsed.warnings,
      })

      this.log.info("Silo bookmark import completed", {
        totalBookmarks: parsed.bookmarks.length,
        importedCount,
        errors: parsed.errors.length,
        warnings: parsed.warnings.length,
        missingContainers: missingContainers.length,
        unresolvedContainers: unresolvedContainers.length,
      })

      return {
        success: true,
        data: {
          bookmarks: parsed.bookmarks,
          importedCount,
          errors: parsed.errors,
          warnings: parsed.warnings,
          missingContainers: unresolvedContainers,
        },
      }
    } catch (error) {
      this.log.error("Failed to import bookmarks in Silo format", error)
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to import bookmarks",
      }
    }
  }

  /**
   * Export bookmarks in cross-browser standard format (HTML)
   */
  private async exportBookmarksStandard(
    _message: Message,
  ): Promise<MessageResponse> {
    try {
      const bookmarks = await bookmarkService.getBookmarks()
      const { html } = exportToNetscapeFormat(bookmarks)

      this.log.info("Standard bookmark export completed", {
        bookmarksCount: bookmarks.length,
      })

      return {
        success: true,
        data: {
          html,
          metadata: {
            source: "silo",
            format: "netscape-html",
            version: "1.0",
            exportDate: new Date().toISOString(),
          },
        },
      }
    } catch (error) {
      this.log.error("Failed to export bookmarks in standard format", error)
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to export bookmarks",
      }
    }
  }

  /**
   * Import bookmarks from cross-browser standard format
   */
  private async importBookmarksStandard(
    message: Message,
  ): Promise<MessageResponse> {
    try {
      const { data, preview } = (message.payload || {}) as {
        data: unknown
        preview?: boolean
      }

      if (typeof data !== "string") {
        return {
          success: false,
          error: "Standard bookmark import requires HTML content as a string",
        }
      }

      const errors: ImportIssue[] = []
      const warnings: ImportIssue[] = []
      const parsedStandardBookmarks = parseNetscapeFormat(data)
      const bookmarks = convertStandardToSilo(parsedStandardBookmarks)

      if (bookmarks.length === 0) {
        warnings.push({
          message: "No bookmarks found in HTML import data",
        })
      }

      if (preview) {
        return {
          success: true,
          data: {
            bookmarks,
            errors,
            warnings,
            missingContainers: [],
          },
        }
      }

      const importedCount = await this.importBookmarkTree({
        bookmarks,
        containerMap: new Map<string, string>(),
        errors,
        warnings,
      })

      this.log.info("Standard bookmark import completed", {
        totalBookmarks: bookmarks.length,
        importedCount,
        errors: errors.length,
        warnings: warnings.length,
      })

      return {
        success: true,
        data: {
          bookmarks,
          importedCount,
          errors,
          warnings,
          missingContainers: [],
        },
      }
    } catch (error) {
      this.log.error("Failed to import bookmarks from standard format", error)
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to import bookmarks",
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
