import {
  Bookmark as BookmarkIcon,
  Edit3,
  Eye,
  Plus,
  Tag,
  Trash2,
} from "lucide-react"
import React, { useCallback, useMemo } from "react"
import type { BookmarkTag } from "../../shared/types"
import { Card } from "../shared/components/Card"
import { ColorSelector, TAG_COLORS } from "../shared/components/ColorSelector"
import {
  Button,
  DataView,
  EmptyState,
  type FilterConfig,
  PageHeader,
  PageLayout,
  StatusBar,
  ToolBar,
  type ToolBarSortOption,
  type ViewMode,
} from "../shared/components/layout"
import { TagFilters } from "../shared/components/TagFilters"
import { useTagsPageState } from "../shared/stores"
import {
  useBookmarkActions,
  useBookmarkTags,
  useFilteredBookmarks,
} from "../shared/stores/bookmarkStore"
import { TagModal } from "./TagModal"

interface TagWithUsage extends BookmarkTag {
  usageCount: number
}

const SORT_OPTIONS: ToolBarSortOption[] = [
  { value: "name", label: "Name" },
  { value: "usage", label: "Usage" },
  { value: "created", label: "Created" },
  { value: "modified", label: "Modified" },
]

const PAGE_DESCRIPTION =
  "Organize your bookmarks with tags. Tags help you categorize and quickly find bookmarks across different containers."

export function TagsPage() {
  const tags = useBookmarkTags()
  const allBookmarks = useFilteredBookmarks()
  const {
    createTag: _createTag,
    updateTag,
    deleteTag,
    loadBookmarks,
    loadTags,
    setFilters,
    clearFilters,
  } = useBookmarkActions()

  // Use persistent UI state
  const pageState = useTagsPageState()
  const {
    searchQuery,
    sortBy,
    sortOrder,
    viewMode,
    showFilters,
    filters,
    updateState,
    updateFilter,
    clearFilters: clearPageFilters,
    toggleFilters,
    updateSort,
    updateViewMode,
  } = pageState

  const [showColorPicker, setShowColorPicker] = React.useState<string | null>(
    null,
  )
  const [viewingBookmarks, setViewingBookmarks] = React.useState<string | null>(
    null,
  )
  const [modalState, setModalState] = React.useState<{
    isOpen: boolean
    mode: "create" | "edit"
    tag?: BookmarkTag
  }>({ isOpen: false, mode: "create" })

  // Load data on mount
  React.useEffect(() => {
    loadTags()
    loadBookmarks()
  }, [loadTags, loadBookmarks])

  // Calculate tag usage statistics
  const tagsWithUsage = useMemo((): TagWithUsage[] => {
    return tags.map((tag) => {
      const usageCount = allBookmarks.filter((bookmark) =>
        bookmark.tags?.includes(tag.id),
      ).length
      return { ...tag, usageCount }
    })
  }, [tags, allBookmarks])

  const _filterConfigs: FilterConfig[] = useMemo(
    () => [
      {
        key: "hasBookmarks",
        label: "Has Bookmarks",
        type: "select",
        options: [
          { value: "", label: "All" },
          { value: "yes", label: "With Bookmarks" },
          { value: "no", label: "Without Bookmarks" },
        ],
      },
      {
        key: "color",
        label: "Color",
        type: "select",
        options: [
          { value: "", label: "All Colors" },
          ...TAG_COLORS.map((color) => ({
            value: color.value,
            label: color.displayName || color.name,
          })),
        ],
      },
    ],
    [],
  )

  const filteredTags = useMemo(() => {
    let filtered = [...tagsWithUsage]

    if (searchQuery) {
      const lower = searchQuery.toLowerCase()
      filtered = filtered.filter((tag) =>
        tag.name.toLowerCase().includes(lower),
      )
    }

    if (filters.hasBookmarks) {
      filtered = filtered.filter((tag) =>
        filters.hasBookmarks === "yes"
          ? tag.usageCount > 0
          : tag.usageCount === 0,
      )
    }

    if (filters.color) {
      filtered = filtered.filter((tag) => tag.color === filters.color)
    }

    filtered.sort((a, b) => {
      let result = 0
      switch (sortBy) {
        case "name":
          result = a.name.localeCompare(b.name)
          break
        case "usage":
          result = b.usageCount - a.usageCount
          break
        case "created":
          result = b.created - a.created
          break
        case "modified":
          result = (b.modified || b.created) - (a.modified || a.created)
          break
        default:
          return 0
      }
      return sortOrder === "asc" ? result : -result
    })

    return filtered
  }, [tagsWithUsage, searchQuery, filters, sortBy, sortOrder])

  const handleFilterChange = useCallback(
    (key: string, value: any) => {
      updateFilter(key, value)
    },
    [updateFilter],
  )

  const handleClearFilters = useCallback(() => {
    clearPageFilters()
  }, [clearPageFilters])

  const handleUpdateTag = async (
    tagId: string,
    updates: Partial<BookmarkTag>,
  ) => {
    try {
      await updateTag(tagId, updates)
      setShowColorPicker(null)
    } catch (error) {
      console.error("Failed to update tag:", error)
    }
  }

  const handleDeleteTag = async (tag: TagWithUsage) => {
    const message =
      tag.usageCount > 0
        ? `Delete tag "${tag.name}"? This will remove the tag from ${tag.usageCount} bookmark${tag.usageCount === 1 ? "" : "s"}.`
        : `Delete tag "${tag.name}"?`

    if (!confirm(message)) return

    try {
      await deleteTag(tag.id)
    } catch (error) {
      console.error("Failed to delete tag:", error)
    }
  }

  const handleViewBookmarks = (tagId: string) => {
    clearFilters()
    setFilters({ tags: [tagId] })
    setViewingBookmarks(tagId)
  }

  const openCreateModal = useCallback(() => {
    setModalState({ isOpen: true, mode: "create" })
  }, [])

  const openEditModal = useCallback((tag: BookmarkTag) => {
    setModalState({ isOpen: true, mode: "edit", tag })
  }, [])

  const closeModal = useCallback(() => {
    setModalState((prev) => ({ ...prev, isOpen: false }))
  }, [])

  const handleClearAll = useCallback(() => {
    clearPageFilters()
    updateState({ searchQuery: "" })
  }, [clearPageFilters, updateState])

  const handleSortOrderToggle = useCallback(() => {
    updateSort(sortBy)
  }, [updateSort, sortBy])

  // biome-ignore lint/correctness/useExhaustiveDependencies: Hook changes
  const tableColumns = useMemo(
    () => [
      {
        key: "tag",
        header: "Tag",
        render: (tag: TagWithUsage) => (
          <div className="flex items-center gap-3">
            <div className="relative">
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setShowColorPicker(showColorPicker === tag.id ? null : tag.id)
                }}
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
                  <div className="absolute top-full mt-2 left-0 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg z-20 p-3">
                    <ColorSelector
                      selectedColor={tag.color}
                      onColorChange={(color) =>
                        handleUpdateTag(tag.id, { color })
                      }
                      colors={TAG_COLORS}
                      layout="grid"
                      columns={5}
                      size="small"
                    />
                  </div>
                </>
              )}
            </div>
            <span className="font-medium">{tag.name}</span>
          </div>
        ),
      },
      {
        key: "bookmarks",
        header: "Bookmarks",
        render: (tag: TagWithUsage) => (
          <div className="flex items-center gap-2">
            <span className="font-medium">{tag.usageCount}</span>
            {tag.usageCount > 0 && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  handleViewBookmarks(tag.id)
                }}
                className="text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 text-sm flex items-center gap-1"
                title="View bookmarks with this tag"
              >
                <Eye className="w-3 h-3" />
                View
              </button>
            )}
          </div>
        ),
        width: "w-32",
      },
      {
        key: "created",
        header: "Created",
        render: (tag: TagWithUsage) => (
          <span className="text-sm text-gray-600 dark:text-gray-400">
            {new Date(tag.created).toLocaleDateString()}
          </span>
        ),
        width: "w-32",
      },
      {
        key: "actions",
        header: "Actions",
        render: (tag: TagWithUsage) => (
          <div className="flex items-center gap-2">
            <button
              onClick={(e) => {
                e.stopPropagation()
                openEditModal(tag)
              }}
              className="p-2 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 rounded transition-colors"
              title="Edit tag"
            >
              <Edit3 className="w-4 h-4" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation()
                handleDeleteTag(tag)
              }}
              className="p-2 text-gray-400 hover:text-red-500 dark:text-gray-500 dark:hover:text-red-400 rounded transition-colors"
              title="Delete tag"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ),
        width: "w-32",
      },
    ],
    [showColorPicker, openEditModal],
  )

  // biome-ignore lint/correctness/useExhaustiveDependencies: hooks changin
  const renderTagCard = useCallback(
    (tag: TagWithUsage) => (
      <Card>
        <div className="p-4">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-3">
              <div
                className="w-8 h-8 rounded-full border-2 border-gray-300 dark:border-gray-600"
                style={{ backgroundColor: tag.color }}
              />
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                {tag.name}
              </h3>
            </div>
            <div className="flex gap-1">
              <button
                onClick={() => openEditModal(tag)}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                title="Edit"
              >
                <Edit3 className="w-4 h-4" />
              </button>
              <button
                onClick={() => handleDeleteTag(tag)}
                className="p-1 hover:bg-red-100 dark:hover:bg-red-900/20 rounded text-red-500"
                title="Delete"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between text-sm">
            <div className="text-gray-600 dark:text-gray-400">
              {tag.usageCount} bookmark{tag.usageCount !== 1 ? "s" : ""}
            </div>
            {tag.usageCount > 0 && (
              <button
                onClick={() => handleViewBookmarks(tag.id)}
                className="text-blue-500 hover:text-blue-600 flex items-center gap-1"
              >
                <Eye className="w-3 h-3" />
                View
              </button>
            )}
          </div>
        </div>
      </Card>
    ),
    [openEditModal],
  )

  const hasActiveFilters = Object.values(filters).some(
    (v) => v !== null && v !== "",
  )

  return (
    <PageLayout>
      <PageHeader
        title="Tags"
        description={PAGE_DESCRIPTION}
        actions={
          <Button onClick={openCreateModal}>
            <Plus className="w-4 h-4 mr-2" />
            New Tag
          </Button>
        }
      />

      <ToolBar
        searchValue={searchQuery}
        onSearchChange={(query) => updateState({ searchQuery: query })}
        searchPlaceholder="Search tags..."
        sortOptions={SORT_OPTIONS}
        currentSort={sortBy}
        sortOrder={sortOrder}
        onSortOrderToggle={handleSortOrderToggle}
        onSortChange={(sort) => updateSort(sort)}
        viewMode={viewMode as ViewMode}
        availableViews={["table", "cards"]}
        onViewChange={(mode) => updateViewMode(mode)}
        showFilters={showFilters}
        onToggleFilters={toggleFilters}
        filtersActive={hasActiveFilters}
        hasActiveFilters={hasActiveFilters || !!searchQuery}
        onClearAll={handleClearAll}
        className="mb-4"
      />

      {showFilters && (
        <TagFilters
          className="mb-4"
          onClose={toggleFilters}
          filters={filters as { hasBookmarks: string; color: string }}
          onChange={handleFilterChange}
          onClear={handleClearFilters}
        />
      )}

      <DataView
        items={filteredTags}
        viewMode={viewMode as ViewMode}
        columns={tableColumns}
        renderCard={renderTagCard}
        emptyState={
          <EmptyState
            icon={<Tag className="w-12 h-12" />}
            title={
              searchQuery || hasActiveFilters
                ? "No tags found"
                : "No tags created"
            }
            description={
              searchQuery || hasActiveFilters
                ? "Try adjusting your search or filters"
                : "Create your first tag to organize your bookmarks"
            }
            action={
              !searchQuery &&
              !hasActiveFilters && (
                <Button onClick={openCreateModal}>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Tag
                </Button>
              )
            }
            hasSearch={!!searchQuery || hasActiveFilters}
            searchQuery={searchQuery}
          />
        }
        onItemClick={viewMode === "table" ? openEditModal : undefined}
      />

      <StatusBar>
        {filteredTags.length} of {tagsWithUsage.length} tags
        {(searchQuery || hasActiveFilters) && " (filtered)"}
      </StatusBar>

      {/* Viewing Bookmarks Section */}
      {viewingBookmarks && (
        <Card className="mt-4">
          <div className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                <BookmarkIcon className="w-5 h-5" />
                Bookmarks with "
                {tags.find((t) => t.id === viewingBookmarks)?.name}"
              </h3>
              <button
                onClick={() => {
                  setViewingBookmarks(null)
                  clearFilters()
                }}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                ✕
              </button>
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">
              {
                allBookmarks.filter((b) => b.tags?.includes(viewingBookmarks!))
                  .length
              }{" "}
              bookmarks
            </div>
          </div>
        </Card>
      )}

      <TagModal
        isOpen={modalState.isOpen}
        mode={modalState.mode}
        tag={modalState.mode === "edit" ? modalState.tag : undefined}
        onClose={closeModal}
      />
    </PageLayout>
  )
}
