/** @jest-environment jsdom */

import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import browser from "webextension-polyfill"
import type { Container } from "@/shared/types"
import { PopupApp } from "@/ui/popup/components/PopupApp"
import {
  useContainerActions,
  useContainerLoading,
  useContainers,
  useRuleActions,
} from "@/ui/shared/stores"

jest.mock("@/ui/shared/stores", () => ({
  useContainers: jest.fn(),
  useContainerActions: jest.fn(),
  useContainerLoading: jest.fn(),
  useRuleActions: jest.fn(),
}))

jest.mock("@/ui/shared/components/ThemeSwitcher", () => ({
  ThemeSwitcher: () => <div>Theme</div>,
}))

describe("PopupApp", () => {
  const mockUseContainers = useContainers as jest.MockedFunction<
    typeof useContainers
  >
  const mockUseContainerActions = useContainerActions as jest.MockedFunction<
    typeof useContainerActions
  >
  const mockUseContainerLoading = useContainerLoading as jest.MockedFunction<
    typeof useContainerLoading
  >
  const mockUseRuleActions = useRuleActions as jest.MockedFunction<
    typeof useRuleActions
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
  ]

  beforeEach(() => {
    jest.clearAllMocks()

    mockUseContainers.mockReturnValue(containers)
    mockUseContainerLoading.mockReturnValue(false)
    mockUseContainerActions.mockReturnValue({
      load: jest.fn().mockResolvedValue(undefined),
      create: jest.fn().mockResolvedValue({
        ...containers[0],
        id: "temp",
        name: "Temp",
        cookieStoreId: "firefox-container-temp",
      }),
    } as any)
    mockUseRuleActions.mockReturnValue({
      create: jest.fn().mockResolvedValue(undefined),
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
    ;(browser.bookmarks.create as jest.Mock).mockResolvedValue({
      id: "bookmark-1",
    })
    ;(browser.contextualIdentities.get as jest.Mock).mockRejectedValue(
      new Error("missing"),
    )
    ;(browser.runtime as any).openOptionsPage = jest
      .fn()
      .mockResolvedValue(undefined)
  })

  it("renders context and current site", async () => {
    render(<PopupApp />)

    expect(screen.getByRole("heading", { name: "Silo" })).toBeInTheDocument()
    expect(screen.getByText("Target container")).toBeInTheDocument()

    await waitFor(() => {
      expect(screen.getByText("example.com")).toBeInTheDocument()
    })
  })

  it("prefills the selected container from the current tab when possible", async () => {
    ;(browser.tabs.query as jest.Mock).mockResolvedValue([
      {
        id: 123,
        url: "https://example.com/path",
        title: "Example",
        cookieStoreId: "firefox-container-work",
        index: 0,
      },
    ])

    render(<PopupApp />)

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /open this tab in work/i }),
      ).toBeInTheDocument()
    })
  })

  it("opens the current tab in the selected container", async () => {
    const user = userEvent.setup()
    render(<PopupApp />)

    const trigger = document.querySelector(".selector-trigger")
    expect(trigger).not.toBeNull()
    await user.click(trigger as HTMLButtonElement)
    await user.click(screen.getByRole("option", { name: /work/i }))

    await user.click(
      screen.getByRole("button", { name: /open this tab in work/i }),
    )

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

  it("blocks creating a domain rule when no container is selected", async () => {
    const user = userEvent.setup()
    render(<PopupApp />)

    await user.click(screen.getByRole("button", { name: /\+ domain rule/i }))

    expect(
      screen.getByText("Select a container before creating a domain rule"),
    ).toBeInTheDocument()
  })

  it("opens the options page from the footer link", async () => {
    const user = userEvent.setup()
    render(<PopupApp />)

    await user.click(screen.getByRole("link", { name: /manage containers/i }))

    await waitFor(() => {
      expect((browser.runtime as any).openOptionsPage).toHaveBeenCalled()
    })
  })
})
