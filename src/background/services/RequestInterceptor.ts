import browser from "webextension-polyfill"
import rulesEngine from "./RulesEngine"
import containerManager from "./ContainerManager"
import storageService from "./StorageService"
import type { EvaluationResult } from "@/shared/types"
import { logger } from "@/shared/utils/logger"
import bookmarkIntegration from "./BookmarkIntegration"

export class RequestInterceptor {
  private static instance: RequestInterceptor | null = null
  private rulesEngine = rulesEngine
  private containerManager = containerManager
  private storage = storageService
  private isRegistered = false
  private log = logger.withContext("RequestInterceptor")
  private tabToContainer = new Map<number, string>()

  async register(): Promise<void> {
    if (this.isRegistered) {
      this.log.warn("Request interceptor already registered")
      return
    }

    try {
      let webRequestRegistered = false

      // Try to register webRequest listener if available
      if (browser.webRequest?.onBeforeRequest) {
        try {
          browser.webRequest.onBeforeRequest.addListener(
            this.handleRequest.bind(this),
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
      } else {
      }

      // Always register tab listeners as fallback
      browser.tabs.onUpdated.addListener(this.handleTabUpdate.bind(this))
      browser.tabs.onCreated.addListener(this.handleTabCreated.bind(this))
      browser.tabs.onRemoved.addListener(this.handleTabRemoved.bind(this))

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
      browser.webRequest.onBeforeRequest.removeListener(
        this.handleRequest.bind(this),
      )
      browser.tabs.onUpdated.removeListener(this.handleTabUpdate.bind(this))

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
      // Get current tab info
      const tab = await browser.tabs.get(tabId)
      const currentContainer = tab?.cookieStoreId

      // Check for bookmark container hint in URL and clean it
      const processed = await bookmarkIntegration.processBookmarkUrl(url)
      const urlToEvaluate = processed.cleanUrl

      // Evaluate URL against rules
      const evaluation = await this.rulesEngine.evaluate(
        urlToEvaluate,
        currentContainer,
      )

      this.log.debug("Request evaluation", {
        url: urlToEvaluate,
        currentContainer,
        evaluation,
      })

      switch (evaluation.action) {
        case "redirect":
          if (!evaluation.containerId) {
            return {}
          }
          return await this.handleRedirect(
            urlToEvaluate,
            tabId,
            evaluation.containerId,
            evaluation,
          )

        case "exclude":
          return await this.handleExclude(
            urlToEvaluate,
            tabId,
            evaluation,
            currentContainer,
          )

        case "block":
          return await this.handleBlock(urlToEvaluate, tabId, evaluation)

        case "open":
        default:
          // If silo param specified, open in that container even if rules say open
          if (
            processed.containerId &&
            processed.containerId !== currentContainer
          ) {
            return await this.handleRedirect(
              urlToEvaluate,
              tabId,
              processed.containerId,
              {
                action: "redirect",
                containerId: processed.containerId,
                reason: "Bookmark silo param",
              },
            )
          }
          // Count matches even when no redirect is needed (already in correct container or no-op include)
          try {
            if (evaluation.rule) {
              const containerForMatch =
                evaluation.rule.ruleType === "exclude"
                  ? currentContainer && currentContainer !== "firefox-default"
                    ? currentContainer
                    : undefined
                  : evaluation.rule.containerId
              if (containerForMatch) {
                await this.storage.recordStat(containerForMatch, "match")
              }
            }
            if (currentContainer && currentContainer !== "firefox-default") {
              await this.storage.recordStat(currentContainer, "touch")
            }
          } catch {
            /* ignore stats errors */
          }
          return {}
      }
    } catch (error) {
      this.log.error("Error handling request", { url, tabId, error })
      return {} // Allow request to proceed on error
    }
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

      // stats: count rule match for target container
      try {
        if (evaluation.rule) {
          await this.storage.recordStat(targetContainer, "match")
        }
      } catch {
        /* ignore stats errors */
      }

      // Handle old tab based on preferences
      const preferences = await this.storage.getPreferences()
      if (!preferences.keepOldTabs && tabId !== -1) {
        // Close original tab after a short delay to ensure new tab loads
        setTimeout(async () => {
          try {
            await browser.tabs.remove(tabId)
          } catch (error) {
            this.log.warn("Failed to close original tab", { tabId, error })
          }
        }, 100)
      }

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
        cookieStoreId: "firefox-default",
        active: true,
      })

      this.log.info("Excluded from container", {
        url,
        newTabId: newTab.id,
        rule: evaluation.rule?.id,
      })

      // stats: attribute match to the source container (being excluded from)
      try {
        if (sourceContainerId && sourceContainerId !== "firefox-default") {
          await this.storage.recordStat(sourceContainerId, "match")
        }
      } catch {
        /* ignore */
      }

      // Handle old tab and optional notification
      const preferences = await this.storage.getPreferences()

      // Show notification about exclusion if enabled
      if (preferences.notifications.showOnExclude) {
        try {
          await this.showExcludeNotification(url)
        } catch (error) {
          this.log.warn("Failed to show exclude notification", error)
        }
      }

      if (!preferences.keepOldTabs && tabId !== -1) {
        setTimeout(async () => {
          try {
            await browser.tabs.remove(tabId)
          } catch (error) {
            this.log.warn("Failed to close original tab", { tabId, error })
          }
        }, 100)
      }

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
    // Only process when URL changes
    if (!changeInfo.url || !tab.url) {
      return
    }

    // Skip if URL should not be intercepted
    if (!this.shouldIntercept(tab.url)) {
      return
    }

    try {
      const currentContainer = tab.cookieStoreId
      // Keep mapping up to date
      if (typeof tabId === "number" && currentContainer) {
        this.tabToContainer.set(tabId, currentContainer)
      }
      const processed = await bookmarkIntegration.processBookmarkUrl(tab.url)
      const urlToEvaluate = processed.cleanUrl
      const evaluation = await this.rulesEngine.evaluate(
        urlToEvaluate,
        currentContainer,
      )

      this.log.debug("Tab update evaluation", {
        tabId,
        url: tab.url,
        currentContainer,
        evaluation,
      })

      // Handle tab updates that require action
      if (evaluation.action === "redirect" || evaluation.action === "exclude") {
        // Update the tab's container if needed
        await this.handleTabContainerUpdate(tabId, urlToEvaluate, evaluation)
        return
      }

      // If evaluation says open but bookmark param requests a container switch
      if (
        evaluation.action === "open" &&
        processed.containerId &&
        processed.containerId !== currentContainer
      ) {
        await this.handleTabContainerUpdate(tabId, urlToEvaluate, {
          action: "redirect",
          containerId: processed.containerId,
        })
        return
      }

      // Otherwise, update last used on container tabs when URL changed
      try {
        if (currentContainer && currentContainer !== "firefox-default") {
          await this.storage.recordStat(currentContainer, "touch")
        }
      } catch {
        /* ignore */
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
      const useDefault =
        evaluation.action === "exclude" ||
        evaluation.containerId === "firefox-default"
      const createProps: browser.Tabs.CreateCreatePropertiesType = {
        url,
        active: true,
        index: (await browser.tabs.get(tabId)).index,
      }
      if (!useDefault && evaluation.containerId) {
        createProps.cookieStoreId = evaluation.containerId
      }

      // Create new tab in correct container (or default) and close current tab
      const newTab = await browser.tabs.create(
        useDefault
          ? { ...createProps, cookieStoreId: "firefox-default" }
          : createProps,
      )

      await browser.tabs.remove(tabId)

      const targetContainer = useDefault
        ? "firefox-default"
        : evaluation.containerId
      this.log.info("Updated tab container", {
        url,
        oldTabId: tabId,
        newTabId: newTab.id,
        targetContainer,
      })

      // stats events
      try {
        if (!useDefault && targetContainer) {
          await this.storage.recordStat(targetContainer, "open")
          if (evaluation.rule) {
            await this.storage.recordStat(targetContainer, "match")
          }
        }
      } catch {
        /* ignore */
      }
    } catch (error) {
      this.log.error("Failed to update tab container", { tabId, url, error })
    }
  }

  private async handleTabCreated(tab: browser.Tabs.Tab): Promise<void> {
    try {
      const cid = tab.cookieStoreId
      if (typeof tab.id === "number" && cid) {
        this.tabToContainer.set(tab.id, cid)
      }
      if (cid && cid !== "firefox-default") {
        await this.storage.recordStat(cid, "open")
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
      const cid = this.tabToContainer.get(tabId)
      if (cid) {
        await this.storage.recordStat(cid, "close")

        // Trigger cleanup of temporary containers after tab is closed
        setTimeout(async () => {
          try {
            await this.containerManager.cleanupTemporaryContainersAsync()
          } catch (error) {
            this.log.warn("Failed to cleanup temporary containers", { error })
          }
        }, 1000) // Small delay to ensure tab is fully closed
      }
      this.tabToContainer.delete(tabId)
    } catch (error) {
      this.log.warn("Failed to handle tab removed", { error })
    }
  }

  shouldIntercept(url: string): boolean {
    // Use the same regex pattern as the original implementation
    const IGNORED_URLS_REGEX =
      /^(about|moz-extension|file|javascript|data|chrome|chrome-extension):/

    if (IGNORED_URLS_REGEX.test(url)) {
      return false
    }

    // Only intercept HTTP(S) URLs
    return url.startsWith("http://") || url.startsWith("https://")
  }
}
export const requestInterceptor = new RequestInterceptor()
export default requestInterceptor
