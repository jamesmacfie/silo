import { logger } from "@/shared/utils/logger"
import type { Message, MessageResponse } from "@/shared/utils/messaging"
import type { MessageHandler } from "../MessageRouter"
import rulesEngine from "../services/RulesEngine"
import * as matcher from "../utils/matcher"

/**
 * Handles system-level messages like PING, logging, and testing
 */
export class SystemHandler implements MessageHandler {
  private log = logger.withContext("SystemHandler")

  private readonly handledTypes = [
    "PING",
    "LOG",
    "TEST_INTERCEPTOR",
    "TEST_PATTERN",
  ]

  canHandle(type: string): boolean {
    return this.handledTypes.includes(type)
  }

  async handle(message: Message): Promise<MessageResponse> {
    switch (message.type) {
      case "PING":
        return this.handlePing()

      case "LOG":
        return this.handleLog(message)

      case "TEST_INTERCEPTOR":
        return this.handleTestInterceptor(message)

      case "TEST_PATTERN":
        return this.handleTestPattern(message)

      default:
        return {
          success: false,
          error: `SystemHandler cannot handle message type: ${message.type}`,
        }
    }
  }

  /**
   * Handle PING messages for connectivity testing
   */
  private handlePing(): MessageResponse {
    this.log.debug("Received PING")
    return { success: true, data: "PONG" }
  }

  /**
   * Handle LOG messages from client-side code
   */
  private handleLog(message: Message): MessageResponse {
    const logData = message.payload
    this.log.info("Client log", logData)
    return { success: true }
  }

  /**
   * Handle TEST_INTERCEPTOR messages for testing URL evaluation
   */
  private async handleTestInterceptor(
    message: Message,
  ): Promise<MessageResponse> {
    const { url } = (message.payload || {}) as { url: string }

    if (!url) {
      return {
        success: false,
        error: "URL is required for interceptor testing",
      }
    }

    try {
      const evaluation = await rulesEngine.evaluate(url)
      this.log.debug("Interceptor test completed", {
        url: url.substring(0, 100), // Limit URL length in logs
        evaluation,
      })
      return { success: true, data: evaluation }
    } catch (error) {
      this.log.error("Interceptor test failed", { url, error })
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  }

  /**
   * Handle TEST_PATTERN messages for testing pattern matching
   */
  private async handleTestPattern(message: Message): Promise<MessageResponse> {
    const { url, pattern, matchType } = (message.payload || {}) as {
      url: string
      pattern: string
      matchType: import("@/shared/types").MatchType
    }

    if (!url || !pattern || !matchType) {
      return {
        success: false,
        error: "URL, pattern, and matchType are required for pattern testing",
      }
    }

    try {
      const matches = matcher.match(url, pattern, matchType)
      this.log.debug("Pattern test completed", {
        url: url.substring(0, 100), // Limit URL length in logs
        pattern,
        matchType,
        matches,
      })
      return { success: true, data: { matches } }
    } catch (error) {
      this.log.error("Pattern test failed", { url, pattern, matchType, error })
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
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
