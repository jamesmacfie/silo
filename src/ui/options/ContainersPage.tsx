import { Cookie, Edit3, Package, Plus, Trash2 } from "lucide-react"
import React, { useCallback, useMemo } from "react"
import type { Container } from "../../shared/types/container"
import { containerColorToCss } from "../shared/components/ColorSelector"
import { ContainerCard } from "../shared/components/ContainerCard"
import { ContainerFilters } from "../shared/components/ContainerFilters"
import {
  Button,
  DataView,
  EmptyState,
  type FilterConfig,
  PageHeader,
  PageLayout,
  StatusBar,
  ToolBar,
  type ToolBarSortOption,
  type ViewMode,
} from "../shared/components/layout"
import {
  useContainerActions,
  useContainers,
  useContainersPageState,
  useRules,
} from "../shared/stores"
import { ContainerModal } from "./ContainerModal"

const SORT_OPTIONS: ToolBarSortOption[] = [
  { value: "name", label: "Name" },
  { value: "created", label: "Created" },
  { value: "modified", label: "Modified" },
  { value: "rules", label: "Rule Count" },
]

const PAGE_DESCRIPTION =
  "Manage Firefox containers that isolate browsing sessions with separate cookies, storage, and cache. Containers help you separate work, personal, and shopping activities."

export function ContainersPage() {
  const containers = useContainers()
  const rules = useRules()
  const {
    load: syncContainers,
    update: _updateContainer,
    delete: deleteContainer,
    clearCookies: clearContainerData,
  } = useContainerActions()

  // Use persistent UI state
  const pageState = useContainersPageState()
  const {
    searchQuery,
    sortBy,
    sortOrder,
    viewMode,
    showFilters,
    filters,
    updateState,
    updateFilter,
    clearFilters,
    toggleFilters,
    updateSort,
    updateViewMode,
  } = pageState

  const [containerModalState, setContainerModalState] = React.useState<{
    isOpen: boolean
    mode: "create" | "edit"
    container?: Container
  }>({ isOpen: false, mode: "create" })

  const _filterConfigs: FilterConfig[] = useMemo(
    () => [
      {
        key: "hasRules",
        label: "Has Rules",
        type: "select",
        options: [
          { value: "", label: "All" },
          { value: "yes", label: "With Rules" },
          { value: "no", label: "Without Rules" },
        ],
      },
      {
        key: "color",
        label: "Color",
        type: "select",
        options: [
          { value: "", label: "All Colors" },
          { value: "blue", label: "Blue" },
          { value: "red", label: "Red" },
          { value: "green", label: "Green" },
          { value: "yellow", label: "Yellow" },
          { value: "orange", label: "Orange" },
          { value: "pink", label: "Pink" },
          { value: "purple", label: "Purple" },
          { value: "turquoise", label: "Turquoise" },
        ],
      },
    ],
    [],
  )

  const containerRuleCounts = useMemo(() => {
    const counts = new Map<string, number>()
    rules.forEach((rule) => {
      if (rule.containerId) {
        counts.set(rule.containerId, (counts.get(rule.containerId) || 0) + 1)
      }
    })
    return counts
  }, [rules])

  const filteredContainers = useMemo(() => {
    let filtered = [...containers]

    if (searchQuery) {
      const lower = searchQuery.toLowerCase()
      filtered = filtered.filter((container) =>
        container.name.toLowerCase().includes(lower),
      )
    }

    if (filters.hasRules) {
      filtered = filtered.filter((c) => {
        const ruleCount = containerRuleCounts.get(c.cookieStoreId) || 0
        return filters.hasRules === "yes" ? ruleCount > 0 : ruleCount === 0
      })
    }

    if (filters.color) {
      filtered = filtered.filter((c) => c.color === filters.color)
    }

    filtered.sort((a, b) => {
      let result = 0
      switch (sortBy) {
        case "name":
          result = a.name.localeCompare(b.name)
          break
        case "created":
          result = (b.created || 0) - (a.created || 0)
          break
        case "modified":
          result = (b.modified || 0) - (a.modified || 0)
          break
        case "rules": {
          const aCount = containerRuleCounts.get(a.cookieStoreId) || 0
          const bCount = containerRuleCounts.get(b.cookieStoreId) || 0
          result = bCount - aCount
          break
        }
        default:
          return 0
      }
      return sortOrder === "asc" ? result : -result
    })

    return filtered
  }, [containers, searchQuery, filters, sortBy, sortOrder, containerRuleCounts])

  const handleFilterChange = useCallback(
    (key: string, value: any) => {
      updateFilter(key, value)
    },
    [updateFilter],
  )

  const handleClearFilters = useCallback(() => {
    clearFilters()
  }, [clearFilters])

  const openCreateContainerModal = useCallback(() => {
    setContainerModalState({ isOpen: true, mode: "create" })
  }, [])

  const openEditContainerModal = useCallback((container: Container) => {
    setContainerModalState({ isOpen: true, mode: "edit", container })
  }, [])

  const closeContainerModal = useCallback(() => {
    setContainerModalState((prev) => ({ ...prev, isOpen: false }))
  }, [])

  const handleClearCookies = useCallback(
    async (container: Container) => {
      if (
        !confirm(
          `Clear all cookies and data for "${container.name}"? This cannot be undone.`,
        )
      )
        return
      await clearContainerData(container.cookieStoreId)
    },
    [clearContainerData],
  )

  const handleDeleteContainer = useCallback(
    async (container: Container) => {
      const ruleCount = containerRuleCounts.get(container.cookieStoreId) || 0
      const message =
        ruleCount > 0
          ? `Delete container "${container.name}" and its ${ruleCount} associated rule(s)?`
          : `Delete container "${container.name}"?`

      if (!confirm(message)) return
      await deleteContainer(container.cookieStoreId)
    },
    [deleteContainer, containerRuleCounts],
  )

  const tableColumns = useMemo(
    () => [
      {
        key: "container",
        header: "Container",
        render: (container: Container) => (
          <div className="flex items-center gap-3">
            <div
              className="w-4 h-4 rounded-full"
              style={{ backgroundColor: containerColorToCss(container.color) }}
            />
            <div>
              <div className="font-medium">{container.name}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                {container.cookieStoreId}
              </div>
            </div>
          </div>
        ),
      },
      {
        key: "rules",
        header: "Rules",
        render: (container: Container) => {
          const count = containerRuleCounts.get(container.cookieStoreId) || 0
          return (
            <span className="text-sm">
              {count} {count === 1 ? "rule" : "rules"}
            </span>
          )
        },
        width: "w-24",
      },
      {
        key: "created",
        header: "Created",
        render: (container: Container) => (
          <span className="text-sm text-gray-600 dark:text-gray-400">
            {container.created
              ? new Date(container.created).toLocaleDateString()
              : "—"}
          </span>
        ),
        width: "w-32",
      },
      {
        key: "actions",
        header: "Actions",
        render: (container: Container) => (
          <div className="flex items-center gap-2">
            <button
              onClick={(e) => {
                e.stopPropagation()
                openEditContainerModal(container)
              }}
              className="p-2 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 rounded transition-colors"
              title="Edit container"
            >
              <Edit3 className="w-4 h-4" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation()
                handleClearCookies(container)
              }}
              className="p-2 text-gray-400 hover:text-blue-500 dark:text-gray-500 dark:hover:text-blue-400 rounded transition-colors"
              title="Clear cookies"
            >
              <Cookie className="w-4 h-4" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation()
                handleDeleteContainer(container)
              }}
              className="p-2 text-gray-400 hover:text-red-500 dark:text-gray-500 dark:hover:text-red-400 rounded transition-colors"
              title="Delete container"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ),
        width: "w-40",
      },
    ],
    [
      containerRuleCounts,
      handleClearCookies,
      openEditContainerModal,
      handleDeleteContainer,
    ],
  )

  const renderContainerCard = useCallback(
    (container: Container) => {
      return (
        <ContainerCard
          container={container}
          onEdit={() => openEditContainerModal(container)}
          onDelete={() => handleDeleteContainer(container)}
          onClearCookies={() => handleClearCookies(container)}
        />
      )
    },
    [openEditContainerModal, handleDeleteContainer, handleClearCookies],
  )

  const hasActiveFilters = Object.values(filters).some(
    (v) => v !== null && v !== "",
  )

  const handleClearAll = useCallback(() => {
    clearFilters()
    updateState({ searchQuery: "" })
  }, [clearFilters, updateState])

  const handleSortOrderToggle = useCallback(() => {
    updateSort(sortBy)
  }, [updateSort, sortBy])

  return (
    <PageLayout>
      <PageHeader
        title="Containers"
        description={PAGE_DESCRIPTION}
        actions={
          <Button onClick={openCreateContainerModal}>
            <Plus className="w-4 h-4 mr-2" />
            New Container
          </Button>
        }
      />

      <ToolBar
        searchValue={searchQuery}
        onSearchChange={(query) => updateState({ searchQuery: query })}
        searchPlaceholder="Search containers..."
        sortOptions={SORT_OPTIONS}
        currentSort={sortBy}
        sortOrder={sortOrder}
        onSortChange={(sort) => updateSort(sort)}
        onSortOrderToggle={handleSortOrderToggle}
        viewMode={viewMode as ViewMode}
        availableViews={["cards", "table"]}
        onViewChange={(mode) => updateViewMode(mode)}
        showFilters={showFilters}
        onToggleFilters={toggleFilters}
        filtersActive={hasActiveFilters}
        hasActiveFilters={hasActiveFilters || !!searchQuery}
        onClearAll={handleClearAll}
        className="mb-4"
      />

      {showFilters && (
        <ContainerFilters
          className="mb-4"
          onClose={toggleFilters}
          filters={filters as { hasRules: string; color: string }}
          onChange={handleFilterChange}
          onClear={handleClearFilters}
        />
      )}

      <DataView
        items={filteredContainers}
        viewMode={viewMode as ViewMode}
        columns={tableColumns}
        renderCard={renderContainerCard}
        emptyState={
          <EmptyState
            icon={<Package className="w-12 h-12" />}
            title={
              searchQuery || hasActiveFilters
                ? "No containers found"
                : "No containers configured"
            }
            description={
              searchQuery || hasActiveFilters
                ? "Try adjusting your search or filters"
                : "Create your first container to isolate your browsing sessions"
            }
            action={
              !searchQuery &&
              !hasActiveFilters && (
                <Button onClick={openCreateContainerModal}>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Container
                </Button>
              )
            }
            hasSearch={!!searchQuery || hasActiveFilters}
            searchQuery={searchQuery}
          />
        }
        onItemClick={viewMode === "table" ? openEditContainerModal : undefined}
      />

      <StatusBar>
        {filteredContainers.length} of {containers.length} containers
        {(searchQuery || hasActiveFilters) && " (filtered)"}
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
    </PageLayout>
  )
}
