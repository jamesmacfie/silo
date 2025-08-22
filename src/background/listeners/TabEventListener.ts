import browser from "webextension-polyfill"
import { logger } from "@/shared/utils/logger"
import statsService from "../services/StatsService"

/**
 * Handles all tab-related events for statistics tracking
 */
export class TabEventListener {
  private tabContainerMap = new Map<number, string>()
  private log = logger.withContext("TabEventListener")

  /**
   * Register all tab event listeners
   */
  register(): void {
    this.log.info("Registering tab event listeners")

    browser.tabs.onCreated.addListener(this.handleTabCreated.bind(this))
    browser.tabs.onRemoved.addListener(this.handleTabRemoved.bind(this))
    browser.tabs.onActivated.addListener(this.handleTabActivated.bind(this))
    browser.tabs.onUpdated.addListener(this.handleTabUpdated.bind(this))

    this.log.info("Tab event listeners registered successfully")
  }

  /**
   * Handle tab creation events
   */
  private async handleTabCreated(tab: browser.Tabs.Tab): Promise<void> {
    if (!this.isContainerTab(tab)) {
      return
    }

    try {
      // Track for cleanup
      this.tabContainerMap.set(tab.id!, tab.cookieStoreId!)

      // Record stats
      await statsService.recordEvent(tab.cookieStoreId!, "tab-created", {
        tabId: tab.id,
        url: this.sanitizeUrl(tab.url), // Remove query params for privacy
      })

      await statsService.trackTabSession(tab.cookieStoreId!, tab.id!, "start")

      this.log.debug("Tab created event recorded", {
        tabId: tab.id,
        cookieStoreId: tab.cookieStoreId,
      })
    } catch (error) {
      this.log.error("Failed to record tab created event", error)
    }
  }

  /**
   * Handle tab removal events
   */
  private async handleTabRemoved(
    tabId: number,
    removeInfo: browser.Tabs.OnRemovedRemoveInfoType,
  ): Promise<void> {
    try {
      const cookieStoreId = this.tabContainerMap.get(tabId)

      if (cookieStoreId) {
        await statsService.recordEvent(cookieStoreId, "tab-closed", {
          tabId,
          windowClosing: removeInfo.isWindowClosing,
        })

        await statsService.trackTabSession(cookieStoreId, tabId, "end")

        // Clean up tracking
        this.tabContainerMap.delete(tabId)

        this.log.debug("Tab removed event recorded", {
          tabId,
          cookieStoreId,
          windowClosing: removeInfo.isWindowClosing,
        })
      }
    } catch (error) {
      this.log.error("Failed to record tab removed event", error)
    }
  }

  /**
   * Handle tab activation events
   */
  private async handleTabActivated(
    activeInfo: browser.Tabs.OnActivatedActiveInfoType,
  ): Promise<void> {
    try {
      const tab = await browser.tabs.get(activeInfo.tabId)

      if (this.isContainerTab(tab)) {
        await statsService.recordEvent(tab.cookieStoreId!, "tab-activated", {
          tabId: tab.id,
          previousTabId: activeInfo.previousTabId,
        })

        this.log.debug("Tab activated event recorded", {
          tabId: tab.id,
          cookieStoreId: tab.cookieStoreId,
          previousTabId: activeInfo.previousTabId,
        })
      }
    } catch (error) {
      this.log.error("Failed to record tab activated event", error)
    }
  }

  /**
   * Handle tab update events (primarily URL changes)
   */
  private async handleTabUpdated(
    tabId: number,
    changeInfo: browser.Tabs.OnUpdatedChangeInfoType,
    tab: browser.Tabs.Tab,
  ): Promise<void> {
    // Only track URL changes in container tabs
    if (!changeInfo.url || !this.isContainerTab(tab)) {
      return
    }

    try {
      const domain = new URL(changeInfo.url).hostname

      await statsService.recordEvent(tab.cookieStoreId!, "navigation", {
        tabId,
        domain,
        url: this.sanitizeUrl(changeInfo.url), // Remove query params for privacy
      })

      this.log.debug("Navigation event recorded", {
        tabId,
        cookieStoreId: tab.cookieStoreId,
        domain,
      })
    } catch (error) {
      this.log.error("Failed to record navigation event", error)
    }
  }

  /**
   * Check if a tab is in a container (not the default container)
   */
  private isContainerTab(tab: browser.Tabs.Tab): boolean {
    return !!(
      tab.cookieStoreId &&
      tab.cookieStoreId !== "firefox-default" &&
      tab.id
    )
  }

  /**
   * Remove query parameters from URLs for privacy
   */
  private sanitizeUrl(url?: string): string | undefined {
    return url?.split("?")[0]
  }

  /**
   * Get current tab-container mapping (useful for debugging)
   */
  getTabContainerMap(): Map<number, string> {
    return new Map(this.tabContainerMap)
  }

  /**
   * Clear the tab-container mapping (useful for cleanup)
   */
  clearTabContainerMap(): void {
    this.tabContainerMap.clear()
    this.log.debug("Tab container map cleared")
  }
}
