import { MESSAGE_TYPES } from "@/shared/constants"
import type { CreateRuleRequest, Rule } from "@/shared/types"
import { logger } from "@/shared/utils/logger"
import type { Message, MessageResponse } from "@/shared/utils/messaging"
import type { MessageHandler } from "../MessageRouter"
import rulesEngine from "../services/RulesEngine"
import storageService from "../services/StorageService"

/**
 * Handles all rule-related operations
 */
export class RuleHandler implements MessageHandler {
  private log = logger.withContext("RuleHandler")

  private readonly handledTypes = [
    MESSAGE_TYPES.GET_RULES,
    MESSAGE_TYPES.CREATE_RULE,
    MESSAGE_TYPES.UPDATE_RULE,
    MESSAGE_TYPES.DELETE_RULE,
    MESSAGE_TYPES.EVALUATE_URL,
  ]

  canHandle(type: string): boolean {
    return this.handledTypes.includes(
      type as (typeof this.handledTypes)[number],
    )
  }

  async handle(message: Message): Promise<MessageResponse> {
    switch (message.type) {
      case MESSAGE_TYPES.GET_RULES:
        return this.getRules()

      case MESSAGE_TYPES.CREATE_RULE:
        return this.createRule(message)

      case MESSAGE_TYPES.UPDATE_RULE:
        return this.updateRule(message)

      case MESSAGE_TYPES.DELETE_RULE:
        return this.deleteRule(message)

      case MESSAGE_TYPES.EVALUATE_URL:
        return this.evaluateUrl(message)

      default:
        return {
          success: false,
          error: `RuleHandler cannot handle message type: ${message.type}`,
        }
    }
  }

  /**
   * Get all rules
   */
  private async getRules(): Promise<MessageResponse> {
    try {
      const rules = await storageService.getRules()
      this.log.debug("Retrieved rules", { count: rules.length })
      return { success: true, data: rules }
    } catch (error) {
      this.log.error("Failed to get rules", error)
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to get rules",
      }
    }
  }

  /**
   * Create a new rule
   */
  private async createRule(message: Message): Promise<MessageResponse> {
    try {
      const request = message.payload as CreateRuleRequest

      if (
        !request ||
        !request.pattern ||
        !request.matchType ||
        !request.ruleType
      ) {
        return {
          success: false,
          error: "Pattern, matchType, and ruleType are required",
        }
      }

      const rule = await rulesEngine.addRule(request)
      this.log.info("Rule created", {
        id: rule.id,
        pattern: rule.pattern,
        matchType: rule.matchType,
        ruleType: rule.ruleType,
      })

      return { success: true, data: rule }
    } catch (error) {
      this.log.error("Failed to create rule", error)
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to create rule",
      }
    }
  }

  /**
   * Update an existing rule
   */
  private async updateRule(message: Message): Promise<MessageResponse> {
    try {
      const { id, updates } = (message.payload || {}) as {
        id: string
        updates: Partial<Rule>
      }

      if (!id) {
        return { success: false, error: "Rule ID is required" }
      }

      if (!updates || Object.keys(updates).length === 0) {
        return { success: false, error: "Updates are required" }
      }

      await rulesEngine.updateRule(id, updates)

      this.log.info("Rule updated", {
        id,
        updates: Object.keys(updates),
      })

      return { success: true }
    } catch (error) {
      this.log.error("Failed to update rule", error)
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to update rule",
      }
    }
  }

  /**
   * Delete a rule
   */
  private async deleteRule(message: Message): Promise<MessageResponse> {
    try {
      const { id } = (message.payload || {}) as { id: string }

      if (!id) {
        return { success: false, error: "Rule ID is required" }
      }

      await rulesEngine.removeRule(id)
      this.log.info("Rule deleted", { id })
      return { success: true }
    } catch (error) {
      this.log.error("Failed to delete rule", error)
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to delete rule",
      }
    }
  }

  /**
   * Evaluate a URL against all rules
   */
  private async evaluateUrl(message: Message): Promise<MessageResponse> {
    try {
      const { url, currentContainer } = (message.payload || {}) as {
        url: string
        currentContainer?: string
      }

      if (!url) {
        return { success: false, error: "URL is required for evaluation" }
      }

      const result = await rulesEngine.evaluate(url, currentContainer)

      this.log.debug("URL evaluated", {
        url: url.substring(0, 100), // Limit URL length in logs
        currentContainer,
        result: result
          ? {
              containerId: result.containerId,
              ruleType: result.rule?.ruleType,
              pattern: result.rule?.pattern,
            }
          : null,
      })

      return { success: true, data: result }
    } catch (error) {
      this.log.error("Failed to evaluate URL", error)
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to evaluate URL",
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
