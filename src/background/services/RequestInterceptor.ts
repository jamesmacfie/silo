import browser from "webextension-polyfill"
import type { EvaluationResult } from "@/shared/types"
import { logger } from "@/shared/utils/logger"
import bookmarkIntegration from "./BookmarkIntegration"
import containerManager from "./ContainerManager"
import rulesEngine from "./RulesEngine"
import storageService from "./StorageService"

const DEFAULT_CONTAINER_ID = "firefox-default"
const ORIGINAL_TAB_CLOSE_DELAY_MS = 100
const TEMP_CONTAINER_CLEANUP_DELAY_MS = 1000
const IGNORED_URLS_REGEX =
  /^(about|moz-extension|file|javascript|data|chrome|chrome-extension):/

type StatEvent = "open" | "match" | "close" | "touch"

interface OpenActionContext {
  cleanUrl: string
  tabId: number
  currentContainerId?: string
  evaluation: EvaluationResult
  bookmarkContainerId?: string | null
}

export class RequestInterceptor {
  private rulesEngine = rulesEngine
  private containerManager = containerManager
  private storage = storageService
  private isRegistered = false
  private log = logger.withContext("RequestInterceptor")
  private tabToContainer = new Map<number, string>()
  private readonly onBeforeRequestListener = this.handleRequest.bind(this)
  private readonly onTabUpdatedListener = this.handleTabUpdate.bind(this)
  private readonly onTabCreatedListener = this.handleTabCreated.bind(this)
  private readonly onTabRemovedListener = this.handleTabRemoved.bind(this)

  async register(): Promise<void> {
    if (this.isRegistered) {
      this.log.warn("Request interceptor already registered")
      return
    }

    try {
      let webRequestRegistered = false

      // Register network interception when available; tab listeners are fallback.
      if (browser.webRequest?.onBeforeRequest) {
        try {
          browser.webRequest.onBeforeRequest.addListener(
            this.onBeforeRequestListener,
            { urls: ["<all_urls>"], types: ["main_frame"] },
            ["blocking"],
          )
          webRequestRegistered = true
        } catch (webRequestError) {
          this.log.warn(
            "Failed to register webRequest listener",
            webRequestError,
          )
        }
      }

      // Always register tab listeners.
      browser.tabs.onUpdated.addListener(this.onTabUpdatedListener)
      browser.tabs.onCreated.addListener(this.onTabCreatedListener)
      browser.tabs.onRemoved.addListener(this.onTabRemovedListener)

      this.isRegistered = true
      this.log.info("Request interceptor registered", {
        webRequestAvailable: !!browser.webRequest,
        webRequestRegistered,
        tabListenersRegistered: true,
      })
    } catch (error) {
      this.log.error("Failed to register request interceptor", error)
      throw error
    }
  }

  async unregister(): Promise<void> {
    if (!this.isRegistered) {
      return
    }

    try {
      if (browser.webRequest?.onBeforeRequest) {
        browser.webRequest.onBeforeRequest.removeListener(
          this.onBeforeRequestListener,
        )
      }
      browser.tabs.onUpdated.removeListener(this.onTabUpdatedListener)
      browser.tabs.onCreated.removeListener(this.onTabCreatedListener)
      browser.tabs.onRemoved.removeListener(this.onTabRemovedListener)

      this.isRegistered = false
      this.log.info("Request interceptor unregistered")
    } catch (error) {
      this.log.error("Failed to unregister request interceptor", error)
    }
  }

  private async handleRequest(
    details: browser.WebRequest.OnBeforeRequestDetailsType,
  ): Promise<browser.WebRequest.BlockingResponse> {
    const { url, tabId, frameId } = details

    this.log.debug("Request intercepted", { url, tabId, frameId })

    // Only process main frame requests (like the original implementation)
    if (frameId !== 0) {
      this.log.debug("Skipping - not main frame", { url, frameId })
      return {}
    }

    // Skip if URL should not be intercepted
    if (!this.shouldIntercept(url)) {
      this.log.debug("Skipping URL - not interceptable", { url })
      return {}
    }

    // Guard against unknown tab contexts to prevent redirect loops
    if (tabId === -1) {
      this.log.debug("Skipping URL - invalid tab ID", { url, tabId })
      return {}
    }

    try {
      const currentTab = await browser.tabs.get(tabId)
      const currentContainerId = currentTab?.cookieStoreId

      const bookmarkHintResult =
        await bookmarkIntegration.processBookmarkUrl(url)
      const cleanUrl = bookmarkHintResult.cleanUrl

      const evaluation = await this.rulesEngine.evaluate(
        cleanUrl,
        currentContainerId,
      )

      this.log.debug("Request evaluation", {
        url: cleanUrl,
        currentContainerId,
        evaluation,
      })

      switch (evaluation.action) {
        case "redirect":
          if (!evaluation.containerId) {
            return {}
          }
          return await this.handleRedirect(
            cleanUrl,
            tabId,
            evaluation.containerId,
            evaluation,
          )

        case "exclude":
          return await this.handleExclude(
            cleanUrl,
            tabId,
            evaluation,
            currentContainerId,
          )

        case "block":
          return await this.handleBlock(cleanUrl, tabId, evaluation)
        default:
          return await this.handleOpenAction({
            cleanUrl,
            tabId,
            currentContainerId,
            evaluation,
            bookmarkContainerId: bookmarkHintResult.containerId,
          })
      }
    } catch (error) {
      this.log.error("Error handling request", { url, tabId, error })
      return {} // Allow request to proceed on error
    }
  }

  private async handleOpenAction({
    cleanUrl,
    tabId,
    currentContainerId,
    evaluation,
    bookmarkContainerId,
  }: OpenActionContext): Promise<browser.WebRequest.BlockingResponse> {
    // Explicit `?silo=` hints win over passive "open" results.
    if (
      this.hasBookmarkContainerOverride(bookmarkContainerId, currentContainerId)
    ) {
      return await this.handleRedirect(cleanUrl, tabId, bookmarkContainerId, {
        action: "redirect",
        containerId: bookmarkContainerId,
        reason: "Bookmark silo param",
      })
    }

    await this.recordOpenActionStats(evaluation, currentContainerId)
    return {}
  }

  private async handleRedirect(
    url: string,
    tabId: number,
    targetContainer: string,
    evaluation: EvaluationResult,
  ): Promise<browser.WebRequest.BlockingResponse> {
    try {
      // Create new tab in target container
      const newTab = await browser.tabs.create({
        url,
        cookieStoreId: targetContainer,
        active: true,
      })

      this.log.info("Redirected to container", {
        url,
        targetContainer,
        newTabId: newTab.id,
        rule: evaluation.rule?.id,
      })

      if (evaluation.rule) {
        await this.recordStatSafely(targetContainer, "match")
      }

      const preferences = await this.storage.getPreferences()
      this.maybeCloseOriginalTab(tabId, preferences.keepOldTabs)

      // Cancel the original request since we've opened it in a new tab
      return { cancel: true }
    } catch (error) {
      this.log.error("Failed to redirect to container", {
        url,
        targetContainer,
        error,
      })
      return {} // Allow original request to proceed
    }
  }

  private async handleExclude(
    url: string,
    tabId: number,
    evaluation: EvaluationResult,
    sourceContainerId?: string,
  ): Promise<browser.WebRequest.BlockingResponse> {
    try {
      // Open in default (no container) context explicitly
      const newTab = await browser.tabs.create({
        url,
        cookieStoreId: DEFAULT_CONTAINER_ID,
        active: true,
      })

      this.log.info("Excluded from container", {
        url,
        newTabId: newTab.id,
        rule: evaluation.rule?.id,
      })

      // EXCLUDE matches are attributed to the source container being exited.
      if (sourceContainerId && !this.isDefaultContainer(sourceContainerId)) {
        await this.recordStatSafely(sourceContainerId, "match")
      }

      const preferences = await this.storage.getPreferences()

      if (preferences.notifications.showOnExclude) {
        try {
          await this.showExcludeNotification(url)
        } catch (error) {
          this.log.warn("Failed to show exclude notification", error)
        }
      }

      this.maybeCloseOriginalTab(tabId, preferences.keepOldTabs)

      return { cancel: true }
    } catch (error) {
      this.log.error("Failed to exclude from container", { url, error })
      return {}
    }
  }

  private async handleBlock(
    url: string,
    _tabId: number,
    evaluation: EvaluationResult,
  ): Promise<browser.WebRequest.BlockingResponse> {
    this.log.warn("Blocked restricted URL", {
      url,
      requiredContainer: evaluation.containerId,
      rule: evaluation.rule?.id,
    })

    // Show notification about restriction
    const preferences = await this.storage.getPreferences()
    if (preferences.notifications.showOnRestrict) {
      try {
        await this.showRestrictionNotification(url, evaluation.containerId)
      } catch (error) {
        this.log.warn("Failed to show restriction notification", error)
      }
    }

    // Block the request
    return { cancel: true }
  }

  private async showRestrictionNotification(
    url: string,
    containerId: string,
  ): Promise<void> {
    try {
      const containers = await this.containerManager.getAll()
      const container = containers.find((c) => c.cookieStoreId === containerId)
      const containerName = container?.name || "Unknown Container"

      await browser.notifications.create({
        type: "basic",
        iconUrl: browser.runtime.getURL("images/extension_48.png"),
        title: "Domain Restricted",
        message: `${new URL(url).hostname} can only be opened in "${containerName}" container.`,
      })
    } catch (error) {
      this.log.error("Failed to create notification", error)
    }
  }

  private async showExcludeNotification(url: string): Promise<void> {
    try {
      await browser.notifications.create({
        type: "basic",
        iconUrl: browser.runtime.getURL("images/extension_48.png"),
        title: "Opened Outside Containers",
        message: `${new URL(url).hostname} was opened outside of containers due to an EXCLUDE rule.`,
      })
    } catch (error) {
      this.log.error("Failed to create exclude notification", error)
    }
  }

  private async handleTabUpdate(
    tabId: number,
    changeInfo: browser.Tabs.OnUpdatedChangeInfoType,
    tab: browser.Tabs.Tab,
  ): Promise<void> {
    if (!changeInfo.url || !tab.url) {
      return
    }

    if (!this.shouldIntercept(tab.url)) {
      return
    }

    try {
      const currentContainerId = tab.cookieStoreId
      if (typeof tabId === "number" && currentContainerId) {
        this.tabToContainer.set(tabId, currentContainerId)
      }

      const bookmarkHintResult = await bookmarkIntegration.processBookmarkUrl(
        tab.url,
      )
      const cleanUrl = bookmarkHintResult.cleanUrl
      const evaluation = await this.rulesEngine.evaluate(
        cleanUrl,
        currentContainerId,
      )

      this.log.debug("Tab update evaluation", {
        tabId,
        url: tab.url,
        currentContainerId,
        evaluation,
      })

      if (evaluation.action === "redirect" || evaluation.action === "exclude") {
        await this.handleTabContainerUpdate(tabId, cleanUrl, evaluation)
        return
      }

      if (
        evaluation.action === "open" &&
        this.hasBookmarkContainerOverride(
          bookmarkHintResult.containerId,
          currentContainerId,
        )
      ) {
        await this.handleTabContainerUpdate(tabId, cleanUrl, {
          action: "redirect",
          containerId: bookmarkHintResult.containerId,
        })
        return
      }

      if (currentContainerId && !this.isDefaultContainer(currentContainerId)) {
        await this.recordStatSafely(currentContainerId, "touch")
      }
    } catch (error) {
      this.log.error("Error handling tab update", {
        tabId,
        url: tab.url,
        error,
      })
    }
  }

  private async handleTabContainerUpdate(
    tabId: number,
    url: string,
    evaluation: EvaluationResult,
  ): Promise<void> {
    try {
      const sourceTab = await browser.tabs.get(tabId)
      const targetContainerId = this.resolveTabUpdateTargetContainer(evaluation)
      const createProps: browser.Tabs.CreateCreatePropertiesType = {
        url,
        active: true,
        index: sourceTab.index,
      }

      if (targetContainerId) {
        createProps.cookieStoreId = targetContainerId
      }

      const newTab = await browser.tabs.create(createProps)

      await browser.tabs.remove(tabId)

      this.log.info("Updated tab container", {
        url,
        oldTabId: tabId,
        newTabId: newTab.id,
        targetContainer: targetContainerId,
      })

      if (targetContainerId && !this.isDefaultContainer(targetContainerId)) {
        await this.recordStatSafely(targetContainerId, "open")
        if (evaluation.rule) {
          await this.recordStatSafely(targetContainerId, "match")
        }
      }
    } catch (error) {
      this.log.error("Failed to update tab container", { tabId, url, error })
    }
  }

  private async handleTabCreated(tab: browser.Tabs.Tab): Promise<void> {
    try {
      const containerId = tab.cookieStoreId
      if (typeof tab.id === "number" && containerId) {
        this.tabToContainer.set(tab.id, containerId)
      }

      if (containerId && !this.isDefaultContainer(containerId)) {
        await this.recordStatSafely(containerId, "open")
      }
    } catch (error) {
      this.log.warn("Failed to handle tab created", { error })
    }
  }

  private async handleTabRemoved(
    tabId: number,
    _removeInfo: browser.Tabs.OnRemovedRemoveInfoType,
  ): Promise<void> {
    try {
      const containerId = this.tabToContainer.get(tabId)
      if (containerId) {
        await this.recordStatSafely(containerId, "close")

        // Trigger cleanup of temporary containers after tab is closed
        setTimeout(async () => {
          try {
            await this.containerManager.cleanupTemporaryContainersAsync()
          } catch (error) {
            this.log.warn("Failed to cleanup temporary containers", { error })
          }
        }, TEMP_CONTAINER_CLEANUP_DELAY_MS)
      }
      this.tabToContainer.delete(tabId)
    } catch (error) {
      this.log.warn("Failed to handle tab removed", { error })
    }
  }

  private hasBookmarkContainerOverride(
    bookmarkContainerId: string | null | undefined,
    currentContainerId?: string,
  ): bookmarkContainerId is string {
    return Boolean(
      bookmarkContainerId && bookmarkContainerId !== currentContainerId,
    )
  }

  private async recordOpenActionStats(
    evaluation: EvaluationResult,
    currentContainerId?: string,
  ): Promise<void> {
    if (evaluation.rule) {
      const containerForMatch =
        evaluation.rule.ruleType === "exclude"
          ? this.isDefaultContainer(currentContainerId)
            ? undefined
            : currentContainerId
          : evaluation.rule.containerId

      if (containerForMatch) {
        await this.recordStatSafely(containerForMatch, "match")
      }
    }

    if (currentContainerId && !this.isDefaultContainer(currentContainerId)) {
      await this.recordStatSafely(currentContainerId, "touch")
    }
  }

  private async recordStatSafely(
    containerId: string,
    event: StatEvent,
  ): Promise<void> {
    try {
      await this.storage.recordStat(containerId, event)
    } catch {
      /* ignore stats errors */
    }
  }

  private maybeCloseOriginalTab(tabId: number, keepOldTabs: boolean): void {
    if (keepOldTabs || tabId === -1) {
      return
    }

    // Delay closure slightly so the replacement tab has time to initialize.
    setTimeout(async () => {
      try {
        await browser.tabs.remove(tabId)
      } catch (error) {
        this.log.warn("Failed to close original tab", { tabId, error })
      }
    }, ORIGINAL_TAB_CLOSE_DELAY_MS)
  }

  private resolveTabUpdateTargetContainer(
    evaluation: EvaluationResult,
  ): string | undefined {
    if (
      evaluation.action === "exclude" ||
      evaluation.containerId === DEFAULT_CONTAINER_ID
    ) {
      return DEFAULT_CONTAINER_ID
    }

    return evaluation.containerId
  }

  private isDefaultContainer(containerId?: string): boolean {
    return !containerId || containerId === DEFAULT_CONTAINER_ID
  }

  shouldIntercept(url: string): boolean {
    if (IGNORED_URLS_REGEX.test(url)) {
      return false
    }

    // Only intercept HTTP(S) URLs
    return url.startsWith("http://") || url.startsWith("https://")
  }
}
export const requestInterceptor = new RequestInterceptor()
export default requestInterceptor
