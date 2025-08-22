import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import {
  AlertCircle,
  CheckSquare,
  Edit3,
  ExternalLink,
  Folder,
  FolderOpen,
  GripVertical,
  Square,
  Trash2,
} from "lucide-react"
import type React from "react"
import type { Bookmark, BookmarkTag, Container } from "@/shared/types"
import {
  getContainerColors,
  iconToEmoji,
} from "@/shared/utils/containerHelpers"

interface DraggableTreeItemProps {
  bookmark: Bookmark
  depth: number
  isSelected: boolean
  isFolderSelected?: boolean
  isExpanded?: boolean
  isDropTarget?: boolean
  container?: Container | null
  suggestedContainer?: Container | null
  tags?: BookmarkTag[]
  onToggleFolder?: (id: string) => void
  onSelectBookmark?: (id: string) => void
  onToggleFolderSelection?: (id: string) => void
  onEditBookmark?: (bookmark: Bookmark) => void
  onDeleteBookmark?: (bookmark: Bookmark) => void
  children?: React.ReactNode
}

export function DraggableTreeItem({
  bookmark,
  depth,
  isSelected,
  isFolderSelected = false,
  isExpanded = false,
  isDropTarget = false,
  container,
  suggestedContainer,
  tags = [],
  onToggleFolder,
  onSelectBookmark,
  onToggleFolderSelection,
  onEditBookmark,
  onDeleteBookmark,
  children,
}: DraggableTreeItemProps): JSX.Element {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: bookmark.id,
    data: {
      type: bookmark.type,
      bookmark,
    },
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  if (bookmark.type === "folder") {
    return (
      <div style={{ marginLeft: `${depth * 20}px` }}>
        <div
          ref={setNodeRef}
          style={style}
          className={`flex items-center gap-2 py-2 px-3 hover:bg-gray-50 dark:hover:bg-gray-700 rounded group ${
            isFolderSelected ? "bg-blue-50 dark:bg-blue-900" : ""
          } ${isDragging ? "shadow-lg z-50" : ""} ${
            isDropTarget && bookmark.type === "folder"
              ? "bg-green-50 dark:bg-green-900 border-2 border-green-300 dark:border-green-600"
              : ""
          }`}
        >
          {/* Drag handle */}
          <button
            {...attributes}
            {...listeners}
            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity"
            title="Drag to reorder"
          >
            <GripVertical className="w-3 h-3" />
          </button>

          <button
            onClick={() => onToggleFolder?.(bookmark.id)}
            className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
          >
            {isExpanded ? (
              <FolderOpen className="w-4 h-4 text-blue-500" />
            ) : (
              <Folder className="w-4 h-4 text-gray-500" />
            )}
          </button>

          <button
            onClick={() => onToggleFolderSelection?.(bookmark.id)}
            className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
            title="Select folder for bulk actions"
          >
            {isFolderSelected ? (
              <CheckSquare className="w-4 h-4 text-blue-500" />
            ) : (
              <Square className="w-4 h-4 text-gray-400" />
            )}
          </button>

          <span className="flex-1 text-sm font-medium text-gray-900 dark:text-gray-100">
            {bookmark.title}
          </span>

          {bookmark.children && (
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {
                bookmark.children.filter((child) => child.type === "bookmark")
                  .length
              }{" "}
              items
            </span>
          )}
        </div>

        {/* Children rendered outside */}
        {children}
      </div>
    )
  }

  if (bookmark.type === "bookmark" && bookmark.url) {
    return (
      <div
        ref={setNodeRef}
        className={`flex items-center gap-2 py-2 px-3 hover:bg-gray-50 dark:hover:bg-gray-700 rounded group ${
          isSelected ? "bg-blue-50 dark:bg-blue-900" : ""
        } ${isDragging ? "shadow-lg z-50" : ""}`}
        style={{
          marginLeft: `${depth * 20}px`,
          ...style,
        }}
      >
        {/* Drag handle */}
        <button
          {...attributes}
          {...listeners}
          className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity"
          title="Drag to reorder"
        >
          <GripVertical className="w-3 h-3" />
        </button>

        <button
          onClick={() => onSelectBookmark?.(bookmark.id)}
          className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
        >
          {isSelected ? (
            <CheckSquare className="w-4 h-4 text-blue-500" />
          ) : (
            <Square className="w-4 h-4 text-gray-400" />
          )}
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
              {bookmark.title}
            </span>
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={() => onEditBookmark?.(bookmark)}
                className="p-1 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 rounded"
                title="Edit bookmark"
              >
                <Edit3 className="w-3 h-3" />
              </button>
              <button
                onClick={() => onDeleteBookmark?.(bookmark)}
                className="p-1 text-gray-400 hover:text-red-600 dark:text-gray-500 dark:hover:text-red-400 rounded"
                title="Delete bookmark"
              >
                <Trash2 className="w-3 h-3" />
              </button>
              <a
                href={bookmark.url}
                target="_blank"
                rel="noopener noreferrer"
                className="p-1 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 rounded"
                title="Open bookmark"
              >
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400 truncate font-mono">
            {bookmark.url}
          </div>

          {/* Container and Tags Row */}
          <div className="flex items-center gap-2 mt-1">
            {/* Container */}
            {container ? (
              <div className="flex items-center gap-1">
                <div
                  className="flex items-center justify-center w-4 h-4 rounded text-xs"
                  style={{
                    backgroundColor: getContainerColors(container.color).bg,
                    borderColor: getContainerColors(container.color).border,
                    color: getContainerColors(container.color).text,
                    border: "1px solid",
                  }}
                  title={`Container: ${container.name}`}
                >
                  <span className="text-xs leading-none">
                    {iconToEmoji(container.icon)}
                  </span>
                </div>
                <span className="text-xs text-gray-600 dark:text-gray-300 truncate max-w-[100px]">
                  {container.name}
                </span>
              </div>
            ) : suggestedContainer ? (
              <div className="flex items-center gap-1">
                <AlertCircle className="w-3 h-3 text-amber-500" />
                <span
                  className="text-xs text-amber-600 dark:text-amber-400 truncate max-w-[100px]"
                  title={`Suggested: ${suggestedContainer.name}`}
                >
                  {suggestedContainer.name}
                </span>
              </div>
            ) : null}

            {/* Tags */}
            {bookmark.tags.length > 0 && (
              <div className="flex items-center gap-1 ml-2">
                {bookmark.tags.slice(0, 2).map((tagId) => {
                  const tag = tags.find((t) => t.id === tagId)
                  if (!tag) return null
                  return (
                    <span
                      key={tagId}
                      className="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs rounded bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
                      title={tag.name}
                    >
                      <div
                        className="w-1.5 h-1.5 rounded-full"
                        style={{ backgroundColor: tag.color }}
                      />
                      <span className="truncate max-w-[60px]">{tag.name}</span>
                    </span>
                  )
                })}
                {bookmark.tags.length > 2 && (
                  <span className="text-xs text-gray-400 dark:text-gray-500">
                    +{bookmark.tags.length - 2}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  return null
}
