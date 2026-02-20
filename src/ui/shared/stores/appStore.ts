import React from "react"
import { create } from "zustand"
import { useBookmarkStore } from "./bookmarkStore"
import { useContainerStore } from "./containerStore"
import { usePreferencesStore } from "./preferencesStore"
import { useRuleStore } from "./ruleStore"
import { waitForBackgroundReady } from "./runtimeMessaging"
import { useThemeEffects, useThemeStore } from "./themeStore"

const CORE_DATA_LOAD_ATTEMPTS = 2
const CORE_DATA_RETRY_DELAY_MS = 250

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

interface AppState {
  isInitialized: boolean
  initializationError?: string

  actions: {
    initialize: () => Promise<void>
    clearInitializationError: () => void
  }
}

export const useAppStore = create<AppState>((set, _get) => ({
  isInitialized: false,
  initializationError: undefined,

  actions: {
    initialize: async () => {
      try {
        set({ isInitialized: false, initializationError: undefined })

        // Wait for the background script to accept messages before loading stores.
        await waitForBackgroundReady({
          attempts: 4,
          retryDelayMs: 120,
          attemptTimeoutMs: 1000,
        })

        // Start non-critical settings loads in the background.
        void useThemeStore.getState().actions.load()
        void usePreferencesStore.getState().actions.load()

        let coreDataErrorMessage: string | null = null

        for (
          let attempt = 1;
          attempt <= CORE_DATA_LOAD_ATTEMPTS;
          attempt += 1
        ) {
          await Promise.all([
            useContainerStore.getState().actions.load(),
            useRuleStore.getState().actions.load(),
          ])

          const coreDataErrors = [
            useContainerStore.getState().error
              ? `Containers: ${useContainerStore.getState().error}`
              : null,
            useRuleStore.getState().error
              ? `Rules: ${useRuleStore.getState().error}`
              : null,
          ].filter((error): error is string => Boolean(error))

          if (coreDataErrors.length === 0) {
            coreDataErrorMessage = null
            break
          }

          coreDataErrorMessage = coreDataErrors.join("; ")

          if (attempt < CORE_DATA_LOAD_ATTEMPTS) {
            await wait(CORE_DATA_RETRY_DELAY_MS * attempt)
          }
        }

        if (coreDataErrorMessage) {
          throw new Error(coreDataErrorMessage)
        }

        set({ isInitialized: true, initializationError: undefined })

        // Bookmarks are non-critical for shell startup; load opportunistically.
        void useBookmarkStore.getState().actions.loadBookmarks()
      } catch (error) {
        set({
          initializationError:
            error instanceof Error ? error.message : "Failed to initialize app",
          isInitialized: false,
        })
      }
    },

    clearInitializationError: () => set({ initializationError: undefined }),
  },
}))

// Main initialization hook that should be called in the app root
export const useAppInitialization = () => {
  const isInitialized = useAppStore((state) => state.isInitialized)
  const initializationError = useAppStore((state) => state.initializationError)
  const initialize = useAppStore((state) => state.actions.initialize)

  // Apply theme effects
  useThemeEffects()

  React.useEffect(() => {
    if (!isInitialized && !initializationError) {
      initialize()
    }
  }, [isInitialized, initializationError, initialize])

  return {
    isInitialized,
    initializationError,
    retry: initialize,
  }
}

// Cross-store effects and cleanup
export const useStoreEffects = () => {
  React.useEffect(() => {
    // Subscribe to container deletions to clean up related rules
    const unsubscribeContainers = useContainerStore.subscribe(
      (state) => state.containers,
      (containers, prevContainers) => {
        if (!prevContainers) return

        // Find deleted containers
        const deletedContainers = prevContainers.filter(
          (prev) => !containers.find((curr) => curr.id === prev.id),
        )
        const deletedIds = new Set(deletedContainers.map((c) => c.id))
        const deletedCookieStoreIds = new Set(
          deletedContainers.map((c) => c.cookieStoreId),
        )

        if (deletedContainers.length > 0) {
          // Clean up bookmark container assignments for deleted containers
          const bookmarks = useBookmarkStore.getState().bookmarks
          const bookmarksToUpdate = bookmarks.filter((b) =>
            Boolean(
              b.containerId &&
                (deletedCookieStoreIds.has(b.containerId) ||
                  deletedIds.has(b.containerId)),
            ),
          )

          bookmarksToUpdate.forEach((bookmark) => {
            useBookmarkStore
              .getState()
              .actions.removeContainer(bookmark.id)
              .catch(() => {
                // Silently fail
              })
          })
        }
      },
    )

    return () => {
      unsubscribeContainers()
    }
  }, [])
}

// Global error state aggregator
export const useGlobalErrors = () => {
  const containerError = useContainerStore((state) => state.error)
  const ruleError = useRuleStore((state) => state.error)
  const themeError = useThemeStore((state) => state.error)
  const preferencesError = usePreferencesStore((state) => state.error)
  const bookmarkError = useBookmarkStore((state) => state.error)
  const initializationError = useAppStore((state) => state.initializationError)

  const errors = [
    containerError && { type: "containers", message: containerError },
    ruleError && { type: "rules", message: ruleError },
    themeError && { type: "theme", message: themeError },
    preferencesError && { type: "preferences", message: preferencesError },
    bookmarkError && { type: "bookmarks", message: bookmarkError },
    initializationError && {
      type: "initialization",
      message: initializationError,
    },
  ].filter(Boolean)

  const clearErrors = () => {
    useContainerStore.getState().actions.clearError()
    useRuleStore.getState().actions.clearError()
    useThemeStore.getState().actions.clearError()
    usePreferencesStore.getState().actions.clearError()
    useBookmarkStore.getState().actions.clearError()
    useAppStore.getState().actions.clearInitializationError()
  }

  return {
    errors,
    hasErrors: errors.length > 0,
    clearErrors,
  }
}

// Global loading state aggregator
export const useGlobalLoading = () => {
  const containerLoading = useContainerStore((state) => state.loading)
  const ruleLoading = useRuleStore((state) => state.loading)
  const themeLoading = useThemeStore((state) => state.loading)
  const preferencesLoading = usePreferencesStore((state) => state.loading)
  const bookmarkLoading = useBookmarkStore((state) => state.loading)
  const isInitialized = useAppStore((state) => state.isInitialized)

  return {
    containers: containerLoading,
    rules: ruleLoading,
    theme: themeLoading,
    preferences: preferencesLoading,
    bookmarks: bookmarkLoading.bookmarks,
    isInitializing: !isInitialized,
    isLoading:
      containerLoading ||
      ruleLoading ||
      themeLoading ||
      preferencesLoading ||
      bookmarkLoading.bookmarks,
  }
}
