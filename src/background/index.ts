import browser from "webextension-polyfill"
import { logger } from "@/shared/utils/logger"
import type { Message } from "@/shared/utils/messaging"
// Import all message handlers
import { BackupHandler } from "./handlers/BackupHandler"
import { BookmarkHandler } from "./handlers/BookmarkHandler"
import { CategoryHandler } from "./handlers/CategoryHandler"
import { ContainerHandler } from "./handlers/ContainerHandler"
import { CSVHandler } from "./handlers/CSVHandler"
import { PreferenceHandler } from "./handlers/PreferenceHandler"
import { RuleHandler } from "./handlers/RuleHandler"
import { StatsHandler } from "./handlers/StatsHandler"
import { SyncHandler } from "./handlers/SyncHandler"
import { SystemHandler } from "./handlers/SystemHandler"
import { TemplateHandler } from "./handlers/TemplateHandler"
// Import our new architecture components
import { AppInitializer } from "./initialization/AppInitializer"
import { TabEventListener } from "./listeners/TabEventListener"
import { MessageRouter } from "./MessageRouter"

/**
 * Main background script orchestrator
 * Wires together all components of the new modular architecture
 */

// Initialize core components
const initializer = new AppInitializer()
const router = new MessageRouter()
const tabListener = new TabEventListener()
const log = logger.withContext("BackgroundScript")

// Register all message handlers
function registerHandlers(): void {
  log.info("Registering message handlers")

  // Register handlers in logical order
  router.register(new SystemHandler()) // PING, logging, testing
  router.register(new PreferenceHandler()) // Settings
  router.register(new ContainerHandler()) // Container operations
  router.register(new RuleHandler()) // Rule management
  router.register(new StatsHandler()) // Statistics
  router.register(new BookmarkHandler()) // Bookmark operations (largest)
  router.register(new BackupHandler()) // Backup/restore
  router.register(new CSVHandler()) // CSV import/export
  router.register(new TemplateHandler()) // Container templates
  router.register(new CategoryHandler()) // Categories
  router.register(new SyncHandler()) // Sync operations (not implemented)

  const handlerNames = router.getRegisteredHandlers()
  log.info("Message handlers registered", {
    count: handlerNames.length,
    handlers: handlerNames,
  })
}

// Initialize the extension
async function initializeExtension(): Promise<void> {
  log.info("Starting extension initialization")

  try {
    // Register tab event listeners for statistics
    tabListener.register()

    // Initialize application services
    await initializer.initialize()

    log.info("Extension initialization completed successfully")
  } catch (error) {
    log.error("Extension initialization failed", error)
    // Continue running even if initialization fails partially
    // Individual operations will handle their own errors
  }
}

// Register handlers immediately when script loads
log.info("Registering message handlers immediately")
registerHandlers()

// Handle incoming messages through the router
browser.runtime.onMessage.addListener(async (message: Message) => {
  log.debug("Processing message", { type: message?.type })

  try {
    const response = await router.route(message)
    return response
  } catch (error) {
    log.error("Message routing failed", {
      type: message?.type,
      error,
    })

    // Return error response to prevent hanging requests
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Message processing failed",
    }
  }
})

// Handle extension lifecycle events
browser.runtime.onInstalled.addListener(async (details) => {
  log.info("Extension installed/updated", {
    reason: details.reason,
    version: browser.runtime.getManifest().version,
  })

  await initializeExtension()
})

// Handle browser startup (if supported)
if (browser.runtime.onStartup) {
  browser.runtime.onStartup.addListener(async () => {
    log.info("Browser startup detected")
    await initializeExtension()
  })
} else {
  // Fallback for environments without onStartup (like development)
  log.info("Browser onStartup not supported, initializing immediately")
  initializeExtension()
}

// Export for debugging/testing (if needed)
declare const process: { env: { NODE_ENV?: string } }
if (typeof process !== "undefined" && process.env?.NODE_ENV === "development") {
  // @ts-expect-error - Expose for debugging
  globalThis.siloBackground = {
    router,
    initializer,
    tabListener,
    getHandlers: () => router.getRegisteredHandlers(),
  }
}
