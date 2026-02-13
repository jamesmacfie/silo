/** @jest-environment jsdom */

import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { BookmarkManager } from "@/ui/shared/components/bookmarks/BookmarkManager"
import { useContainers } from "@/ui/shared/stores"
import {
  useBookmarkActions,
  useBookmarkError,
  useBookmarkLoading,
  useBookmarkSearchState,
  useBookmarkView,
  useSelectedBookmarks,
} from "@/ui/shared/stores/bookmarkStore"

jest.mock("@/ui/shared/stores", () => ({
  useContainers: jest.fn(),
}))

jest.mock("@/ui/shared/stores/bookmarkStore", () => ({
  useBookmarkActions: jest.fn(),
  useBookmarkError: jest.fn(),
  useBookmarkLoading: jest.fn(),
  useBookmarkSearchState: jest.fn(),
  useBookmarkView: jest.fn(),
  useSelectedBookmarks: jest.fn(),
}))

jest.mock("@/ui/shared/components/bookmarks/BookmarkSearchBar", () => ({
  BookmarkSearchBar: () => <div data-testid="bookmark-search">Search</div>,
}))

jest.mock("@/ui/shared/components/bookmarks/BookmarkFilters", () => ({
  BookmarkFilters: () => <div data-testid="bookmark-filters">Filters</div>,
}))

jest.mock("@/ui/shared/components/bookmarks/BookmarkTableView", () => ({
  BookmarkTableView: () => <div data-testid="bookmark-table">Table</div>,
}))

jest.mock("@/ui/shared/components/bookmarks/BookmarkTreeView", () => ({
  BookmarkTreeView: () => <div data-testid="bookmark-tree">Tree</div>,
}))

jest.mock("@/ui/shared/components/bookmarks/BulkActionsBar", () => ({
  BulkActionsBar: () => <div data-testid="bulk-actions">Bulk</div>,
}))

describe("BookmarkManager", () => {
  const mockUseContainers = useContainers as jest.MockedFunction<
    typeof useContainers
  >
  const mockUseBookmarkView = useBookmarkView as jest.MockedFunction<
    typeof useBookmarkView
  >
  const mockUseSelectedBookmarks = useSelectedBookmarks as jest.MockedFunction<
    typeof useSelectedBookmarks
  >
  const mockUseBookmarkLoading = useBookmarkLoading as jest.MockedFunction<
    typeof useBookmarkLoading
  >
  const mockUseBookmarkError = useBookmarkError as jest.MockedFunction<
    typeof useBookmarkError
  >
  const mockUseBookmarkSearchState =
    useBookmarkSearchState as jest.MockedFunction<typeof useBookmarkSearchState>
  const mockUseBookmarkActions = useBookmarkActions as jest.MockedFunction<
    typeof useBookmarkActions
  >

  const loadBookmarks = jest.fn().mockResolvedValue(undefined)
  const loadTags = jest.fn().mockResolvedValue(undefined)
  const setView = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()

    mockUseContainers.mockReturnValue([])
    mockUseBookmarkView.mockReturnValue("table")
    mockUseSelectedBookmarks.mockReturnValue(new Set())
    mockUseBookmarkLoading.mockReturnValue({
      bookmarks: false,
      tags: false,
      bulkOperation: false,
      dragOperation: false,
    })
    mockUseBookmarkError.mockReturnValue(undefined)
    mockUseBookmarkSearchState.mockReturnValue({
      query: "",
      filters: {},
      sortOptions: { field: "title", order: "asc" },
    })
    mockUseBookmarkActions.mockReturnValue({
      setView,
      refreshAll: jest.fn().mockResolvedValue(undefined),
      clearError: jest.fn(),
      loadBookmarks,
      loadTags,
    } as any)
  })

  it("renders and loads bookmark data on mount", () => {
    render(<BookmarkManager />)

    expect(screen.getByText("Bookmark Manager")).toBeInTheDocument()
    expect(screen.getByTestId("bookmark-search")).toBeInTheDocument()
    expect(screen.getByTestId("bookmark-table")).toBeInTheDocument()
    expect(loadBookmarks).toHaveBeenCalled()
    expect(loadTags).toHaveBeenCalled()
  })

  it("switches to tree view from the toggle", async () => {
    const user = userEvent.setup()
    render(<BookmarkManager />)

    await user.click(screen.getByTitle("Tree View"))

    expect(setView).toHaveBeenCalledWith("tree")
  })

  it("shows error message when bookmark loading fails", () => {
    mockUseBookmarkError.mockReturnValue("Failed to load")

    render(<BookmarkManager />)

    expect(screen.getByText("Error Loading Bookmarks")).toBeInTheDocument()
    expect(screen.getByText("Failed to load")).toBeInTheDocument()
  })
})
