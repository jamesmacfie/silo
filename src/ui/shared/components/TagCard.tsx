import { Edit3, Eye, Trash2 } from "lucide-react"
import type { BookmarkTag } from "../../../shared/types"
import { ActionIcon } from "./ActionIcon"
import { Card } from "./Card"
import { ColorDot } from "./ColorDot"

interface TagWithUsage extends BookmarkTag {
  usageCount: number
}

interface TagCardProps {
  tag: TagWithUsage
  onEdit: (tag: TagWithUsage) => void
  onDelete: (tag: TagWithUsage) => void
  onViewBookmarks: (tagId: string) => void
}

export function TagCard({
  tag,
  onEdit,
  onDelete,
  onViewBookmarks,
}: TagCardProps): JSX.Element {
  return (
    <Card className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm hover:shadow-md transition-shadow">
      {/* Header with tag info */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-700">
        <div className="flex items-center gap-3">
          <ColorDot color={tag.color} size="md" />
          <div className="font-medium text-gray-900 dark:text-gray-100">
            {tag.name}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 py-3">
        <div className="text-sm text-gray-600 dark:text-gray-400">
          {tag.usageCount} bookmark{tag.usageCount !== 1 ? "s" : ""}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 dark:border-gray-700">
        <div>
          {tag.usageCount > 0 && (
            <ActionIcon
              icon={Eye}
              onClick={() => onViewBookmarks(tag.id)}
              actionType="view"
              context="card"
              title="View bookmarks with this tag"
            />
          )}
        </div>
        <div className="flex items-center gap-2">
          <ActionIcon
            icon={Edit3}
            onClick={() => onEdit(tag)}
            actionType="edit"
            context="card"
            title="Edit tag"
          />
          <ActionIcon
            icon={Trash2}
            onClick={() => onDelete(tag)}
            actionType="delete"
            context="card"
            title="Delete tag"
          />
        </div>
      </div>
    </Card>
  )
}
