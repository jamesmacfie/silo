interface StatusBarProps {
  message: string
  type?: "success" | "error" | "warning" | "info"
  className?: string
}

export function StatusBar({
  message,
  type = "info",
  className,
}: StatusBarProps): JSX.Element {
  const baseStyles =
    "flex items-center gap-2 p-4 rounded-lg font-medium text-sm mb-4"

  const typeStyles = {
    success:
      "bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200 border border-green-200 dark:border-green-800",
    error:
      "bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200 border border-red-200 dark:border-red-800",
    warning:
      "bg-yellow-50 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-200 border border-yellow-200 dark:border-yellow-800",
    info: "bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-200 border border-blue-200 dark:border-blue-800",
  }

  const icons = {
    success: "✓",
    error: "✕",
    warning: "⚠",
    info: "ℹ",
  }

  const finalClassName = className || `${baseStyles} ${typeStyles[type]}`

  return (
    <div className={finalClassName}>
      <span className="font-bold text-base">{icons[type]}</span>
      <span>{message}</span>
    </div>
  )
}
