import {
  Check,
  Container as ContainerIcon,
  ExternalLink,
  Tag,
  Trash2,
  X,
} from "lucide-react"
import React from "react"
import type { BookmarkBulkAction, Container } from "@/shared/types"
import {
  useBookmarkActions,
  useBookmarkTags,
  useSelectedBookmarks,
  useSelectedFolders,
} from "../../stores/bookmarkStore"

interface BulkActionsBarProps {
  selectedCount: number
  containers: Container[]
  className?: string
}

export function BulkActionsBar({
  containers,
  className = "",
}: BulkActionsBarProps): JSX.Element {
  const selectedBookmarks = useSelectedBookmarks()
  const selectedFolders = useSelectedFolders()
  const tags = useBookmarkTags()
  const { executeBulkAction, clearSelection, deleteFolders } =
    useBookmarkActions()

  const [showTagMenu, setShowTagMenu] = React.useState(false)
  const [showContainerMenu, setShowContainerMenu] = React.useState(false)
  const [isExecuting, setIsExecuting] = React.useState(false)

  const selectedBookmarkIds = Array.from(selectedBookmarks)
  const selectedFolderIds = Array.from(selectedFolders)
  const totalSelectedCount =
    selectedBookmarkIds.length + selectedFolderIds.length

  const handleBulkAction = async (action: BookmarkBulkAction) => {
    if (isExecuting) return

    setIsExecuting(true)
    try {
      await executeBulkAction(action)
    } catch (error) {
      console.error("Bulk action failed:", error)
    } finally {
      setIsExecuting(false)
    }
  }

  const handleDelete = async () => {
    const hasBookmarks = selectedBookmarkIds.length > 0
    const hasFolders = selectedFolderIds.length > 0

    let message = ""
    if (hasBookmarks && hasFolders) {
      message = `Delete ${selectedBookmarkIds.length} bookmark${selectedBookmarkIds.length === 1 ? "" : "s"} and ${selectedFolderIds.length} folder${selectedFolderIds.length === 1 ? "" : "s"}? This action cannot be undone.`
    } else if (hasBookmarks) {
      message = `Delete ${selectedBookmarkIds.length} bookmark${selectedBookmarkIds.length === 1 ? "" : "s"}? This action cannot be undone.`
    } else if (hasFolders) {
      message = `Delete ${selectedFolderIds.length} folder${selectedFolderIds.length === 1 ? "" : "s"} and all their contents? This action cannot be undone.`
    }

    if (!confirm(message)) {
      return
    }

    try {
      setIsExecuting(true)

      // Delete folders first (which will delete their contents)
      if (hasFolders) {
        await deleteFolders(selectedFolderIds)
      }

      // Then delete individual bookmarks if any
      if (hasBookmarks) {
        await handleBulkAction({
          type: "delete",
          bookmarkIds: selectedBookmarkIds,
        })
      }
    } catch (error) {
      console.error("Delete operation failed:", error)
    } finally {
      setIsExecuting(false)
    }
  }

  const handleAssignTag = async (tagId: string) => {
    await handleBulkAction({
      type: "assignTag",
      bookmarkIds: selectedBookmarkIds, // Will be enhanced in executeBulkAction to include folder bookmarks
      payload: { tagId },
    })
    setShowTagMenu(false)
  }

  const _handleRemoveTag = async (tagId: string) => {
    await handleBulkAction({
      type: "removeTag",
      bookmarkIds: selectedBookmarkIds, // Will be enhanced in executeBulkAction to include folder bookmarks
      payload: { tagId },
    })
    setShowTagMenu(false)
  }

  const handleAssignContainer = async (containerId: string) => {
    await handleBulkAction({
      type: "assignContainer",
      bookmarkIds: selectedBookmarkIds, // Will be enhanced in executeBulkAction to include folder bookmarks
      payload: { containerId },
    })
    setShowContainerMenu(false)
  }

  const handleRemoveContainer = async () => {
    await handleBulkAction({
      type: "removeContainer",
      bookmarkIds: selectedBookmarkIds, // Will be enhanced in executeBulkAction to include folder bookmarks
    })
  }

  const handleOpenInContainer = async (containerId: string) => {
    await handleBulkAction({
      type: "openInContainer",
      bookmarkIds: selectedBookmarkIds, // Will be enhanced in executeBulkAction to include folder bookmarks
      payload: { containerId },
    })
    setShowContainerMenu(false)
  }

  if (totalSelectedCount === 0) return null

  return (
    <div className={`bulk-actions-bar ${className}`}>
      <div className="fixed bottom-4 left-4 right-4 z-30 max-w-4xl mx-auto">
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Check className="w-5 h-5 text-blue-500" />
                <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {selectedBookmarkIds.length > 0 &&
                  selectedFolderIds.length > 0
                    ? `${selectedBookmarkIds.length} bookmark${selectedBookmarkIds.length === 1 ? "" : "s"} and ${selectedFolderIds.length} folder${selectedFolderIds.length === 1 ? "" : "s"} selected`
                    : selectedBookmarkIds.length > 0
                      ? `${selectedBookmarkIds.length} bookmark${selectedBookmarkIds.length === 1 ? "" : "s"} selected`
                      : `${selectedFolderIds.length} folder${selectedFolderIds.length === 1 ? "" : "s"} selected`}
                </span>
              </div>

              <div className="flex items-center gap-2">
                {/* Tag Actions */}
                <div className="relative">
                  <button
                    onClick={() => setShowTagMenu(!showTagMenu)}
                    disabled={isExecuting}
                    className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium bg-blue-50 dark:bg-blue-900 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-700 rounded hover:bg-blue-100 dark:hover:bg-blue-800 transition-colors disabled:opacity-50"
                    title="Tag actions"
                  >
                    <Tag className="w-4 h-4" />
                    Tags
                  </button>

                  {showTagMenu && (
                    <>
                      <div
                        className="fixed inset-0 z-10"
                        onClick={() => setShowTagMenu(false)}
                      />
                      <div className="absolute bottom-full mb-2 left-0 w-64 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg z-20">
                        <div className="p-2">
                          <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
                            Assign Tags
                          </div>
                          <div className="max-h-32 overflow-y-auto space-y-1">
                            {tags.length === 0 ? (
                              <p className="text-xs text-gray-500 dark:text-gray-400 italic p-2">
                                No tags available
                              </p>
                            ) : (
                              tags.map((tag) => (
                                <button
                                  key={tag.id}
                                  onClick={() => handleAssignTag(tag.id)}
                                  className="w-full flex items-center gap-2 px-2 py-1.5 text-sm text-left rounded hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                                >
                                  <div
                                    className="w-3 h-3 rounded-full"
                                    style={{ backgroundColor: tag.color }}
                                  />
                                  <span className="flex-1">{tag.name}</span>
                                </button>
                              ))
                            )}
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </div>

                {/* Container Actions */}
                <div className="relative">
                  <button
                    onClick={() => setShowContainerMenu(!showContainerMenu)}
                    disabled={isExecuting}
                    className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium bg-green-50 dark:bg-green-900 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-700 rounded hover:bg-green-100 dark:hover:bg-green-800 transition-colors disabled:opacity-50"
                    title="Container actions"
                  >
                    <ContainerIcon className="w-4 h-4" />
                    Containers
                  </button>

                  {showContainerMenu && (
                    <>
                      <div
                        className="fixed inset-0 z-10"
                        onClick={() => setShowContainerMenu(false)}
                      />
                      <div className="absolute bottom-full mb-2 left-0 w-64 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg z-20">
                        <div className="p-2">
                          <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
                            Assign Container
                          </div>
                          <div className="max-h-32 overflow-y-auto space-y-1">
                            {containers.length === 0 ? (
                              <p className="text-xs text-gray-500 dark:text-gray-400 italic p-2">
                                No containers available
                              </p>
                            ) : (
                              containers.map((container) => (
                                <button
                                  key={container.cookieStoreId}
                                  onClick={() =>
                                    handleAssignContainer(
                                      container.cookieStoreId,
                                    )
                                  }
                                  className="w-full flex items-center gap-2 px-2 py-1.5 text-sm text-left rounded hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                                >
                                  <div className="w-4 h-4 rounded bg-gray-200 dark:bg-gray-600 flex items-center justify-center text-xs font-medium">
                                    {container.name.charAt(0).toUpperCase()}
                                  </div>
                                  <span className="flex-1">
                                    {container.name}
                                  </span>
                                </button>
                              ))
                            )}
                          </div>

                          <div className="border-t border-gray-200 dark:border-gray-600 mt-2 pt-2">
                            <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
                              Open Actions
                            </div>
                            {containers.map((container) => (
                              <button
                                key={`open-${container.cookieStoreId}`}
                                onClick={() =>
                                  handleOpenInContainer(container.cookieStoreId)
                                }
                                className="w-full flex items-center gap-2 px-2 py-1.5 text-sm text-left rounded hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                              >
                                <ExternalLink className="w-3 h-3" />
                                <span className="flex-1">
                                  Open in {container.name}
                                </span>
                              </button>
                            ))}
                          </div>

                          <div className="border-t border-gray-200 dark:border-gray-600 mt-2 pt-2">
                            <button
                              onClick={handleRemoveContainer}
                              className="w-full flex items-center gap-2 px-2 py-1.5 text-sm text-left rounded hover:bg-red-50 dark:hover:bg-red-900 text-red-600 dark:text-red-400 transition-colors"
                            >
                              <X className="w-3 h-3" />
                              Remove container assignment
                            </button>
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </div>

                {/* Delete Action */}
                <button
                  onClick={handleDelete}
                  disabled={isExecuting}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium bg-red-50 dark:bg-red-900 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-700 rounded hover:bg-red-100 dark:hover:bg-red-800 transition-colors disabled:opacity-50"
                  title="Delete selected bookmarks"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete
                </button>
              </div>
            </div>

            {/* Close Button */}
            <button
              onClick={clearSelection}
              disabled={isExecuting}
              className="p-2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors disabled:opacity-50"
              title="Clear selection"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {isExecuting && (
            <div className="mt-2 flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
              <span>Executing bulk action...</span>
            </div>
          )}
        </div>
      </div>

      <style>{`
        .bulk-actions-bar {
          position: relative;
        }

        /* Animation */
        .fixed.bottom-4 {
          animation: slideUp 0.3s ease-out;
        }

        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        /* Mobile responsive adjustments */
        @media (max-width: 640px) {
          .flex.items-center.gap-2 {
            flex-wrap: wrap;
            gap: 0.5rem;
          }
          
          .fixed.bottom-4.left-4.right-4 {
            left: 1rem;
            right: 1rem;
          }
        }
      `}</style>
    </div>
  )
}
