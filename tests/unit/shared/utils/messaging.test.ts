import browser from "webextension-polyfill"
import { MessagingService } from "@/shared/utils/messaging"

describe("MessagingService", () => {
  const sendMessageMock = browser.runtime.sendMessage as jest.Mock
  const addListenerMock = browser.runtime.onMessage.addListener as jest.Mock

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("does not register a runtime message listener in UI contexts", () => {
    new MessagingService()

    expect(addListenerMock).not.toHaveBeenCalled()
  })

  it("throws when background returns an invalid response shape", async () => {
    sendMessageMock.mockResolvedValueOnce(false)
    const service = new MessagingService()

    await expect(service.sendMessage("GET_ACTIVE_TABS")).rejects.toThrow(
      "Invalid response from background script",
    )
  })

  it("throws handler error messages for unsuccessful responses", async () => {
    sendMessageMock.mockResolvedValueOnce({
      success: false,
      error: "Failed to get active tabs",
    })
    const service = new MessagingService()

    await expect(service.sendMessage("GET_ACTIVE_TABS")).rejects.toThrow(
      "Failed to get active tabs",
    )
  })

  it("returns successful response payloads", async () => {
    sendMessageMock.mockResolvedValueOnce({
      success: true,
      data: { active: 3 },
    })
    const service = new MessagingService()

    await expect(service.sendMessage("GET_ACTIVE_TABS")).resolves.toEqual({
      success: true,
      data: { active: 3 },
    })
  })
})
