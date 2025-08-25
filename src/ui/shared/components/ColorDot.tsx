interface ColorDotProps {
  color: string
  size?: "xs" | "sm" | "md"
  className?: string
}

export function ColorDot({
  color,
  size = "sm",
  className = "",
}: ColorDotProps): JSX.Element {
  const sizeClasses = {
    xs: "w-2 h-2",
    sm: "w-2.5 h-2.5",
    md: "w-3 h-3",
  }

  return (
    <div
      className={`${sizeClasses[size]} rounded-full flex-shrink-0 ${className}`}
      style={{ backgroundColor: color }}
    />
  )
}
