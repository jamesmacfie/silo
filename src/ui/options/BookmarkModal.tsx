import React from "react"
import type { Bookmark } from "@/shared/types"
import {
  getContainerColors,
  iconToEmoji,
} from "@/shared/utils/containerHelpers"
import {
  Modal,
  ModalError,
  ModalFormRow,
  ModalInfo,
  ModalInput,
  ModalLabel,
  ModalSelect,
} from "@/ui/shared/components/Modal"
import { useBookmarkActions } from "@/ui/shared/stores/bookmarkStore"

interface Container {
  id: string
  name: string
  cookieStoreId: string
  color?: string
  icon?: string
}

interface Props {
  isOpen: boolean
  mode: "create-bookmark" | "create-folder" | "edit" | "delete"
  bookmark?: Bookmark
  containers: Container[]
  parentId?: string // For creating new bookmarks/folders in specific location
  onClose: () => void
  onSuccess: () => void
}

export function BookmarkModal({
  isOpen,
  mode,
  bookmark,
  containers,
  parentId,
  onClose,
  onSuccess,
}: Props): JSX.Element {
  const {
    createBookmark,
    createFolder,
    updateBookmark,
    deleteBookmark,
    updateBookmarkMetadata,
    checkRuleMatch,
  } = useBookmarkActions()

  const [title, setTitle] = React.useState("")
  const [url, setUrl] = React.useState("")
  const [containerId, setContainerId] = React.useState("")
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [suggestedContainer, setSuggestedContainer] =
    React.useState<Container | null>(null)

  // Helper function to validate URL
  const isValidUrl = React.useCallback((string: string) => {
    try {
      new URL(string)
      return true
    } catch {
      return false
    }
  }, [])

  React.useEffect(() => {
    if (isOpen) {
      if (bookmark && (mode === "edit" || mode === "delete")) {
        // Editing existing bookmark
        setTitle(bookmark.title || "")
        setUrl(bookmark.url || "")
        setContainerId(bookmark.containerId || "")
      } else if (mode === "create-bookmark" || mode === "create-folder") {
        // Creating new bookmark/folder
        setTitle("")
        setUrl("")
        setContainerId("")
        setSuggestedContainer(null)

        // For new bookmarks, try to get URL from clipboard
        if (mode === "create-bookmark") {
          navigator.clipboard
            .readText()
            .then((clipboardText) => {
              if (clipboardText && isValidUrl(clipboardText)) {
                setUrl(clipboardText)
              }
            })
            .catch(() => {
              // Clipboard access failed, ignore
            })
        }
      }
      setError(null)
    }
  }, [isOpen, bookmark, mode, isValidUrl])

  const handleSave = React.useCallback(async () => {
    if (!title.trim()) {
      setError("Title is required")
      return
    }

    if ((mode === "create-bookmark" || mode === "edit") && !url.trim()) {
      setError("URL is required")
      return
    }

    setSaving(true)
    setError(null)

    try {
      if (mode === "create-bookmark") {
        // Create new bookmark
        await createBookmark({
          title: title.trim(),
          url: url.trim(),
          parentId,
          containerId: containerId || undefined,
        })
      } else if (mode === "create-folder") {
        // Create new folder
        await createFolder({
          title: title.trim(),
          parentId,
        })
      } else if (mode === "edit" && bookmark) {
        // Update existing bookmark
        await updateBookmark(bookmark.id, {
          title: title.trim(),
          url: url.trim(),
        })

        // Update our metadata layer
        await updateBookmarkMetadata(bookmark.id, {
          containerId: containerId || undefined,
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
    mode,
    bookmark,
    parentId,
    createBookmark,
    createFolder,
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

  const handleUrlChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
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

    // Check for rule-based container suggestions
    if (isValidUrl(newUrl)) {
      try {
        const matchedContainerId = await checkRuleMatch(newUrl)
        if (matchedContainerId) {
          const matchedContainer = containers.find(
            (c) => c.cookieStoreId === matchedContainerId,
          )
          setSuggestedContainer(matchedContainer || null)
        } else {
          setSuggestedContainer(null)
        }
      } catch {
        // Rule matching failed, ignore
        setSuggestedContainer(null)
      }
    } else {
      setSuggestedContainer(null)
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

  const getButtonText = () => {
    if (saving) return "Saving..."
    if (mode === "create-bookmark") return "Create Bookmark"
    if (mode === "create-folder") return "Create Folder"
    return "Save Bookmark"
  }

  const getTitle = () => {
    if (mode === "create-bookmark") return "Create New Bookmark"
    if (mode === "create-folder") return "Create New Folder"
    return "Edit Bookmark"
  }

  const isFormValid = () => {
    if (!title.trim()) return false
    if ((mode === "create-bookmark" || mode === "edit") && !url.trim())
      return false
    return true
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
        disabled={saving || !isFormValid()}
      >
        {getButtonText()}
      </button>
    </>
  )

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={getTitle()}
      footer={footer}
      size="large"
    >
      <div className="space-y-4">
        {error && <ModalError>{error}</ModalError>}

        <ModalFormRow>
          <ModalLabel htmlFor="title" required>
            {mode === "create-folder" ? "Folder Name" : "Title"}
          </ModalLabel>
          <ModalInput
            id="title"
            type="text"
            placeholder={
              mode === "create-folder" ? "Folder name" : "Bookmark title"
            }
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            error={!title.trim() && title.length > 0}
          />
        </ModalFormRow>

        {mode !== "create-folder" && (
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

            {/* Suggested Container */}
            {suggestedContainer && !containerId && (
              <div className="mt-2 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                <div className="flex items-center gap-2">
                  <div
                    className="flex items-center justify-center w-6 h-6 rounded text-sm"
                    style={{
                      backgroundColor: getContainerColors(
                        suggestedContainer.color,
                      ).bg,
                      borderColor: getContainerColors(suggestedContainer.color)
                        .border,
                      color: getContainerColors(suggestedContainer.color).text,
                      border: "1px solid",
                    }}
                  >
                    {iconToEmoji(suggestedContainer.icon)}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                      Suggested container: {suggestedContainer.name}
                    </p>
                    <p className="text-xs text-amber-600 dark:text-amber-300">
                      Based on your rules, this URL matches the "
                      {suggestedContainer.name}" container
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setContainerId(suggestedContainer.cookieStoreId)
                      setSuggestedContainer(null)
                    }}
                    className="px-3 py-1 text-xs bg-amber-600 hover:bg-amber-700 text-white rounded transition-colors"
                  >
                    Use This
                  </button>
                  <button
                    type="button"
                    onClick={() => setSuggestedContainer(null)}
                    className="p-1 text-amber-600 hover:text-amber-800 dark:text-amber-400 dark:hover:text-amber-200"
                    title="Dismiss suggestion"
                  >
                    ×
                  </button>
                </div>
              </div>
            )}
          </ModalFormRow>
        )}

        {mode !== "create-folder" && (
          <>
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
          </>
        )}
      </div>
    </Modal>
  )
}
