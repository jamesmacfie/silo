import {
  CheckSquare,
  Edit3,
  ExternalLink,
  Folder,
  FolderOpen,
  Square,
  Trash2,
} from "lucide-react"
import React from "react"
import type { Bookmark } from "@/shared/types"
import { BookmarkModal } from "../../../options/BookmarkModal"
import { useContainers } from "../../stores"
import {
  useBookmarkActions,
  useBookmarkStore,
  useSelectedBookmarks,
  useSelectedFolders,
} from "../../stores/bookmarkStore"
import { Card } from "../Card"

interface BookmarkTreeViewProps {
  className?: string
}

export function BookmarkTreeView({
  className = "",
}: BookmarkTreeViewProps): JSX.Element {
  const bookmarksTree = useBookmarkStore((state) => state.bookmarks)
  const expandedFolders = useBookmarkStore((state) => state.expandedFolders)
  const selectedBookmarks = useSelectedBookmarks()
  const selectedFolders = useSelectedFolders()
  const containers = useContainers()
  const { toggleFolder, selectBookmark, toggleFolderSelection, loadBookmarks } =
    useBookmarkActions()

  const [modalState, setModalState] = React.useState<{
    isOpen: boolean
    mode: "edit" | "delete"
    bookmark?: Bookmark
  }>({
    isOpen: false,
    mode: "edit",
  })

  const handleEditBookmark = (bookmark: Bookmark) => {
    setModalState({
      isOpen: true,
      mode: "edit",
      bookmark,
    })
  }

  const handleDeleteBookmark = (bookmark: Bookmark) => {
    setModalState({
      isOpen: true,
      mode: "delete",
      bookmark,
    })
  }

  const handleCloseModal = () => {
    setModalState({
      isOpen: false,
      mode: "edit",
    })
  }

  const handleModalSuccess = () => {
    loadBookmarks()
  }

  const renderBookmarkItem = (bookmark: Bookmark, depth = 0) => {
    const isSelected = selectedBookmarks.has(bookmark.id)
    const isFolderSelected = selectedFolders.has(bookmark.id)
    const isExpanded = expandedFolders.has(bookmark.id)

    if (bookmark.type === "folder") {
      return (
        <div key={bookmark.id} style={{ marginLeft: `${depth * 20}px` }}>
          {/* Folder Header */}
          <div
            className={`flex items-center gap-2 py-2 px-3 hover:bg-gray-50 dark:hover:bg-gray-700 rounded group ${
              isFolderSelected ? "bg-blue-50 dark:bg-blue-900" : ""
            }`}
          >
            <button
              onClick={() => toggleFolder(bookmark.id)}
              className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
            >
              {isExpanded ? (
                <FolderOpen className="w-4 h-4 text-blue-500" />
              ) : (
                <Folder className="w-4 h-4 text-gray-500" />
              )}
            </button>

            <button
              onClick={() => toggleFolderSelection(bookmark.id)}
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

          {/* Folder Contents */}
          {isExpanded && bookmark.children && (
            <div className="ml-4">
              {bookmark.children.map((child) =>
                renderBookmarkItem(child, depth + 1),
              )}
            </div>
          )}
        </div>
      )
    }

    if (bookmark.type === "bookmark" && bookmark.url) {
      return (
        <div
          key={bookmark.id}
          className={`flex items-center gap-2 py-2 px-3 hover:bg-gray-50 dark:hover:bg-gray-700 rounded group ${
            isSelected ? "bg-blue-50 dark:bg-blue-900" : ""
          }`}
          style={{ marginLeft: `${depth * 20}px` }}
        >
          <button
            onClick={() => selectBookmark(bookmark.id)}
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
                  onClick={() => handleEditBookmark(bookmark)}
                  className="p-1 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 rounded"
                  title="Edit bookmark"
                >
                  <Edit3 className="w-3 h-3" />
                </button>
                <button
                  onClick={() => handleDeleteBookmark(bookmark)}
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
          </div>

          {/* Tags */}
          {bookmark.tags.length > 0 && (
            <div className="flex gap-1">
              {bookmark.tags.slice(0, 2).map((tagId) => (
                <div
                  key={tagId}
                  className="w-2 h-2 rounded-full bg-blue-500"
                  title={`Tag: ${tagId}`}
                />
              ))}
              {bookmark.tags.length > 2 && (
                <span className="text-xs text-gray-400">
                  +{bookmark.tags.length - 2}
                </span>
              )}
            </div>
          )}
        </div>
      )
    }

    return null
  }

  if (bookmarksTree.length === 0) {
    return (
      <Card className={`bookmark-tree-view ${className}`}>
        <div className="flex flex-col items-center justify-center py-12">
          <div className="text-gray-400 dark:text-gray-600 mb-4">
            <Folder className="w-12 h-12" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
            No bookmarks found
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 text-center max-w-md">
            Your bookmark tree is empty or no bookmarks match your current
            filters.
          </p>
        </div>
      </Card>
    )
  }

  // Skip root folders and show their children directly
  const renderableBookmarks = bookmarksTree.flatMap((rootItem) => {
    // For root folders (like "Bookmarks Toolbar", "Other Bookmarks"), show their contents directly
    if (rootItem.type === "folder" && rootItem.children) {
      return rootItem.children
    }
    // For any root-level bookmarks (unlikely but possible), include them
    return [rootItem]
  })

  return (
    <Card className={`bookmark-tree-view ${className}`}>
      <div className="p-4">
        <div className="space-y-1">
          {renderableBookmarks.map((bookmark) => renderBookmarkItem(bookmark))}
        </div>
      </div>

      <style>{`
        .bookmark-tree-view {
          max-height: 600px;
          overflow-y: auto;
        }

        /* Smooth expansion animation */
        .ml-4 {
          animation: slideDown 0.2s ease-out;
        }

        @keyframes slideDown {
          from {
            opacity: 0;
            max-height: 0;
          }
          to {
            opacity: 1;
            max-height: 1000px;
          }
        }
      `}</style>

      <BookmarkModal
        isOpen={modalState.isOpen}
        mode={modalState.mode}
        bookmark={modalState.bookmark}
        containers={containers}
        onClose={handleCloseModal}
        onSuccess={handleModalSuccess}
      />
    </Card>
  )
}
