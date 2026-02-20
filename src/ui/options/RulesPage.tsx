import { Edit3, Plus, Trash2 } from "lucide-react"
import React, { useCallback, useMemo } from "react"
import type { Rule } from "../../shared/types/rule"
import { containerColorToCss } from "../shared/components/ColorSelector"
import { DuplicateRuleManager } from "../shared/components/DuplicateRuleManager"
import {
  Button,
  DataView,
  EmptyState,
  PageHeader,
  PageLayout,
  StatusBar,
  ToolBar,
  type ToolBarSortOption,
  type ViewMode,
} from "../shared/components/layout"
import { RuleCard } from "../shared/components/RuleCard"
import { RuleFilters } from "../shared/components/RuleFilters"
import {
  useContainers,
  useRuleActions,
  useRules,
  useRulesPageState,
} from "../shared/stores"
import { RuleModal } from "./RuleModal"

const SORT_OPTIONS: ToolBarSortOption[] = [
  { value: "priority", label: "Priority" },
  { value: "pattern", label: "Pattern" },
  { value: "type", label: "Type" },
  { value: "container", label: "Container" },
  { value: "created", label: "Created" },
  { value: "modified", label: "Modified" },
]

const PAGE_DESCRIPTION =
  "Create and manage rules that automatically open websites in specific containers based on URL patterns. Rules can include sites in containers, exclude them, or restrict access."

type RulesPageProps = {}

export function RulesPage({}: RulesPageProps) {
  const rules = useRules()
  const containers = useContainers()
  const {
    create: _createRule,
    update: updateRule,
    delete: deleteRule,
  } = useRuleActions()

  // Use persistent UI state
  const pageState = useRulesPageState()
  const {
    searchQuery,
    sortBy,
    sortOrder,
    viewMode,
    showDuplicates,
    showFilters,
    filters,
    updateState,
    updateFilter,
    clearFilters,
    toggleFilters,
    updateSort,
    updateViewMode,
  } = pageState
  const normalizedViewMode: ViewMode =
    viewMode === "table" || viewMode === "cards" ? viewMode : "table"

  const [ruleModalState, setRuleModalState] = React.useState<{
    isOpen: boolean
    mode: "create" | "edit"
    rule?: Rule
  }>({ isOpen: false, mode: "create" })

  const duplicateCount = useMemo(() => {
    const patternCounts = new Map<string, number>()
    rules.forEach((rule) => {
      const key = `${rule.pattern}-${rule.matchType}`
      patternCounts.set(key, (patternCounts.get(key) || 0) + 1)
    })
    return Array.from(patternCounts.values()).filter((count) => count > 1)
      .length
  }, [rules])

  const filteredRules = useMemo(() => {
    let filtered = [...rules]
    const normalizedContainerFilter = (() => {
      if (typeof filters.container !== "string" || !filters.container) {
        return ""
      }

      const byCookieStoreId = containers.find(
        (c) => c.cookieStoreId === filters.container,
      )
      if (byCookieStoreId) {
        return byCookieStoreId.cookieStoreId
      }

      const byInternalId = containers.find((c) => c.id === filters.container)
      if (byInternalId) {
        return byInternalId.cookieStoreId
      }

      // If the persisted filter no longer maps to any known container/rule
      // (e.g. removed container), ignore it so rules are still visible.
      const hasMatchingRules = rules.some(
        (r) => r.containerId === filters.container,
      )
      return hasMatchingRules ? filters.container : ""
    })()
    const normalizedRuleTypeFilter =
      typeof filters.ruleType === "string" ? filters.ruleType.toLowerCase() : ""
    const normalizedEnabledFilter =
      filters.enabled === true || filters.enabled === "true"
        ? true
        : filters.enabled === false || filters.enabled === "false"
          ? false
          : null

    if (searchQuery) {
      const lower = searchQuery.toLowerCase()
      filtered = filtered.filter(
        (rule) =>
          rule.pattern.toLowerCase().includes(lower) ||
          rule.metadata.description?.toLowerCase().includes(lower) ||
          containers
            .find((c) => c.cookieStoreId === rule.containerId)
            ?.name.toLowerCase()
            .includes(lower),
      )
    }

    if (normalizedContainerFilter) {
      filtered = filtered.filter(
        (r) => r.containerId === normalizedContainerFilter,
      )
    }

    if (normalizedRuleTypeFilter) {
      filtered = filtered.filter((r) => r.ruleType === normalizedRuleTypeFilter)
    }

    if (normalizedEnabledFilter !== null) {
      filtered = filtered.filter((r) => r.enabled === normalizedEnabledFilter)
    }

    filtered.sort((a, b) => {
      let result = 0
      switch (sortBy) {
        case "pattern":
          result = a.pattern.localeCompare(b.pattern)
          break
        case "priority":
          result = b.priority - a.priority
          break
        case "type":
          result = a.ruleType.localeCompare(b.ruleType)
          break
        case "container": {
          const containerA =
            containers.find((c) => c.cookieStoreId === a.containerId)?.name ||
            ""
          const containerB =
            containers.find((c) => c.cookieStoreId === b.containerId)?.name ||
            ""
          result = containerA.localeCompare(containerB)
          break
        }
        case "created":
          result = b.created - a.created
          break
        case "modified":
          result = b.modified - a.modified
          break
        default:
          return 0
      }
      return sortOrder === "asc" ? result : -result
    })

    return filtered
  }, [rules, containers, searchQuery, filters, sortBy, sortOrder])

  const handleFilterChange = useCallback(
    (key: string, value: any) => {
      updateFilter(key, value)
    },
    [updateFilter],
  )

  const handleClearFilters = useCallback(() => {
    clearFilters()
  }, [clearFilters])

  const openCreateRuleModal = useCallback(() => {
    setRuleModalState({ isOpen: true, mode: "create" })
  }, [])

  const openEditRuleModal = useCallback((rule: Rule) => {
    setRuleModalState({ isOpen: true, mode: "edit", rule })
  }, [])

  const closeRuleModal = useCallback(() => {
    setRuleModalState((prev) => ({ ...prev, isOpen: false }))
  }, [])

  const handleToggleEnabled = useCallback(
    async (rule: Rule) => {
      await updateRule(rule.id, { enabled: !rule.enabled })
    },
    [updateRule],
  )

  const handleDeleteRule = useCallback(
    async (rule: Rule) => {
      if (!confirm(`Delete rule for "${rule.pattern}"?`)) return
      await deleteRule(rule.id)
    },
    [deleteRule],
  )

  const tableColumns = useMemo(
    () => [
      {
        key: "pattern",
        header: "Pattern",
        render: (rule: Rule) => (
          <div>
            <div className="font-mono text-sm">{rule.pattern}</div>
            {rule.metadata.description && (
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {rule.metadata.description}
              </div>
            )}
          </div>
        ),
      },
      {
        key: "type",
        header: "Type",
        render: (rule: Rule) => (
          <span
            className={`px-2 py-1 text-xs rounded-full ${
              rule.ruleType === "include"
                ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
                : rule.ruleType === "exclude"
                  ? "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400"
                  : "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400"
            }`}
          >
            {rule.ruleType}
          </span>
        ),
        width: "w-24",
      },
      {
        key: "container",
        header: "Container",
        render: (rule: Rule) => {
          const container = containers.find(
            (c) => c.cookieStoreId === rule.containerId,
          )
          return container ? (
            <div className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-full"
                style={{
                  backgroundColor: containerColorToCss(container.color),
                }}
              />
              <span className="text-sm">{container.name}</span>
            </div>
          ) : (
            <span className="text-gray-500 dark:text-gray-400">—</span>
          )
        },
        width: "w-40",
      },
      {
        key: "priority",
        header: "Priority",
        render: (rule: Rule) => (
          <span className="text-sm font-medium">{rule.priority}</span>
        ),
        width: "w-20",
      },
      {
        key: "status",
        header: "Status",
        render: (rule: Rule) => (
          <button
            onClick={(e) => {
              e.stopPropagation()
              handleToggleEnabled(rule)
            }}
            className={`px-2 py-1 text-xs rounded ${
              rule.enabled
                ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
                : "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400"
            }`}
          >
            {rule.enabled ? "Enabled" : "Disabled"}
          </button>
        ),
        width: "w-24",
      },
      {
        key: "actions",
        header: "Actions",
        render: (rule: Rule) => (
          <div className="flex items-center gap-2">
            <button
              onClick={(e) => {
                e.stopPropagation()
                openEditRuleModal(rule)
              }}
              className="p-2 text-gray-500 hover:text-gray-600 dark:text-gray-400 dark:hover:text-gray-300 rounded transition-colors"
              title="Edit rule"
            >
              <Edit3 className="w-4 h-4" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation()
                handleDeleteRule(rule)
              }}
              className="p-2 text-gray-500 hover:text-red-500 dark:text-gray-400 dark:hover:text-red-400 rounded transition-colors"
              title="Delete rule"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ),
        width: "w-32",
      },
    ],
    [containers, handleToggleEnabled, openEditRuleModal, handleDeleteRule],
  )

  const renderRuleCard = useCallback(
    (rule: Rule) => {
      return (
        <RuleCard
          rule={rule}
          containers={containers}
          onEdit={() => openEditRuleModal(rule)}
          onToggleEnabled={() => handleToggleEnabled(rule)}
          onDelete={() => handleDeleteRule(rule)}
        />
      )
    },
    [containers, openEditRuleModal, handleToggleEnabled, handleDeleteRule],
  )

  const hasActiveFilters = Object.values(filters).some(
    (v) => v !== null && v !== "" && (!Array.isArray(v) || v.length > 0),
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
        title="Rules"
        description={PAGE_DESCRIPTION}
        actions={
          <Button onClick={openCreateRuleModal}>
            <Plus className="w-4 h-4 mr-2" />
            New Rule
          </Button>
        }
      />

      <ToolBar
        searchValue={searchQuery}
        onSearchChange={(query) => updateState({ searchQuery: query })}
        searchPlaceholder="Search rules by pattern, description, or container..."
        sortOptions={SORT_OPTIONS}
        currentSort={sortBy}
        sortOrder={sortOrder}
        onSortChange={(sort) => updateSort(sort)}
        onSortOrderToggle={handleSortOrderToggle}
        viewMode={normalizedViewMode}
        availableViews={["cards", "table"]}
        onViewChange={(mode) => updateViewMode(mode)}
        showFilters={showFilters}
        onToggleFilters={toggleFilters}
        filtersActive={hasActiveFilters}
        hasActiveFilters={hasActiveFilters || !!searchQuery}
        onClearAll={handleClearAll}
        className="mb-4"
      />

      {duplicateCount > 0 && (
        <div className="mb-4">
          <Button
            variant="ghost"
            onClick={() => updateState({ showDuplicates: !showDuplicates })}
            size="sm"
          >
            {showDuplicates ? "Hide" : "Show"} Duplicates ({duplicateCount})
          </Button>
        </div>
      )}

      {showFilters && (
        <RuleFilters
          className="mb-4"
          containers={containers}
          onClose={toggleFilters}
          filters={
            filters as {
              container: string
              ruleType: string
              enabled: string | boolean | null
            }
          }
          onChange={handleFilterChange}
          onClear={handleClearFilters}
        />
      )}

      {showDuplicates && duplicateCount > 0 && (
        <div className="mb-6">
          <DuplicateRuleManager
            rules={rules}
            containers={containers}
            onDeleteRule={deleteRule}
          />
        </div>
      )}

      <DataView
        items={filteredRules}
        viewMode={normalizedViewMode}
        columns={tableColumns}
        renderCard={renderRuleCard}
        emptyState={
          <EmptyState
            icon={<Plus className="w-12 h-12" />}
            title={
              searchQuery || hasActiveFilters
                ? "No rules found"
                : "No rules configured"
            }
            description={
              searchQuery || hasActiveFilters
                ? "Try adjusting your search or filters"
                : "Create your first rule to automatically open websites in containers"
            }
            action={
              !searchQuery &&
              !hasActiveFilters && (
                <Button onClick={openCreateRuleModal}>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Rule
                </Button>
              )
            }
            hasSearch={!!searchQuery || hasActiveFilters}
            searchQuery={searchQuery}
          />
        }
        onItemClick={viewMode === "table" ? openEditRuleModal : undefined}
      />

      <StatusBar>
        {filteredRules.length} of {rules.length} rules
        {(searchQuery || hasActiveFilters) && " (filtered)"}
      </StatusBar>

      <RuleModal
        isOpen={ruleModalState.isOpen}
        mode={ruleModalState.mode}
        rule={ruleModalState.rule}
        containers={containers}
        onClose={closeRuleModal}
        onSuccess={() => {}}
      />
    </PageLayout>
  )
}
