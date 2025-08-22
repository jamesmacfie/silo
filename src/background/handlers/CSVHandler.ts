import { MESSAGE_TYPES } from "@/shared/constants"
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
   * Get the list of message types this handler can process
   */
  getHandledTypes(): string[] {
    return [...this.handledTypes]
  }
}
