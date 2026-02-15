import Fuse from "fuse.js"
import {
  ArrowLeft,
  ArrowRightLeft,
  ExternalLink,
  Globe,
  Plus,
  Search,
} from "lucide-react"
import React from "react"
import browser from "webextension-polyfill"
import { MESSAGE_TYPES } from "@/shared/constants"
import type { Container } from "@/shared/types"
import { colorToCss, iconToEmoji } from "@/shared/utils/containerHelpers"
import { ThemeSwitcher } from "@/ui/shared/components/ThemeSwitcher"
import { useContainerActions, useContainers } from "@/ui/shared/stores"

type PopupMode = "home" | "pick-current" | "pick-new"
type StatusKind = "idle" | "success" | "error" | "info"

interface StatusState {
  kind: StatusKind
  message: string
}

const NO_CONTAINER_OPTION: Container = {
  id: "no-container",
  name: "No Container",
  icon: "fingerprint",
  color: "toolbar",
  cookieStoreId: "firefox-default",
  created: 0,
  modified: 0,
  temporary: false,
  syncEnabled: false,
}

async function getActiveTab(): Promise<browser.Tabs.Tab | null> {
  try {
    const tabs = await browser.tabs.query({ active: true, currentWindow: true })
    return tabs[0] || null
  } catch {
    return null
  }
}

function getDisplayHost(url?: string): string {
  if (!url) {
    return "—"
  }

  try {
    return new URL(url).host || "—"
  } catch {
    return "—"
  }
}

function canMoveCurrentUrl(url?: string | null): url is string {
  if (!url) {
    return false
  }

  try {
    const parsedUrl = new URL(url)
    return (
      parsedUrl.protocol === "http:" ||
      parsedUrl.protocol === "https:" ||
      parsedUrl.protocol === "ftp:"
    )
  } catch {
    return false
  }
}

export function PopupApp(): JSX.Element {
  const containersData = useContainers()
  const { create: createContainer, load: loadContainers } =
    useContainerActions()

  const statusTimerRef = React.useRef<number | undefined>(undefined)
  const searchInputRef = React.useRef<HTMLInputElement>(null)
  const selectedContainerRef = React.useRef<HTMLButtonElement | null>(null)

  const [mode, setMode] = React.useState<PopupMode>("home")
  const [containerQuery, setContainerQuery] = React.useState("")
  const [activeResultIndex, setActiveResultIndex] = React.useState(0)
  const [currentHost, setCurrentHost] = React.useState("—")
  const [currentTitle, setCurrentTitle] = React.useState("No active tab")
  const [currentTabUrl, setCurrentTabUrl] = React.useState<string | null>(null)
  const [currentTabId, setCurrentTabId] = React.useState<number | undefined>(
    undefined,
  )
  const [currentTabIndex, setCurrentTabIndex] = React.useState(0)
  const [currentCookieStoreId, setCurrentCookieStoreId] =
    React.useState("firefox-default")
  const [currentContainerName, setCurrentContainerName] =
    React.useState("No Container")
  const [status, setStatus] = React.useState<StatusState>({
    kind: "idle",
    message: "",
  })

  const containers = React.useMemo(() => {
    const sorted = [...containersData].sort((a, b) =>
      a.name.localeCompare(b.name),
    )
    return [NO_CONTAINER_OPTION, ...sorted]
  }, [containersData])

  const containerSearch = React.useMemo(() => {
    return new Fuse(containers, {
      keys: ["name"],
      threshold: 0.4,
      ignoreLocation: true,
      minMatchCharLength: 1,
    })
  }, [containers])

  const filteredContainers = React.useMemo(() => {
    const query = containerQuery.trim()
    if (!query) {
      return containers
    }

    return containerSearch.search(query).map((result) => result.item)
  }, [containerQuery, containerSearch, containers])

  const setStatusMessage = React.useCallback(
    (kind: StatusKind, message: string, persist = false) => {
      setStatus({ kind, message })

      if (statusTimerRef.current) {
        window.clearTimeout(statusTimerRef.current)
      }

      if (persist) {
        return
      }

      statusTimerRef.current = window.setTimeout(() => {
        setStatus({ kind: "idle", message: "" })
      }, 3500)
    },
    [],
  )

  const updateContext = React.useCallback(async () => {
    const activeTab = await getActiveTab()

    if (!activeTab?.url) {
      setCurrentHost("—")
      setCurrentTitle("No active tab")
      setCurrentTabUrl(null)
      setCurrentTabId(undefined)
      setCurrentTabIndex(0)
      setCurrentCookieStoreId("firefox-default")
      setCurrentContainerName("No Container")
      return
    }

    const cookieStoreId = activeTab.cookieStoreId || "firefox-default"
    const host = getDisplayHost(activeTab.url)

    setCurrentHost(host)
    setCurrentTitle(activeTab.title || host)
    setCurrentTabUrl(activeTab.url)
    setCurrentTabId(activeTab.id)
    setCurrentTabIndex(activeTab.index || 0)
    setCurrentCookieStoreId(cookieStoreId)

    if (cookieStoreId === "firefox-default") {
      setCurrentContainerName("No Container")
      return
    }

    const knownContainer = containersData.find(
      (container) => container.cookieStoreId === cookieStoreId,
    )

    if (knownContainer) {
      setCurrentContainerName(knownContainer.name)
      return
    }

    if (browser.contextualIdentities?.get) {
      try {
        const identity = await browser.contextualIdentities.get(cookieStoreId)
        setCurrentContainerName(identity?.name || "Unknown")
      } catch {
        setCurrentContainerName("Unknown")
      }
    }
  }, [containersData])

  React.useEffect(() => {
    void updateContext()
  }, [updateContext])

  React.useEffect(() => {
    let isUnmounted = false

    const refreshContainers = async () => {
      try {
        await browser.runtime.sendMessage({
          type: MESSAGE_TYPES.SYNC_CONTAINERS,
        })
      } catch {
        // Keep popup responsive even if sync fails; local load still runs.
      }

      if (isUnmounted) {
        return
      }

      try {
        await loadContainers()
      } catch {
        // Container store already manages error state.
      }
    }

    const onStorageChanged = (
      changes: Record<string, unknown>,
      areaName: string,
    ) => {
      if (areaName !== "local" || !changes.containers) {
        return
      }

      void loadContainers()
    }

    const onWindowFocus = () => {
      void refreshContainers()
    }

    const onVisibilityChange = () => {
      if (!document.hidden) {
        void refreshContainers()
      }
    }

    void refreshContainers()

    browser.storage?.onChanged?.addListener(
      onStorageChanged as (
        changes: browser.Storage.StorageAreaOnChangedChangesType,
        areaName: string,
      ) => void,
    )
    window.addEventListener("focus", onWindowFocus)
    document.addEventListener("visibilitychange", onVisibilityChange)

    return () => {
      isUnmounted = true
      browser.storage?.onChanged?.removeListener(
        onStorageChanged as (
          changes: browser.Storage.StorageAreaOnChangedChangesType,
          areaName: string,
        ) => void,
      )
      window.removeEventListener("focus", onWindowFocus)
      document.removeEventListener("visibilitychange", onVisibilityChange)
    }
  }, [loadContainers])

  React.useEffect(() => {
    return () => {
      if (statusTimerRef.current) {
        window.clearTimeout(statusTimerRef.current)
      }
    }
  }, [])

  React.useEffect(() => {
    if (mode === "home") {
      return
    }

    const frameId = window.requestAnimationFrame(() => {
      searchInputRef.current?.focus()
    })

    return () => {
      window.cancelAnimationFrame(frameId)
    }
  }, [mode])

  React.useEffect(() => {
    if (filteredContainers.length === 0) {
      setActiveResultIndex(-1)
      return
    }

    setActiveResultIndex((current) => {
      if (current < 0) {
        return 0
      }

      if (current >= filteredContainers.length) {
        return filteredContainers.length - 1
      }

      return current
    })
  }, [filteredContainers])

  const openInContainer = React.useCallback(
    async (params: {
      url?: string
      cookieStoreId?: string
      index?: number
      closeTabId?: number
    }) => {
      const response = (await browser.runtime.sendMessage({
        type: "OPEN_IN_CONTAINER",
        payload: params,
      })) as { success?: boolean; error?: string } | undefined

      if (!response?.success) {
        throw new Error(response?.error || "Failed to open tab in container")
      }
    },
    [],
  )

  const closePopup = React.useCallback(() => {
    window.close()
  }, [])

  const openCurrentPicker = React.useCallback(() => {
    setContainerQuery("")
    setActiveResultIndex(0)
    setMode("pick-current")
  }, [])

  const openNewPicker = React.useCallback(() => {
    setContainerQuery("")
    setActiveResultIndex(0)
    setMode("pick-new")
  }, [])

  const openCurrentTabInContainer = React.useCallback(
    async (container: Container) => {
      if (!currentTabUrl || currentTabId === undefined) {
        setStatusMessage("error", "No active tab to move")
        return
      }

      const targetStoreId = container.cookieStoreId
      const currentStoreId = currentCookieStoreId || "firefox-default"
      if (targetStoreId === currentStoreId) {
        setStatusMessage("info", `Already in ${container.name}`)
        return
      }

      const movableCurrentUrl = canMoveCurrentUrl(currentTabUrl)

      try {
        await openInContainer({
          ...(movableCurrentUrl ? { url: currentTabUrl } : {}),
          cookieStoreId:
            targetStoreId === "firefox-default" ? undefined : targetStoreId,
          index: currentTabIndex + 1,
          ...(movableCurrentUrl ? { closeTabId: currentTabId } : {}),
        })

        setStatusMessage(
          "success",
          movableCurrentUrl
            ? `Opened current tab in ${container.name}`
            : `Opened new tab in ${container.name}`,
        )
        closePopup()
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error)
        setStatusMessage("error", `Failed to move tab: ${message}`)
      }
    },
    [
      currentCookieStoreId,
      currentTabId,
      currentTabIndex,
      currentTabUrl,
      closePopup,
      openInContainer,
      setStatusMessage,
    ],
  )

  const openNewTabInContainer = React.useCallback(
    async (container: Container) => {
      try {
        await openInContainer({
          cookieStoreId:
            container.cookieStoreId === "firefox-default"
              ? undefined
              : container.cookieStoreId,
        })

        setStatusMessage("success", `Opened new tab in ${container.name}`)
        closePopup()
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error)
        setStatusMessage("error", `Failed to open tab: ${message}`)
      }
    },
    [closePopup, openInContainer, setStatusMessage],
  )

  const handleContainerClick = React.useCallback(
    (container: Container) => {
      if (mode === "pick-current") {
        void openCurrentTabInContainer(container)
        return
      }

      void openNewTabInContainer(container)
    },
    [mode, openCurrentTabInContainer, openNewTabInContainer],
  )

  const openInTemporaryContainer = React.useCallback(async () => {
    try {
      const tempName = currentHost !== "—" ? `Temp ${currentHost}` : "Temp"
      const created = await createContainer({
        name: tempName,
        temporary: true,
        metadata: {
          lifetime: "untilLastTab",
        },
      })

      const movableCurrentUrl = canMoveCurrentUrl(currentTabUrl)

      await openInContainer({
        ...(movableCurrentUrl ? { url: currentTabUrl } : {}),
        cookieStoreId: created.cookieStoreId,
        ...(movableCurrentUrl && currentTabId !== undefined
          ? { closeTabId: currentTabId, index: currentTabIndex + 1 }
          : currentTabId !== undefined
            ? { index: currentTabIndex + 1 }
            : {}),
      })

      setStatusMessage(
        "success",
        movableCurrentUrl
          ? `Opened in ${tempName}`
          : `Opened new tab in ${tempName}`,
      )
      closePopup()
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error)
      setStatusMessage(
        "error",
        `Failed to open in temporary container: ${message}`,
      )
    }
  }, [
    createContainer,
    currentHost,
    currentTabId,
    currentTabIndex,
    currentTabUrl,
    closePopup,
    openInContainer,
    setStatusMessage,
  ])

  const openManagement = React.useCallback(async () => {
    const params = new URLSearchParams({ page: "containers" })
    if (currentCookieStoreId !== "firefox-default") {
      params.set("container", currentCookieStoreId)
    }

    const optionsPath =
      browser.runtime.getManifest().options_ui?.page || "options_ui/page.html"
    const separator = optionsPath.includes("?") ? "&" : "?"
    const optionsUrl = browser.runtime.getURL(
      `${optionsPath}${separator}${params.toString()}`,
    )
    await browser.tabs.create({ url: optionsUrl })

    window.setTimeout(() => {
      window.close()
    }, 60)
  }, [currentCookieStoreId])

  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (mode !== "home") {
        return
      }

      const target = event.target as HTMLElement | null
      const tagName = target?.tagName?.toLowerCase()
      const isEditable =
        target &&
        (target.isContentEditable ||
          tagName === "input" ||
          tagName === "textarea" ||
          tagName === "select")

      if (isEditable) {
        return
      }

      if (event.key === "1") {
        event.preventDefault()
        openCurrentPicker()
        return
      }

      if (event.key === "2") {
        event.preventDefault()
        openNewPicker()
        return
      }

      if (event.key === "3") {
        event.preventDefault()
        void openInTemporaryContainer()
      }
    }

    window.addEventListener("keydown", onKeyDown)
    return () => {
      window.removeEventListener("keydown", onKeyDown)
    }
  }, [mode, openCurrentPicker, openInTemporaryContainer, openNewPicker])

  return (
    <div className="popup-shell">
      <header className="popup-header">
        <img
          src={browser.runtime.getURL("images/icon_128.png")}
          alt="Silo"
          className="brand-icon"
        />
        <div className="header-controls">
          <ThemeSwitcher compact />
        </div>
      </header>

      <section className="context-card" aria-label="Current tab context">
        <div className="context-row">
          <span className="context-label">Site</span>
          <span className="context-value">{currentHost}</span>
        </div>
        <div className="context-row">
          <span className="context-label">Current container</span>
          <span className="context-value">{currentContainerName}</span>
        </div>
        <div className="context-row">
          <span className="context-label">Title</span>
          <span className="context-value truncated">{currentTitle}</span>
        </div>
      </section>

      {mode === "home" ? (
        <section className="action-section" aria-label="Choose action">
          <div className="action-tabs">
            <button
              type="button"
              className="action-tab"
              aria-keyshortcuts="1"
              onClick={openCurrentPicker}
            >
              <span className="action-label">
                Open current tab in container
              </span>
              <kbd>1</kbd>
            </button>
            <button
              type="button"
              className="action-tab"
              aria-keyshortcuts="2"
              onClick={openNewPicker}
            >
              <span className="action-label">Open new tab in container</span>
              <kbd>2</kbd>
            </button>
          </div>

          <button
            type="button"
            className="primary-cta"
            aria-keyshortcuts="3"
            onClick={() => void openInTemporaryContainer()}
          >
            <span>Open in New Temp Container</span>
            <kbd>3</kbd>
          </button>
        </section>
      ) : (
        <section className="container-picker" aria-label="Choose container">
          <div className="picker-header">
            <button
              type="button"
              className="ghost-btn back-btn"
              onClick={() => setMode("home")}
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back
            </button>
            <label className="section-title m-0">
              {mode === "pick-current"
                ? "Select container for current tab"
                : "Select container for new tab"}
            </label>
          </div>

          <div className="search-wrap">
            <Search className="search-icon" />
            <input
              ref={searchInputRef}
              type="text"
              className="search-input"
              placeholder="Search containers..."
              value={containerQuery}
              onChange={(event) => {
                setContainerQuery(event.target.value)
                setActiveResultIndex(0)
              }}
              onKeyDown={(event) => {
                if (event.key === "ArrowDown") {
                  if (filteredContainers.length === 0) {
                    return
                  }

                  event.preventDefault()
                  setActiveResultIndex((current) =>
                    Math.min(current + 1, filteredContainers.length - 1),
                  )
                  return
                }

                if (event.key === "ArrowUp") {
                  if (filteredContainers.length === 0) {
                    return
                  }

                  event.preventDefault()
                  setActiveResultIndex((current) => Math.max(current - 1, 0))
                  return
                }

                if (event.key !== "Enter") {
                  return
                }

                const selectedContainer =
                  filteredContainers[activeResultIndex] || filteredContainers[0]
                if (!selectedContainer) {
                  return
                }

                event.preventDefault()
                handleContainerClick(selectedContainer)
              }}
            />
          </div>

          <div className="container-list">
            {filteredContainers.length === 0 && (
              <div className="empty-list">No matching containers</div>
            )}

            {filteredContainers.map((container, index) => {
              const isCurrent =
                container.cookieStoreId ===
                (currentCookieStoreId || "firefox-default")
              const isSelected = index === activeResultIndex

              return (
                <button
                  key={container.cookieStoreId}
                  type="button"
                  className={`container-option ${isCurrent ? "highlighted" : ""} ${
                    isSelected ? "selected" : ""
                  }`}
                  ref={
                    isSelected
                      ? (element) => {
                          selectedContainerRef.current = element
                          if (typeof element?.scrollIntoView === "function") {
                            element.scrollIntoView({ block: "nearest" })
                          }
                        }
                      : null
                  }
                  onClick={() => handleContainerClick(container)}
                >
                  <span
                    className="dot"
                    style={{ backgroundColor: colorToCss(container.color) }}
                  />
                  <span className="icon">{iconToEmoji(container.icon)}</span>
                  <span className="label">{container.name}</span>
                  {container.temporary && <span className="pill">Temp</span>}
                  {isCurrent && mode === "pick-current" && (
                    <span className="pill current">Current</span>
                  )}
                </button>
              )
            })}
          </div>
        </section>
      )}

      <footer className="popup-footer">
        <button
          type="button"
          className="footer-btn col-span-2"
          onClick={() => void openManagement()}
        >
          <ExternalLink className="w-4 h-4" />
          Open Management
        </button>
      </footer>

      {status.message && (
        <output className={`status-message ${status.kind}`} aria-live="polite">
          {status.kind === "success" && <ArrowRightLeft className="w-4 h-4" />}
          {status.kind === "error" && <Plus className="w-4 h-4 rotate-45" />}
          {(status.kind === "idle" || status.kind === "info") && (
            <Globe className="w-4 h-4" />
          )}
          <span>{status.message}</span>
        </output>
      )}
    </div>
  )
}
