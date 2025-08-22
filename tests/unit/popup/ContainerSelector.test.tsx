/** @jest-environment jsdom */
import React from "react"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import browser from "webextension-polyfill"
import { QueryProvider } from "@/ui/shared/providers/QueryProvider"
import { ContainerSelector } from "@/ui/popup/components/ContainerSelector"

describe("ContainerSelector", () => {
  beforeEach(() => {
    ;(browser.runtime.sendMessage as jest.Mock).mockReset()
  })

  it("renders containers and handles select", async () => {
    ;(browser.runtime.sendMessage as jest.Mock).mockResolvedValue({
      success: true,
      data: [
        {
          id: "1",
          name: "Work",
          icon: "briefcase",
          color: "blue",
          cookieStoreId: "fx-1",
          created: 1,
          modified: 1,
          temporary: false,
          syncEnabled: true,
        },
        {
          id: "2",
          name: "Personal",
          icon: "gift",
          color: "red",
          cookieStoreId: "fx-2",
          created: 1,
          modified: 1,
          temporary: false,
          syncEnabled: true,
        },
      ],
    })

    const onSelect = jest.fn()
    render(
      <QueryProvider>
        <ContainerSelector onSelect={onSelect} />
      </QueryProvider>,
    )

    await waitFor(() => {
      expect(screen.getByText("Work")).toBeInTheDocument()
      expect(screen.getByText("Personal")).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText("Personal"))
    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Personal" }),
    )
  })
})
