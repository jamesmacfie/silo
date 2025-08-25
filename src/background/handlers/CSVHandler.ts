import { MESSAGE_TYPES, STORAGE_KEYS } from "@/shared/constants"
import type { CSVExportOptions } from "@/shared/utils/csv"
import { exportToCSV, generateCSVTemplate, parseCSV } from "@/shared/utils/csv"
import { logger } from "@/shared/utils/logger"
import type { Message, MessageResponse } from "@/shared/utils/messaging"
import type { MessageHandler } from "../MessageRouter"
import containerManager from "../services/ContainerManager"
import rulesEngine from "../services/RulesEngine"
import storageService from "../services/StorageService"

/**
 * Handles CSV import/export operations
 */
export class CSVHandler implements MessageHandler {
  private log = logger.withContext("CSVHandler")

  private readonly handledTypes = [
    MESSAGE_TYPES.EXPORT_CSV,
    MESSAGE_TYPES.IMPORT_CSV,
    MESSAGE_TYPES.GENERATE_CSV_TEMPLATE,
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
      case MESSAGE_TYPES.EXPORT_CSV:
        return this.exportCSV(message)

      case MESSAGE_TYPES.IMPORT_CSV:
        return this.importCSV(message)

      case MESSAGE_TYPES.GENERATE_CSV_TEMPLATE:
        return this.generateCSVTemplate()

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
          error: `CSVHandler cannot handle message type: ${message.type}`,
        }
    }
  }

  /**
   * Export rules and containers to CSV format
   */
  private async exportCSV(message: Message): Promise<MessageResponse> {
    try {
      const { options } = (message.payload || {}) as {
        options?: CSVExportOptions
      }

      const rules = await storageService.getRules()
      const containers = await storageService.getContainers()

      const csv = exportToCSV(rules, containers, options)

      this.log.info("CSV export completed", {
        rulesCount: rules.length,
        containersCount: containers.length,
        csvLength: csv.length,
      })

      return { success: true, data: { csv } }
    } catch (error) {
      this.log.error("Failed to export CSV", error)
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to export CSV",
      }
    }
  }

  /**
   * Import rules from CSV format
   */
  private async importCSV(message: Message): Promise<MessageResponse> {
    try {
      const { csvContent, createMissingContainers } = (message.payload ||
        {}) as {
        csvContent: string
        createMissingContainers?: boolean
      }

      if (!csvContent || typeof csvContent !== "string") {
        return { success: false, error: "CSV content is required" }
      }

      const containers = await storageService.getContainers()
      const result = parseCSV(csvContent, containers)

      // Create missing containers if requested
      if (createMissingContainers && result.missingContainers.length > 0) {
        this.log.info("Creating missing containers", {
          containers: result.missingContainers,
        })

        for (const containerName of result.missingContainers) {
          try {
            const created = await containerManager.create({
              name: containerName,
            })

            // Update rules to use the new container
            result.rules
              .filter((r) => r.ruleType !== "exclude")
              .forEach((r) => {
                if (!r.containerId) {
                  r.containerId = created.cookieStoreId
                }
              })

            this.log.debug("Created missing container", {
              name: containerName,
              cookieStoreId: created.cookieStoreId,
            })
          } catch (error) {
            this.log.warn("Failed to create missing container", {
              containerName,
              error,
            })
          }
        }
      }

      // Import valid rules
      let importedCount = 0
      for (const rule of result.rules) {
        try {
          await rulesEngine.addRule(rule)
          importedCount++
        } catch (error) {
          this.log.warn("Failed to import rule", { rule, error })
        }
      }

      this.log.info("CSV import completed", {
        totalRules: result.rules.length,
        importedRules: importedCount,
        errors: result.errors.length,
        missingContainers: result.missingContainers.length,
        createdContainers: createMissingContainers
          ? result.missingContainers.length
          : 0,
      })

      return { success: true, data: result }
    } catch (error) {
      this.log.error("Failed to import CSV", error)
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to import CSV",
      }
    }
  }

  /**
   * Generate a CSV template for import
   */
  private async generateCSVTemplate(): Promise<MessageResponse> {
    try {
      const template = generateCSVTemplate()
      this.log.debug("CSV template generated")
      return { success: true, data: { template } }
    } catch (error) {
      this.log.error("Failed to generate CSV template", error)
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to generate CSV template",
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
