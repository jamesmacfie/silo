import browser from "webextension-polyfill"
import { MESSAGE_TYPES } from "@/shared/constants"
import type {
  BackupData,
  CreateContainerRequest,
  CreateRuleRequest,
  Rule,
} from "@/shared/types"
import {
  type CSVExportOptions,
  exportToCSV,
  generateCSVTemplate,
  parseCSV,
} from "@/shared/utils/csv"
import { logger } from "@/shared/utils/logger"
import type { Message } from "@/shared/utils/messaging"
import bookmarkIntegration from "./services/BookmarkIntegration"
import bookmarkService from "./services/BookmarkService"
import containerManager from "./services/ContainerManager"
import requestInterceptor from "./services/RequestInterceptor"
import rulesEngine from "./services/RulesEngine"
import statsService from "./services/StatsService"
import storageService from "./services/StorageService"
import tagService from "./services/TagService"
import * as matcher from "./utils/matcher"

async function initialize(): Promise<void> {
  // Test if we can load rules
  try {
    const _rules = await storageService.getRules()
  } catch (_error) {}

  try {
    await storageService.migrate()
  } catch (error: unknown) {
    logger.error("Storage initialization failed", error)
  }

  try {
    await containerManager.syncWithFirefox()
  } catch (error: unknown) {
    logger.warn("Container sync failed (continuing)", error)
  }

  try {
    await requestInterceptor.register()
  } catch (error: unknown) {
    logger.error("Failed to register request interceptor", error)
  }

  try {
    // Best-effort sync of existing bookmarks that include container hints
    await bookmarkIntegration.syncBookmarks()
  } catch (error: unknown) {
    logger.warn("Failed to sync bookmark associations (continuing)", error)
  }
}

// Tab event listeners for stats tracking
// Keep track of tab containers for cleanup
const tabContainerMap = new Map<number, string>()

browser.tabs.onCreated.addListener(async (tab) => {
  if (tab.cookieStoreId && tab.cookieStoreId !== "firefox-default" && tab.id) {
    try {
      // Track for cleanup
      tabContainerMap.set(tab.id, tab.cookieStoreId)

      // Record stats
      await statsService.recordEvent(tab.cookieStoreId, "tab-created", {
        tabId: tab.id,
        url: tab.url?.split("?")[0], // Remove query params for privacy
      })
      await statsService.trackTabSession(tab.cookieStoreId, tab.id, "start")
    } catch (error) {
      logger.error("Failed to record tab created event", error)
    }
  }
})

browser.tabs.onRemoved.addListener(async (tabId, removeInfo) => {
  try {
    const cookieStoreId = tabContainerMap.get(tabId)
    if (cookieStoreId) {
      await statsService.recordEvent(cookieStoreId, "tab-closed", {
        tabId,
        windowClosing: removeInfo.isWindowClosing,
      })
      await statsService.trackTabSession(cookieStoreId, tabId, "end")
      tabContainerMap.delete(tabId)
    }
  } catch (error) {
    logger.error("Failed to record tab removed event", error)
  }
})

browser.tabs.onActivated.addListener(async (activeInfo) => {
  try {
    const tab = await browser.tabs.get(activeInfo.tabId)
    if (tab.cookieStoreId && tab.cookieStoreId !== "firefox-default") {
      await statsService.recordEvent(tab.cookieStoreId, "tab-activated", {
        tabId: tab.id,
        previousTabId: activeInfo.previousTabId,
      })
    }
  } catch (error) {
    logger.error("Failed to record tab activated event", error)
  }
})

browser.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (
    changeInfo.url &&
    tab.cookieStoreId &&
    tab.cookieStoreId !== "firefox-default"
  ) {
    try {
      const domain = new URL(changeInfo.url).hostname
      await statsService.recordEvent(tab.cookieStoreId, "navigation", {
        tabId,
        domain,
        url: changeInfo.url.split("?")[0], // Remove query params for privacy
      })
    } catch (error) {
      logger.error("Failed to record navigation event", error)
    }
  }
})

browser.runtime.onInstalled.addListener((_details) => {
  logger.info("Extension installed/updated")
  initialize()
})

if (browser.runtime.onStartup) {
  browser.runtime.onStartup.addListener(() => {
    logger.info("Extension startup")
    initialize()
  })
} else {
  // Fallback for environments without onStartup
  initialize()
}

browser.runtime.onMessage.addListener(async (message: Message) => {
  logger.debug("Received message", { type: message?.type })

  try {
    switch (message?.type) {
      case "PING": {
        return { success: true, data: "PONG" }
      }

      case "TEST_INTERCEPTOR": {
        const { url } = (message.payload || {}) as { url: string }

        try {
          const evaluation = await rulesEngine.evaluate(url)
          return { success: true, data: evaluation }
        } catch (error) {
          return { success: false, error: String(error) }
        }
      }

      // Containers
      case MESSAGE_TYPES.GET_CONTAINERS: {
        const containers = await storageService.getContainers()
        return { success: true, data: containers }
      }
      case MESSAGE_TYPES.CREATE_CONTAINER: {
        const container = await containerManager.create(
          message.payload as CreateContainerRequest,
        )
        return { success: true, data: container }
      }
      case MESSAGE_TYPES.UPDATE_CONTAINER: {
        const { id, updates } = (message.payload || {}) as {
          id: string
          updates: Partial<browser.ContextualIdentities.ContextualIdentity> &
            Record<string, unknown>
        }
        await containerManager.update(
          id,
          updates as Partial<browser.ContextualIdentities.ContextualIdentity>,
        )
        return { success: true }
      }
      case MESSAGE_TYPES.DELETE_CONTAINER: {
        await containerManager.delete((message.payload as { id: string }).id)
        return { success: true }
      }
      case MESSAGE_TYPES.SYNC_CONTAINERS: {
        await containerManager.syncWithFirefox()
        return { success: true }
      }
      case MESSAGE_TYPES.CLEAR_CONTAINER_COOKIES: {
        await containerManager.clearContainerCookies(
          (message.payload as { id: string }).id,
        )
        return { success: true }
      }

      case MESSAGE_TYPES.OPEN_IN_CONTAINER: {
        const { url, cookieStoreId, index, closeTabId } = (message.payload ||
          {}) as {
          url: string
          cookieStoreId?: string
          index?: number
          closeTabId?: number
        }
        const newTab = await browser.tabs.create({
          url,
          active: true,
          index,
          ...(cookieStoreId ? { cookieStoreId } : {}),
        })
        if (closeTabId) {
          try {
            await browser.tabs.remove(closeTabId)
          } catch (e) {
            logger.warn("Failed to close source tab", { closeTabId, e })
          }
        }
        return { success: true, data: { tabId: newTab.id } }
      }

      // Rules
      case MESSAGE_TYPES.GET_RULES: {
        const rules = await storageService.getRules()
        return { success: true, data: rules }
      }
      case MESSAGE_TYPES.CREATE_RULE: {
        const rule = await rulesEngine.addRule(
          message.payload as CreateRuleRequest,
        )
        return { success: true, data: rule }
      }
      case MESSAGE_TYPES.UPDATE_RULE: {
        const { id, updates } = (message.payload || {}) as {
          id: string
          updates: Partial<Rule>
        }
        await rulesEngine.updateRule(id, updates)
        return { success: true }
      }
      case MESSAGE_TYPES.DELETE_RULE: {
        await rulesEngine.removeRule((message.payload as { id: string }).id)
        return { success: true }
      }
      case MESSAGE_TYPES.EVALUATE_URL: {
        const { url, currentContainer } = (message.payload || {}) as {
          url: string
          currentContainer?: string
        }
        const result = await rulesEngine.evaluate(url, currentContainer)
        return { success: true, data: result }
      }

      case MESSAGE_TYPES.TEST_PATTERN: {
        const { url, pattern, matchType } = (message.payload || {}) as {
          url: string
          pattern: string
          matchType: import("@/shared/types").MatchType
        }
        const ok = matcher.match(url, pattern, matchType)
        return { success: true, data: { matches: ok } }
      }

      // Preferences
      case MESSAGE_TYPES.GET_PREFERENCES: {
        const prefs = await storageService.getPreferences()
        return { success: true, data: prefs }
      }
      case MESSAGE_TYPES.UPDATE_PREFERENCES: {
        await storageService.updatePreferences(message.payload)
        return { success: true }
      }

      // Backup/Restore
      case MESSAGE_TYPES.BACKUP_DATA: {
        const backup = await storageService.backup()
        return { success: true, data: backup }
      }
      case MESSAGE_TYPES.RESTORE_DATA: {
        await storageService.restore(message.payload as BackupData)
        return { success: true }
      }

      // Sync (not implemented yet)
      case MESSAGE_TYPES.SYNC_PUSH:
      case MESSAGE_TYPES.SYNC_PULL:
      case MESSAGE_TYPES.GET_SYNC_STATE: {
        return { success: false, error: "Sync not implemented" }
      }

      // Logging passthrough
      case MESSAGE_TYPES.LOG: {
        logger.info("Client log", message.payload)
        return { success: true }
      }

      // Bookmarks
      case MESSAGE_TYPES.GET_BOOKMARK_ASSOCIATIONS: {
        const list = await storageService.getBookmarkAssociations()
        return { success: true, data: list }
      }
      case MESSAGE_TYPES.ADD_BOOKMARK_ASSOCIATION: {
        const { bookmarkId, containerId, url, autoOpen } = (message.payload ||
          {}) as {
          bookmarkId: string
          containerId: string
          url: string
          autoOpen?: boolean
        }
        await storageService.addBookmarkAssociation({
          bookmarkId,
          containerId,
          url,
          autoOpen: !!autoOpen,
          created: Date.now(),
        })
        return { success: true }
      }
      case MESSAGE_TYPES.REMOVE_BOOKMARK_ASSOCIATION: {
        await storageService.removeBookmarkAssociation(
          (message.payload as { bookmarkId: string }).bookmarkId,
        )
        return { success: true }
      }
      case MESSAGE_TYPES.PROCESS_BOOKMARK_URL: {
        const { url } = (message.payload || {}) as { url: string }
        const result = await bookmarkIntegration.processBookmarkUrl(url)
        return { success: true, data: result }
      }

      // Categories
      case MESSAGE_TYPES.GET_CATEGORIES: {
        const cats = await storageService.getCategories()
        return { success: true, data: cats }
      }
      case MESSAGE_TYPES.ADD_CATEGORY: {
        await storageService.addCategory(
          (message.payload as { name: string }).name,
        )
        return { success: true }
      }
      case MESSAGE_TYPES.RENAME_CATEGORY: {
        const { oldName, newName } = (message.payload || {}) as {
          oldName: string
          newName: string
        }
        await storageService.renameCategory(oldName, newName)
        return { success: true }
      }
      case MESSAGE_TYPES.DELETE_CATEGORY: {
        await storageService.deleteCategory(
          (message.payload as { name: string }).name,
        )
        return { success: true }
      }

      // Stats
      case MESSAGE_TYPES.GET_STATS: {
        const stats = await storageService.getStats()
        return { success: true, data: stats }
      }
      case MESSAGE_TYPES.RESET_STATS: {
        await statsService.resetStats()
        return { success: true }
      }
      case MESSAGE_TYPES.GET_GLOBAL_STATS: {
        const globalStats = await statsService.getGlobalStats()
        return { success: true, data: globalStats }
      }
      case MESSAGE_TYPES.GET_DAILY_STATS: {
        const { days } = (message.payload || {}) as { days?: number }
        const dailyStats = await statsService.getDailyStats(days)
        return { success: true, data: dailyStats }
      }
      case MESSAGE_TYPES.GET_ACTIVE_TABS: {
        const activeTabs = await statsService.getCurrentActiveTabs()
        return { success: true, data: activeTabs }
      }
      case MESSAGE_TYPES.GET_RECENT_ACTIVITY: {
        const activity = await statsService.getRecentActivity()
        return { success: true, data: activity }
      }
      case MESSAGE_TYPES.GET_CONTAINER_TRENDS: {
        const { days } = (message.payload || {}) as { days?: number }
        const trends = await statsService.getContainerTrends(days)
        return { success: true, data: trends }
      }
      case MESSAGE_TYPES.RECORD_STAT_EVENT: {
        const { containerId, event, metadata } = (message.payload || {}) as {
          containerId: string
          event: string
          metadata?: Record<string, unknown>
        }
        await statsService.recordEvent(containerId, event as any, metadata)
        return { success: true }
      }

      // Templates
      case MESSAGE_TYPES.GET_TEMPLATES: {
        const templates = await storageService.getTemplates()
        return { success: true, data: templates }
      }
      case MESSAGE_TYPES.SAVE_TEMPLATE: {
        await storageService.saveTemplate(
          message.payload as import("@/shared/types").ContainerTemplate,
        )
        return { success: true }
      }
      case MESSAGE_TYPES.DELETE_TEMPLATE: {
        await storageService.deleteTemplate(
          (message.payload as { name: string }).name,
        )
        return { success: true }
      }
      case MESSAGE_TYPES.APPLY_TEMPLATE: {
        const { name } = (message.payload || {}) as { name: string }
        const templates = await storageService.getTemplates()
        const tmpl = templates.find((t) => t.name === name)
        if (!tmpl) {
          return { success: false, error: "Template not found" }
        }
        const created = await containerManager.create({
          name: tmpl.name,
          color: tmpl.color,
          icon: tmpl.icon,
          metadata: tmpl.metadata,
        })
        // Optional starter rules
        const starters = (tmpl.starterRules || []) as Array<
          Partial<Rule> & Pick<Rule, "pattern" | "matchType" | "ruleType">
        >
        for (const r of starters) {
          await rulesEngine.addRule({
            ...r,
            containerId: created.cookieStoreId,
          } as CreateRuleRequest)
        }
        return { success: true, data: created }
      }

      // Sharing a single container
      case MESSAGE_TYPES.EXPORT_CONTAINER: {
        const { cookieStoreId } = (message.payload || {}) as {
          cookieStoreId: string
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
        return { success: true, data: { container, rules } }
      }
      case MESSAGE_TYPES.IMPORT_CONTAINER: {
        const { data, mode } = (message.payload || {}) as {
          data: {
            container: import("@/shared/types").Container
            rules: import("@/shared/types").Rule[]
          }
          mode?: "merge" | "replace" | "skip"
        }
        if (!data || !data.container) {
          return { success: false, error: "Invalid import data" }
        }
        const incoming = data.container
        const existingContainers = await storageService.getContainers()
        let target = existingContainers.find((c) => c.name === incoming.name)
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
          const updated = (await storageService.getContainers()).find(
            (c) => c.name === incoming.name,
          )
          if (updated) {
            target = updated
          }
        }
        // Merge rules mapped to target cookieStoreId
        const currentRules = await storageService.getRules()
        const mapped = (Array.isArray(data.rules) ? data.rules : []).map(
          (r: import("@/shared/types").Rule) => ({
            ...r,
            id: `rule_${Date.now()}_${Math.random().toString(36).slice(2)}`,
            containerId:
              r.ruleType === "exclude" ? undefined : target.cookieStoreId,
            created: Date.now(),
            modified: Date.now(),
          }),
        )
        const dupKey = (r: import("@/shared/types").Rule) =>
          `${r.pattern}||${r.matchType}||${r.ruleType}||${r.containerId || ""}`
        const existingKeys = new Set(currentRules.map(dupKey))
        const merged = [...currentRules]
        for (const r of mapped) {
          if (!existingKeys.has(dupKey(r))) {
            merged.push(r)
            existingKeys.add(dupKey(r))
          }
        }
        await storageService.setRules(merged)
        return { success: true, data: { cookieStoreId: target.cookieStoreId } }
      }

      // CSV Import/Export
      case MESSAGE_TYPES.EXPORT_CSV: {
        const { options } = (message.payload || {}) as {
          options?: CSVExportOptions
        }
        const rules = await storageService.getRules()
        const containers = await storageService.getContainers()
        const csv = exportToCSV(rules, containers, options)
        return { success: true, data: { csv } }
      }
      case MESSAGE_TYPES.IMPORT_CSV: {
        const { csvContent, createMissingContainers } = (message.payload ||
          {}) as { csvContent: string; createMissingContainers?: boolean }
        const containers = await storageService.getContainers()
        const result = parseCSV(csvContent, containers)

        // Create missing containers if requested
        if (createMissingContainers && result.missingContainers.length > 0) {
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
            } catch (error) {
              logger.warn("Failed to create missing container", {
                containerName,
                error,
              })
            }
          }
        }

        // Import valid rules
        for (const rule of result.rules) {
          try {
            await rulesEngine.addRule(rule)
          } catch (error) {
            logger.warn("Failed to import rule", { rule, error })
          }
        }

        return { success: true, data: result }
      }
      case MESSAGE_TYPES.GENERATE_CSV_TEMPLATE: {
        const template = generateCSVTemplate()
        return { success: true, data: { template } }
      }

      // Bookmark Operations
      case MESSAGE_TYPES.GET_BOOKMARKS: {
        const bookmarks = await bookmarkService.getBookmarks()
        return { success: true, data: bookmarks }
      }

      case MESSAGE_TYPES.UPDATE_BOOKMARK: {
        const { bookmarkId, updates } = message.payload as {
          bookmarkId: string
          updates: any
        }
        await bookmarkService.updateBookmarkMetadata(bookmarkId, updates)
        return { success: true, data: null }
      }

      case MESSAGE_TYPES.BULK_UPDATE_BOOKMARKS: {
        const action = message.payload as any // BookmarkBulkAction type
        await bookmarkService.executeBulkAction(action)
        return { success: true, data: null }
      }

      case MESSAGE_TYPES.CHECK_BOOKMARK_RULE_MATCH: {
        const { url } = message.payload as { url: string }
        const match = await rulesEngine.evaluate(url)
        return {
          success: true,
          data: { containerId: match?.containerId || null },
        }
      }

      // Bookmark Tags
      case MESSAGE_TYPES.GET_BOOKMARK_TAGS: {
        const tags = await tagService.getAllTags()
        return { success: true, data: tags }
      }

      case MESSAGE_TYPES.CREATE_BOOKMARK_TAG: {
        const tagData = message.payload
        const tag = await tagService.createTag(tagData)
        return { success: true, data: tag }
      }

      case MESSAGE_TYPES.UPDATE_BOOKMARK_TAG: {
        const { id, updates } = message.payload as { id: string; updates: any }
        const tag = await tagService.updateTag(id, updates)
        return { success: true, data: tag }
      }

      case MESSAGE_TYPES.DELETE_BOOKMARK_TAG: {
        const { id } = message.payload as { id: string }
        await tagService.deleteTag(id)
        return { success: true, data: null }
      }

      // Bulk Tag Operations
      case MESSAGE_TYPES.BULK_ASSIGN_TAG: {
        const { bookmarkIds, tagId } = message.payload as {
          bookmarkIds: string[]
          tagId: string
        }
        await tagService.bulkAddTag(bookmarkIds, tagId)
        return { success: true, data: null }
      }

      case MESSAGE_TYPES.BULK_REMOVE_TAG: {
        const { bookmarkIds, tagId } = message.payload as {
          bookmarkIds: string[]
          tagId: string
        }
        await tagService.bulkRemoveTag(bookmarkIds, tagId)
        return { success: true, data: null }
      }

      case MESSAGE_TYPES.BULK_ASSIGN_CONTAINER: {
        const { bookmarkIds, containerId } = message.payload as {
          bookmarkIds: string[]
          containerId: string
        }
        for (const bookmarkId of bookmarkIds) {
          await bookmarkService.assignContainer(bookmarkId, containerId)
        }
        return { success: true, data: null }
      }

      case MESSAGE_TYPES.BULK_REMOVE_CONTAINER: {
        const { bookmarkIds } = message.payload as { bookmarkIds: string[] }
        for (const bookmarkId of bookmarkIds) {
          await bookmarkService.removeContainer(bookmarkId)
        }
        return { success: true, data: null }
      }

      case MESSAGE_TYPES.BULK_OPEN_IN_CONTAINER: {
        const { bookmarkIds, containerId } = message.payload as {
          bookmarkIds: string[]
          containerId: string
        }
        await bookmarkService.executeBulkAction({
          type: "openInContainer",
          bookmarkIds,
          payload: { containerId },
        })
        return { success: true, data: null }
      }

      // Bookmark Migration
      case MESSAGE_TYPES.MIGRATE_BOOKMARKS: {
        await bookmarkService.migrateLegacyBookmarks()
        return { success: true, data: null }
      }

      default: {
        return { success: false, error: "Unknown message type" }
      }
    }
  } catch (error: unknown) {
    logger.error("Message handling failed", { type: message?.type, error })
    const msg = error instanceof Error ? error.message : String(error)
    return { success: false, error: msg }
  }
})
