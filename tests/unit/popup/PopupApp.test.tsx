/** @jest-environment jsdom */

import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import browser from "webextension-polyfill"
import type { Container } from "@/shared/types"
import { PopupApp } from "@/ui/popup/components/PopupApp"
import { useContainerActions, useContainers } from "@/ui/shared/stores"

jest.mock("@/ui/shared/stores", () => ({
  useContainers: jest.fn(),
  useContainerActions: jest.fn(),
}))

jest.mock("@/ui/shared/components/ThemeSwitcher", () => ({
  ThemeSwitcher: () => <div>Theme</div>,
}))

describe("PopupApp", () => {
  let closeSpy: jest.SpyInstance

  const mockUseContainers = useContainers as jest.MockedFunction<
    typeof useContainers
  >
  const mockUseContainerActions = useContainerActions as jest.MockedFunction<
    typeof useContainerActions
  >

  const containers: Container[] = [
    {
      id: "work",
      name: "Work",
      icon: "briefcase",
      color: "blue",
      cookieStoreId: "firefox-container-work",
      created: Date.now(),
      modified: Date.now(),
      temporary: false,
      syncEnabled: true,
    },
    {
      id: "personal",
      name: "Personal",
      icon: "user",
      color: "orange",
      cookieStoreId: "firefox-container-personal",
      created: Date.now(),
      modified: Date.now(),
      temporary: false,
      syncEnabled: true,
    },
  ]

  const createContainerMock = jest.fn()
  const loadContainersMock = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
    closeSpy = jest.spyOn(window, "close").mockImplementation(() => {})

    createContainerMock.mockResolvedValue({
      ...containers[0],
      id: "temp",
      name: "Temp example.com",
      cookieStoreId: "firefox-container-temp",
      temporary: true,
    })
    loadContainersMock.mockResolvedValue(undefined)

    mockUseContainers.mockReturnValue(containers)
    mockUseContainerActions.mockReturnValue({
      create: createContainerMock,
      load: loadContainersMock,
    } as any)

    ;(browser.tabs.query as jest.Mock).mockResolvedValue([
      {
        id: 123,
        url: "https://example.com/path",
        title: "Example",
        cookieStoreId: "firefox-default",
        index: 0,
      },
    ])

    ;(browser.runtime.sendMessage as jest.Mock).mockResolvedValue({
      success: true,
    })

    ;(browser.contextualIdentities.get as jest.Mock).mockRejectedValue(
      new Error("missing"),
    )

    ;(browser.tabs.create as jest.Mock).mockResolvedValue({ id: 333 })

    ;(browser.runtime.getManifest as jest.Mock).mockReturnValue({
      version: "2.0.0",
      options_ui: { page: "options_ui/page.html" },
    })
  })

  afterEach(() => {
    closeSpy.mockRestore()
  })

  it("renders simplified actions and current tab context", async () => {
    render(<PopupApp />)

    expect(
      screen.getByRole("heading", { name: "Silo Quick Open" }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: /open current tab in container/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: /open new tab in container/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: /open in new temp container/i }),
    ).toBeInTheDocument()
    expect(screen.getByText("1")).toBeInTheDocument()
    expect(screen.getByText("2")).toBeInTheDocument()
    expect(screen.getByText("3")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /^work$/i })).toBeNull()

    await waitFor(() => {
      expect(screen.getByText("example.com")).toBeInTheDocument()
    })

    expect(loadContainersMock).toHaveBeenCalled()
    expect(browser.runtime.sendMessage).toHaveBeenCalledWith({
      type: "SYNC_CONTAINERS",
    })
  })

  it("opens the current tab in the chosen container", async () => {
    const user = userEvent.setup()
    render(<PopupApp />)

    await user.click(
      screen.getByRole("button", { name: /open current tab in container/i }),
    )
    expect(screen.getByRole("button", { name: /back/i })).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: /work/i }))

    await waitFor(() => {
      expect(browser.runtime.sendMessage).toHaveBeenCalledWith({
        type: "OPEN_IN_CONTAINER",
        payload: {
          url: "https://example.com/path",
          cookieStoreId: "firefox-container-work",
          index: 1,
          closeTabId: 123,
        },
      })
    })
  })

  it("opens a new tab for current-tab action when page URL cannot be moved", async () => {
    const user = userEvent.setup()
    ;(browser.tabs.query as jest.Mock).mockResolvedValue([
      {
        id: 987,
        url: "about:debugging#/runtime/this-firefox",
        title: "Debug",
        cookieStoreId: "firefox-default",
        index: 2,
      },
    ])

    render(<PopupApp />)

    await user.click(
      screen.getByRole("button", { name: /open current tab in container/i }),
    )
    await user.click(screen.getByRole("button", { name: /work/i }))

    await waitFor(() => {
      expect(browser.runtime.sendMessage).toHaveBeenCalledWith({
        type: "OPEN_IN_CONTAINER",
        payload: {
          cookieStoreId: "firefox-container-work",
          index: 3,
        },
      })
    })
  })

  it("opens a new tab in the chosen container", async () => {
    const user = userEvent.setup()
    render(<PopupApp />)

    await user.click(
      screen.getByRole("button", { name: /open new tab in container/i }),
    )
    expect(screen.getByRole("button", { name: /back/i })).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: /work/i }))

    await waitFor(() => {
      expect(browser.runtime.sendMessage).toHaveBeenCalledWith({
        type: "OPEN_IN_CONTAINER",
        payload: {
          cookieStoreId: "firefox-container-work",
        },
      })
    })

    expect(closeSpy).toHaveBeenCalled()
  })

  it("focuses search and opens first fuzzy match on Enter", async () => {
    const user = userEvent.setup()
    render(<PopupApp />)

    await user.click(
      screen.getByRole("button", { name: /open new tab in container/i }),
    )

    const searchInput = screen.getByPlaceholderText(/search containers\.\.\./i)
    await waitFor(() => {
      expect(searchInput).toHaveFocus()
    })

    await user.type(searchInput, "wrk{enter}")

    await waitFor(() => {
      expect(browser.runtime.sendMessage).toHaveBeenCalledWith({
        type: "OPEN_IN_CONTAINER",
        payload: {
          cookieStoreId: "firefox-container-work",
        },
      })
    })
  })

  it("supports arrow-key selection in results and Enter opens selected container", async () => {
    const user = userEvent.setup()
    render(<PopupApp />)

    await user.click(
      screen.getByRole("button", { name: /open new tab in container/i }),
    )

    const searchInput = screen.getByPlaceholderText(/search containers\.\.\./i)
    await waitFor(() => {
      expect(searchInput).toHaveFocus()
    })

    expect(screen.getByRole("button", { name: /no container/i })).toHaveClass(
      "selected",
    )

    await user.keyboard("{ArrowDown}")
    expect(screen.getByRole("button", { name: /personal/i })).toHaveClass(
      "selected",
    )

    await user.keyboard("{Enter}")

    await waitFor(() => {
      expect(browser.runtime.sendMessage).toHaveBeenCalledWith({
        type: "OPEN_IN_CONTAINER",
        payload: {
          cookieStoreId: "firefox-container-personal",
        },
      })
    })
  })

  it("supports keyboard shortcuts 1 2 and 3 on the home actions", async () => {
    const user = userEvent.setup()
    render(<PopupApp />)

    await user.keyboard("1")
    expect(screen.getByRole("button", { name: /back/i })).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: /back/i }))

    await user.keyboard("2")
    expect(screen.getByRole("button", { name: /back/i })).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: /back/i }))

    await user.keyboard("3")

    await waitFor(() => {
      expect(createContainerMock).toHaveBeenCalled()
    })
  })

  it("creates a temp container and opens the current tab in it", async () => {
    const user = userEvent.setup()
    render(<PopupApp />)

    await user.click(
      screen.getByRole("button", { name: /open in new temp container/i }),
    )

    await waitFor(() => {
      expect(createContainerMock).toHaveBeenCalledWith({
        name: "Temp example.com",
        temporary: true,
        metadata: {
          lifetime: "untilLastTab",
        },
      })
    })

    await waitFor(() => {
      expect(browser.runtime.sendMessage).toHaveBeenCalledWith({
        type: "OPEN_IN_CONTAINER",
        payload: {
          url: "https://example.com/path",
          cookieStoreId: "firefox-container-temp",
          index: 1,
          closeTabId: 123,
        },
      })
    })
  })

  it("opens temp container with a blank new tab when current URL is restricted", async () => {
    const user = userEvent.setup()
    ;(browser.tabs.query as jest.Mock).mockResolvedValue([
      {
        id: 777,
        url: "about:debugging#/runtime/this-firefox",
        title: "Debug",
        cookieStoreId: "firefox-default",
        index: 4,
      },
    ])

    render(<PopupApp />)

    await user.click(
      screen.getByRole("button", { name: /open in new temp container/i }),
    )

    await waitFor(() => {
      expect(browser.runtime.sendMessage).toHaveBeenCalledWith({
        type: "OPEN_IN_CONTAINER",
        payload: {
          cookieStoreId: "firefox-container-temp",
          index: 5,
        },
      })
    })
  })

  it("opens management page from popup footer", async () => {
    const user = userEvent.setup()
    render(<PopupApp />)

    await user.click(screen.getByRole("button", { name: /open management/i }))

    await waitFor(() => {
      expect(browser.tabs.create).toHaveBeenCalledWith({
        url: expect.stringContaining("options_ui/page.html?page=containers"),
      })
    })
  })
})
