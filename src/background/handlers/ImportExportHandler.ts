import { MESSAGE_TYPES, STORAGE_KEYS } from "@/shared/constants"
import { logger } from "@/shared/utils/logger"
import type { Message, MessageResponse } from "@/shared/utils/messaging"
import type { MessageHandler } from "../MessageRouter"
import containerManager from "../services/ContainerManager"
import rulesEngine from "../services/RulesEngine"
import storageService from "../services/StorageService"

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
    MESSAGE_TYPES.EXPORT_TAGS,
    MESSAGE_TYPES.IMPORT_TAGS,
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

      case MESSAGE_TYPES.EXPORT_TAGS:
        return this.exportTags(message)

      case MESSAGE_TYPES.IMPORT_TAGS:
        return this.importTags(message)

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
          const { metadata, ...ruleWithoutMetadata } = rule
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
      const {
        data: rulesData,
        preview,
        createMissingContainers,
      } = (message.payload || {}) as {
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

        case "IMPORT_TAGS":
          template = [
            {
              name: "Important",
              color: "#ff0000",
              metadata: {
                description: "Tag for important bookmarks",
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
  private async exportContainers(message: Message): Promise<MessageResponse> {
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

  /**
   * Export bookmark tags to JSON format
   */
  private async exportTags(message: Message): Promise<MessageResponse> {
    try {
      const tags = ((await storageService.get(STORAGE_KEYS.BOOKMARK_TAGS)) ||
        []) as any[]

      this.log.info("Tags export completed", {
        tagsCount: tags.length,
      })

      return { success: true, data: tags }
    } catch (error) {
      this.log.error("Failed to export tags", error)
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to export tags",
      }
    }
  }

  /**
   * Import bookmark tags from JSON format
   */
  private async importTags(message: Message): Promise<MessageResponse> {
    try {
      const { data, preview } = (message.payload || {}) as {
        data: any[]
        preview?: boolean
      }

      if (!data || !Array.isArray(data)) {
        return {
          success: false,
          error: "Tags data is required and must be an array",
        }
      }

      if (preview) {
        return {
          success: true,
          data: {
            tags: data,
            errors: [],
            warnings: [],
          },
        }
      }

      // Import tags
      await storageService.set(STORAGE_KEYS.BOOKMARK_TAGS, data)

      this.log.info("Tags import completed", {
        tagsCount: data.length,
      })

      return {
        success: true,
        data: {
          tags: data,
          importedCount: data.length,
          errors: [],
        },
      }
    } catch (error) {
      this.log.error("Failed to import tags", error)
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to import tags",
      }
    }
  }

  /**
   * Export bookmarks in Silo format with full metadata
   */
  private async exportBookmarksSilo(
    message: Message,
  ): Promise<MessageResponse> {
    try {
      // This would require integration with BookmarkService to get full bookmark data
      // For now, return a placeholder response
      return {
        success: false,
        error:
          "Silo bookmark export not yet implemented - please use the existing bookmark export functionality",
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
      return {
        success: false,
        error:
          "Silo bookmark import not yet implemented - please use the existing bookmark import functionality",
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
    message: Message,
  ): Promise<MessageResponse> {
    try {
      return {
        success: false,
        error:
          "Standard bookmark export not yet implemented - please use the existing bookmark export functionality",
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
      return {
        success: false,
        error:
          "Standard bookmark import not yet implemented - please use the existing bookmark import functionality",
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
