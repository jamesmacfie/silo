import React from "react"
import { create } from "zustand"
import { useBookmarkStore } from "./bookmarkStore"
import { useContainerStore } from "./containerStore"
import { usePreferencesStore } from "./preferencesStore"
import { useRuleStore } from "./ruleStore"
import { useThemeEffects, useThemeStore } from "./themeStore"

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
        set({ initializationError: undefined })

        // Initialize all stores in parallel
        // Theme and preferences first since other stores might depend on them
        await Promise.all([
          useThemeStore.getState().actions.load(),
          usePreferencesStore.getState().actions.load(),
        ])

        // Then load the main data
        await Promise.all([
          useContainerStore.getState().actions.load(),
          useRuleStore.getState().actions.load(),
          useBookmarkStore.getState().actions.loadTags(),
          useBookmarkStore.getState().actions.loadBookmarks(),
        ])

        set({ isInitialized: true })
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
        const deletedIds = prevContainers
          .filter((prev) => !containers.find((curr) => curr.id === prev.id))
          .map((c) => c.id)

        if (deletedIds.length > 0) {
          // Clean up rules for deleted containers
          const rules = useRuleStore.getState().rules
          const rulesToDelete = rules
            .filter((r) => deletedIds.includes(r.containerId || ""))
            .map((r) => r.id)

          // Delete related rules
          rulesToDelete.forEach((ruleId) => {
            useRuleStore
              .getState()
              .actions.delete(ruleId)
              .catch(() => {
                // Silently fail - the rule might already be deleted
              })
          })

          // Clean up bookmark container assignments for deleted containers
          const bookmarks = useBookmarkStore.getState().bookmarks
          const bookmarksToUpdate = bookmarks.filter(
            (b) => b.containerId && deletedIds.includes(b.containerId),
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
    bookmarks: bookmarkLoading.bookmarks || bookmarkLoading.tags,
    isInitializing: !isInitialized,
    isLoading:
      containerLoading ||
      ruleLoading ||
      themeLoading ||
      preferencesLoading ||
      bookmarkLoading.bookmarks ||
      bookmarkLoading.tags,
  }
}
