import browser from "webextension-polyfill"
import {
  sendRuntimeMessageWithRetry,
  waitForBackgroundReady,
} from "@/ui/shared/stores/runtimeMessaging"

describe("runtimeMessaging", () => {
  const sendMessageMock = browser.runtime.sendMessage as jest.Mock

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("retries transient runtime sendMessage failures", async () => {
    sendMessageMock
      .mockRejectedValueOnce(
        new Error(
          "Could not establish connection. Receiving end does not exist.",
        ),
      )
      .mockResolvedValueOnce({ success: true, data: [] })

    const response = await sendRuntimeMessageWithRetry<{ success: boolean }>(
      {
        type: "GET_CONTAINERS",
      },
      { attempts: 2, retryDelayMs: 0 },
    )

    expect(response).toEqual({ success: true, data: [] })
    expect(sendMessageMock).toHaveBeenCalledTimes(2)
  })

  it("retries when runtime sendMessage resolves with no response", async () => {
    sendMessageMock
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce({ success: true, data: [] })

    const response = await sendRuntimeMessageWithRetry<{ success: boolean }>(
      {
        type: "GET_CONTAINERS",
      },
      { attempts: 2, retryDelayMs: 0 },
    )

    expect(response).toEqual({ success: true, data: [] })
    expect(sendMessageMock).toHaveBeenCalledTimes(2)
  })

  it("retries transient unsuccessful response payloads", async () => {
    sendMessageMock
      .mockResolvedValueOnce({
        success: false,
        error: "Unknown message type: GET_PREFERENCES",
      })
      .mockResolvedValueOnce({ success: true, data: { theme: "auto" } })

    const response = await sendRuntimeMessageWithRetry<{ success: boolean }>(
      {
        type: "GET_PREFERENCES",
      },
      { attempts: 2, retryDelayMs: 0 },
    )

    expect(response).toEqual({ success: true, data: { theme: "auto" } })
    expect(sendMessageMock).toHaveBeenCalledTimes(2)
  })

  it("retries invalid response payloads that lack success", async () => {
    sendMessageMock
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ success: true, data: [] })

    const response = await sendRuntimeMessageWithRetry<{ success: boolean }>(
      {
        type: "GET_RULES",
      },
      { attempts: 2, retryDelayMs: 0 },
    )

    expect(response).toEqual({ success: true, data: [] })
    expect(sendMessageMock).toHaveBeenCalledTimes(2)
  })

  it("does not retry non-transient runtime sendMessage failures", async () => {
    sendMessageMock.mockRejectedValueOnce(new Error("Unexpected failure"))

    await expect(
      sendRuntimeMessageWithRetry(
        { type: "GET_CONTAINERS" },
        { attempts: 3, retryDelayMs: 0 },
      ),
    ).rejects.toThrow("Unexpected failure")

    expect(sendMessageMock).toHaveBeenCalledTimes(1)
  })

  it("waits for background ping to succeed", async () => {
    sendMessageMock
      .mockRejectedValueOnce(
        new Error("The message port closed before a response was received."),
      )
      .mockResolvedValueOnce({ success: true, data: "PONG" })

    await expect(
      waitForBackgroundReady({ attempts: 3, retryDelayMs: 0 }),
    ).resolves.toBeUndefined()

    expect(sendMessageMock).toHaveBeenCalledTimes(2)
    expect(sendMessageMock).toHaveBeenNthCalledWith(1, { type: "PING" })
    expect(sendMessageMock).toHaveBeenNthCalledWith(2, { type: "PING" })
  })

  it("retries background ping even for non-retryable thrown errors", async () => {
    sendMessageMock
      .mockRejectedValueOnce(new Error("Unexpected startup failure"))
      .mockResolvedValueOnce({ success: true, data: "PONG" })

    await expect(
      waitForBackgroundReady({ attempts: 2, retryDelayMs: 0 }),
    ).resolves.toBeUndefined()

    expect(sendMessageMock).toHaveBeenCalledTimes(2)
    expect(sendMessageMock).toHaveBeenNthCalledWith(1, { type: "PING" })
    expect(sendMessageMock).toHaveBeenNthCalledWith(2, { type: "PING" })
  })

  it("fails when background ping responds with an error", async () => {
    sendMessageMock.mockResolvedValueOnce({
      success: false,
      error: "Unknown message type: PING",
    })

    await expect(
      waitForBackgroundReady({ attempts: 1, retryDelayMs: 0 }),
    ).rejects.toThrow("Unknown message type: PING")
  })
})
