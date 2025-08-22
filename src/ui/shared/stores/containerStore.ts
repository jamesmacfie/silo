import browser from "webextension-polyfill"
import { create } from "zustand"
import { subscribeWithSelector } from "zustand/middleware"
import { MESSAGE_TYPES } from "@/shared/constants"
import type { Container } from "@/shared/types"

interface ContainerState {
  containers: Container[]
  loading: boolean
  error?: string

  actions: {
    load: () => Promise<void>
    create: (container: Partial<Container>) => Promise<Container>
    update: (id: string, updates: Partial<Container>) => Promise<void>
    delete: (id: string) => Promise<void>
    clearCookies: (id: string) => Promise<void>
    clearError: () => void
  }
}

export const useContainerStore = create<ContainerState>()(
  subscribeWithSelector((set, get) => ({
    containers: [],
    loading: false,
    error: undefined,

    actions: {
      load: async () => {
        set({ loading: true, error: undefined })

        try {
          const response = await browser.runtime.sendMessage({
            type: MESSAGE_TYPES.GET_CONTAINERS,
          })

          if (!response?.success) {
            throw new Error(response?.error || "Failed to fetch containers")
          }

          set({ containers: response.data || [], loading: false })
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : "Unknown error",
            loading: false,
          })
        }
      },

      create: async (container) => {
        try {
          const response = await browser.runtime.sendMessage({
            type: MESSAGE_TYPES.CREATE_CONTAINER,
            payload: container,
          })

          if (!response?.success) {
            throw new Error(response?.error || "Failed to create container")
          }

          // Optimistically add to state
          set((state) => ({
            containers: [...state.containers, response.data],
          }))

          return response.data
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : "Unknown error",
          })
          throw error
        }
      },

      update: async (id, updates) => {
        try {
          const response = await browser.runtime.sendMessage({
            type: MESSAGE_TYPES.UPDATE_CONTAINER,
            payload: { id, updates },
          })

          if (!response?.success) {
            throw new Error(response?.error || "Failed to update container")
          }

          // Optimistic update - match by cookieStoreId since that's what we receive
          set((state) => ({
            containers: state.containers.map((c) =>
              c.cookieStoreId === id
                ? { ...c, ...updates, modified: Date.now() }
                : c,
            ),
          }))
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : "Unknown error",
          })
          // Refresh on error to revert optimistic update
          await get().actions.load()
          throw error
        }
      },

      delete: async (id) => {
        try {
          const response = await browser.runtime.sendMessage({
            type: MESSAGE_TYPES.DELETE_CONTAINER,
            payload: { id },
          })

          if (!response?.success) {
            throw new Error(response?.error || "Failed to delete container")
          }

          // Optimistic removal - filter by cookieStoreId since that's what we receive
          set((state) => ({
            containers: state.containers.filter((c) => c.cookieStoreId !== id),
          }))
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : "Unknown error",
          })
          await get().actions.load()
          throw error
        }
      },

      clearCookies: async (id) => {
        try {
          const response = await browser.runtime.sendMessage({
            type: MESSAGE_TYPES.CLEAR_CONTAINER_COOKIES,
            payload: { id },
          })

          if (!response?.success) {
            throw new Error(response?.error || "Failed to clear cookies")
          }
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

// Convenient selectors
export const useContainers = () =>
  useContainerStore((state) => state.containers)
export const useContainerActions = () =>
  useContainerStore((state) => state.actions)
export const useContainerLoading = () =>
  useContainerStore((state) => state.loading)
export const useContainerError = () => useContainerStore((state) => state.error)
