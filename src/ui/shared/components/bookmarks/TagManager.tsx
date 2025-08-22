import React from "react"
import { Plus, Edit3, Trash2, X, Palette } from "lucide-react"
import { useBookmarkTags, useBookmarkActions } from "../../stores/bookmarkStore"
import type { BookmarkTag } from "@/shared/types"
import { Card } from "../Card"
import { TAG_COLORS } from "../ColorSelector"

interface TagManagerProps {
  className?: string
  onClose: () => void
}

export function TagManager({
  className = "",
  onClose,
}: TagManagerProps): JSX.Element {
  const tags = useBookmarkTags()
  const { createTag, updateTag, deleteTag } = useBookmarkActions()

  const [editingTag, setEditingTag] = React.useState<string | null>(null)
  const [newTagName, setNewTagName] = React.useState("")
  const [newTagColor, setNewTagColor] = React.useState(TAG_COLORS[0].value)
  const [showColorPicker, setShowColorPicker] = React.useState<string | null>(
    null,
  )
  const [isCreating, setIsCreating] = React.useState(false)

  const handleCreateTag = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTagName.trim()) return

    setIsCreating(true)
    try {
      await createTag({
        name: newTagName.trim(),
        color: newTagColor,
      })
      setNewTagName("")
      setNewTagColor(TAG_COLORS[0].value)
    } catch (error) {
      console.error("Failed to create tag:", error)
    } finally {
      setIsCreating(false)
    }
  }

  const handleUpdateTag = async (
    tagId: string,
    updates: Partial<BookmarkTag>,
  ) => {
    try {
      await updateTag(tagId, updates)
      setEditingTag(null)
      setShowColorPicker(null)
    } catch (error) {
      console.error("Failed to update tag:", error)
    }
  }

  const handleDeleteTag = async (tagId: string) => {
    const tag = tags.find((t) => t.id === tagId)
    if (!tag) return

    if (
      !confirm(
        `Delete tag "${tag.name}"? This will remove the tag from all bookmarks.`,
      )
    ) {
      return
    }

    try {
      await deleteTag(tagId)
    } catch (error) {
      console.error("Failed to delete tag:", error)
    }
  }

  const ColorPicker = ({
    currentColor,
    onColorChange,
  }: {
    currentColor: string
    onColorChange: (color: string) => void
  }) => (
    <div className="grid grid-cols-5 gap-2 p-3">
      {TAG_COLORS.map((color) => (
        <button
          key={color.value}
          onClick={() => onColorChange(color.value)}
          className={`w-8 h-8 rounded-full border-2 ${
            currentColor === color.value
              ? "border-gray-800 dark:border-gray-200"
              : "border-gray-300 dark:border-gray-600"
          }`}
          style={{ backgroundColor: color.value }}
          title={color.displayName || color.name}
        />
      ))}
    </div>
  )

  return (
    <Card className={`tag-manager ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          Tag Manager
        </h3>
        <button
          onClick={onClose}
          className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
          title="Close tag manager"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Create New Tag */}
      <form onSubmit={handleCreateTag} className="mb-6">
        <div className="flex items-center gap-3">
          <div className="relative">
            <button
              type="button"
              onClick={() =>
                setShowColorPicker(showColorPicker === "new" ? null : "new")
              }
              className="w-8 h-8 rounded-full border-2 border-gray-300 dark:border-gray-600"
              style={{ backgroundColor: newTagColor }}
              title="Select color"
            />
            {showColorPicker === "new" && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setShowColorPicker(null)}
                />
                <div className="absolute top-full mt-2 left-0 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg z-20">
                  <ColorPicker
                    currentColor={newTagColor}
                    onColorChange={(color) => {
                      setNewTagColor(color)
                      setShowColorPicker(null)
                    }}
                  />
                </div>
              </>
            )}
          </div>
          <input
            type="text"
            placeholder="Tag name..."
            value={newTagName}
            onChange={(e) => setNewTagName(e.target.value)}
            className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <button
            type="submit"
            disabled={!newTagName.trim() || isCreating}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create
          </button>
        </div>
      </form>

      {/* Tag List */}
      <div className="space-y-2">
        {tags.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400 italic text-center py-8">
            No tags created yet. Create your first tag above to get started.
          </p>
        ) : (
          tags.map((tag) => (
            <div
              key={tag.id}
              className="flex items-center gap-3 p-3 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              {/* Color */}
              <div className="relative">
                <button
                  onClick={() =>
                    setShowColorPicker(
                      showColorPicker === tag.id ? null : tag.id,
                    )
                  }
                  className="w-6 h-6 rounded-full border-2 border-gray-300 dark:border-gray-600 hover:scale-110 transition-transform"
                  style={{ backgroundColor: tag.color }}
                  title="Change color"
                />
                {showColorPicker === tag.id && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setShowColorPicker(null)}
                    />
                    <div className="absolute top-full mt-2 left-0 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg z-20">
                      <ColorPicker
                        currentColor={tag.color}
                        onColorChange={(color) => {
                          handleUpdateTag(tag.id, { color })
                        }}
                      />
                    </div>
                  </>
                )}
              </div>

              {/* Name */}
              {editingTag === tag.id ? (
                <input
                  type="text"
                  defaultValue={tag.name}
                  onBlur={(e) => {
                    if (e.target.value.trim() && e.target.value !== tag.name) {
                      handleUpdateTag(tag.id, { name: e.target.value.trim() })
                    } else {
                      setEditingTag(null)
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.currentTarget.blur()
                    } else if (e.key === "Escape") {
                      setEditingTag(null)
                    }
                  }}
                  className="flex-1 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  autoFocus
                />
              ) : (
                <span className="flex-1 text-sm font-medium text-gray-900 dark:text-gray-100">
                  {tag.name}
                </span>
              )}

              {/* Stats */}
              <span className="text-xs text-gray-500 dark:text-gray-400">
                Created {new Date(tag.created).toLocaleDateString()}
              </span>

              {/* Actions */}
              <div className="flex items-center gap-1">
                <button
                  onClick={() =>
                    setEditingTag(editingTag === tag.id ? null : tag.id)
                  }
                  className="p-1 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 rounded transition-colors"
                  title="Edit tag name"
                >
                  <Edit3 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDeleteTag(tag.id)}
                  className="p-1 text-gray-400 hover:text-red-500 dark:text-gray-500 dark:hover:text-red-400 rounded transition-colors"
                  title="Delete tag"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <style>{`
        .tag-manager {
          animation: slideDown 0.2s ease-out;
        }

        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </Card>
  )
}
