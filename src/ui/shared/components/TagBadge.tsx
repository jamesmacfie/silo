import type { BookmarkTag } from "@/shared/types"
import { ColorDot } from "./ColorDot"

interface TagBadgeProps {
  tag: BookmarkTag
  size?: "xs" | "sm"
  className?: string
}

export function TagBadge({
  tag,
  size = "xs",
  className = "",
}: TagBadgeProps): JSX.Element {
  const sizeClasses = {
    xs: "px-1.5 py-0.5 text-xs gap-1",
    sm: "px-2 py-1 text-sm gap-1.5",
  }

  return (
    <span
      className={`inline-flex items-center ${sizeClasses[size]} rounded bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 ${className}`}
      title={tag.name}
    >
      <ColorDot color={tag.color} size="xs" />
      <span className="truncate max-w-[60px]">{tag.name}</span>
    </span>
  )
}
