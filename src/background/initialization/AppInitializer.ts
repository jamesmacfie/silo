import { logger } from "@/shared/utils/logger"
import bookmarkIntegration from "../services/BookmarkIntegration"
import containerManager from "../services/ContainerManager"
import requestInterceptor from "../services/RequestInterceptor"
import storageService from "../services/StorageService"

/**
 * Handles the complete application initialization sequence
 */
export class AppInitializer {
  private log = logger.withContext("AppInitializer")

  /**
   * Initialize the complete application
   */
  async initialize(): Promise<void> {
    this.log.info("Starting application initialization")

    await this.migrateStorage()
    await this.syncContainers()
    await this.registerInterceptor()
    await this.syncBookmarks()

    this.log.info("Application initialization complete")
  }

  /**
   * Test storage and run any necessary migrations
   */
  private async migrateStorage(): Promise<void> {
    this.log.debug("Initializing storage")

    try {
      // Test if we can load rules (basic connectivity test)
      await storageService.getRules()
    } catch (_error) {
      // Ignore test errors, migration will handle issues
    }

    try {
      await storageService.migrate()
      this.log.info("Storage migration completed successfully")
    } catch (error: unknown) {
      this.log.error("Storage initialization failed", error)
      // Continue with initialization even if migration fails
      // Individual operations will handle storage errors
    }
  }

  /**
   * Synchronize containers with Firefox's contextual identities
   */
  private async syncContainers(): Promise<void> {
    this.log.debug("Synchronizing containers with Firefox")

    try {
      await containerManager.syncWithFirefox()
      this.log.info("Container synchronization completed")
    } catch (error: unknown) {
      this.log.warn("Container sync failed (continuing)", error)
      // Not critical - continue initialization
      // Individual container operations will handle failures
    }
  }

  /**
   * Register the request interceptor for URL processing
   */
  private async registerInterceptor(): Promise<void> {
    this.log.debug("Registering request interceptor")

    try {
      await requestInterceptor.register()
      this.log.info("Request interceptor registered successfully")
    } catch (error: unknown) {
      this.log.error("Failed to register request interceptor", error)
      // This is more critical but don't fail initialization
      // Extension can still work manually
    }
  }

  /**
   * Sync existing bookmarks that include container hints
   */
  private async syncBookmarks(): Promise<void> {
    this.log.debug("Syncing bookmark associations")

    try {
      // Best-effort sync of existing bookmarks that include container hints
      await bookmarkIntegration.syncBookmarks()
      this.log.info("Bookmark synchronization completed")
    } catch (error: unknown) {
      this.log.warn("Failed to sync bookmark associations (continuing)", error)
      // Not critical - bookmarks will work without pre-sync
    }
  }
}
