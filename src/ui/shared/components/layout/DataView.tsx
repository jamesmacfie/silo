import React from "react"
import { EmptyState } from "./EmptyState"

export type ViewMode = "table" | "cards" | "tree"

interface Column<T> {
  key: string
  header: string
  render: (item: T) => React.ReactNode
  width?: string
  sortable?: boolean
}

interface DataViewProps<T> {
  items: T[]
  viewMode: ViewMode
  columns?: Column<T>[]
  renderCard?: (item: T) => React.ReactNode
  renderTree?: (item: T) => React.ReactNode
  emptyState?: React.ReactNode
  loading?: boolean
  className?: string
  gridClassName?: string
  onItemClick?: (item: T) => void
  selectedItems?: Set<string>
  onSelectItem?: (id: string, selected: boolean) => void
  onSelectAll?: (selected: boolean) => void
  getItemId?: (item: T) => string
}

export function DataView<T extends { id: string }>({
  items,
  viewMode,
  columns = [],
  renderCard,
  renderTree,
  emptyState,
  loading = false,
  className = "",
  gridClassName = "cards-grid",
  onItemClick,
  selectedItems,
  onSelectItem,
  onSelectAll,
  getItemId = (item) => item.id,
}: DataViewProps<T>) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-500 dark:text-gray-400">Loading...</div>
      </div>
    )
  }

  if (items.length === 0) {
    return <>{emptyState || <EmptyState title="No items found" />}</>
  }

  if (viewMode === "table" && columns.length > 0) {
    const allSelected = selectedItems?.size === items.length && items.length > 0
    const someSelected = selectedItems && selectedItems.size > 0 && !allSelected

    return (
      <div
        className={`bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 ${className}`}
      >
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                {onSelectItem && (
                  <th className="w-8 px-4 py-3 text-left">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      ref={(input) => {
                        if (input) input.indeterminate = someSelected
                      }}
                      onChange={(e) => onSelectAll?.(e.target.checked)}
                      className="rounded border-gray-300 dark:border-gray-600"
                    />
                  </th>
                )}
                {columns.map((column) => (
                  <th
                    key={column.key}
                    className={`px-4 py-3 text-left font-medium text-gray-900 dark:text-gray-100 ${
                      column.width || ""
                    }`}
                  >
                    {column.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const itemId = getItemId(item)
                const isSelected = selectedItems?.has(itemId)

                return (
                  <tr
                    key={itemId}
                    onClick={() => onItemClick?.(item)}
                    className={`hover:bg-gray-50 dark:hover:bg-gray-800/50 ${
                      onItemClick ? "cursor-pointer" : ""
                    } ${isSelected ? "bg-blue-50 dark:bg-blue-900/20" : ""}`}
                  >
                    {onSelectItem && (
                      <td className="w-8 px-4 py-3">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => {
                            e.stopPropagation()
                            onSelectItem(itemId, e.target.checked)
                          }}
                          onClick={(e) => e.stopPropagation()}
                          className="rounded border-gray-300 dark:border-gray-600"
                        />
                      </td>
                    )}
                    {columns.map((column) => (
                      <td key={column.key} className="px-4 py-3">
                        {column.render(item)}
                      </td>
                    ))}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  if (viewMode === "cards" && renderCard) {
    return (
      <div className={`${gridClassName} ${className}`}>
        {items.map((item) => (
          <div key={getItemId(item)} onClick={() => onItemClick?.(item)}>
            {renderCard(item)}
          </div>
        ))}
      </div>
    )
  }

  if (viewMode === "tree" && renderTree) {
    return (
      <div className={className}>
        {items.map((item) => (
          <div key={getItemId(item)}>{renderTree(item)}</div>
        ))}
      </div>
    )
  }

  return null
}
