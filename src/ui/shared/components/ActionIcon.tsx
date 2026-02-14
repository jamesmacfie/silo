import type { LucideIcon } from "lucide-react"
import type React from "react"

export type ActionType =
  | "edit"
  | "delete"
  | "view"
  | "clear"
  | "open"
  | "close"
  | "add"
  | "default"
export type ActionContext = "table" | "card"

interface ActionIconProps {
  icon: LucideIcon
  onClick: (e: React.MouseEvent<HTMLButtonElement>) => void
  actionType?: ActionType
  context?: ActionContext
  title: string
  disabled?: boolean
  className?: string
}

const getActionColors = (actionType: ActionType): string => {
  switch (actionType) {
    case "delete":
      return "hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
    case "view":
    case "open":
    case "clear":
      return "hover:text-blue-500 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20"
    default:
      return "hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
  }
}

const getBaseStyles = (context: ActionContext): string => {
  switch (context) {
    case "table":
      return "p-2 rounded transition-colors"
    case "card":
      return "inline-flex items-center justify-center w-8 h-8 rounded transition-colors"
    default:
      return "p-2 rounded transition-colors"
  }
}

export function ActionIcon({
  icon: Icon,
  onClick,
  actionType = "default",
  context = "table",
  title,
  disabled = false,
  className = "",
}: ActionIconProps): JSX.Element {
  const baseStyles = getBaseStyles(context)
  const actionColors = getActionColors(actionType)
  const disabledStyles = disabled
    ? "opacity-50 cursor-not-allowed"
    : "cursor-pointer"

  const combinedClassName =
    `${baseStyles} text-gray-500 dark:text-gray-400 ${actionColors} ${disabledStyles} ${className}`.trim()

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation()
    if (!disabled) {
      onClick(e)
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className={combinedClassName}
      title={title}
      aria-label={title}
      disabled={disabled}
    >
      <Icon className="w-4 h-4" />
    </button>
  )
}
