import React from "react"

interface EmptyStateProps {
  icon?: React.ReactNode
  title: string
  description?: string
  action?: React.ReactNode
  hasSearch?: boolean
  searchQuery?: string
  className?: string
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  hasSearch = false,
  searchQuery = "",
  className = "",
}: EmptyStateProps) {
  const displayTitle =
    hasSearch && searchQuery ? `No results for "${searchQuery}"` : title
  const displayDescription =
    hasSearch && searchQuery
      ? "Try adjusting your search or filters"
      : description

  return (
    <div
      className={`bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 ${className}`}
    >
      <div className="flex flex-col items-center justify-center py-16 px-6">
        {icon && (
          <div className="text-gray-400 dark:text-gray-600 mb-4">{icon}</div>
        )}
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2 text-center">
          {displayTitle}
        </h3>
        {displayDescription && (
          <p className="text-sm text-gray-500 dark:text-gray-400 text-center max-w-md mb-6">
            {displayDescription}
          </p>
        )}
        {action && !hasSearch && action}
      </div>
    </div>
  )
}
