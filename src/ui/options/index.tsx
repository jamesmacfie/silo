import React from "react"
import { createRoot } from "react-dom/client"
import "@/ui/options/index.css"
import type { CSVImportResult } from "@/shared/utils/csv"
import { BookmarksPage } from "@/ui/options/BookmarksPage"
import { ContainersPage } from "@/ui/options/ContainersPage"
import { Dashboard } from "@/ui/options/Dashboard"
import { RulesPage } from "@/ui/options/RulesPage"
import { TagsPage } from "@/ui/options/TagsPage"
import { CSVImportExport } from "@/ui/shared/components/CSVImportExport"
import { InterceptorTest } from "@/ui/shared/components/InterceptorTest"
import { PageHeader } from "@/ui/shared/components/PageHeader"
import { StatusBar } from "@/ui/shared/components/StatusBar"
import { ThemeSwitcher } from "@/ui/shared/components/ThemeSwitcher"
import { useAppInitialization, useStoreEffects } from "@/ui/shared/stores"

function PageShell(props: { children: React.ReactNode }): JSX.Element {
  return <div className="app">{props.children}</div>
}

function Sidebar(props: {
  current: string
  onNavigate(page: string): void
}): JSX.Element {
  const nav = [
    { key: "dashboard", label: "Dashboard" },
    { key: "containers", label: "Containers" },
    { key: "rules", label: "Rules" },
    { key: "bookmarks", label: "Bookmarks" },
    { key: "tags", label: "Tags" },
    { key: "import-export", label: "Import/Export" },
    { key: "settings", label: "Settings" },
  ]
  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="logo" />
        <h1>Silo</h1>
      </div>
      <div className="nav">
        {nav.map((n) => (
          <button
            key={n.key}
            className={props.current === n.key ? "active" : ""}
            type="button"
            onClick={() => {
              props.onNavigate(n.key)
              return
            }}
          >
            {n.label}
          </button>
        ))}
      </div>
    </aside>
  )
}

function Content(props: { children: React.ReactNode }): JSX.Element {
  return <main className="content">{props.children}</main>
}
function ImportExportPage(): JSX.Element {
  const [status, setStatus] = React.useState("")

  const handleImportComplete = React.useCallback((result: CSVImportResult) => {
    const { rules, errors, warnings } = result
    let message = `Imported ${rules.length} rules`
    if (warnings.length > 0) message += ` with ${warnings.length} warnings`
    if (errors.length > 0) message += ` and ${errors.length} errors`
    setStatus(message)

    // Clear status after 5 seconds
    setTimeout(() => setStatus(""), 5000)
  }, [])

  const handleError = React.useCallback((error: string) => {
    setStatus(`Error: ${error}`)
    setTimeout(() => setStatus(""), 5000)
  }, [])

  return (
    <div className="page">
      <PageHeader title="Import/Export" />
      {status && <StatusBar message={status} />}
      <CSVImportExport
        onImportComplete={handleImportComplete}
        onError={handleError}
      />
    </div>
  )
}

function SettingsPage(): JSX.Element {
  return (
    <div className="page">
      <PageHeader title="Settings" />
      <ThemeSwitcher />
      <InterceptorTest />
      <div className="small">More settings coming soon.</div>
    </div>
  )
}

function OptionsApp(): JSX.Element {
  const [page, setPage] = React.useState<string>("containers")
  return (
    <PageShell>
      <Sidebar
        current={page}
        onNavigate={(p) => {
          setPage(p)
          return
        }}
      />
      <Content>
        {page === "dashboard" && <Dashboard />}
        {page === "containers" && <ContainersPage />}
        {page === "rules" && <RulesPage />}
        {page === "bookmarks" && <BookmarksPage />}
        {page === "tags" && <TagsPage />}
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
