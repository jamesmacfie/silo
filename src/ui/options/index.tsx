import React from "react"
import { createRoot } from "react-dom/client"
import browser from "webextension-polyfill"
import "@/ui/options/index.css"
import { BookmarksPage } from "@/ui/options/BookmarksPage"
import { ContainersPage } from "@/ui/options/ContainersPage"
import { Dashboard } from "@/ui/options/Dashboard"
import { ImportExportPage } from "@/ui/options/ImportExportPage"
import { RulesPage } from "@/ui/options/RulesPage"
import { PageHeader } from "@/ui/shared/components/PageHeader"
import { ThemeSwitcher } from "@/ui/shared/components/ThemeSwitcher"
import {
  useAppInitialization,
  useStoreEffects,
  useUIStateStore,
} from "@/ui/shared/stores"

type PageKey =
  | "dashboard"
  | "containers"
  | "rules"
  | "bookmarks"
  | "import-export"
  | "settings"

const NAV_ITEMS: Array<{ key: PageKey; label: string; shortcut: string }> = [
  { key: "dashboard", label: "Dashboard", shortcut: "1" },
  { key: "containers", label: "Containers", shortcut: "2" },
  { key: "rules", label: "Rules", shortcut: "3" },
  { key: "bookmarks", label: "Bookmarks", shortcut: "4" },
  { key: "import-export", label: "Import/Export", shortcut: "5" },
  { key: "settings", label: "Settings", shortcut: "6" },
]

const PAGE_KEYS = new Set(NAV_ITEMS.map((item) => item.key))

function isPageKey(value: string | null): value is PageKey {
  if (!value) {
    return false
  }

  return PAGE_KEYS.has(value as PageKey)
}

function readPageFromUrl(): PageKey {
  const params = new URLSearchParams(window.location.search)
  const page = params.get("page")
  return isPageKey(page) ? page : "containers"
}

function pushPageToUrl(page: PageKey): void {
  const params = new URLSearchParams(window.location.search)
  params.set("page", page)

  const url = `${window.location.pathname}?${params.toString()}`
  window.history.pushState({}, "", url)
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false
  }

  if (target.isContentEditable) {
    return true
  }

  const tagName = target.tagName
  return tagName === "INPUT" || tagName === "TEXTAREA" || tagName === "SELECT"
}

function PageShell(props: { children: React.ReactNode }): JSX.Element {
  return <div className="app">{props.children}</div>
}

function Sidebar(props: {
  current: PageKey
  onNavigate(page: PageKey): void
}): JSX.Element {
  return (
    <aside className="sidebar" aria-label="Primary navigation">
      <div className="brand">
        <div className="logo" />
        <h1>Silo</h1>
      </div>

      <div className="small mb-3">Press 1-6 to navigate</div>

      <nav className="nav">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.key}
            className={props.current === item.key ? "active" : ""}
            type="button"
            onClick={() => props.onNavigate(item.key)}
            aria-current={props.current === item.key ? "page" : undefined}
          >
            <span>{item.label}</span>
            <span className="text-xs opacity-70">{item.shortcut}</span>
          </button>
        ))}
      </nav>
    </aside>
  )
}

function Content(props: { children: React.ReactNode }): JSX.Element {
  return <main className="content">{props.children}</main>
}

function SettingsPage(): JSX.Element {
  const [popupShortcut, setPopupShortcut] = React.useState<string>("")
  const [shortcutError, setShortcutError] = React.useState<string>("")
  const [shortcutLoading, setShortcutLoading] = React.useState<boolean>(true)

  const refreshShortcut = React.useCallback(async () => {
    setShortcutLoading(true)
    setShortcutError("")

    try {
      if (!browser.commands?.getAll) {
        setPopupShortcut("Not available")
        return
      }

      const commands = await browser.commands.getAll()
      const popupCommand = commands.find(
        (command) => command.name === "_execute_browser_action",
      )
      setPopupShortcut(popupCommand?.shortcut || "Not set")
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error)
      setShortcutError(message)
      setPopupShortcut("Unavailable")
    } finally {
      setShortcutLoading(false)
    }
  }, [])

  React.useEffect(() => {
    void refreshShortcut()
  }, [refreshShortcut])

  const openShortcutSettings = React.useCallback(async () => {
    setShortcutError("")

    try {
      await browser.tabs.create({ url: "about:addons" })
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error)
      setShortcutError(
        `Could not open about:addons automatically (${message}). Open about:addons and use the gear menu -> Manage Extension Shortcuts.`,
      )
    }
  }, [])

  return (
    <div className="page">
      <PageHeader title="Settings" />
      <ThemeSwitcher />
      <section className="card mt-4">
        <div className="row">
          <div>
            <div className="name">Keyboard Shortcut</div>
            <div className="small mt-1">
              Global shortcut for opening the Silo popup in Firefox.
            </div>
          </div>
          <span className="badge info">
            {shortcutLoading ? "Loading..." : popupShortcut}
          </span>
        </div>

        <div className="small mt-3">
          Default: <strong>Alt+Shift+S</strong>
        </div>
        <div className="small mt-1">
          Customization: open Firefox shortcut settings and change Silo there.
        </div>

        <div className="actions mt-3">
          <button
            type="button"
            className="btn ghost sm"
            onClick={() => void openShortcutSettings()}
          >
            Open Shortcut Settings
          </button>
          <button
            type="button"
            className="btn ghost sm"
            onClick={() => void refreshShortcut()}
          >
            Refresh Shortcut
          </button>
        </div>

        {shortcutError && <div className="status">{shortcutError}</div>}
      </section>
    </div>
  )
}

function OptionsApp(): JSX.Element {
  const [page, setPage] = React.useState<PageKey>(readPageFromUrl)

  const applyUrlContext = React.useCallback(() => {
    const params = new URLSearchParams(window.location.search)
    const nextPage = readPageFromUrl()

    setPage(nextPage)

    const containerId = params.get("container")

    if (!containerId) {
      return
    }

    if (nextPage === "containers") {
      useUIStateStore
        .getState()
        .updatePageState("containers", { selectedContainerId: containerId })
      return
    }

    if (nextPage === "rules") {
      useUIStateStore
        .getState()
        .updatePageFilter("rules", "container", containerId)
    }
  }, [])

  React.useEffect(() => {
    applyUrlContext()

    const onPopState = () => {
      applyUrlContext()
    }

    window.addEventListener("popstate", onPopState)
    return () => window.removeEventListener("popstate", onPopState)
  }, [applyUrlContext])

  const navigate = React.useCallback((next: PageKey) => {
    setPage(next)
    pushPageToUrl(next)
  }, [])

  const navigateToRulesFromContainer = React.useCallback(
    (containerId: string) => {
      useUIStateStore
        .getState()
        .updatePageFilter("rules", "container", containerId)
      navigate("rules")
    },
    [navigate],
  )

  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target)) {
        return
      }

      if (event.key >= "1" && event.key <= "6") {
        const navItem = NAV_ITEMS[Number(event.key) - 1]
        if (navItem) {
          event.preventDefault()
          navigate(navItem.key)
        }
      }
    }

    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [navigate])

  return (
    <PageShell>
      <Sidebar current={page} onNavigate={navigate} />
      <Content>
        {page === "dashboard" && <Dashboard />}
        {page === "containers" && (
          <ContainersPage onNavigateToRules={navigateToRulesFromContainer} />
        )}
        {page === "rules" && <RulesPage />}
        {page === "bookmarks" && <BookmarksPage />}
        {page === "import-export" && <ImportExportPage />}
        {page === "settings" && <SettingsPage />}
      </Content>
    </PageShell>
  )
}

function App(): JSX.Element {
  const { isInitialized, initializationError, retry } = useAppInitialization()

  // Set up cross-store effects
  useStoreEffects()

  if (initializationError) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center min-h-screen">
        <div className="text-red-600 dark:text-red-400 mb-4 text-lg">
          Failed to initialize app
        </div>
        <div className="text-sm text-gray-600 dark:text-gray-400 mb-6 max-w-md">
          {initializationError}
        </div>
        <button
          type="button"
          onClick={retry}
          className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
        >
          Retry
        </button>
      </div>
    )
  }

  if (!isInitialized) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg text-gray-600 dark:text-gray-400">
          Loading...
        </div>
      </div>
    )
  }

  return <OptionsApp />
}

const mount = document.getElementById("root")
if (mount) {
  const root = createRoot(mount)
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  )
}
