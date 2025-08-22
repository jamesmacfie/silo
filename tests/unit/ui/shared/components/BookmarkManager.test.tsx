/** @jest-environment jsdom */

import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import browser from "webextension-polyfill"
import { BookmarkManager } from "@/ui/shared/components/BookmarkManager"
import { QueryProvider } from "@/ui/shared/providers/QueryProvider"

// Mock the hooks
jest.mock("@/ui/shared/hooks/useBookmarks", () => ({
  useBookmarkAssociations: jest.fn(),
  useBookmarksTree: jest.fn(),
  useBookmarkActions: jest.fn(),
}))

import {
  useBookmarkActions,
  useBookmarkAssociations,
  useBookmarksTree,
} from "@/ui/shared/hooks/useBookmarks"

const mockUseBookmarkAssociations =
  useBookmarkAssociations as jest.MockedFunction<typeof useBookmarkAssociations>
const mockUseBookmarksTree = useBookmarksTree as jest.MockedFunction<
  typeof useBookmarksTree
>
const mockUseBookmarkActions = useBookmarkActions as jest.MockedFunction<
  typeof useBookmarkActions
>

describe("BookmarkManager", () => {
  const mockBookmarks = [
    {
      id: "bookmark-1",
      title: "GitHub",
      url: "https://github.com",
      parentId: "folder-1",
    },
    {
      id: "bookmark-2",
      title: "GitLab",
      url: "https://gitlab.com",
      parentId: "folder-1",
    },
    {
      id: "folder-1",
      title: "Work",
      children: [],
      parentId: "0",
    },
  ]

  const mockContainers = [
    {
      id: "container-1",
      name: "Work",
      icon: "briefcase",
      color: "blue",
      cookieStoreId: "firefox-container-1",
      created: Date.now(),
      modified: Date.now(),
      temporary: false,
      syncEnabled: true,
    },
    {
      id: "container-2",
      name: "Personal",
      icon: "gift",
      color: "red",
      cookieStoreId: "firefox-container-2",
      created: Date.now(),
      modified: Date.now(),
      temporary: false,
      syncEnabled: true,
    },
  ]

  const mockAssociations = [
    {
      bookmarkId: "bookmark-1",
      containerId: "container-1",
      url: "https://github.com",
      autoOpen: true,
      created: Date.now(),
    },
  ]

  beforeEach(() => {
    jest.clearAllMocks()

    // Setup hook mocks with default behavior
    mockUseBookmarkActions.mockReturnValue({
      addAssociation: jest.fn().mockResolvedValue(undefined),
      removeAssociation: jest.fn().mockResolvedValue(undefined),
      processBookmarkUrl: jest.fn().mockResolvedValue({}),
      invalidateBookmarks: jest.fn(),
    })

    mockUseBookmarkAssociations.mockReturnValue({
      data: mockAssociations,
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    })

    mockUseBookmarksTree.mockReturnValue({
      data: [
        {
          id: "0",
          title: "Root",
          children: mockBookmarks,
        },
      ],
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    })

    // Mock browser bookmarks API
    global.browser.bookmarks = {
      getTree: jest.fn().mockResolvedValue([
        {
          id: "0",
          title: "Root",
          children: mockBookmarks,
        },
      ]),
      get: jest.fn().mockResolvedValue(mockBookmarks),
      onCreated: { addListener: jest.fn(), removeListener: jest.fn() },
      onRemoved: { addListener: jest.fn(), removeListener: jest.fn() },
      onChanged: { addListener: jest.fn(), removeListener: jest.fn() },
      onMoved: { addListener: jest.fn(), removeListener: jest.fn() },
    } as any

    // Mock runtime messages
    ;(browser.runtime.sendMessage as jest.Mock).mockImplementation(
      (message) => {
        if (message.type === "GET_CONTAINERS") {
          return Promise.resolve({ success: true, data: mockContainers })
        }
        if (message.type === "GET_BOOKMARK_ASSOCIATIONS") {
          return Promise.resolve({ success: true, data: mockAssociations })
        }
        if (message.type === "ASSOCIATE_BOOKMARK") {
          return Promise.resolve({ success: true })
        }
        if (message.type === "DISASSOCIATE_BOOKMARK") {
          return Promise.resolve({ success: true })
        }
        if (message.type === "BULK_ASSOCIATE_BOOKMARKS") {
          return Promise.resolve({ success: true })
        }
        return Promise.resolve({ success: false })
      },
    )
  })

  const renderComponent = (props = {}) => {
    return render(
      <QueryProvider>
        <BookmarkManager containers={mockContainers} {...props} />
      </QueryProvider>,
    )
  }

  describe("initial render", () => {
    it("should display bookmark folders and bookmarks", async () => {
      renderComponent()

      await waitFor(() => {
        expect(screen.getByText("Work")).toBeInTheDocument()
        expect(screen.getByText("Root > GitHub")).toBeInTheDocument()
        expect(screen.getByText("Root > GitLab")).toBeInTheDocument()
      })
    })

    it("should show loading state initially", () => {
      // Override default mock to return loading state
      mockUseBookmarkAssociations.mockReturnValue({
        data: undefined,
        isLoading: true,
        error: null,
        refetch: jest.fn(),
      })

      renderComponent()
      expect(screen.getByText("Loading bookmarks...")).toBeInTheDocument()
    })

    it("should handle bookmarks API error", async () => {
      // Mock hooks to return error state
      mockUseBookmarksTree.mockReturnValue({
        data: undefined,
        isLoading: false,
        error: new Error("Bookmarks API error"),
        refetch: jest.fn(),
      })

      renderComponent()

      await waitFor(() => {
        expect(screen.getByText(/error loading bookmarks/i)).toBeInTheDocument()
      })
    })
  })

  describe("bookmark associations", () => {
    it("should show associated containers for bookmarks", async () => {
      renderComponent()

      await waitFor(() => {
        expect(screen.getByText("Root > GitHub")).toBeInTheDocument()
      })

      // GitHub should show Work container association
      expect(screen.getByText(/work/i)).toBeInTheDocument()
    })

    it("should allow associating bookmark with container", async () => {
      const user = userEvent.setup()
      renderComponent()

      await waitFor(() => {
        expect(screen.getByText("Root > GitLab")).toBeInTheDocument()
      })

      const mockAddAssociation = jest.fn().mockResolvedValue(undefined)

      mockUseBookmarkActions.mockReturnValue({
        addAssociation: mockAddAssociation,
        removeAssociation: jest.fn().mockResolvedValue(undefined),
        processBookmarkUrl: jest.fn().mockResolvedValue({}),
        invalidateBookmarks: jest.fn(),
      })

      // Select container from dropdown first
      const containerSelect = screen.getByRole("combobox")
      await user.selectOptions(containerSelect, "firefox-container-2")

      // Click assign button for GitLab bookmark
      const assignButton = screen.getByTestId("associate-button")
      await user.click(assignButton)

      expect(mockAddAssociation).toHaveBeenCalledWith(
        "bookmark-2",
        "firefox-container-2",
        "https://gitlab.com",
        true,
      )
    })

    it("should allow removing bookmark association", async () => {
      const user = userEvent.setup()
      const mockRemoveAssociation = jest.fn().mockResolvedValue(undefined)

      mockUseBookmarkActions.mockReturnValue({
        addAssociation: jest.fn().mockResolvedValue(undefined),
        removeAssociation: mockRemoveAssociation,
        processBookmarkUrl: jest.fn().mockResolvedValue({}),
        invalidateBookmarks: jest.fn(),
      })

      renderComponent()

      await waitFor(() => {
        expect(screen.getByText("Root > GitHub")).toBeInTheDocument()
      })

      const removeButton = screen.getByTitle(/remove association/i)
      await user.click(removeButton)

      expect(mockRemoveAssociation).toHaveBeenCalledWith("bookmark-1")
    })

    it.skip("should toggle auto-open setting", async () => {
      // TODO: Implement auto-open toggle functionality
      // Currently just shows as a badge, no toggle available
    })
  })

  describe("bulk operations", () => {
    it("should allow bulk associating folder with container", async () => {
      const user = userEvent.setup()
      renderComponent()

      await waitFor(() => {
        expect(screen.getByText("Work")).toBeInTheDocument()
      })

      const mockAddAssociation = jest.fn().mockResolvedValue(undefined)

      mockUseBookmarkActions.mockReturnValue({
        addAssociation: mockAddAssociation,
        removeAssociation: jest.fn().mockResolvedValue(undefined),
        processBookmarkUrl: jest.fn().mockResolvedValue({}),
        invalidateBookmarks: jest.fn(),
      })

      // Mock window.confirm to return true
      jest.spyOn(window, "confirm").mockReturnValue(true)

      // Select container first
      const containerSelect = screen.getByRole("combobox")
      await user.selectOptions(containerSelect, "firefox-container-1")

      // Click the global bulk associate button
      const bulkAssociateButton = screen.getByTestId("bulk-associate-button")
      await user.click(bulkAssociateButton)

      // Should call addAssociation for unassociated bookmarks (GitLab bookmark)
      expect(mockAddAssociation).toHaveBeenCalledWith(
        "bookmark-2",
        "firefox-container-1",
        "https://gitlab.com",
        true,
      )

      window.confirm.mockRestore()
    })

    it("should show confirmation for bulk operations", async () => {
      const user = userEvent.setup()
      renderComponent()

      await waitFor(() => {
        expect(screen.getByText("Work")).toBeInTheDocument()
      })

      // Mock window.confirm to return true and track if it was called
      const mockConfirm = jest.spyOn(window, "confirm").mockReturnValue(true)

      // Select container first
      const containerSelect = screen.getByRole("combobox")
      await user.selectOptions(containerSelect, "firefox-container-1")

      // Click the bulk associate button
      const bulkAssociateButton = screen.getByTestId("bulk-associate-button")
      await user.click(bulkAssociateButton)

      // Should show confirmation dialog
      expect(mockConfirm).toHaveBeenCalledWith(
        "Assign 1 bookmarks to the selected container?",
      )

      mockConfirm.mockRestore()
    })

    it("should allow canceling bulk operations", async () => {
      const user = userEvent.setup()
      renderComponent()

      await waitFor(() => {
        expect(screen.getByText("Work")).toBeInTheDocument()
      })

      const mockAddAssociation = jest.fn().mockResolvedValue(undefined)

      mockUseBookmarkActions.mockReturnValue({
        addAssociation: mockAddAssociation,
        removeAssociation: jest.fn().mockResolvedValue(undefined),
        processBookmarkUrl: jest.fn().mockResolvedValue({}),
        invalidateBookmarks: jest.fn(),
      })

      // Mock window.confirm to return false (cancel)
      const mockConfirm = jest.spyOn(window, "confirm").mockReturnValue(false)

      // Select container first
      const containerSelect = screen.getByRole("combobox")
      await user.selectOptions(containerSelect, "firefox-container-1")

      // Click the bulk associate button
      const bulkAssociateButton = screen.getByTestId("bulk-associate-button")
      await user.click(bulkAssociateButton)

      // Should show confirmation dialog but cancel was clicked
      expect(mockConfirm).toHaveBeenCalled()

      // Should not call addAssociation since user cancelled
      expect(mockAddAssociation).not.toHaveBeenCalled()

      mockConfirm.mockRestore()
    })
  })

  describe("filtering and search", () => {
    it("should filter bookmarks by search query", async () => {
      const user = userEvent.setup()
      renderComponent()

      await waitFor(() => {
        expect(screen.getByText("Root > GitHub")).toBeInTheDocument()
        expect(screen.getByText("Root > GitLab")).toBeInTheDocument()
      })

      const searchInput = screen.getByPlaceholderText(/filter bookmarks/i)
      await user.type(searchInput, "GitHub")

      await waitFor(() => {
        expect(screen.getByText("Root > GitHub")).toBeInTheDocument()
        expect(screen.queryByText("GitLab")).not.toBeInTheDocument()
      })
    })

    it("should filter by container association", async () => {
      const user = userEvent.setup()
      renderComponent()

      await waitFor(() => {
        expect(screen.getByText("Root > GitHub")).toBeInTheDocument()
      })

      const filterSelect = screen.getByLabelText(/filter by container/i)
      await user.selectOptions(filterSelect, "container-1")

      // Should show only bookmarks associated with Work container
      expect(screen.getByText("Root > GitHub")).toBeInTheDocument()
      expect(screen.queryByText("GitLab")).not.toBeInTheDocument()
    })

    it("should show unassociated bookmarks when filter is set", async () => {
      const user = userEvent.setup()
      renderComponent()

      await waitFor(() => {
        expect(screen.getByText("Root > GitLab")).toBeInTheDocument()
      })

      const filterSelect = screen.getByLabelText(/filter by container/i)
      await user.selectOptions(filterSelect, "unassociated")

      // Should show only unassociated bookmarks
      expect(screen.getByText("Root > GitLab")).toBeInTheDocument()
      expect(screen.queryByText("GitHub")).not.toBeInTheDocument()
    })
  })

  describe("tree navigation", () => {
    it("should expand and collapse bookmark folders", async () => {
      const user = userEvent.setup()
      renderComponent()

      await waitFor(() => {
        expect(screen.getByText("Work")).toBeInTheDocument()
      })

      const expandButton = screen.getByLabelText(/expand folder/i)
      await user.click(expandButton)

      expect(screen.getByText("Root > GitHub")).toBeInTheDocument()
      expect(screen.getByText("Root > GitLab")).toBeInTheDocument()

      // Click again to collapse
      const collapseButton = screen.getByLabelText(/collapse folder/i)
      await user.click(collapseButton)

      expect(screen.queryByText("GitHub")).not.toBeInTheDocument()
    })

    it("should show folder bookmark counts", async () => {
      renderComponent()

      await waitFor(() => {
        expect(screen.getByText("Work")).toBeInTheDocument()
      })

      expect(screen.getByText(/2 bookmarks/i)).toBeInTheDocument()
    })

    it("should handle nested folders", async () => {
      const nestedBookmarks = [
        {
          id: "folder-1",
          title: "Work",
          children: [
            {
              id: "subfolder-1",
              title: "Projects",
              children: [
                {
                  id: "bookmark-1",
                  title: "GitHub",
                  url: "https://github.com",
                },
              ],
            },
          ],
        },
      ]

      ;(browser.bookmarks.getTree as jest.Mock).mockResolvedValue([
        { id: "0", title: "Root", children: nestedBookmarks },
      ])

      renderComponent()

      await waitFor(() => {
        expect(screen.getByText("Work")).toBeInTheDocument()
        expect(screen.getByText("Projects")).toBeInTheDocument()
      })
    })
  })

  describe("error handling", () => {
    it("should handle association errors", async () => {
      ;(browser.runtime.sendMessage as jest.Mock).mockRejectedValue(
        new Error("Association failed"),
      )

      const user = userEvent.setup()
      renderComponent()

      await waitFor(() => {
        expect(screen.getByText("Root > GitLab")).toBeInTheDocument()
      })

      const associateButton = screen.getByTestId("associate-button")
      await user.click(associateButton)

      await waitFor(() => {
        expect(
          screen.getByText(/error associating bookmark/i),
        ).toBeInTheDocument()
      })
    })

    it("should handle bulk operation errors", async () => {
      ;(browser.runtime.sendMessage as jest.Mock).mockImplementation(
        (message) => {
          if (message.type === "BULK_ASSOCIATE_BOOKMARKS") {
            return Promise.reject(new Error("Bulk operation failed"))
          }
          return Promise.resolve({ success: true, data: [] })
        },
      )

      const user = userEvent.setup()
      renderComponent()

      await waitFor(() => {
        expect(screen.getByText("Work")).toBeInTheDocument()
      })

      const bulkAssociateButton = screen.getByTestId("bulk-associate-button")
      await user.click(bulkAssociateButton)

      const confirmButton = screen.getByText(/associate all/i)
      await user.click(confirmButton)

      await waitFor(() => {
        expect(
          screen.getByText(/error performing bulk operation/i),
        ).toBeInTheDocument()
      })
    })
  })

  describe("real-time updates", () => {
    it("should update when bookmarks are added", async () => {
      renderComponent()

      await waitFor(() => {
        expect(screen.getByText("Root > GitHub")).toBeInTheDocument()
      })

      // Simulate data update by changing the mock return value
      const newBookmarks = [
        ...mockBookmarks,
        {
          id: "bookmark-3",
          title: "New Bookmark",
          url: "https://new.com",
          parentId: "folder-1",
        },
      ]

      mockUseBookmarksTree.mockReturnValue({
        data: [
          {
            id: "0",
            title: "Root",
            children: newBookmarks,
          },
        ],
        isLoading: false,
        error: null,
        refetch: jest.fn(),
      })

      // Re-render to simulate React Query update
      renderComponent()

      await waitFor(() => {
        expect(screen.getByText("Root > New Bookmark")).toBeInTheDocument()
      })
    })

    it("should update when bookmarks are removed", async () => {
      renderComponent()

      await waitFor(() => {
        expect(screen.getByText("Root > GitHub")).toBeInTheDocument()
      })

      // Simulate bookmark removal by changing the mock return value
      const remainingBookmarks = mockBookmarks.filter(
        (bookmark) => bookmark.id !== "bookmark-1",
      )

      mockUseBookmarksTree.mockReturnValue({
        data: [
          {
            id: "0",
            title: "Root",
            children: remainingBookmarks,
          },
        ],
        isLoading: false,
        error: null,
        refetch: jest.fn(),
      })

      // Re-render to simulate React Query update
      renderComponent()

      await waitFor(() => {
        expect(screen.queryByText("Root > GitHub")).not.toBeInTheDocument()
      })
    })
  })

  describe("accessibility", () => {
    it("should have proper ARIA labels", async () => {
      renderComponent()

      await waitFor(() => {
        expect(screen.getByLabelText(/bookmark tree/i)).toBeInTheDocument()
        expect(screen.getByLabelText(/Search bookmarks/i)).toBeInTheDocument()
        expect(
          screen.getByLabelText(/filter by container/i),
        ).toBeInTheDocument()
      })
    })

    it("should support keyboard navigation", async () => {
      const user = userEvent.setup()
      renderComponent()

      await waitFor(() => {
        expect(screen.getByText("Work")).toBeInTheDocument()
      })

      const folderItem = screen.getByText("Work")
      folderItem.focus()

      await user.keyboard("{Enter}")

      expect(screen.getByText("Root > GitHub")).toBeInTheDocument()
    })
  })
})
