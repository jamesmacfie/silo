import browser from "webextension-polyfill"
import {
  DEFAULT_CONTAINER_COLORS,
  DEFAULT_CONTAINER_ICONS,
} from "@/shared/constants"
import type { Container, CreateContainerRequest } from "@/shared/types"
import { logger } from "@/shared/utils/logger"
import StorageService from "./StorageService"

export class ContainerManager {
  private storage = StorageService
  private log = logger.withContext("ContainerManager")

  constructor() {
    this.setupEventListeners()
  }

  private setupEventListeners(): void {
    // Listen for container changes from Firefox
    if (browser.contextualIdentities?.onCreated) {
      browser.contextualIdentities.onCreated.addListener(async (changeInfo) => {
        this.log.info("Firefox container created", changeInfo)
        await this.syncWithFirefox()
      })

      browser.contextualIdentities.onRemoved.addListener(async (changeInfo) => {
        this.log.info("Firefox container removed", changeInfo)
        await this.handleFirefoxContainerRemoved(
          changeInfo.contextualIdentity.cookieStoreId,
        )
      })

      browser.contextualIdentities.onUpdated.addListener(async (changeInfo) => {
        this.log.info("Firefox container updated", changeInfo)
        await this.syncWithFirefox()
      })
    }

    // Clean up temporary containers on startup
    this.cleanupTemporaryContainers()
  }

  async create(request: CreateContainerRequest): Promise<Container> {
    this.log.info("Creating container", request)

    // Create Firefox container first
    let firefoxContainer: browser.ContextualIdentities.ContextualIdentity

    try {
      firefoxContainer = await browser.contextualIdentities.create({
        name: request.name,
        color: request.color || this.getRandomColor(),
        icon: request.icon || this.getRandomIcon(),
      })
    } catch (error) {
      this.log.error("Failed to create Firefox container", error)
      throw new Error(`Failed to create Firefox container: ${error}`)
    }

    // Create our container record
    const container: Container = {
      id: this.generateId(),
      name: request.name,
      icon: firefoxContainer.icon,
      color: firefoxContainer.color,
      cookieStoreId: firefoxContainer.cookieStoreId,
      created: Date.now(),
      modified: Date.now(),
      temporary: request.temporary || false,
      syncEnabled: request.syncEnabled !== false, // default true
      metadata: request.metadata || {},
    }

    await this.storage.addContainer(container)
    this.log.info("Container created successfully", container)

    return container
  }

  async update(id: string, updates: Partial<Container>): Promise<Container> {
    this.log.info("Updating container", { id, updates })

    const containers = await this.storage.getContainers()
    // Try to find by internal ID first, then by cookieStoreId for backwards compatibility
    const container =
      containers.find((c: Container) => c.id === id) ||
      containers.find((c: Container) => c.cookieStoreId === id)

    if (!container) {
      throw new Error(`Container not found: ${id}`)
    }

    // Update Firefox container if display properties changed
    if (updates.name || updates.color || updates.icon) {
      try {
        await browser.contextualIdentities.update(container.cookieStoreId, {
          name: updates.name || container.name,
          color: updates.color || container.color,
          icon: updates.icon || container.icon,
        })
      } catch (error) {
        this.log.error("Failed to update Firefox container", error)
        throw new Error(`Failed to update Firefox container: ${error}`)
      }
    }

    // Update our container record
    await this.storage.updateContainer(container.id, {
      ...updates,
      modified: Date.now(),
    })

    const updatedContainer = { ...container, ...updates, modified: Date.now() }
    this.log.info("Container updated successfully", updatedContainer)

    return updatedContainer
  }

  async delete(id: string): Promise<void> {
    this.log.info("Deleting container", { id })

    const containers = await this.storage.getContainers()
    // Try to find by internal ID first, then by cookieStoreId for backwards compatibility
    const container =
      containers.find((c: Container) => c.id === id) ||
      containers.find((c: Container) => c.cookieStoreId === id)

    if (!container) {
      throw new Error(`Container not found: ${id}`)
    }

    // Remove Firefox container first
    try {
      await browser.contextualIdentities.remove(container.cookieStoreId)
    } catch (error) {
      this.log.warn(
        "Failed to remove Firefox container (may already be deleted)",
        error,
      )
    }

    // Remove our container record
    await this.storage.removeContainer(container.id)

    // Remove any rules associated with this container
    const rules = await this.storage.getRules()
    const filteredRules = rules.filter(
      (rule) => rule.containerId !== container.cookieStoreId,
    )
    if (filteredRules.length !== rules.length) {
      await this.storage.setRules(filteredRules)
      this.log.info("Removed rules associated with deleted container", {
        removedCount: rules.length - filteredRules.length,
      })
    }

    this.log.info("Container deleted successfully", {
      id: container.id,
      cookieStoreId: container.cookieStoreId,
    })
  }

  async get(id: string): Promise<Container | null> {
    const containers = await this.storage.getContainers()
    return containers.find((c) => c.id === id) || null
  }

  async getAll(): Promise<Container[]> {
    return await this.storage.getContainers()
  }

  async syncWithFirefox(): Promise<void> {
    this.log.info("Syncing with Firefox containers")

    try {
      const firefoxContainers = await browser.contextualIdentities.query({})
      const ourContainers = await this.storage.getContainers()

      // Find containers that exist in Firefox but not in our storage
      const missingContainers: Container[] = []

      for (const ffContainer of firefoxContainers) {
        const exists = ourContainers.find(
          (c) => c.cookieStoreId === ffContainer.cookieStoreId,
        )

        if (!exists) {
          const container: Container = {
            id: this.generateId(),
            name: ffContainer.name,
            icon: ffContainer.icon,
            color: ffContainer.color,
            cookieStoreId: ffContainer.cookieStoreId,
            created: Date.now(),
            modified: Date.now(),
            temporary: false,
            syncEnabled: true,
            metadata: {},
          }
          missingContainers.push(container)
        }
      }

      // Add missing containers
      if (missingContainers.length > 0) {
        const allContainers = [...ourContainers, ...missingContainers]
        await this.storage.setContainers(allContainers)
        this.log.info("Added missing containers from Firefox", {
          count: missingContainers.length,
        })
      }

      // Find containers that exist in our storage but not in Firefox
      const orphanedContainers = ourContainers.filter(
        (ourContainer) =>
          !firefoxContainers.find(
            (ffContainer) =>
              ffContainer.cookieStoreId === ourContainer.cookieStoreId,
          ),
      )

      // Remove orphaned containers
      if (orphanedContainers.length > 0) {
        const validContainers = ourContainers.filter(
          (c) => !orphanedContainers.includes(c),
        )
        await this.storage.setContainers(validContainers)
        this.log.info("Removed orphaned containers", {
          count: orphanedContainers.length,
        })
      }
    } catch (error) {
      this.log.error("Failed to sync with Firefox containers", error)
      throw error
    }
  }

  async mapToFirefoxContainer(container: Container): Promise<string> {
    // Ensure the Firefox container still exists
    try {
      const firefoxContainer = await browser.contextualIdentities.get(
        container.cookieStoreId,
      )
      return firefoxContainer.cookieStoreId
    } catch (error) {
      // Container was deleted in Firefox, need to recreate or remove
      this.log.warn("Firefox container no longer exists", { container, error })

      if (!container.temporary) {
        // Try to recreate the container
        try {
          const newFirefoxContainer = await browser.contextualIdentities.create(
            {
              name: container.name,
              color: container.color,
              icon: container.icon,
            },
          )

          // Update our record with new cookieStoreId
          await this.storage.updateContainer(container.id, {
            cookieStoreId: newFirefoxContainer.cookieStoreId,
          })

          return newFirefoxContainer.cookieStoreId
        } catch (createError) {
          this.log.error("Failed to recreate container", createError)
          throw createError
        }
      } else {
        // Remove temporary container that no longer exists
        await this.storage.removeContainer(container.id)
        throw new Error("Temporary container no longer exists and was removed")
      }
    }
  }

  private async handleFirefoxContainerRemoved(
    cookieStoreId: string,
  ): Promise<void> {
    const containers = await this.storage.getContainers()
    const container = containers.find((c) => c.cookieStoreId === cookieStoreId)

    if (container) {
      await this.storage.removeContainer(container.id)
      this.log.info("Removed container that was deleted in Firefox", container)
    }
  }

  private async cleanupTemporaryContainers(): Promise<void> {
    this.log.info("Cleaning up temporary containers")

    const containers = await this.storage.getContainers()
    const temporaryContainers = containers.filter(
      (c) => c.temporary || c.metadata?.lifetime === "untilLastTab",
    )

    for (const container of temporaryContainers) {
      try {
        // Check if container has any open tabs
        const tabs = await browser.tabs.query({
          cookieStoreId: container.cookieStoreId,
        })

        if (tabs.length === 0) {
          this.log.info("Cleaning up empty temporary container", container)
          await this.delete(container.id)
        }
      } catch (error) {
        this.log.error("Error checking temporary container", {
          container,
          error,
        })
      }
    }
  }

  // Public method for external cleanup triggers
  async cleanupTemporaryContainersAsync(): Promise<void> {
    return this.cleanupTemporaryContainers()
  }

  async clearContainerCookies(id: string): Promise<void> {
    this.log.info("Clearing cookies for container", { id })

    const containers = await this.storage.getContainers()
    // Try to find by internal ID first, then by cookieStoreId for backwards compatibility
    const container =
      containers.find((c: Container) => c.id === id) ||
      containers.find((c: Container) => c.cookieStoreId === id)

    if (!container) {
      throw new Error(`Container not found: ${id}`)
    }

    try {
      // Clear cookies for this specific container
      await browser.browsingData.removeCookies({
        cookieStoreId: container.cookieStoreId,
      })

      this.log.info("Successfully cleared cookies for container", {
        id: container.id,
        cookieStoreId: container.cookieStoreId,
        name: container.name,
      })
    } catch (error) {
      this.log.error("Failed to clear cookies for container", {
        container,
        error,
      })
      throw new Error(`Failed to clear cookies for container: ${error}`)
    }
  }

  private generateId(): string {
    return `container_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  private getRandomIcon(): string {
    const icons = DEFAULT_CONTAINER_ICONS
    return icons[Math.floor(Math.random() * icons.length)]
  }

  private getRandomColor(): string {
    const colors = DEFAULT_CONTAINER_COLORS
    return colors[Math.floor(Math.random() * colors.length)]
  }
}
export const containerManager = new ContainerManager()
export default containerManager
