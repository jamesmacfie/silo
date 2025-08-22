import { MESSAGE_TYPES } from "@/shared/constants"
import type { CreateRuleRequest, Rule } from "@/shared/types"
import { logger } from "@/shared/utils/logger"
import type { Message, MessageResponse } from "@/shared/utils/messaging"
import type { MessageHandler } from "../MessageRouter"
import containerManager from "../services/ContainerManager"
import rulesEngine from "../services/RulesEngine"
import storageService from "../services/StorageService"

/**
 * Handles container template operations
 */
export class TemplateHandler implements MessageHandler {
  private log = logger.withContext("TemplateHandler")

  private readonly handledTypes = [
    MESSAGE_TYPES.GET_TEMPLATES,
    MESSAGE_TYPES.SAVE_TEMPLATE,
    MESSAGE_TYPES.DELETE_TEMPLATE,
    MESSAGE_TYPES.APPLY_TEMPLATE,
    MESSAGE_TYPES.EXPORT_CONTAINER,
    MESSAGE_TYPES.IMPORT_CONTAINER,
  ]

  canHandle(type: string): boolean {
    return this.handledTypes.includes(
      type as (typeof this.handledTypes)[number],
    )
  }

  async handle(message: Message): Promise<MessageResponse> {
    switch (message.type) {
      case MESSAGE_TYPES.GET_TEMPLATES:
        return this.getTemplates()

      case MESSAGE_TYPES.SAVE_TEMPLATE:
        return this.saveTemplate(message)

      case MESSAGE_TYPES.DELETE_TEMPLATE:
        return this.deleteTemplate(message)

      case MESSAGE_TYPES.APPLY_TEMPLATE:
        return this.applyTemplate(message)

      case MESSAGE_TYPES.EXPORT_CONTAINER:
        return this.exportContainer(message)

      case MESSAGE_TYPES.IMPORT_CONTAINER:
        return this.importContainer(message)

      default:
        return {
          success: false,
          error: `TemplateHandler cannot handle message type: ${message.type}`,
        }
    }
  }

  /**
   * Get all container templates
   */
  private async getTemplates(): Promise<MessageResponse> {
    try {
      const templates = await storageService.getTemplates()
      this.log.debug("Retrieved templates", { count: templates.length })
      return { success: true, data: templates }
    } catch (error) {
      this.log.error("Failed to get templates", error)
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to get templates",
      }
    }
  }

  /**
   * Save a container template
   */
  private async saveTemplate(message: Message): Promise<MessageResponse> {
    try {
      const template =
        message.payload as import("@/shared/types").ContainerTemplate

      if (!template || !template.name) {
        return { success: false, error: "Template with name is required" }
      }

      await storageService.saveTemplate(template)
      this.log.info("Template saved", { name: template.name })
      return { success: true }
    } catch (error) {
      this.log.error("Failed to save template", error)
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to save template",
      }
    }
  }

  /**
   * Delete a container template
   */
  private async deleteTemplate(message: Message): Promise<MessageResponse> {
    try {
      const { name } = (message.payload || {}) as { name: string }

      if (!name || typeof name !== "string") {
        return { success: false, error: "Template name is required" }
      }

      await storageService.deleteTemplate(name)
      this.log.info("Template deleted", { name })
      return { success: true }
    } catch (error) {
      this.log.error("Failed to delete template", error)
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to delete template",
      }
    }
  }

  /**
   * Apply a template to create a new container
   */
  private async applyTemplate(message: Message): Promise<MessageResponse> {
    try {
      const { name } = (message.payload || {}) as { name: string }

      if (!name || typeof name !== "string") {
        return { success: false, error: "Template name is required" }
      }

      const templates = await storageService.getTemplates()
      const template = templates.find((t) => t.name === name)

      if (!template) {
        return { success: false, error: "Template not found" }
      }

      // Create container from template
      const created = await containerManager.create({
        name: template.name,
        color: template.color,
        icon: template.icon,
        metadata: template.metadata,
      })

      // Create starter rules if defined
      const starterRules = (template.starterRules || []) as Array<
        Partial<Rule> & Pick<Rule, "pattern" | "matchType" | "ruleType">
      >

      for (const ruleTemplate of starterRules) {
        try {
          await rulesEngine.addRule({
            ...ruleTemplate,
            containerId: created.cookieStoreId,
          } as CreateRuleRequest)
        } catch (error) {
          this.log.warn("Failed to create starter rule", {
            ruleTemplate,
            error,
          })
          // Continue with other rules if one fails
        }
      }

      this.log.info("Template applied", {
        templateName: name,
        containerName: created.name,
        cookieStoreId: created.cookieStoreId,
        starterRulesCount: starterRules.length,
      })

      return { success: true, data: created }
    } catch (error) {
      this.log.error("Failed to apply template", error)
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to apply template",
      }
    }
  }

  /**
   * Export a container with its rules
   */
  private async exportContainer(message: Message): Promise<MessageResponse> {
    try {
      const { cookieStoreId } = (message.payload || {}) as {
        cookieStoreId: string
      }

      if (!cookieStoreId) {
        return { success: false, error: "Container cookieStoreId is required" }
      }

      const containers = await storageService.getContainers()
      const container = containers.find(
        (c) => c.cookieStoreId === cookieStoreId,
      )

      if (!container) {
        return { success: false, error: "Container not found" }
      }

      const rules = (await storageService.getRules()).filter(
        (r) => r.containerId === cookieStoreId,
      )

      this.log.info("Container exported", {
        containerName: container.name,
        cookieStoreId,
        rulesCount: rules.length,
      })

      return { success: true, data: { container, rules } }
    } catch (error) {
      this.log.error("Failed to export container", error)
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to export container",
      }
    }
  }

  /**
   * Import a container with its rules
   */
  private async importContainer(message: Message): Promise<MessageResponse> {
    try {
      const { data: importData, mode } = (message.payload || {}) as {
        data: {
          container: import("@/shared/types").Container
          rules: import("@/shared/types").Rule[]
        }
        mode?: "merge" | "replace" | "skip"
      }

      if (!importData || !importData.container) {
        return { success: false, error: "Invalid import data" }
      }

      const incoming = importData.container
      const existingContainers = await storageService.getContainers()
      let target = existingContainers.find((c) => c.name === incoming.name)

      // Create or update container
      if (!target) {
        target = await containerManager.create({
          name: incoming.name,
          color: incoming.color,
          icon: incoming.icon,
          metadata: incoming.metadata,
        })
      } else if (mode !== "skip") {
        await containerManager.update(target.id, {
          name: incoming.name,
          color: incoming.color,
          icon: incoming.icon,
          metadata: incoming.metadata,
        })

        // Reload to get updated container
        const updated = (await storageService.getContainers()).find(
          (c) => c.name === incoming.name,
        )
        if (updated) {
          target = updated
        }
      }

      // Import rules
      const currentRules = await storageService.getRules()
      const mappedRules = (
        Array.isArray(importData.rules) ? importData.rules : []
      ).map((r: import("@/shared/types").Rule) => ({
        ...r,
        id: `rule_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        containerId:
          r.ruleType === "exclude" ? undefined : target.cookieStoreId,
        created: Date.now(),
        modified: Date.now(),
      }))

      // Merge rules (avoid duplicates)
      const dupKey = (r: import("@/shared/types").Rule) =>
        `${r.pattern}||${r.matchType}||${r.ruleType}||${r.containerId || ""}`

      const existingKeys = new Set(currentRules.map(dupKey))
      const merged = [...currentRules]

      for (const rule of mappedRules) {
        if (!existingKeys.has(dupKey(rule))) {
          merged.push(rule)
          existingKeys.add(dupKey(rule))
        }
      }

      await storageService.setRules(merged)

      this.log.info("Container imported", {
        containerName: incoming.name,
        cookieStoreId: target.cookieStoreId,
        rulesCount: mappedRules.length,
        mode: mode || "merge",
      })

      return { success: true, data: { cookieStoreId: target.cookieStoreId } }
    } catch (error) {
      this.log.error("Failed to import container", error)
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to import container",
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
