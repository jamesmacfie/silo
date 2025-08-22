import React from "react"
import browser from "webextension-polyfill"
import type { Container } from "@/shared/types"
import { MatchType, RuleType } from "@/shared/types"
import {
  useContainers,
  useContainerActions,
  useContainerLoading,
  useRuleActions,
} from "@/ui/shared/stores"
import { ThemeSwitcher } from "@/ui/shared/components/ThemeSwitcher"

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

  React.useEffect(() => {
    if (
      containers.length &&
      !containers.find((c) => c.cookieStoreId === selectedCookieStoreId)
    ) {
      setSelectedCookieStoreId(containers[0].cookieStoreId)
    }
    return
  }, [containers, selectedCookieStoreId])

  const updateContextInfo = React.useCallback(async () => {
    try {
      const tab = await getActiveTab()
      if (tab?.url) {
        const url = new URL(tab.url as string)
        setCurrentHost(url.host || "—")
        const cookieStoreId = tab.cookieStoreId
        if (cookieStoreId && browser.contextualIdentities?.get) {
          try {
            const ci = await browser.contextualIdentities.get(cookieStoreId)
            setCurrentContainerName(
              ci?.name ||
                (cookieStoreId === "firefox-default" ? "No Container" : "—"),
            )
          } catch {
            setCurrentContainerName(
              cookieStoreId === "firefox-default" ? "No Container" : "—",
            )
          }
        } else {
          setCurrentContainerName(
            cookieStoreId === "firefox-default" ? "No Container" : "—",
          )
        }
      }
    } catch {
      // ignore
    }
    return
  }, [])

  React.useEffect(() => {
    updateContextInfo()
    return
  }, [updateContextInfo])

  const onRefresh = React.useCallback(async () => {
    setStatus("Refreshing…")
    await refetchContainers()
    await updateContextInfo()
    setStatus("")
    return
  }, [refetchContainers, updateContextInfo])

  const openInSelectedContainer = React.useCallback(async () => {
    try {
      const tab = await getActiveTab()
      if (!tab?.url) {
        setStatus("No active tab")
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
      setStatus(`Opened in ${isNoContainer ? "No Container" : "container"}`)
      return
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      setStatus(`Failed: ${msg}`)
      return
    }
  }, [selectedCookieStoreId])

  const createTemporaryContainer = React.useCallback(async () => {
    try {
      const name = `Temp ${new Date().toLocaleTimeString()}`
      const created = await createContainer({ name, temporary: true })
      if (created?.cookieStoreId) {
        setSelectedCookieStoreId(created.cookieStoreId)
      }
      setStatus("Temporary container created")
      return
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      setStatus(`Failed to create temp: ${msg}`)
      return
    }
  }, [createContainer])

  const quickAddCurrentDomain = React.useCallback(async () => {
    try {
      const tab = await getActiveTab()
      if (!tab?.url) {
        setStatus("No active tab")
        return
      }
      const { hostname } = new URL(tab.url as string)
      await createRule({
        containerId: selectedCookieStoreId,
        pattern: hostname,
        matchType: MatchType.DOMAIN,
        ruleType: RuleType.INCLUDE,
        priority: 1,
        enabled: true,
        metadata: { source: "user" },
      })
      setStatus(`Added rule for ${hostname}`)
      return
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      setStatus(`Failed to add rule: ${msg}`)
      return
    }
  }, [selectedCookieStoreId, createRule])

  const bookmarkCurrentTab = React.useCallback(async () => {
    try {
      const tab = await getActiveTab()
      if (!tab?.url) {
        setStatus("No active tab")
        return
      }
      const title = tab.title || new URL(tab.url as string).hostname
      const urlObj = new URL(tab.url as string)
      // Clean existing silo parameters
      urlObj.searchParams.delete("silo")
      // Add silo parameter based on selected container (not current tab container)
      if (
        selectedCookieStoreId &&
        selectedCookieStoreId !== "firefox-default"
      ) {
        urlObj.searchParams.append("silo", selectedCookieStoreId)
      }
      await browser.bookmarks.create({ title, url: urlObj.toString() })
      const containerName =
        containers.find((c) => c.cookieStoreId === selectedCookieStoreId)
          ?.name || "No Container"
      setStatus(`Bookmarked for ${containerName}`)
      return
    } catch (_e) {
      setStatus("Failed to create bookmark")
      return
    }
  }, [selectedCookieStoreId, containers])

  const onManageContainers = React.useCallback(async () => {
    // Use getURL to get the proper extension URL for the options page
    const optionsUrl = browser.runtime.getURL("options_ui/page.html")
    await browser.tabs.create({ url: optionsUrl })
    setTimeout(() => {
      window.close()
      return
    }, 50)
    return
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
            onClick={() => {
              onRefresh()
              return
            }}
          >
            {isLoading ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </div>

      <div id="contextInfo" className="context">
        Tab:{" "}
        <b>
          <span>{currentHost}</span>
        </b>
        <span className="ml-2">
          Current:{" "}
          <b>
            <span>{currentContainerName}</span>
          </b>
        </span>
      </div>

      <label htmlFor="containerSelect">Container</label>
      <select
        id="containerSelect"
        className="select"
        value={selectedCookieStoreId}
        onChange={(e) => {
          setSelectedCookieStoreId(e.target.value)
          return
        }}
      >
        {containers.map((c) => (
          <option key={c.cookieStoreId} value={c.cookieStoreId}>
            {c.name}
          </option>
        ))}
      </select>

      <div className="row mt-2">
        <button
          className="btn flex-1"
          type="button"
          onClick={() => {
            openInSelectedContainer()
            return
          }}
        >
          Open in container…
        </button>
        <button
          className="ghost small"
          title="Add a rule for the current domain"
          type="button"
          onClick={() => {
            quickAddCurrentDomain()
            return
          }}
        >
          + Add domain
        </button>
        <button
          className="ghost small"
          title="Create temporary container"
          type="button"
          onClick={() => {
            createTemporaryContainer()
            return
          }}
        >
          + Temp
        </button>
        <button
          className="ghost small"
          title="Create a bookmark for this page in the current container"
          type="button"
          onClick={() => {
            bookmarkCurrentTab()
            return
          }}
        >
          ⭐︎ Bookmark
        </button>
      </div>

      <div id="status" className="status">
        {status}
      </div>
      <div className="footerLink">
        <a
          className="link"
          href="/options.html"
          onClick={(e) => {
            e.preventDefault()
            onManageContainers()
            return
          }}
        >
          Manage Containers →
        </a>
      </div>
    </div>
  )
}
