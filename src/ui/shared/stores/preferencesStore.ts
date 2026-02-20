import browser from "webextension-polyfill"
import { create } from "zustand"
import { subscribeWithSelector } from "zustand/middleware"
import { DEFAULT_PREFERENCES, MESSAGE_TYPES } from "@/shared/constants"
import type { Preferences } from "@/shared/types"
import { sendRuntimeMessageWithRetry } from "./runtimeMessaging"

interface PreferencesState {
  preferences: Preferences
  loading: boolean
  error?: string

  actions: {
    load: () => Promise<void>
    update: (updates: Partial<Preferences>) => Promise<void>
    clearError: () => void
  }
}

export const usePreferencesStore = create<PreferencesState>()(
  subscribeWithSelector((set, get) => ({
    preferences: DEFAULT_PREFERENCES,
    loading: false,
    error: undefined,

    actions: {
      load: async () => {
        set({ loading: true, error: undefined })

        try {
          const response = await sendRuntimeMessageWithRetry<{
            success?: boolean
            data?: Preferences
            error?: string
          }>(
            {
              type: MESSAGE_TYPES.GET_PREFERENCES,
            },
            {
              attempts: 3,
              retryDelayMs: 120,
              retryOnAnyError: true,
              retryOnUnsuccessfulResponse: true,
              attemptTimeoutMs: 1200,
            },
          )

          if (!response?.success) {
            throw new Error(response?.error || "Failed to fetch preferences")
          }

          set({
            preferences: { ...DEFAULT_PREFERENCES, ...response.data },
            loading: false,
          })
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : "Unknown error",
            loading: false,
          })
        }
      },

      update: async (updates) => {
        try {
          const current = get().preferences
          const newPreferences = { ...current, ...updates }

          const response = await browser.runtime.sendMessage({
            type: MESSAGE_TYPES.UPDATE_PREFERENCES,
            payload: newPreferences,
          })

          if (!response?.success) {
            throw new Error(response?.error || "Failed to update preferences")
          }

          set({ preferences: newPreferences })
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : "Unknown error",
          })
          throw error
        }
      },

      clearError: () => set({ error: undefined }),
    },
  })),
)

export const usePreferences = () =>
  usePreferencesStore((state) => state.preferences)
export const usePreferencesActions = () =>
  usePreferencesStore((state) => state.actions)
export const usePreferencesLoading = () =>
  usePreferencesStore((state) => state.loading)
export const usePreferencesError = () =>
  usePreferencesStore((state) => state.error)
