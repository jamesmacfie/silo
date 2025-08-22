import { logger } from "@/shared/utils/logger"
import type { Message, MessageResponse } from "@/shared/utils/messaging"

/**
 * Interface for message handlers that process specific message types
 */
export interface MessageHandler {
  /**
   * Check if this handler can process the given message type
   */
  canHandle(type: string): boolean

  /**
   * Handle the message and return a response
   */
  handle(message: Message): Promise<MessageResponse>
}

/**
 * Central message router that delegates messages to appropriate handlers
 */
export class MessageRouter {
  private handlers: MessageHandler[] = []
  private log = logger.withContext("MessageRouter")

  /**
   * Register a new message handler
   */
  register(handler: MessageHandler): void {
    this.handlers.push(handler)
    this.log.debug("Registered handler", {
      handlerName: handler.constructor.name,
    })
  }

  /**
   * Route a message to the appropriate handler
   */
  async route(message: Message): Promise<MessageResponse> {
    this.log.debug("Routing message", { type: message?.type })

    if (!message?.type) {
      return {
        success: false,
        error: "Invalid message: missing type",
      }
    }

    // Find the first handler that can process this message type
    const handler = this.handlers.find((h) => h.canHandle(message.type))

    if (!handler) {
      this.log.warn("No handler found for message type", {
        type: message.type,
      })
      return {
        success: false,
        error: `Unknown message type: ${message.type}`,
      }
    }

    try {
      const response = await handler.handle(message)

      if (!response.success && response.error) {
        this.log.warn("Handler returned error", {
          type: message.type,
          error: response.error,
        })
      }

      return response
    } catch (error) {
      this.log.error("Handler threw error", {
        type: message.type,
        handler: handler.constructor.name,
        error,
      })

      const errorMessage =
        error instanceof Error ? error.message : String(error)

      return {
        success: false,
        error: errorMessage,
      }
    }
  }

  /**
   * Get a list of all registered handlers (useful for debugging)
   */
  getRegisteredHandlers(): string[] {
    return this.handlers.map((h) => h.constructor.name)
  }

  /**
   * Get all message types that can be handled (useful for debugging)
   */
  getHandledMessageTypes(): string[] {
    // This would require handlers to expose their handled types
    // For now, return empty array
    return []
  }
}
