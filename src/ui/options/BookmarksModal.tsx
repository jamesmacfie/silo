import { Eye } from "lucide-react"
import { useEffect, useState } from "react"
import type { Bookmark, BookmarkTag } from "@/shared/types"
import { ContainerBadge } from "../shared/components/ContainerBadge"
import { Modal } from "../shared/components/Modal"
import { TagBadge } from "../shared/components/TagBadge"
import { useContainers } from "../shared/stores"
import {
  useBookmarkActions,
  useBookmarkStore,
  useBookmarkTags,
} from "../shared/stores/bookmarkStore"

interface BookmarksModalProps {
  isOpen: boolean
  tag: BookmarkTag | null
  onClose: () => void
}

export function BookmarksModal({
  isOpen,
  tag,
  onClose,
}: BookmarksModalProps): JSX.Element {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([])
  const [loading, setLoading] = useState(false)
  const containers = useContainers()
  const tags = useBookmarkTags()
  const { loadBookmarks } = useBookmarkActions()

  // Get bookmarks from store
  const flatBookmarks = useBookmarkStore((state) => state.flatBookmarks)

  // Load and filter bookmarks when modal opens or tag changes
  useEffect(() => {
    if (!isOpen || !tag) {
      setBookmarks([])
      return
    }

    const loadTagBookmarks = async () => {
      setLoading(true)
      try {
        await loadBookmarks()
        // Filter bookmarks that have this tag
        const taggedBookmarks = flatBookmarks.filter((bookmark) =>
          bookmark.tags.includes(tag.id),
        )
        setBookmarks(taggedBookmarks)
      } catch (error) {
        console.error("Failed to load bookmarks:", error)
        setBookmarks([])
      } finally {
        setLoading(false)
      }
    }

    loadTagBookmarks()
  }, [isOpen, tag, loadBookmarks, flatBookmarks])

  const getContainer = (containerId: string) =>
    containers.find((c) => c.cookieStoreId === containerId)

  const getTag = (tagId: string) => tags.find((t) => t.id === tagId)

  if (!isOpen || !tag) return <></>

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Bookmarks with "${tag.name}" tag`}
      size="large"
    >
      <div className="max-h-96 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            <span className="ml-3 text-sm text-gray-500 dark:text-gray-400">
              Loading bookmarks...
            </span>
          </div>
        ) : bookmarks.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-500 dark:text-gray-400">
              No bookmarks found with this tag.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-gray-200 dark:border-gray-700">
                <tr>
                  <th className="text-left py-2 px-3 text-sm font-medium text-gray-900 dark:text-gray-100">
                    Bookmark
                  </th>
                  <th className="text-left py-2 px-3 text-sm font-medium text-gray-900 dark:text-gray-100">
                    Tags
                  </th>
                  <th className="text-left py-2 px-3 text-sm font-medium text-gray-900 dark:text-gray-100">
                    Container
                  </th>
                  <th className="text-center py-2 px-3 text-sm font-medium text-gray-900 dark:text-gray-100 w-16">
                    {/* Visit column - icons are self-explanatory */}
                  </th>
                </tr>
              </thead>
              <tbody>
                {bookmarks.map((bookmark) => {
                  const container = bookmark.containerId
                    ? getContainer(bookmark.containerId)
                    : null

                  return (
                    <tr
                      key={bookmark.id}
                      className="hover:bg-gray-50 dark:hover:bg-gray-800/50 border-b border-gray-100 dark:border-gray-800 last:border-b-0"
                    >
                      {/* Bookmark Name & URL */}
                      <td className="py-3 px-3">
                        <div className="flex flex-col gap-1">
                          <span className="font-medium text-gray-900 dark:text-gray-100 text-sm truncate max-w-xs">
                            {bookmark.title}
                          </span>
                          {bookmark.url && (
                            <span className="text-xs text-gray-500 dark:text-gray-400 font-mono truncate max-w-sm">
                              {bookmark.url}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Tags */}
                      <td className="py-3 px-3">
                        <div className="flex flex-wrap gap-1 max-w-xs">
                          {bookmark.tags.slice(0, 3).map((tagId) => {
                            const tagInfo = getTag(tagId)
                            if (!tagInfo) return null
                            return (
                              <TagBadge key={tagId} tag={tagInfo} size="xs" />
                            )
                          })}
                          {bookmark.tags.length > 3 && (
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              +{bookmark.tags.length - 3}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Container */}
                      <td className="py-3 px-3">
                        {container ? (
                          <ContainerBadge container={container} size="xs" />
                        ) : (
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            None
                          </span>
                        )}
                      </td>

                      {/* Visit Link */}
                      <td className="py-3 px-3 text-center">
                        {bookmark.url && (
                          <a
                            href={bookmark.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center justify-center p-2 text-gray-500 hover:text-blue-500 dark:text-gray-400 dark:hover:text-blue-400 rounded transition-colors"
                            title="Open bookmark"
                          >
                            <Eye className="w-4 h-4" />
                          </a>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Modal>
  )
}
