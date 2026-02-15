import {
  DndContext,
  type DragEndEvent,
  type DragMoveEvent,
  DragOverlay,
  type DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core"
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable"
import { Folder, Plus } from "lucide-react"
import React from "react"
import type { Bookmark } from "@/shared/types"
import { flattenBookmarkTree } from "@/shared/utils/bookmarkTree"
import { BookmarkModal } from "../../../options/BookmarkModal"
import { useContainers } from "../../stores"
import {
  useBookmarkActions,
  useBookmarkError,
  useBookmarkLoading,
  useBookmarkStore,
  useSelectedBookmarks,
  useSelectedFolders,
} from "../../stores/bookmarkStore"
import { Card } from "../Card"
import { DraggableTreeItem } from "./DraggableTreeItem"

interface BookmarkTreeViewProps {
  className?: string
}

export function BookmarkTreeView({
  className = "",
}: BookmarkTreeViewProps): JSX.Element {
  const bookmarksTree = useBookmarkStore((state) => state.bookmarks)
  const expandedFolders = useBookmarkStore((state) => state.expandedFolders)
  const newlyCreatedItems = useBookmarkStore((state) => state.newlyCreatedItems)
  const selectedBookmarks = useSelectedBookmarks()
  const selectedFolders = useSelectedFolders()
  const containers = useContainers()
  const {
    toggleFolder,
    selectBookmark,
    toggleFolderSelection,
    loadBookmarks,
    reorderBookmarks,
    moveBookmark,
    checkRuleMatch,
  } = useBookmarkActions()

  const loading = useBookmarkLoading()
  const error = useBookmarkError()

  const [draggedItem, setDraggedItem] = React.useState<Bookmark | null>(null)
  const [dropTarget, setDropTarget] = React.useState<{
    id: string
    type: "folder" | "reorder"
  } | null>(null)
  const [ruleMatches, setRuleMatches] = React.useState<Map<string, string>>(
    new Map(),
  )

  // Refs for scroll-to-view functionality
  const itemRefs = React.useRef<Map<string, HTMLElement>>(new Map())

  // Scroll to newly created items
  React.useEffect(() => {
    if (newlyCreatedItems.size > 0) {
      // Scroll to the first newly created item
      const firstNewItemId = Array.from(newlyCreatedItems)[0]
      const element = itemRefs.current.get(firstNewItemId)
      if (element) {
        element.scrollIntoView({
          behavior: "smooth",
          block: "center",
        })
      }
    }
  }, [newlyCreatedItems])

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
  )

  const [modalState, setModalState] = React.useState<{
    isOpen: boolean
    mode: "create-bookmark" | "create-folder" | "edit" | "delete"
    bookmark?: Bookmark
    parentId?: string
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

  const handleCreateBookmark = (parentId?: string) => {
    setModalState({
      isOpen: true,
      mode: "create-bookmark",
      parentId,
    })
  }

  const handleCreateFolder = (parentId?: string) => {
    setModalState({
      isOpen: true,
      mode: "create-folder",
      parentId,
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

  // Helper functions
  const getContainer = (containerId: string) =>
    containers.find((c) => c.cookieStoreId === containerId)

  // Check rule matches for bookmarks without containers
  React.useEffect(() => {
    const checkRules = async () => {
      const matches = new Map<string, string>()
      const allBookmarks = flattenBookmarkTree(bookmarksTree)

      for (const bookmark of allBookmarks) {
        if (bookmark.url && !bookmark.containerId) {
          try {
            const matchedContainer = await checkRuleMatch(bookmark.url)
            if (matchedContainer) {
              matches.set(bookmark.id, matchedContainer)
            }
          } catch (_error) {
            // Ignore rule check errors
          }
        }
      }

      setRuleMatches(matches)
    }

    if (bookmarksTree.length > 0) {
      checkRules()
    }
  }, [bookmarksTree, checkRuleMatch])

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event
    const bookmark = active.data.current?.bookmark as Bookmark
    setDraggedItem(bookmark)
  }

  const handleDragMove = (event: DragMoveEvent) => {
    const { over } = event
    if (over) {
      const overData = over.data.current
      if (overData?.bookmark?.type === "folder") {
        setDropTarget({ id: over.id as string, type: "folder" })
      } else {
        setDropTarget({ id: over.id as string, type: "reorder" })
      }
    } else {
      setDropTarget(null)
    }
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    setDraggedItem(null)
    setDropTarget(null)

    if (!over || active.id === over.id) return

    const draggedBookmark = active.data.current?.bookmark as Bookmark
    const overData = over.data.current
    const overBookmark = overData?.bookmark as Bookmark

    if (!draggedBookmark || !overBookmark) return

    try {
      if (overBookmark.type === "folder") {
        // Moving into a folder
        await moveBookmark(draggedBookmark.id, overBookmark.id)
      } else if (draggedBookmark.parentId === overBookmark.parentId) {
        // Reordering within the same parent
        const findSiblings = (
          bookmarks: Bookmark[],
          parentId: string,
        ): Bookmark[] => {
          for (const bookmark of bookmarks) {
            if (bookmark.id === parentId && bookmark.children) {
              return bookmark.children
            }
            if (bookmark.children) {
              const found = findSiblings(bookmark.children, parentId)
              if (found.length > 0) return found
            }
          }
          return []
        }

        const parentId = draggedBookmark.parentId
        if (!parentId) {
          return
        }

        const siblings = findSiblings(bookmarksTree, parentId)
        const draggedIndex = siblings.findIndex(
          (s) => s.id === draggedBookmark.id,
        )
        const overIndex = siblings.findIndex((s) => s.id === overBookmark.id)

        if (
          draggedIndex !== -1 &&
          overIndex !== -1 &&
          draggedIndex !== overIndex
        ) {
          const newOrder = [...siblings]
          const [draggedItem] = newOrder.splice(draggedIndex, 1)
          newOrder.splice(overIndex, 0, draggedItem)

          await reorderBookmarks(
            parentId,
            newOrder.map((b) => b.id),
          )
        }
      } else {
        // Different parent - move to the over item's parent at the over item's position
        await moveBookmark(
          draggedBookmark.id,
          overBookmark.parentId,
          overBookmark.index,
        )
      }
    } catch (_error) {
      // Error state is already set in the store actions
      // Could add toast notification here if available
    }
  }

  const renderBookmarkItem = (bookmark: Bookmark, depth = 0) => {
    const isSelected = selectedBookmarks.has(bookmark.id)
    const isFolderSelected = selectedFolders.has(bookmark.id)
    const isExpanded = expandedFolders.has(bookmark.id)
    const isHighlighted = newlyCreatedItems.has(bookmark.id)

    // Get container information for bookmarks
    const container = bookmark.containerId
      ? getContainer(bookmark.containerId)
      : null
    const ruleMatch = ruleMatches.get(bookmark.id)
    const suggestedContainer = ruleMatch ? getContainer(ruleMatch) : null

    // Callback to store element ref for scrolling
    const setItemRef = (element: HTMLElement | null) => {
      if (element) {
        itemRefs.current.set(bookmark.id, element)
      } else {
        itemRefs.current.delete(bookmark.id)
      }
    }

    if (bookmark.type === "folder") {
      return (
        <DraggableTreeItem
          key={bookmark.id}
          bookmark={bookmark}
          depth={depth}
          isSelected={isSelected}
          isFolderSelected={isFolderSelected}
          isExpanded={isExpanded}
          isDropTarget={
            dropTarget?.id === bookmark.id && dropTarget?.type === "folder"
          }
          isHighlighted={isHighlighted}
          setItemRef={setItemRef}
          onToggleFolder={toggleFolder}
          onSelectBookmark={selectBookmark}
          onToggleFolderSelection={toggleFolderSelection}
          onEditBookmark={handleEditBookmark}
          onDeleteBookmark={handleDeleteBookmark}
          onCreateBookmark={handleCreateBookmark}
          onCreateFolder={handleCreateFolder}
        >
          {/* Folder Contents */}
          {isExpanded && bookmark.children && (
            <div className="ml-4">
              <SortableContext
                items={bookmark.children.map((child) => child.id)}
                strategy={verticalListSortingStrategy}
              >
                {bookmark.children.map((child) =>
                  renderBookmarkItem(child, depth + 1),
                )}
              </SortableContext>
            </div>
          )}
        </DraggableTreeItem>
      )
    }

    if (bookmark.type === "bookmark" && bookmark.url) {
      return (
        <DraggableTreeItem
          key={bookmark.id}
          bookmark={bookmark}
          depth={depth}
          isSelected={isSelected}
          isFolderSelected={isFolderSelected}
          isExpanded={isExpanded}
          isDropTarget={
            dropTarget?.id === bookmark.id && dropTarget?.type === "folder"
          }
          isHighlighted={isHighlighted}
          setItemRef={setItemRef}
          container={container}
          suggestedContainer={suggestedContainer}
          onToggleFolder={toggleFolder}
          onSelectBookmark={selectBookmark}
          onToggleFolderSelection={toggleFolderSelection}
          onEditBookmark={handleEditBookmark}
          onDeleteBookmark={handleDeleteBookmark}
          onCreateBookmark={handleCreateBookmark}
          onCreateFolder={handleCreateFolder}
        />
      )
    }

    return null
  }

  if (bookmarksTree.length === 0) {
    return (
      <Card className={`bookmark-tree-view ${className}`}>
        <div className="flex flex-col items-center justify-center py-12">
          <div className="text-gray-500 dark:text-gray-400 mb-4">
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
    <Card className={`bookmark-tree-view relative ${className}`}>
      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragMove={handleDragMove}
        onDragEnd={handleDragEnd}
      >
        {loading.dragOperation && (
          <div className="absolute inset-0 bg-white/50 dark:bg-gray-800/50 flex items-center justify-center z-50 rounded-lg">
            <div className="flex items-center gap-2 bg-white dark:bg-gray-800 rounded-lg shadow-lg px-4 py-2 border">
              <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
              <span className="text-sm text-gray-700 dark:text-gray-300">
                Moving bookmark...
              </span>
            </div>
          </div>
        )}

        {error && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <div className="flex items-center justify-between">
              <span className="text-sm text-red-700 dark:text-red-300">
                {error}
              </span>
              <button
                onClick={() => useBookmarkStore.getState().actions.clearError()}
                className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-200"
              >
                ×
              </button>
            </div>
          </div>
        )}

        {/* Subtle creation buttons at top */}
        <div className="absolute top-4 right-4 flex gap-2 z-30">
          <button
            onClick={() => handleCreateBookmark()}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 hover:border-blue-300 dark:hover:border-blue-500 transition-colors shadow-sm"
            title="Create new bookmark"
          >
            <Plus className="w-3 h-3" />
            Bookmark
          </button>
          <button
            onClick={() => handleCreateFolder()}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 hover:border-green-300 dark:hover:border-green-500 transition-colors shadow-sm"
            title="Create new folder"
          >
            <Folder className="w-3 h-3" />
            Folder
          </button>
        </div>

        <div className="space-y-1">
          <SortableContext
            items={renderableBookmarks.map((bookmark) => bookmark.id)}
            strategy={verticalListSortingStrategy}
          >
            {renderableBookmarks.map((bookmark) =>
              renderBookmarkItem(bookmark),
            )}
          </SortableContext>
        </div>

        {/* Drag overlay */}
        <DragOverlay>
          {draggedItem ? (
            <div className="bg-white dark:bg-gray-800 shadow-lg rounded p-2 opacity-90 border">
              <div className="flex items-center gap-2">
                {draggedItem.type === "folder" ? (
                  <Folder className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                ) : null}
                <span className="text-sm font-medium">{draggedItem.title}</span>
              </div>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

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
        parentId={modalState.parentId}
        onClose={handleCloseModal}
        onSuccess={handleModalSuccess}
      />
    </Card>
  )
}
