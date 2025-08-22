import React, { useMemo, useCallback } from "react"
import { Plus, Edit3, Trash2 } from "lucide-react"
import {
  PageLayout,
  PageHeader,
  ToolBar,
  ToolBarSortOption,
  DataView,
  ViewMode,
  FilterPanel,
  FilterConfig,
  EmptyState,
  Button,
  StatusBar,
} from "../shared/components/layout"
import { RuleCard } from "../shared/components/RuleCard"
import { DuplicateRuleManager } from "../shared/components/DuplicateRuleManager"
import { RuleFilters } from "../shared/components/RuleFilters"
import { RuleModal } from "./RuleModal"
import { useRules, useRuleActions, useRulesPageState } from "../shared/stores"
import { useContainers } from "../shared/stores"
import { containerColorToCss } from "../shared/components/ColorSelector"
import type { Rule } from "../../shared/types/rule"
import type { Container } from "../../shared/types/container"

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

interface RulesPageProps {}

export function RulesPage({}: RulesPageProps) {
  const rules = useRules()
  const containers = useContainers()
  const {
    create: createRule,
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

  const filterConfigs: FilterConfig[] = useMemo(
    () => [
      {
        key: "container",
        label: "Container",
        type: "select",
        options: [
          { value: "", label: "All Containers" },
          ...containers.map((c) => ({ value: c.cookieStoreId, label: c.name })),
        ],
      },
      {
        key: "ruleType",
        label: "Rule Type",
        type: "select",
        options: [
          { value: "", label: "All Types" },
          { value: "INCLUDE", label: "Include" },
          { value: "EXCLUDE", label: "Exclude" },
          { value: "RESTRICT", label: "Restrict" },
        ],
      },
      {
        key: "enabled",
        label: "Status",
        type: "select",
        options: [
          { value: "", label: "All" },
          { value: "true", label: "Enabled" },
          { value: "false", label: "Disabled" },
        ],
      },
      {
        key: "tags",
        label: "Tags",
        type: "multiselect",
        options: Array.from(
          new Set(rules.flatMap((r) => r.metadata.tags || [])),
        ).map((tag) => ({ value: tag, label: tag })),
      },
    ],
    [containers, rules],
  )

  const filteredRules = useMemo(() => {
    let filtered = [...rules]

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

    if (filters.container) {
      filtered = filtered.filter((r) => r.containerId === filters.container)
    }

    if (filters.ruleType) {
      filtered = filtered.filter((r) => r.ruleType === filters.ruleType)
    }

    if (filters.enabled !== null && filters.enabled !== "") {
      const enabledValue = filters.enabled === "true"
      filtered = filtered.filter((r) => r.enabled === enabledValue)
    }

    if (filters.tags && filters.tags.length > 0) {
      filtered = filtered.filter((r) =>
        filters.tags.some((tag: string) => r.metadata.tags?.includes(tag)),
      )
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
            <span className="text-gray-400">—</span>
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
              className="p-2 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 rounded transition-colors"
              title="Edit rule"
            >
              <Edit3 className="w-4 h-4" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation()
                handleDeleteRule(rule)
              }}
              className="p-2 text-gray-400 hover:text-red-500 dark:text-gray-500 dark:hover:text-red-400 rounded transition-colors"
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
              enabled: string
              tags: string[]
            }
          }
          onChange={handleFilterChange}
          onClear={handleClearFilters}
          availableTags={Array.from(
            new Set(rules.flatMap((r) => r.metadata.tags || [])),
          )}
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
        viewMode={viewMode as ViewMode}
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
