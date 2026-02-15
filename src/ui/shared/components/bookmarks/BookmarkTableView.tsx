import {
  AlertCircle,
  Bookmark as BookmarkIcon,
  CheckSquare,
  Edit3,
  ExternalLink,
  Square,
  Trash2,
} from "lucide-react"
import React from "react"
import type { Bookmark } from "@/shared/types"
import { BookmarkModal } from "../../../options/BookmarkModal"
import { useContainers } from "../../stores"
import {
  useBookmarkActions,
  useFilteredBookmarks,
  useSelectedBookmarks,
} from "../../stores/bookmarkStore"
import { Card } from "../Card"
import { ContainerBadge } from "../ContainerBadge"

interface BookmarkTableViewProps {
  className?: string
}

export function BookmarkTableView({
  className = "",
}: BookmarkTableViewProps): JSX.Element {
  const bookmarks = useFilteredBookmarks()
  const selectedBookmarks = useSelectedBookmarks()
  const containers = useContainers()
  const { selectBookmark, clearSelection, checkRuleMatch, loadBookmarks } =
    useBookmarkActions()

  const [modalState, setModalState] = React.useState<{
    isOpen: boolean
    mode: "edit" | "delete"
    bookmark?: Bookmark
  }>({
    isOpen: false,
    mode: "edit",
  })
  const [ruleMatches, setRuleMatches] = React.useState<Map<string, string>>(
    new Map(),
  )

  // Check rule matches for bookmarks without containers
  React.useEffect(() => {
    const checkRules = async () => {
      const matches = new Map<string, string>()

      for (const bookmark of bookmarks) {
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

    if (bookmarks.length > 0) {
      checkRules()
    }
  }, [bookmarks, checkRuleMatch])

  const handleSelectAll = () => {
    const allSelected = bookmarks.every((bookmark) =>
      selectedBookmarks.has(bookmark.id),
    )
    if (allSelected) {
      clearSelection()
    } else {
      clearSelection()
      bookmarks.forEach((bookmark) => {
        selectBookmark(bookmark.id, true)
      })
    }
  }

  const handleSelectBookmark = (id: string, event: React.MouseEvent) => {
    event.preventDefault()
    selectBookmark(id, event.ctrlKey || event.metaKey || event.shiftKey)
  }

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

  const getContainer = (containerId: string) =>
    containers.find((c) => c.cookieStoreId === containerId)

  const formatDate = (timestamp: number | undefined) => {
    if (!timestamp) return "Unknown"
    return new Date(timestamp).toLocaleDateString()
  }

  const formatFolderPath = (folderPath: string[] | undefined) => {
    if (!folderPath || folderPath.length === 0) return "Root"
    return folderPath.join(" > ")
  }

  const allSelected =
    bookmarks.length > 0 &&
    bookmarks.every((bookmark) => selectedBookmarks.has(bookmark.id))
  const someSelected = bookmarks.some((bookmark) =>
    selectedBookmarks.has(bookmark.id),
  )

  if (bookmarks.length === 0) {
    return (
      <Card className={`bookmark-table-view ${className}`}>
        <div className="flex flex-col items-center justify-center py-12">
          <div className="text-gray-500 dark:text-gray-400 mb-4">
            <BookmarkIcon className="w-12 h-12" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
            No bookmarks found
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 text-center max-w-md">
            No bookmarks match your current search and filter criteria. Try
            adjusting your filters or search terms.
          </p>
        </div>
      </Card>
    )
  }

  return (
    <div
      className={`bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 ${className}`}
    >
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700">
              <th className="text-left py-3 px-4 font-medium text-gray-900 dark:text-gray-100 w-12">
                <button
                  onClick={handleSelectAll}
                  className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                  title={allSelected ? "Deselect all" : "Select all"}
                >
                  {allSelected ? (
                    <CheckSquare className="w-4 h-4 text-blue-500" />
                  ) : someSelected ? (
                    <div className="w-4 h-4 bg-blue-500 rounded flex items-center justify-center">
                      <div className="w-2 h-0.5 bg-white"></div>
                    </div>
                  ) : (
                    <Square className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                  )}
                </button>
              </th>
              <th className="text-left py-3 px-4 font-medium text-gray-900 dark:text-gray-100">
                Title & URL
              </th>
              <th className="text-left py-3 px-4 font-medium text-gray-900 dark:text-gray-100">
                Container
              </th>
              <th className="text-left py-3 px-4 font-medium text-gray-900 dark:text-gray-100">
                Folder
              </th>
              <th className="text-left py-3 px-4 font-medium text-gray-900 dark:text-gray-100">
                Added
              </th>
              <th className="text-left py-3 px-4 font-medium text-gray-900 dark:text-gray-100 w-24">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {bookmarks.map((bookmark) => {
              const isSelected = selectedBookmarks.has(bookmark.id)
              const container = bookmark.containerId
                ? getContainer(bookmark.containerId)
                : null
              const ruleMatch = ruleMatches.get(bookmark.id)
              const suggestedContainer = ruleMatch
                ? getContainer(ruleMatch)
                : null

              return (
                <tr
                  key={bookmark.id}
                  className={`hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors ${
                    isSelected ? "bg-blue-50 dark:bg-blue-900/20" : ""
                  }`}
                >
                  {/* Selection Checkbox */}
                  <td className="py-3 px-4">
                    <button
                      onClick={(e) => handleSelectBookmark(bookmark.id, e)}
                      className="p-1 hover:bg-gray-100 dark:hover:bg-gray-600 rounded"
                    >
                      {isSelected ? (
                        <CheckSquare className="w-4 h-4 text-blue-500" />
                      ) : (
                        <Square className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                      )}
                    </button>
                  </td>

                  {/* Title & URL */}
                  <td className="py-3 px-4">
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900 dark:text-gray-100 truncate max-w-xs">
                          {bookmark.title}
                        </span>
                        {bookmark.url && (
                          <a
                            href={bookmark.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-gray-500 hover:text-gray-600 dark:text-gray-400 dark:hover:text-gray-300"
                            title="Open bookmark"
                          >
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                      {bookmark.url && (
                        <span className="text-xs text-gray-500 dark:text-gray-400 font-mono truncate max-w-md">
                          {bookmark.url}
                        </span>
                      )}
                      {bookmark.description && (
                        <span className="text-xs text-gray-600 dark:text-gray-300 mt-1 truncate max-w-md">
                          {bookmark.description}
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Container */}
                  <td className="py-3 px-4">
                    <div className="flex flex-col gap-1">
                      {container ? (
                        <ContainerBadge container={container} size="xs" />
                      ) : suggestedContainer ? (
                        <div className="flex items-center gap-2">
                          <AlertCircle className="w-4 h-4 text-amber-500" />
                          <div className="flex flex-col">
                            <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                              Suggested: {suggestedContainer.name}
                            </span>
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              Based on rules
                            </span>
                          </div>
                        </div>
                      ) : (
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                          None
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Folder */}
                  <td className="py-3 px-4">
                    <span className="text-sm text-gray-600 dark:text-gray-300 truncate max-w-xs block">
                      {formatFolderPath(bookmark.folderPath)}
                    </span>
                  </td>

                  {/* Date Added */}
                  <td className="py-3 px-4">
                    <span className="text-sm text-gray-600 dark:text-gray-300">
                      {formatDate(bookmark.dateAdded)}
                    </span>
                  </td>

                  {/* Actions */}
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleEditBookmark(bookmark)}
                        className="p-1 text-gray-500 hover:text-gray-600 dark:text-gray-400 dark:hover:text-gray-300 rounded"
                        title="Edit bookmark"
                      >
                        <Edit3 className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => handleDeleteBookmark(bookmark)}
                        className="p-1 text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400 rounded"
                        title="Delete bookmark"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                      {bookmark.url && (
                        <a
                          href={bookmark.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1 text-gray-500 hover:text-gray-600 dark:text-gray-400 dark:hover:text-gray-300 rounded"
                          title="Open bookmark"
                        >
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <BookmarkModal
        isOpen={modalState.isOpen}
        mode={modalState.mode}
        bookmark={modalState.bookmark}
        containers={containers}
        onClose={handleCloseModal}
        onSuccess={handleModalSuccess}
      />
    </div>
  )
}
