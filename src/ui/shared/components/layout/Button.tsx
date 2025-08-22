import type React from "react"

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost"
  size?: "sm" | "md" | "lg"
  children: React.ReactNode
}

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  children,
  ...props
}: ButtonProps) {
  const baseClasses =
    "inline-flex items-center justify-center font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"

  const variantClasses = {
    primary: "bg-blue-500 hover:bg-blue-600 text-white",
    secondary:
      "bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600",
    ghost:
      "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700",
  }

  const sizeClasses = {
    sm: "px-2.5 py-1.5 text-xs h-7",
    md: "px-3 py-2 text-sm h-9",
    lg: "px-4 py-2.5 text-base h-11",
  }

  return (
    <button
      className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}
