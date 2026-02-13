/** @jest-environment jsdom */

import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { Container } from "@/shared/types"
import { ContainerSelector } from "@/ui/popup/components/ContainerSelector"
import { useContainerLoading, useContainers } from "@/ui/shared/stores"

jest.mock("@/ui/shared/stores", () => ({
  useContainers: jest.fn(),
  useContainerLoading: jest.fn(),
}))

describe("ContainerSelector", () => {
  const mockUseContainers = useContainers as jest.MockedFunction<
    typeof useContainers
  >
  const mockUseContainerLoading = useContainerLoading as jest.MockedFunction<
    typeof useContainerLoading
  >

  const containers: Container[] = [
    {
      id: "1",
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
      id: "2",
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

  beforeEach(() => {
    jest.clearAllMocks()
    mockUseContainerLoading.mockReturnValue(false)
    mockUseContainers.mockReturnValue(containers)
  })

  it("renders loading state", () => {
    mockUseContainerLoading.mockReturnValue(true)

    render(<ContainerSelector onSelect={jest.fn()} />)
    expect(screen.getByText("Loading…")).toBeInTheDocument()
  })

  it("renders containers and calls onSelect", async () => {
    const user = userEvent.setup()
    const onSelect = jest.fn()

    render(<ContainerSelector onSelect={onSelect} />)

    expect(screen.getByRole("button", { name: "Work" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Personal" })).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Personal" }))

    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ cookieStoreId: "firefox-container-2" }),
    )
  })
})
