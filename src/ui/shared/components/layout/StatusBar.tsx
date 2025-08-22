import type React from "react"

interface StatusBarProps {
  children: React.ReactNode
  className?: string
}

export function StatusBar({ children, className = "" }: StatusBarProps) {
  return (
    <div
      className={`status-bar mt-4 px-4 py-2 text-sm text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700 ${className}`}
    >
      {children}
    </div>
  )
}
