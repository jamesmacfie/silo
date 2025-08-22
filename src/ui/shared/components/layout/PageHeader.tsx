import type React from "react"

interface PageHeaderProps {
  title: string
  description?: string
  actions?: React.ReactNode
  className?: string
}

export function PageHeader({
  title,
  description,
  actions,
  className = "",
}: PageHeaderProps) {
  return (
    <div
      className={`header flex items-start justify-between gap-4 ${className}`}
    >
      <div className="flex-1 min-w-0">
        <h1 className="text-2xl font-bold">{title}</h1>
        {description && (
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            {description}
          </p>
        )}
      </div>
      {actions && (
        <div className="flex items-center gap-2 flex-shrink-0">{actions}</div>
      )}
    </div>
  )
}
