import browser from "webextension-polyfill"
import type { MessageResponse } from "@/shared/utils/messaging"

const RETRYABLE_MESSAGE_ERROR_PATTERNS = [
  /Could not establish connection/i,
  /Receiving end does not exist/i,
  /message port closed/i,
  /Extension context invalidated/i,
  /Unknown message type/i,
]

const DEFAULT_MESSAGE_ATTEMPTS = 3
const DEFAULT_RETRY_DELAY_MS = 120
const DEFAULT_BACKGROUND_READY_ATTEMPTS = 6
const DEFAULT_ATTEMPT_TIMEOUT_MS = 2500

interface RetryOptions {
  attempts?: number
  retryDelayMs?: number
  retryOnAnyError?: boolean
  retryOnUnsuccessfulResponse?: boolean
  attemptTimeoutMs?: number
}

interface RuntimeMessageFailureResponse {
  success?: boolean
  error?: unknown
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

function sendRuntimeMessageWithTimeout(
  message: unknown,
  timeoutMs: number,
): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const timeoutId = window.setTimeout(() => {
      reject(new Error("Runtime message timed out"))
    }, timeoutMs)

    browser.runtime
      .sendMessage(message)
      .then((response) => {
        window.clearTimeout(timeoutId)
        resolve(response)
      })
      .catch((error) => {
        window.clearTimeout(timeoutId)
        reject(error)
      })
  })
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }

  return String(error)
}

export function isRetryableRuntimeMessageError(error: unknown): boolean {
  const message = getErrorMessage(error)
  return RETRYABLE_MESSAGE_ERROR_PATTERNS.some((pattern) =>
    pattern.test(message),
  )
}

export async function sendRuntimeMessageWithRetry<TResponse = unknown>(
  message: unknown,
  options: RetryOptions = {},
): Promise<TResponse> {
  const attempts = Math.max(1, options.attempts ?? DEFAULT_MESSAGE_ATTEMPTS)
  const retryDelayMs = Math.max(
    0,
    options.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS,
  )
  const retryOnAnyError = options.retryOnAnyError === true
  const retryOnUnsuccessfulResponse =
    options.retryOnUnsuccessfulResponse !== false
  const attemptTimeoutMs = Math.max(
    1,
    options.attemptTimeoutMs ?? DEFAULT_ATTEMPT_TIMEOUT_MS,
  )
  let lastError: unknown

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = (await sendRuntimeMessageWithTimeout(
        message,
        attemptTimeoutMs,
      )) as TResponse

      if (response == null) {
        const error = new Error("No response from background script")
        const shouldRetry = attempt < attempts

        if (!shouldRetry) {
          throw error
        }

        lastError = error
        await wait(retryDelayMs * attempt)
        continue
      }

      const responseFailure = response as RuntimeMessageFailureResponse
      if (responseFailure?.success === false) {
        const responseErrorMessage =
          typeof responseFailure.error === "string"
            ? responseFailure.error
            : "Background request failed"
        const shouldRetry = attempt < attempts && retryOnUnsuccessfulResponse

        if (shouldRetry) {
          lastError = new Error(responseErrorMessage)
          await wait(retryDelayMs * attempt)
          continue
        }
      }

      if (
        typeof responseFailure?.success !== "boolean" &&
        retryOnUnsuccessfulResponse
      ) {
        const invalidResponseError = new Error(
          "Invalid response from background script",
        )
        const shouldRetry = attempt < attempts

        if (shouldRetry) {
          lastError = invalidResponseError
          await wait(retryDelayMs * attempt)
          continue
        }

        throw invalidResponseError
      }

      return response
    } catch (error) {
      lastError = error
      const shouldRetry =
        attempt < attempts &&
        (retryOnAnyError || isRetryableRuntimeMessageError(error))

      if (!shouldRetry) {
        throw error
      }

      await wait(retryDelayMs * attempt)
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Failed to send runtime message")
}

export async function waitForBackgroundReady(
  options: RetryOptions = {},
): Promise<void> {
  const response = await sendRuntimeMessageWithRetry<MessageResponse<string>>(
    { type: "PING" },
    {
      attempts: options.attempts ?? DEFAULT_BACKGROUND_READY_ATTEMPTS,
      retryDelayMs: options.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS,
      retryOnAnyError: true,
      retryOnUnsuccessfulResponse: true,
      attemptTimeoutMs: options.attemptTimeoutMs ?? DEFAULT_ATTEMPT_TIMEOUT_MS,
    },
  )

  if (!response?.success) {
    throw new Error(response?.error || "Background did not respond to PING")
  }
}
