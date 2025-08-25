import type { Container } from "@/shared/types"
import {
  getContainerColors,
  iconToEmoji,
} from "@/shared/utils/containerHelpers"

interface ContainerBadgeProps {
  container: Container
  size?: "xs" | "sm"
  className?: string
}

export function ContainerBadge({
  container,
  size = "xs",
  className = "",
}: ContainerBadgeProps): JSX.Element {
  const sizeClasses = {
    xs: "px-2 py-0.5 text-xs gap-1",
    sm: "px-2.5 py-1 text-sm gap-1.5",
  }

  const iconSizeClasses = {
    xs: "text-sm",
    sm: "text-base",
  }

  return (
    <div
      className={`inline-flex items-center ${sizeClasses[size]} rounded ${className}`}
      style={{
        backgroundColor: getContainerColors(container.color).bg,
        borderColor: getContainerColors(container.color).border,
        color: getContainerColors(container.color).text,
        border: "1px solid",
      }}
      title={`Container: ${container.name}`}
    >
      <span className={`${iconSizeClasses[size]} leading-none`}>
        {iconToEmoji(container.icon)}
      </span>
      <span className="truncate max-w-[100px]">{container.name}</span>
    </div>
  )
}
