import React from "react"
import browser from "webextension-polyfill"
import type { Container } from "@/shared/types"
import { MatchType, RuleType } from "@/shared/types"
import { colorToCss, iconToEmoji } from "@/shared/utils/containerHelpers"
import { ThemeSwitcher } from "@/ui/shared/components/ThemeSwitcher"
import {
  useContainerActions,
  useContainerLoading,
  useContainers,
  useRuleActions,
} from "@/ui/shared/stores"

type Props = Record<string, never>

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

export function PopupApp(_props: Props): JSX.Element {
  const containersData = useContainers()
  const { load: refetchContainers, create: createContainer } =
    useContainerActions()
  const { create: createRule } = useRuleActions()
  const isLoading = useContainerLoading()

  const containers: Container[] = React.useMemo(() => {
    return [NO_CONTAINER_OPTION, ...containersData]
  }, [containersData])

  const [selectedCookieStoreId, setSelectedCookieStoreId] =
    React.useState<string>("firefox-default")
  const [currentHost, setCurrentHost] = React.useState<string>("—")
  const [currentContainerName, setCurrentContainerName] =
    React.useState<string>("—")
  const [status, setStatus] = React.useState<string>("")
  const [isSelectorOpen, setIsSelectorOpen] = React.useState(false)
  const [containerQuery, setContainerQuery] = React.useState("")
  const selectorRef = React.useRef<HTMLDivElement>(null)
  const isMountedRef = React.useRef(true)
  const hasUserChosenContainerRef = React.useRef(false)

  const selectedContainer = React.useMemo(
    () =>
      containers.find(
        (container) => container.cookieStoreId === selectedCookieStoreId,
      ) || NO_CONTAINER_OPTION,
    [containers, selectedCookieStoreId],
  )

  const filteredContainers = React.useMemo(() => {
    const trimmedQuery = containerQuery.trim().toLowerCase()
    if (!trimmedQuery) {
      return containers
    }

    return containers.filter((container) =>
      container.name.toLowerCase().includes(trimmedQuery),
    )
  }, [containers, containerQuery])

  React.useEffect(() => {
    if (
      containers.length > 0 &&
      !containers.find(
        (container) => container.cookieStoreId === selectedCookieStoreId,
      )
    ) {
      setSelectedCookieStoreId(containers[0].cookieStoreId)
    }
  }, [containers, selectedCookieStoreId])

  React.useEffect(() => {
    return () => {
      isMountedRef.current = false
    }
  }, [])

  React.useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (
        selectorRef.current &&
        !selectorRef.current.contains(event.target as Node)
      ) {
        setIsSelectorOpen(false)
      }
    }

    document.addEventListener("mousedown", handlePointerDown)
    return () => {
      document.removeEventListener("mousedown", handlePointerDown)
    }
  }, [])

  const updateContextInfo = React.useCallback(async () => {
    try {
      const tab = await getActiveTab()
      if (!tab) {
        if (isMountedRef.current) {
          setCurrentHost("—")
          setCurrentContainerName("—")
        }
        return
      }

      if (isMountedRef.current) {
        setCurrentHost(getDisplayHost(tab.url))
      }

      const cookieStoreId = tab.cookieStoreId
      if (!cookieStoreId) {
        if (isMountedRef.current) {
          setCurrentContainerName("No Container")
        }
        return
      }

      const knownContainer = containersData.find(
        (container) => container.cookieStoreId === cookieStoreId,
      )
      if (knownContainer) {
        if (isMountedRef.current) {
          setCurrentContainerName(knownContainer.name)
        }

        if (
          !hasUserChosenContainerRef.current &&
          selectedCookieStoreId === "firefox-default"
        ) {
          setSelectedCookieStoreId(knownContainer.cookieStoreId)
        }
        return
      }

      if (cookieStoreId === "firefox-default") {
        if (isMountedRef.current) {
          setCurrentContainerName("No Container")
        }
        return
      }

      if (browser.contextualIdentities?.get) {
        try {
          const identity = await browser.contextualIdentities.get(cookieStoreId)
          if (isMountedRef.current) {
            setCurrentContainerName(identity?.name || "Unknown")
          }
          return
        } catch {
          if (isMountedRef.current) {
            setCurrentContainerName("Unknown")
          }
        }
      }
    } catch {
      if (isMountedRef.current) {
        setCurrentHost("—")
        setCurrentContainerName("—")
      }
    }
  }, [containersData, selectedCookieStoreId])

  React.useEffect(() => {
    void updateContextInfo()
  }, [updateContextInfo])

  const onRefresh = React.useCallback(async () => {
    try {
      setStatus("Refreshing…")
      await refetchContainers()
      await updateContextInfo()
      setStatus("")
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error)
      setStatus(`Refresh failed: ${message}`)
    }
  }, [refetchContainers, updateContextInfo])

  const openInSelectedContainer = React.useCallback(async () => {
    try {
      const tab = await getActiveTab()
      if (!tab?.url) {
        setStatus("No active tab")
        return
      }

      const currentCookieStoreId = tab.cookieStoreId || "firefox-default"
      if (currentCookieStoreId === selectedCookieStoreId) {
        setStatus(`Already in ${selectedContainer.name}`)
        return
      }

      const isNoContainer = selectedCookieStoreId === "firefox-default"
      await browser.runtime.sendMessage({
        type: "OPEN_IN_CONTAINER",
        payload: {
          url: tab.url,
          cookieStoreId: isNoContainer ? undefined : selectedCookieStoreId,
          index: (tab.index ?? 0) + 1,
          closeTabId: tab.id,
        },
      })
      setStatus(`Opened in ${selectedContainer.name}`)
      await updateContextInfo()
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error)
      setStatus(`Failed: ${message}`)
    }
  }, [selectedCookieStoreId, selectedContainer.name, updateContextInfo])

  const createTemporaryContainer = React.useCallback(async () => {
    try {
      const name = `Temp ${new Date().toLocaleTimeString()}`
      const created = await createContainer({ name, temporary: true })
      if (created?.cookieStoreId) {
        hasUserChosenContainerRef.current = true
        setSelectedCookieStoreId(created.cookieStoreId)
      }
      setStatus("Temporary container created")
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error)
      setStatus(`Failed to create temp: ${message}`)
    }
  }, [createContainer])

  const quickAddCurrentDomain = React.useCallback(async () => {
    try {
      if (selectedCookieStoreId === "firefox-default") {
        setStatus("Select a container before creating a domain rule")
        return
      }

      const tab = await getActiveTab()
      if (!tab?.url) {
        setStatus("No active tab")
        return
      }

      const { hostname } = new URL(tab.url)
      await createRule({
        containerId: selectedCookieStoreId,
        pattern: hostname,
        matchType: MatchType.DOMAIN,
        ruleType: RuleType.INCLUDE,
        priority: 1,
        enabled: true,
        metadata: { source: "user" },
      })
      setStatus(`Added include rule for ${hostname}`)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error)
      setStatus(`Failed to add rule: ${message}`)
    }
  }, [selectedCookieStoreId, createRule])

  const bookmarkCurrentTab = React.useCallback(async () => {
    try {
      const tab = await getActiveTab()
      if (!tab?.url) {
        setStatus("No active tab")
        return
      }

      const title = tab.title || new URL(tab.url).hostname
      const url = new URL(tab.url)
      url.searchParams.delete("silo")

      if (
        selectedCookieStoreId &&
        selectedCookieStoreId !== "firefox-default"
      ) {
        url.searchParams.set("silo", selectedCookieStoreId)
      }

      await browser.bookmarks.create({ title, url: url.toString() })
      setStatus(`Bookmarked for ${selectedContainer.name}`)
    } catch {
      setStatus("Failed to create bookmark")
    }
  }, [selectedCookieStoreId, selectedContainer.name])

  const onManageContainers = React.useCallback(async () => {
    if (typeof browser.runtime.openOptionsPage === "function") {
      await browser.runtime.openOptionsPage()
    } else {
      const optionsUrl = browser.runtime.getURL("options.html")
      await browser.tabs.create({ url: optionsUrl })
    }

    setTimeout(() => {
      window.close()
    }, 50)
  }, [])

  return (
    <div className="popup">
      <div className="header">
        <div className="brand">
          <div className="logo" />
          <h3 className="title">Silo</h3>
        </div>
        <div className="header-actions">
          <ThemeSwitcher compact />
          <button
            className="ghost"
            title="Refresh"
            type="button"
            onClick={() => void onRefresh()}
          >
            {isLoading ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </div>

      <div className="context">
        <div className="context-row">
          <span className="context-label">Site</span>
          <b>{currentHost}</b>
        </div>
        <div className="context-row">
          <span className="context-label">Current</span>
          <b>{currentContainerName}</b>
        </div>
      </div>

      <label className="section-label" htmlFor="containerSearch">
        Target container
      </label>
      <div className="selector" ref={selectorRef}>
        <button
          type="button"
          className="selector-trigger"
          onClick={() => setIsSelectorOpen((open) => !open)}
          aria-expanded={isSelectorOpen}
          aria-haspopup="listbox"
        >
          <div className="selector-value">
            <span
              className="container-dot"
              style={{ backgroundColor: colorToCss(selectedContainer.color) }}
            />
            <span className="container-icon">
              {iconToEmoji(selectedContainer.icon)}
            </span>
            <span className="container-name">{selectedContainer.name}</span>
          </div>
          <span className="selector-arrow">{isSelectorOpen ? "▴" : "▾"}</span>
        </button>

        {isSelectorOpen && (
          <div className="selector-panel">
            <input
              id="containerSearch"
              className="selector-search"
              type="text"
              placeholder="Search containers..."
              value={containerQuery}
              onChange={(event) => setContainerQuery(event.target.value)}
            />
            <div className="selector-list" role="listbox">
              {filteredContainers.length === 0 && (
                <div className="selector-empty">No matching containers</div>
              )}
              {filteredContainers.map((container) => (
                <button
                  key={container.cookieStoreId}
                  type="button"
                  className={`selector-option ${
                    container.cookieStoreId === selectedCookieStoreId
                      ? "active"
                      : ""
                  }`}
                  onClick={() => {
                    hasUserChosenContainerRef.current = true
                    setSelectedCookieStoreId(container.cookieStoreId)
                    setIsSelectorOpen(false)
                    setContainerQuery("")
                  }}
                  role="option"
                  aria-selected={
                    container.cookieStoreId === selectedCookieStoreId
                  }
                >
                  <span
                    className="container-dot"
                    style={{ backgroundColor: colorToCss(container.color) }}
                  />
                  <span className="container-icon">
                    {iconToEmoji(container.icon)}
                  </span>
                  <span className="container-name">{container.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <button
        className="btn primary"
        type="button"
        onClick={() => void openInSelectedContainer()}
      >
        Open This Tab In {selectedContainer.name}
      </button>

      <div className="actions-grid">
        <button
          className="ghost action-button"
          title="Add an include rule for this domain"
          type="button"
          onClick={() => void quickAddCurrentDomain()}
        >
          + Domain Rule
        </button>
        <button
          className="ghost action-button"
          title="Create temporary container"
          type="button"
          onClick={() => void createTemporaryContainer()}
        >
          + Temporary
        </button>
        <button
          className="ghost action-button"
          title="Create a bookmark for this page in the target container"
          type="button"
          onClick={() => void bookmarkCurrentTab()}
        >
          Bookmark
        </button>
      </div>

      <div className="status">{status}</div>

      <div className="footerLink">
        <a
          className="link"
          href="/options.html"
          onClick={(event) => {
            event.preventDefault()
            void onManageContainers()
          }}
        >
          Manage Containers →
        </a>
      </div>
    </div>
  )
}
