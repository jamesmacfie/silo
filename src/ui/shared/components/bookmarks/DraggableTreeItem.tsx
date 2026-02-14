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
  Plus,
  Square,
  Trash2,
} from "lucide-react"
import type React from "react"
import type { Bookmark, BookmarkTag, Container } from "@/shared/types"
import { ContainerBadge } from "../ContainerBadge"
import { TagBadge } from "../TagBadge"

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
  tags?: BookmarkTag[]
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
  tags = [],
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

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()

    if (bookmark.type === "folder") {
      // For folders, show context menu with add options
      const menu = [
        {
          label: "Add Bookmark Here",
          action: () => onCreateBookmark?.(bookmark.id),
        },
        {
          label: "Add Folder Here",
          action: () => onCreateFolder?.(bookmark.id),
        },
      ]

      // Simple context menu - in a real app you'd use a proper context menu library
      // For now, we'll just show the options as a temporary overlay
      console.log("Context menu for folder:", menu)
    }
  }

  if (bookmark.type === "folder") {
    return (
      <div style={{ marginLeft: `${depth * 20}px` }}>
        <div
          ref={(element) => {
            setNodeRef(element)
            setItemRef?.(element)
          }}
          style={style}
          className={`flex items-center gap-2 py-2 px-3 hover:bg-gray-50 dark:hover:bg-gray-700 rounded group ${
            isFolderSelected ? "bg-blue-50 dark:bg-blue-900" : ""
          } ${isDragging ? "shadow-lg z-50" : ""} ${
            isDropTarget && bookmark.type === "folder"
              ? "bg-green-50 dark:bg-green-900 border-2 border-green-300 dark:border-green-600"
              : ""
          } ${
            isHighlighted
              ? "bg-yellow-100 dark:bg-yellow-900/30 border-2 border-yellow-300 dark:border-yellow-600 animate-pulse"
              : ""
          }`}
          onContextMenu={handleContextMenu}
        >
          {/* Drag handle */}
          <button
            {...attributes}
            {...listeners}
            className="p-1 text-gray-500 dark:text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity"
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

          <span className="flex-1 text-sm font-medium text-gray-900 dark:text-gray-100">
            {bookmark.title}
          </span>

          {/* Inline add buttons that appear on hover */}
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
        ref={(element) => {
          setNodeRef(element)
          setItemRef?.(element)
        }}
        className={`flex items-center gap-2 py-2 px-3 hover:bg-gray-50 dark:hover:bg-gray-700 rounded group ${
          isSelected ? "bg-blue-50 dark:bg-blue-900" : ""
        } ${isDragging ? "shadow-lg z-50" : ""} ${
          isHighlighted
            ? "bg-yellow-100 dark:bg-yellow-900/30 border-2 border-yellow-300 dark:border-yellow-600 animate-pulse"
            : ""
        }`}
        style={{
          marginLeft: `${depth * 20}px`,
          ...style,
        }}
      >
        {/* Drag handle */}
        <button
          {...attributes}
          {...listeners}
          className="p-1 text-gray-500 dark:text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity"
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
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
              {bookmark.title}
            </span>
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400 truncate font-mono">
            {bookmark.url}
          </div>

          {/* Container and Tags Row */}
          <div className="flex items-center gap-2 mt-1">
            {/* Container */}
            {container ? (
              <ContainerBadge container={container} size="xs" />
            ) : suggestedContainer ? (
              <div className="flex items-center gap-1">
                <AlertCircle className="w-4 h-4 text-amber-500" />
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
                  return <TagBadge key={tagId} tag={tag} size="xs" />
                })}
                {bookmark.tags.length > 2 && (
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    +{bookmark.tags.length - 2}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Action buttons - right aligned */}
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
          <a
            href={bookmark.url}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1 text-gray-500 hover:text-gray-600 dark:text-gray-400 dark:hover:text-gray-300 rounded"
            title="Open bookmark"
          >
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>
    )
  }

  return null
}
