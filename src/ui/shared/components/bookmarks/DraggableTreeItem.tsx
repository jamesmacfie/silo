import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import {
  CheckSquare,
  Edit3,
  Folder,
  FolderOpen,
  GripVertical,
  Plus,
  Square,
  Trash2,
} from "lucide-react"
import type React from "react"
import type { Bookmark, Container } from "@/shared/types"
import { ContainerBadge } from "../ContainerBadge"

interface DraggableTreeItemProps {
  bookmark: Bookmark
  depth: number
  isSelected: boolean
  isFolderSelected?: boolean
  isExpanded?: boolean
  isDropTarget?: boolean
  isHighlighted?: boolean
  container?: Container | null
  suggestedContainer?: Container | null
  onToggleFolder?: (id: string) => void
  onSelectBookmark?: (id: string) => void
  onToggleFolderSelection?: (id: string) => void
  onEditBookmark?: (bookmark: Bookmark) => void
  onDeleteBookmark?: (bookmark: Bookmark) => void
  onCreateBookmark?: (parentId: string) => void
  onCreateFolder?: (parentId: string) => void
  setItemRef?: (element: HTMLElement | null) => void
  children?: React.ReactNode
}

export function DraggableTreeItem({
  bookmark,
  depth,
  isSelected,
  isFolderSelected = false,
  isExpanded = false,
  isDropTarget = false,
  isHighlighted = false,
  container,
  suggestedContainer,
  onToggleFolder,
  onSelectBookmark,
  onToggleFolderSelection,
  onEditBookmark,
  onDeleteBookmark,
  onCreateBookmark,
  onCreateFolder,
  setItemRef,
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

  const baseRowClasses =
    "flex items-center gap-2 rounded px-2 py-1.5 text-sm group transition-colors"

  const activeStateClasses = `${isDragging ? "shadow-sm z-50" : ""} ${
    isHighlighted
      ? "bg-yellow-50 dark:bg-yellow-900/20 ring-1 ring-yellow-300 dark:ring-yellow-700"
      : ""
  }`

  if (bookmark.type === "folder") {
    return (
      <div style={{ marginLeft: `${depth * 20}px` }}>
        <div
          ref={(element) => {
            setNodeRef(element)
            setItemRef?.(element)
          }}
          style={style}
          className={`${baseRowClasses} hover:bg-gray-50 dark:hover:bg-gray-700 ${
            isFolderSelected ? "bg-blue-50 dark:bg-blue-900" : ""
          } ${
            isDropTarget && bookmark.type === "folder"
              ? "ring-1 ring-green-400 dark:ring-green-600 bg-green-50 dark:bg-green-900/20"
              : ""
          } ${activeStateClasses}`}
        >
          <button
            {...attributes}
            {...listeners}
            className="p-1 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 cursor-grab active:cursor-grabbing"
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
              <Folder className="w-4 h-4 text-gray-500 dark:text-gray-400" />
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
              <Square className="w-4 h-4 text-gray-500 dark:text-gray-400" />
            )}
          </button>

          <span className="flex-1 min-w-0 truncate text-sm font-medium text-gray-900 dark:text-gray-100">
            {bookmark.title}
          </span>

          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={(e) => {
                e.stopPropagation()
                onCreateBookmark?.(bookmark.id)
              }}
              className="p-1 text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 rounded"
              title="Add bookmark here"
            >
              <Plus className="w-3 h-3" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation()
                onCreateFolder?.(bookmark.id)
              }}
              className="p-1 text-gray-500 hover:text-green-600 dark:text-gray-400 dark:hover:text-green-400 rounded"
              title="Add folder here"
            >
              <Folder className="w-3 h-3" />
            </button>
          </div>

          {bookmark.children && (
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {bookmark.children.length}
            </span>
          )}
        </div>

        {children}
      </div>
    )
  }

  if (bookmark.type === "bookmark" && bookmark.url) {
    return (
      <div
        ref={(element) => {
          setNodeRef(element)
          setItemRef?.(element)
        }}
        className={`${baseRowClasses} hover:bg-gray-50 dark:hover:bg-gray-700 ${
          isSelected ? "bg-blue-50 dark:bg-blue-900" : ""
        } ${activeStateClasses}`}
        style={{
          marginLeft: `${depth * 20}px`,
          ...style,
        }}
      >
        <button
          {...attributes}
          {...listeners}
          className="p-1 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 cursor-grab active:cursor-grabbing"
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
            <Square className="w-4 h-4 text-gray-500 dark:text-gray-400" />
          )}
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <a
              href={bookmark.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate hover:underline"
              title={bookmark.url}
              onClick={(e) => e.stopPropagation()}
            >
              {bookmark.title}
            </a>
          </div>
          {container ? (
            <div className="mt-1">
              <ContainerBadge container={container} size="xs" />
            </div>
          ) : suggestedContainer ? (
            <div className="mt-1 text-xs text-amber-600 dark:text-amber-400 truncate">
              Suggested: {suggestedContainer.name}
            </div>
          ) : null}
        </div>

        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => onEditBookmark?.(bookmark)}
            className="p-1 text-gray-500 hover:text-gray-600 dark:text-gray-400 dark:hover:text-gray-300 rounded"
            title="Edit bookmark"
          >
            <Edit3 className="w-3 h-3" />
          </button>
          <button
            onClick={() => onDeleteBookmark?.(bookmark)}
            className="p-1 text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400 rounded"
            title="Delete bookmark"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>
    )
  }

  return null
}
