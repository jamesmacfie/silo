import {
  ArrowDownUp,
  Check,
  CircleSlash,
  Cookie,
  Edit3,
  Filter,
  Keyboard,
  Package,
  Plus,
  RefreshCw,
  Shield,
  Sparkles,
  Trash2,
} from "lucide-react"
import React from "react"
import type { Container } from "../../shared/types/container"
import type { Rule } from "../../shared/types/rule"
import { ColorDot } from "../shared/components/ColorDot"
import { containerColorToCss } from "../shared/components/ColorSelector"
import {
  Button,
  EmptyState,
  PageHeader,
  PageLayout,
  StatusBar,
} from "../shared/components/layout"
import {
  useContainerActions,
  useContainers,
  useContainersPageState,
  useRules,
} from "../shared/stores"
import { ContainerModal } from "./ContainerModal"
import { ContainerPresetWizard } from "./ContainerPresetWizard"

type ContainerSort = "name" | "rules" | "modified" | "created"

const SORT_OPTIONS: Array<{ value: ContainerSort; label: string }> = [
  { value: "name", label: "Name" },
  { value: "rules", label: "Rule Count" },
  { value: "modified", label: "Last Modified" },
  { value: "created", label: "Created" },
]

interface ContainersPageProps {
  onNavigateToRules?: (containerId: string) => void
}

function isTemporaryContainer(container: Container): boolean {
  return Boolean(
    container.temporary || container.metadata?.lifetime === "untilLastTab",
  )
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

function RuleBadge({ rule }: { rule: Rule }): JSX.Element {
  const typeClass =
    rule.ruleType === "restrict"
      ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
      : rule.ruleType === "exclude"
        ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
        : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"

  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${typeClass}`}>
      {rule.ruleType}
    </span>
  )
}

export function ContainersPage({
  onNavigateToRules,
}: ContainersPageProps): JSX.Element {
  const containers = useContainers()
  const rules = useRules()

  const {
    load: syncContainers,
    delete: deleteContainer,
    clearCookies: clearContainerData,
  } = useContainerActions()

  const {
    searchQuery,
    sortBy,
    sortOrder,
    filters,
    selectedContainerId,
    updateState,
    updateFilter,
    updateSort,
  } = useContainersPageState()

  const searchInputRef = React.useRef<HTMLInputElement>(null)

  const [containerModalState, setContainerModalState] = React.useState<{
    isOpen: boolean
    mode: "create" | "edit"
    container?: Container
  }>({ isOpen: false, mode: "create" })

  const [isSyncing, setIsSyncing] = React.useState(false)
  const [isPresetWizardOpen, setIsPresetWizardOpen] = React.useState(false)

  const containerRuleCounts = React.useMemo(() => {
    const counts = new Map<string, number>()

    rules.forEach((rule) => {
      if (!rule.containerId) {
        return
      }

      counts.set(rule.containerId, (counts.get(rule.containerId) || 0) + 1)
    })

    return counts
  }, [rules])

  const lifecycleFilter = filters.lifecycle || ""

  const filteredContainers = React.useMemo(() => {
    const query = searchQuery.trim().toLowerCase()

    const next = containers.filter((container) => {
      if (query) {
        const searchable = [
          container.name,
          container.cookieStoreId,
          container.metadata?.description || "",
        ]
          .join(" ")
          .toLowerCase()

        if (!searchable.includes(query)) {
          return false
        }
      }

      if (filters.hasRules === "yes") {
        const count = containerRuleCounts.get(container.cookieStoreId) || 0
        if (count === 0) {
          return false
        }
      }

      if (filters.hasRules === "no") {
        const count = containerRuleCounts.get(container.cookieStoreId) || 0
        if (count > 0) {
          return false
        }
      }

      if (filters.color && container.color !== filters.color) {
        return false
      }

      if (lifecycleFilter === "temporary" && !isTemporaryContainer(container)) {
        return false
      }

      if (lifecycleFilter === "permanent" && isTemporaryContainer(container)) {
        return false
      }

      return true
    })

    const activeSort = SORT_OPTIONS.some((option) => option.value === sortBy)
      ? (sortBy as ContainerSort)
      : "name"

    next.sort((a, b) => {
      let result = 0

      switch (activeSort) {
        case "name":
          result = a.name.localeCompare(b.name)
          break
        case "rules": {
          const aCount = containerRuleCounts.get(a.cookieStoreId) || 0
          const bCount = containerRuleCounts.get(b.cookieStoreId) || 0
          result = aCount - bCount
          break
        }
        case "modified":
          result = (a.modified || 0) - (b.modified || 0)
          break
        case "created":
          result = (a.created || 0) - (b.created || 0)
          break
      }

      return sortOrder === "asc" ? result : -result
    })

    return next
  }, [
    containerRuleCounts,
    containers,
    filters.color,
    filters.hasRules,
    lifecycleFilter,
    searchQuery,
    sortBy,
    sortOrder,
  ])

  const selectedContainer = React.useMemo(
    () =>
      filteredContainers.find(
        (container) => container.cookieStoreId === selectedContainerId,
      ) || filteredContainers[0],
    [filteredContainers, selectedContainerId],
  )

  const selectedContainerRules = React.useMemo(() => {
    if (!selectedContainer) {
      return []
    }

    return rules
      .filter((rule) => rule.containerId === selectedContainer.cookieStoreId)
      .sort((a, b) => b.priority - a.priority)
  }, [rules, selectedContainer])

  React.useEffect(() => {
    if (!selectedContainer) {
      if (selectedContainerId) {
        updateState({ selectedContainerId: "" })
      }
      return
    }

    if (selectedContainer.cookieStoreId !== selectedContainerId) {
      updateState({ selectedContainerId: selectedContainer.cookieStoreId })
    }
  }, [selectedContainer, selectedContainerId, updateState])

  const totalCount = containers.length
  const withRulesCount = React.useMemo(() => {
    return containers.filter(
      (container) =>
        (containerRuleCounts.get(container.cookieStoreId) || 0) > 0,
    ).length
  }, [containerRuleCounts, containers])

  const temporaryCount = React.useMemo(
    () =>
      containers.filter((container) => isTemporaryContainer(container)).length,
    [containers],
  )

  const hasActiveFilters = Boolean(
    searchQuery || filters.hasRules || filters.color || lifecycleFilter,
  )

  const openCreateContainerModal = React.useCallback(() => {
    setContainerModalState({ isOpen: true, mode: "create" })
  }, [])

  const openEditContainerModal = React.useCallback((container: Container) => {
    setContainerModalState({ isOpen: true, mode: "edit", container })
  }, [])

  const closeContainerModal = React.useCallback(() => {
    setContainerModalState((prev) => ({ ...prev, isOpen: false }))
  }, [])

  const handleClearCookies = React.useCallback(
    async (container: Container) => {
      if (
        !confirm(
          `Clear all cookies and site data for "${container.name}"? This cannot be undone.`,
        )
      ) {
        return
      }

      await clearContainerData(container.cookieStoreId)
    },
    [clearContainerData],
  )

  const handleDeleteContainer = React.useCallback(
    async (container: Container) => {
      const relatedRules = containerRuleCounts.get(container.cookieStoreId) || 0
      const message =
        relatedRules > 0
          ? `Delete "${container.name}" and ${relatedRules} linked rule(s)?`
          : `Delete "${container.name}"?`

      if (!confirm(message)) {
        return
      }

      await deleteContainer(container.cookieStoreId)
    },
    [containerRuleCounts, deleteContainer],
  )

  const handleSync = React.useCallback(async () => {
    setIsSyncing(true)
    try {
      await syncContainers()
    } finally {
      setIsSyncing(false)
    }
  }, [syncContainers])

  const navigateToRules = React.useCallback(() => {
    if (selectedContainer && onNavigateToRules) {
      onNavigateToRules(selectedContainer.cookieStoreId)
    }
  }, [onNavigateToRules, selectedContainer])

  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (containerModalState.isOpen) {
        return
      }

      const editable = isEditableTarget(event.target)

      if (event.key === "/" && !editable) {
        event.preventDefault()
        searchInputRef.current?.focus()
        searchInputRef.current?.select()
        return
      }

      if (editable) {
        return
      }

      if (event.key.toLowerCase() === "n") {
        event.preventDefault()
        openCreateContainerModal()
        return
      }

      if (event.key.toLowerCase() === "j") {
        event.preventDefault()
        if (!selectedContainer || filteredContainers.length === 0) {
          return
        }

        const currentIndex = filteredContainers.findIndex(
          (container) =>
            container.cookieStoreId === selectedContainer.cookieStoreId,
        )
        const next =
          filteredContainers[
            Math.min(currentIndex + 1, filteredContainers.length - 1)
          ]
        if (next) {
          updateState({ selectedContainerId: next.cookieStoreId })
        }
        return
      }

      if (event.key.toLowerCase() === "k") {
        event.preventDefault()
        if (!selectedContainer || filteredContainers.length === 0) {
          return
        }

        const currentIndex = filteredContainers.findIndex(
          (container) =>
            container.cookieStoreId === selectedContainer.cookieStoreId,
        )
        const next = filteredContainers[Math.max(currentIndex - 1, 0)]
        if (next) {
          updateState({ selectedContainerId: next.cookieStoreId })
        }
        return
      }

      if (!selectedContainer) {
        return
      }

      if (event.key.toLowerCase() === "e") {
        event.preventDefault()
        openEditContainerModal(selectedContainer)
        return
      }

      if (event.key.toLowerCase() === "c") {
        event.preventDefault()
        void handleClearCookies(selectedContainer)
        return
      }

      if (event.key === "Delete" || (event.key === "Backspace" && !editable)) {
        event.preventDefault()
        void handleDeleteContainer(selectedContainer)
        return
      }

      if (event.key.toLowerCase() === "r") {
        event.preventDefault()
        navigateToRules()
      }
    }

    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [
    containerModalState.isOpen,
    filteredContainers,
    handleClearCookies,
    handleDeleteContainer,
    navigateToRules,
    openCreateContainerModal,
    openEditContainerModal,
    selectedContainer,
    updateState,
  ])

  const pageDescription =
    "Manage containers as workflow units. Select a container to audit rules, cleanup data, and tune lifecycle behavior."

  return (
    <PageLayout className="space-y-4">
      <PageHeader
        title="Container Management"
        description={pageDescription}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={() => void handleSync()}>
              <RefreshCw
                className={`w-4 h-4 mr-2 ${isSyncing ? "animate-spin" : ""}`}
              />
              Sync
            </Button>
            <Button
              variant="secondary"
              onClick={() => setIsPresetWizardOpen(true)}
            >
              <Sparkles className="w-4 h-4 mr-2" />
              Presets
            </Button>
            <Button onClick={openCreateContainerModal}>
              <Plus className="w-4 h-4 mr-2" />
              New Container
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3">
          <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Total
          </p>
          <p className="text-2xl font-semibold mt-1">{totalCount}</p>
        </div>

        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3">
          <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
            With Rules
          </p>
          <p className="text-2xl font-semibold mt-1">{withRulesCount}</p>
        </div>

        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3">
          <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Without Rules
          </p>
          <p className="text-2xl font-semibold mt-1">
            {Math.max(totalCount - withRulesCount, 0)}
          </p>
        </div>

        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3">
          <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Temporary
          </p>
          <p className="text-2xl font-semibold mt-1">{temporaryCount}</p>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex flex-wrap items-center gap-2">
          <div className="flex-1 min-w-[220px]">
            <input
              ref={searchInputRef}
              type="text"
              className="w-full h-9 px-3 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
              placeholder="Search by name, ID, or description"
              value={searchQuery}
              onChange={(event) =>
                updateState({ searchQuery: event.target.value })
              }
            />
          </div>

          <div className="flex items-center gap-2">
            <select
              value={sortBy}
              onChange={(event) => updateSort(event.target.value)}
              className="h-9 px-3 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            <button
              type="button"
              className="h-9 px-3 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 inline-flex items-center gap-1"
              onClick={() => updateSort(sortBy)}
              title="Toggle sort direction"
            >
              <ArrowDownUp className="w-4 h-4" />
              {sortOrder === "asc" ? "Asc" : "Desc"}
            </button>

            <button
              type="button"
              className={`h-9 px-3 text-sm rounded-lg border inline-flex items-center gap-1 ${
                filters.hasRules
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600"
              }`}
              onClick={() =>
                updateFilter(
                  "hasRules",
                  filters.hasRules === "yes" ? "" : "yes",
                )
              }
            >
              <Filter className="w-4 h-4" />
              Has rules
            </button>

            <button
              type="button"
              className={`h-9 px-3 text-sm rounded-lg border ${
                lifecycleFilter
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600"
              }`}
              onClick={() =>
                updateFilter(
                  "lifecycle",
                  lifecycleFilter === "temporary" ? "" : "temporary",
                )
              }
            >
              Temporary
            </button>

            {hasActiveFilters && (
              <button
                type="button"
                className="h-9 px-3 text-sm rounded-lg border border-red-300 text-red-600 hover:bg-red-50 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-900/30"
                onClick={() =>
                  updateState({
                    searchQuery: "",
                    filters: {
                      hasRules: "",
                      color: "",
                      lifecycle: "",
                    },
                  })
                }
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {filteredContainers.length === 0 ? (
          <div className="p-4">
            <EmptyState
              icon={<Package className="w-12 h-12" />}
              title={
                hasActiveFilters ? "No containers match" : "No containers yet"
              }
              description={
                hasActiveFilters
                  ? "Adjust filters or search terms to continue."
                  : "Create your first container to start routing sites."
              }
              action={
                !hasActiveFilters ? (
                  <Button onClick={openCreateContainerModal}>
                    <Plus className="w-4 h-4 mr-2" />
                    Create Container
                  </Button>
                ) : undefined
              }
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_390px]">
            <div className="border-b xl:border-b-0 xl:border-r border-gray-200 dark:border-gray-700">
              <ul className="divide-y divide-gray-200 dark:divide-gray-700">
                {filteredContainers.map((container) => {
                  const count =
                    containerRuleCounts.get(container.cookieStoreId) || 0
                  const isSelected =
                    selectedContainer?.cookieStoreId === container.cookieStoreId

                  return (
                    <li key={container.cookieStoreId}>
                      <button
                        type="button"
                        className={`w-full px-4 py-3 text-left transition-colors ${
                          isSelected
                            ? "bg-blue-50 dark:bg-blue-900/20"
                            : "hover:bg-gray-50 dark:hover:bg-gray-800/60"
                        }`}
                        onClick={() =>
                          updateState({
                            selectedContainerId: container.cookieStoreId,
                          })
                        }
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <ColorDot
                                color={containerColorToCss(container.color)}
                                size="sm"
                              />
                              <p className="text-sm font-semibold truncate">
                                {container.name}
                              </p>
                              {isTemporaryContainer(container) && (
                                <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                                  Temp
                                </span>
                              )}
                              {!container.syncEnabled && (
                                <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200">
                                  Manual
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 truncate">
                              {container.cookieStoreId}
                            </p>
                            {container.metadata?.description && (
                              <p className="text-xs text-gray-600 dark:text-gray-300 mt-1 line-clamp-2">
                                {container.metadata.description}
                              </p>
                            )}
                          </div>

                          <div className="text-right shrink-0">
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              Rules
                            </p>
                            <p className="text-sm font-semibold">{count}</p>
                          </div>
                        </div>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </div>

            <aside className="p-4">
              {selectedContainer ? (
                <div className="space-y-4">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                      Selected Container
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <ColorDot
                        color={containerColorToCss(selectedContainer.color)}
                        size="sm"
                      />
                      <h2 className="text-xl font-semibold">
                        {selectedContainer.name}
                      </h2>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 break-all">
                      {selectedContainer.cookieStoreId}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-2.5">
                      <p className="text-gray-500 dark:text-gray-400">Rules</p>
                      <p className="text-lg font-semibold">
                        {containerRuleCounts.get(
                          selectedContainer.cookieStoreId,
                        ) || 0}
                      </p>
                    </div>
                    <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-2.5">
                      <p className="text-gray-500 dark:text-gray-400">
                        Lifecycle
                      </p>
                      <p className="text-lg font-semibold">
                        {isTemporaryContainer(selectedContainer)
                          ? "Temporary"
                          : "Permanent"}
                      </p>
                    </div>
                    <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-2.5 col-span-2">
                      <p className="text-gray-500 dark:text-gray-400">
                        Sync mode
                      </p>
                      <p className="text-lg font-semibold">
                        {selectedContainer.syncEnabled ? "Synced" : "Manual"}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => openEditContainerModal(selectedContainer)}
                    >
                      <Edit3 className="w-4 h-4 mr-1.5" />
                      Edit
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => void handleClearCookies(selectedContainer)}
                    >
                      <Cookie className="w-4 h-4 mr-1.5" />
                      Clear Cookies
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        void handleDeleteContainer(selectedContainer)
                      }
                      className="text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                    >
                      <Trash2 className="w-4 h-4 mr-1.5" />
                      Delete
                    </Button>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-sm font-semibold">Related Rules</h3>
                      <button
                        type="button"
                        className="text-xs text-blue-600 dark:text-blue-300 hover:underline"
                        onClick={navigateToRules}
                      >
                        Open in Rules
                      </button>
                    </div>

                    {selectedContainerRules.length === 0 ? (
                      <div className="rounded-lg border border-dashed border-gray-300 dark:border-gray-700 p-3 text-xs text-gray-500 dark:text-gray-400">
                        No rules target this container yet.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {selectedContainerRules.slice(0, 6).map((rule) => (
                          <div
                            key={rule.id}
                            className="rounded-lg border border-gray-200 dark:border-gray-700 p-2.5"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <RuleBadge rule={rule} />
                              <span className="text-xs text-gray-500 dark:text-gray-400">
                                Priority {rule.priority}
                              </span>
                            </div>
                            <p className="mt-1 text-xs font-mono break-all">
                              {rule.pattern}
                            </p>
                            <div className="mt-1 flex items-center gap-2 text-[11px] text-gray-500 dark:text-gray-400">
                              {rule.enabled ? (
                                <span className="inline-flex items-center gap-1">
                                  <Check className="w-3.5 h-3.5" />
                                  Enabled
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1">
                                  <CircleSlash className="w-3.5 h-3.5" />
                                  Disabled
                                </span>
                              )}
                              <span>•</span>
                              <span>{rule.matchType}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  Select a container to inspect details.
                </div>
              )}
            </aside>
          </div>
        )}
      </div>

      <StatusBar>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <span>
            Showing {filteredContainers.length} of {totalCount} containers
          </span>
          <span className="inline-flex items-center gap-1">
            <Keyboard className="w-4 h-4" />
            Shortcuts: <code>/</code> search, <code>j/k</code> navigate,
            <code>e</code> edit, <code>c</code> clear cookies,
            <code>del</code> delete, <code>n</code> new, <code>r</code> rules
          </span>
          <span className="inline-flex items-center gap-1">
            <Shield className="w-4 h-4" />
            Rule cleanup is automatic on delete
          </span>
        </div>
      </StatusBar>

      <ContainerModal
        isOpen={containerModalState.isOpen}
        mode={containerModalState.mode}
        container={
          containerModalState.mode === "edit"
            ? containerModalState.container
            : undefined
        }
        onClose={closeContainerModal}
        onSuccess={syncContainers}
      />

      <ContainerPresetWizard
        isOpen={isPresetWizardOpen}
        containers={containers}
        rules={rules}
        onClose={() => setIsPresetWizardOpen(false)}
        onComplete={syncContainers}
      />
    </PageLayout>
  )
}
