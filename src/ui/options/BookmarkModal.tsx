import React from "react"
import type { Bookmark, BookmarkTag } from "@/shared/types"
import {
  Modal,
  ModalError,
  ModalFormRow,
  ModalInfo,
  ModalInput,
  ModalLabel,
  ModalSelect,
} from "@/ui/shared/components/Modal"
import {
  useBookmarkActions,
  useBookmarkTags,
} from "@/ui/shared/stores/bookmarkStore"

interface Container {
  id: string
  name: string
  cookieStoreId: string
  color?: string
  icon?: string
}

interface Props {
  isOpen: boolean
  mode: "edit" | "delete"
  bookmark?: Bookmark
  containers: Container[]
  onClose: () => void
  onSuccess: () => void
}

export function BookmarkModal({
  isOpen,
  mode,
  bookmark,
  containers,
  onClose,
  onSuccess,
}: Props): JSX.Element {
  const { updateBookmark, deleteBookmark, updateBookmarkMetadata } =
    useBookmarkActions()
  const tags = useBookmarkTags()

  const [title, setTitle] = React.useState("")
  const [url, setUrl] = React.useState("")
  const [containerId, setContainerId] = React.useState("")
  const [selectedTags, setSelectedTags] = React.useState<string[]>([])
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (isOpen && bookmark) {
      setTitle(bookmark.title || "")
      setUrl(bookmark.url || "")
      setContainerId(bookmark.containerId || "")
      setSelectedTags(bookmark.tags || [])
      setError(null)
    }
  }, [isOpen, bookmark])

  const handleSave = React.useCallback(async () => {
    if (!title.trim()) {
      setError("Title is required")
      return
    }

    if (!url.trim()) {
      setError("URL is required")
      return
    }

    setSaving(true)
    setError(null)

    try {
      if (bookmark) {
        // Update the bookmark in Firefox
        await updateBookmark(bookmark.id, {
          title: title.trim(),
          url: url.trim(),
        })

        // Update our metadata layer
        await updateBookmarkMetadata(bookmark.id, {
          containerId: containerId || undefined,
          tags: selectedTags,
        })
      }

      onSuccess()
      onClose()
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      setError(`Save failed: ${msg}`)
    } finally {
      setSaving(false)
    }
  }, [
    title,
    url,
    containerId,
    selectedTags,
    bookmark,
    updateBookmark,
    updateBookmarkMetadata,
    onSuccess,
    onClose,
  ])

  const handleDelete = React.useCallback(async () => {
    if (!bookmark) return

    setSaving(true)
    setError(null)

    try {
      await deleteBookmark(bookmark.id)
      onSuccess()
      onClose()
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      setError(`Delete failed: ${msg}`)
    } finally {
      setSaving(false)
    }
  }, [bookmark, deleteBookmark, onSuccess, onClose])

  const handleTagToggle = (tagId: string) => {
    setSelectedTags((prev) =>
      prev.includes(tagId)
        ? prev.filter((id) => id !== tagId)
        : [...prev, tagId],
    )
  }

  const handleContainerChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value
    setContainerId(value)

    // Always update the URL to reflect container changes
    try {
      const urlObj = new URL(url)
      if (value) {
        urlObj.searchParams.set("silo", value)
      } else {
        urlObj.searchParams.delete("silo")
      }
      setUrl(urlObj.toString())
    } catch {
      // If URL is invalid, don't update it - user might still be typing
    }
  }

  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newUrl = e.target.value
    setUrl(newUrl)

    // Check if URL has silo parameter and update container selection
    try {
      const urlObj = new URL(newUrl)
      const siloParam = urlObj.searchParams.get("silo")
      if (siloParam && containers.some((c) => c.cookieStoreId === siloParam)) {
        setContainerId(siloParam)
      }
    } catch {
      // Invalid URL, ignore
    }
  }

  if (mode === "delete") {
    const footer = (
      <>
        <button
          type="button"
          className="btn ghost"
          onClick={onClose}
          disabled={saving}
        >
          Cancel
        </button>
        <button
          type="button"
          className="btn danger"
          onClick={handleDelete}
          disabled={saving}
        >
          {saving ? "Deleting..." : "Delete Bookmark"}
        </button>
      </>
    )

    return (
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title="Delete Bookmark"
        footer={footer}
        size="default"
      >
        <div className="space-y-4">
          <p className="text-gray-700 dark:text-gray-300">
            Are you sure you want to delete this bookmark?
          </p>
          {bookmark && (
            <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <h4 className="font-medium text-gray-900 dark:text-gray-100">
                {bookmark.title}
              </h4>
              {bookmark.url && (
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 font-mono break-all">
                  {bookmark.url}
                </p>
              )}
            </div>
          )}
          {error && <ModalError>{error}</ModalError>}
        </div>
      </Modal>
    )
  }

  const footer = (
    <>
      <button
        type="button"
        className="btn ghost"
        onClick={onClose}
        disabled={saving}
      >
        Cancel
      </button>
      <button
        type="button"
        className="btn"
        onClick={handleSave}
        disabled={saving || !title.trim() || !url.trim()}
      >
        {saving ? "Saving..." : "Save Bookmark"}
      </button>
    </>
  )

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Edit Bookmark"
      footer={footer}
      size="large"
    >
      <div className="space-y-4">
        {error && <ModalError>{error}</ModalError>}

        <ModalFormRow>
          <ModalLabel htmlFor="title" required>
            Title
          </ModalLabel>
          <ModalInput
            id="title"
            type="text"
            placeholder="Bookmark title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            error={!title.trim() && title.length > 0}
          />
        </ModalFormRow>

        <ModalFormRow>
          <ModalLabel htmlFor="url" required>
            URL
          </ModalLabel>
          <ModalInput
            id="url"
            type="text"
            placeholder="https://example.com"
            value={url}
            onChange={handleUrlChange}
            error={!url.trim() && url.length > 0}
          />
          <ModalInfo>
            Add ?silo=container-id to the URL to automatically open in a
            specific container
          </ModalInfo>
        </ModalFormRow>

        <ModalFormRow>
          <ModalLabel htmlFor="container">Container</ModalLabel>
          <ModalSelect
            id="container"
            value={containerId}
            onChange={handleContainerChange}
          >
            <option value="">No container (default)</option>
            {containers.map((container) => (
              <option
                key={container.cookieStoreId}
                value={container.cookieStoreId}
              >
                {container.name}
              </option>
            ))}
          </ModalSelect>
          <ModalInfo>
            When you open this bookmark, it will automatically open in the
            selected container
          </ModalInfo>
        </ModalFormRow>

        <ModalFormRow>
          <ModalLabel>Tags</ModalLabel>
          <div className="space-y-2">
            {tags.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                No tags available. Create tags to organize your bookmarks.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {tags.map((tag) => (
                  <label
                    key={tag.id}
                    className="inline-flex items-center gap-2 px-3 py-1.5 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedTags.includes(tag.id)}
                      onChange={() => handleTagToggle(tag.id)}
                      className="w-4 h-4 text-blue-600 bg-gray-100 dark:bg-gray-700 border-gray-300 dark:border-gray-600 rounded focus:ring-blue-500 focus:ring-2"
                    />
                    <div className="flex items-center gap-1.5">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: tag.color }}
                      />
                      <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        {tag.name}
                      </span>
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>
        </ModalFormRow>
      </div>
    </Modal>
  )
}
