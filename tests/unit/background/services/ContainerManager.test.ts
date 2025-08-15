import { ContainerManager } from '@/background/services/ContainerManager';
import { Container, CreateContainerRequest } from '@/shared/types';
import browser from 'webextension-polyfill';
import StorageService from '@/background/services/StorageService';
import { DEFAULT_CONTAINER_ICONS, DEFAULT_CONTAINER_COLORS } from '@/shared/constants';

jest.mock('@/background/services/StorageService');
jest.mock('@/shared/utils/logger');

describe('ContainerManager', () => {
  let containerManager: ContainerManager;
  let mockStorageService: jest.Mocked<typeof StorageService>;

  const mockFirefoxContainer: browser.ContextualIdentities.ContextualIdentity = {
    cookieStoreId: 'firefox-container-1',
    name: 'Test Container',
    color: 'blue',
    colorCode: '#0000FF',
    icon: 'fingerprint',
    iconUrl: 'resource://icon.svg',
  };

  const mockContainer: Container = {
    id: 'test-1',
    name: 'Test Container',
    icon: 'fingerprint',
    color: 'blue',
    cookieStoreId: 'firefox-container-1',
    created: Date.now(),
    modified: Date.now(),
    temporary: false,
    syncEnabled: true,
    metadata: {
      description: 'Test container',
      lifetime: 'permanent',
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Reset singleton instance
    (ContainerManager as any).instance = null;

    mockStorageService = StorageService as jest.Mocked<typeof StorageService>;

    // Mock browser APIs first
    global.browser.contextualIdentities = {
      create: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
      get: jest.fn(),
      query: jest.fn(),
      onCreated: {
        addListener: jest.fn(),
        removeListener: jest.fn(),
        hasListener: jest.fn(),
      },
      onRemoved: {
        addListener: jest.fn(),
        removeListener: jest.fn(),
        hasListener: jest.fn(),
      },
      onUpdated: {
        addListener: jest.fn(),
        removeListener: jest.fn(),
        hasListener: jest.fn(),
      },
    } as any;

    global.browser.tabs = {
      query: jest.fn(),
    } as any;

    // Set up default mocks that will be called during construction
    mockStorageService.getContainers = jest.fn().mockResolvedValue([]);

    containerManager = new ContainerManager();
  });


  describe('create', () => {
    it('should create a new container', async () => {
      const request: CreateContainerRequest = {
        name: 'New Container',
        icon: 'briefcase',
        color: 'red',
        temporary: false,
        syncEnabled: true,
        metadata: {
          description: 'Work container',
        },
      };

      (browser.contextualIdentities.create as jest.Mock).mockResolvedValue(mockFirefoxContainer);
      mockStorageService.addContainer = jest.fn().mockResolvedValue(undefined);

      const result = await containerManager.create(request);

      expect(browser.contextualIdentities.create).toHaveBeenCalledWith({
        name: request.name,
        color: request.color,
        icon: request.icon,
      });

      expect(result).toMatchObject({
        name: request.name,
        icon: mockFirefoxContainer.icon,
        color: mockFirefoxContainer.color,
        cookieStoreId: mockFirefoxContainer.cookieStoreId,
        temporary: false,
        syncEnabled: true,
      });

      expect(mockStorageService.addContainer).toHaveBeenCalledWith(
        expect.objectContaining({
          name: request.name,
          icon: mockFirefoxContainer.icon,
          color: mockFirefoxContainer.color,
          cookieStoreId: mockFirefoxContainer.cookieStoreId,
          temporary: false,
          syncEnabled: true,
        })
      );
    });

    it('should handle Firefox API errors gracefully', async () => {
      const request: CreateContainerRequest = {
        name: 'Error Container',
      };

      const error = new Error('Firefox API error');
      (browser.contextualIdentities.create as jest.Mock).mockRejectedValue(error);

      await expect(containerManager.create(request)).rejects.toThrow('Firefox API error');
    });

    it('should use random values when not provided', async () => {
      const request: CreateContainerRequest = {
        name: 'Minimal Container',
      };

      (browser.contextualIdentities.create as jest.Mock).mockResolvedValue(mockFirefoxContainer);
      mockStorageService.addContainer = jest.fn().mockResolvedValue(undefined);

      await containerManager.create(request);

      const createCall = (browser.contextualIdentities.create as jest.Mock).mock.calls[0][0];
      expect(createCall.name).toBe(request.name);
      expect(DEFAULT_CONTAINER_COLORS).toContain(createCall.color);
      expect(DEFAULT_CONTAINER_ICONS).toContain(createCall.icon);
    });
  });

  describe('update', () => {
    it('should update an existing container', async () => {
      const updates = {
        name: 'Updated Name',
        color: 'green',
      };

      mockStorageService.getContainers = jest.fn().mockResolvedValue([mockContainer]);
      mockStorageService.updateContainer = jest.fn().mockResolvedValue(undefined);
      (browser.contextualIdentities.update as jest.Mock).mockResolvedValue(mockFirefoxContainer);

      const result = await containerManager.update(mockContainer.id, updates);

      expect(browser.contextualIdentities.update).toHaveBeenCalledWith(
        mockContainer.cookieStoreId,
        expect.objectContaining({
          name: updates.name,
          color: updates.color,
          icon: mockContainer.icon,
        })
      );

      expect(mockStorageService.updateContainer).toHaveBeenCalledWith(
        mockContainer.id,
        expect.objectContaining({
          ...updates,
          modified: expect.any(Number),
        })
      );

      expect(result).toMatchObject({
        ...mockContainer,
        ...updates,
        modified: expect.any(Number),
      });
    });

    it('should update container found by cookieStoreId', async () => {
      const updates = { name: 'Updated Name' };

      mockStorageService.getContainers = jest.fn().mockResolvedValue([mockContainer]);
      mockStorageService.updateContainer = jest.fn().mockResolvedValue(undefined);
      (browser.contextualIdentities.update as jest.Mock).mockResolvedValue(mockFirefoxContainer);

      // Use cookieStoreId instead of id
      await containerManager.update(mockContainer.cookieStoreId, updates);

      expect(mockStorageService.updateContainer).toHaveBeenCalledWith(
        mockContainer.id,
        expect.objectContaining(updates)
      );
    });

    it('should throw error if container not found', async () => {
      mockStorageService.getContainers = jest.fn().mockResolvedValue([]);

      await expect(
        containerManager.update('non-existent', { name: 'Test' })
      ).rejects.toThrow('Container not found: non-existent');
    });

    it('should handle Firefox API update errors', async () => {
      mockStorageService.getContainers = jest.fn().mockResolvedValue([mockContainer]);
      (browser.contextualIdentities.update as jest.Mock).mockRejectedValue(
        new Error('Firefox update failed')
      );

      await expect(
        containerManager.update(mockContainer.id, { name: 'Test' })
      ).rejects.toThrow('Failed to update Firefox container');
    });
  });

  describe('delete', () => {
    it('should delete a container and associated rules', async () => {
      const mockRules = [
        { id: 'rule1', containerId: mockContainer.cookieStoreId },
        { id: 'rule2', containerId: 'other-container' },
        { id: 'rule3', containerId: mockContainer.cookieStoreId },
      ];

      mockStorageService.getContainers = jest.fn().mockResolvedValue([mockContainer]);
      mockStorageService.removeContainer = jest.fn().mockResolvedValue(undefined);
      mockStorageService.getRules = jest.fn().mockResolvedValue(mockRules);
      mockStorageService.setRules = jest.fn().mockResolvedValue(undefined);
      (browser.contextualIdentities.remove as jest.Mock).mockResolvedValue(mockFirefoxContainer);

      await containerManager.delete(mockContainer.id);

      expect(browser.contextualIdentities.remove).toHaveBeenCalledWith(
        mockContainer.cookieStoreId
      );
      expect(mockStorageService.removeContainer).toHaveBeenCalledWith(mockContainer.id);
      expect(mockStorageService.setRules).toHaveBeenCalledWith([
        { id: 'rule2', containerId: 'other-container' },
      ]);
    });

    it('should delete container found by cookieStoreId', async () => {
      mockStorageService.getContainers = jest.fn().mockResolvedValue([mockContainer]);
      mockStorageService.removeContainer = jest.fn().mockResolvedValue(undefined);
      mockStorageService.getRules = jest.fn().mockResolvedValue([]);
      (browser.contextualIdentities.remove as jest.Mock).mockResolvedValue(mockFirefoxContainer);

      // Use cookieStoreId instead of id
      await containerManager.delete(mockContainer.cookieStoreId);

      expect(mockStorageService.removeContainer).toHaveBeenCalledWith(mockContainer.id);
    });

    it('should continue even if Firefox container removal fails', async () => {
      mockStorageService.getContainers = jest.fn().mockResolvedValue([mockContainer]);
      mockStorageService.removeContainer = jest.fn().mockResolvedValue(undefined);
      mockStorageService.getRules = jest.fn().mockResolvedValue([]);
      (browser.contextualIdentities.remove as jest.Mock).mockRejectedValue(
        new Error('Already deleted')
      );

      // Should not throw
      await containerManager.delete(mockContainer.id);

      expect(mockStorageService.removeContainer).toHaveBeenCalledWith(mockContainer.id);
    });

    it('should throw error if container not found', async () => {
      mockStorageService.getContainers = jest.fn().mockResolvedValue([]);

      await expect(containerManager.delete('non-existent')).rejects.toThrow(
        'Container not found: non-existent'
      );
    });
  });

  describe('get', () => {
    it('should retrieve a container by id', async () => {
      mockStorageService.getContainers = jest.fn().mockResolvedValue([mockContainer]);

      const result = await containerManager.get(mockContainer.id);

      expect(result).toEqual(mockContainer);
      expect(mockStorageService.getContainers).toHaveBeenCalled();
    });

    it('should return null for non-existent container', async () => {
      mockStorageService.getContainers = jest.fn().mockResolvedValue([mockContainer]);

      const result = await containerManager.get('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('getAll', () => {
    it('should retrieve all containers', async () => {
      const containers = [mockContainer, { ...mockContainer, id: 'test-2' }];
      mockStorageService.getContainers = jest.fn().mockResolvedValue(containers);

      const result = await containerManager.getAll();

      expect(result).toEqual(containers);
      expect(mockStorageService.getContainers).toHaveBeenCalled();
    });

    it('should return empty array when no containers', async () => {
      mockStorageService.getContainers = jest.fn().mockResolvedValue([]);

      const result = await containerManager.getAll();

      expect(result).toEqual([]);
    });
  });

  describe('syncWithFirefox', () => {
    it('should sync containers with Firefox', async () => {
      const firefoxContainers = [mockFirefoxContainer];
      const storageContainers = [mockContainer];

      (browser.contextualIdentities.query as jest.Mock).mockResolvedValue(firefoxContainers);
      mockStorageService.getContainers = jest.fn().mockResolvedValue(storageContainers);
      mockStorageService.setContainers = jest.fn().mockResolvedValue(undefined);

      await containerManager.syncWithFirefox();

      expect(browser.contextualIdentities.query).toHaveBeenCalledWith({});
      expect(mockStorageService.getContainers).toHaveBeenCalled();
    });

    it('should add missing Firefox containers to storage', async () => {
      const newFirefoxContainer = {
        ...mockFirefoxContainer,
        cookieStoreId: 'firefox-container-2',
        name: 'New Firefox Container',
      };

      (browser.contextualIdentities.query as jest.Mock).mockResolvedValue([
        mockFirefoxContainer,
        newFirefoxContainer,
      ]);
      mockStorageService.getContainers = jest.fn().mockResolvedValue([mockContainer]);
      mockStorageService.setContainers = jest.fn().mockResolvedValue(undefined);

      await containerManager.syncWithFirefox();

      expect(mockStorageService.setContainers).toHaveBeenCalledWith(
        expect.arrayContaining([
          mockContainer,
          expect.objectContaining({
            name: newFirefoxContainer.name,
            cookieStoreId: newFirefoxContainer.cookieStoreId,
          }),
        ])
      );
    });

    it('should remove orphaned containers not in Firefox', async () => {
      const orphanedContainer = {
        ...mockContainer,
        id: 'orphaned-1',
        cookieStoreId: 'orphaned-cookie-store',
      };

      (browser.contextualIdentities.query as jest.Mock).mockResolvedValue([mockFirefoxContainer]);
      mockStorageService.getContainers = jest.fn()
        .mockResolvedValueOnce([mockContainer, orphanedContainer])
        .mockResolvedValueOnce([mockContainer, orphanedContainer]);
      mockStorageService.setContainers = jest.fn().mockResolvedValue(undefined);

      await containerManager.syncWithFirefox();

      expect(mockStorageService.setContainers).toHaveBeenCalledWith([mockContainer]);
    });

    it('should handle Firefox API errors', async () => {
      (browser.contextualIdentities.query as jest.Mock).mockRejectedValue(
        new Error('Firefox API error')
      );

      await expect(containerManager.syncWithFirefox()).rejects.toThrow('Firefox API error');
    });
  });

  describe('cleanupTemporaryContainers', () => {
    it('should remove empty temporary containers', async () => {
      const tempContainer = {
        ...mockContainer,
        id: 'temp-1',
        temporary: true,
        metadata: { lifetime: 'untilLastTab' },
      };

      mockStorageService.getContainers = jest.fn().mockResolvedValue([tempContainer]);
      mockStorageService.removeContainer = jest.fn().mockResolvedValue(undefined);
      mockStorageService.getRules = jest.fn().mockResolvedValue([]);
      (browser.tabs.query as jest.Mock).mockResolvedValue([]);
      (browser.contextualIdentities.remove as jest.Mock).mockResolvedValue(undefined);

      // Spy on the delete method
      const deleteSpy = jest.spyOn(containerManager, 'delete');

      await (containerManager as unknown as { cleanupTemporaryContainers: () => Promise<void> }).cleanupTemporaryContainers();

      expect(browser.tabs.query).toHaveBeenCalledWith({
        cookieStoreId: tempContainer.cookieStoreId,
      });
      expect(deleteSpy).toHaveBeenCalledWith(tempContainer.id);

      deleteSpy.mockRestore();
    });

    it('should not remove temporary containers with active tabs', async () => {
      const tempContainer = {
        ...mockContainer,
        temporary: true,
        metadata: { lifetime: 'untilLastTab' },
      };

      mockStorageService.getContainers = jest.fn().mockResolvedValue([tempContainer]);
      (browser.tabs.query as jest.Mock).mockResolvedValue([{ id: 1 }]);

      const deleteSpy = jest.spyOn(containerManager, 'delete');

      await (containerManager as unknown as { cleanupTemporaryContainers: () => Promise<void> }).cleanupTemporaryContainers();

      expect(deleteSpy).not.toHaveBeenCalled();

      deleteSpy.mockRestore();
    });

    it('should handle errors when checking temporary containers', async () => {
      const tempContainer = {
        ...mockContainer,
        id: 'temp-1',
        temporary: true,
      };

      mockStorageService.getContainers = jest.fn().mockResolvedValue([tempContainer]);
      (browser.tabs.query as jest.Mock).mockRejectedValue(new Error('Tab query failed'));

      // Should not throw
      await expect(
        (containerManager as unknown as { cleanupTemporaryContainers: () => Promise<void> }).cleanupTemporaryContainers()
      ).resolves.not.toThrow();
    });
  });

  describe('mapToFirefoxContainer', () => {
    it('should return cookieStoreId when Firefox container exists', async () => {
      (browser.contextualIdentities.get as jest.Mock).mockResolvedValue(mockFirefoxContainer);

      const result = await containerManager.mapToFirefoxContainer(mockContainer);

      expect(result).toBe(mockContainer.cookieStoreId);
      expect(browser.contextualIdentities.get).toHaveBeenCalledWith(mockContainer.cookieStoreId);
    });

    it('should recreate non-temporary container when Firefox container missing', async () => {
      const newFirefoxContainer = {
        ...mockFirefoxContainer,
        cookieStoreId: 'new-firefox-container',
      };

      (browser.contextualIdentities.get as jest.Mock).mockRejectedValue(
        new Error('Container not found')
      );
      (browser.contextualIdentities.create as jest.Mock).mockResolvedValue(newFirefoxContainer);
      mockStorageService.updateContainer = jest.fn().mockResolvedValue(undefined);

      const result = await containerManager.mapToFirefoxContainer(mockContainer);

      expect(result).toBe(newFirefoxContainer.cookieStoreId);
      expect(browser.contextualIdentities.create).toHaveBeenCalledWith({
        name: mockContainer.name,
        color: mockContainer.color,
        icon: mockContainer.icon,
      });
      expect(mockStorageService.updateContainer).toHaveBeenCalledWith(
        mockContainer.id,
        { cookieStoreId: newFirefoxContainer.cookieStoreId }
      );
    });

    it('should remove temporary container when Firefox container missing', async () => {
      const tempContainer = {
        ...mockContainer,
        temporary: true,
      };

      (browser.contextualIdentities.get as jest.Mock).mockRejectedValue(
        new Error('Container not found')
      );
      mockStorageService.removeContainer = jest.fn().mockResolvedValue(undefined);

      await expect(
        containerManager.mapToFirefoxContainer(tempContainer)
      ).rejects.toThrow('Temporary container no longer exists and was removed');

      expect(mockStorageService.removeContainer).toHaveBeenCalledWith(tempContainer.id);
    });

    it('should throw error when recreation fails', async () => {
      (browser.contextualIdentities.get as jest.Mock).mockRejectedValue(
        new Error('Container not found')
      );
      (browser.contextualIdentities.create as jest.Mock).mockRejectedValue(
        new Error('Creation failed')
      );

      await expect(
        containerManager.mapToFirefoxContainer(mockContainer)
      ).rejects.toThrow('Creation failed');
    });
  });

  describe('event handlers', () => {
    it('should handle Firefox container creation', async () => {
      const listener = (browser.contextualIdentities.onCreated.addListener as jest.Mock)
        .mock.calls[0][0];

      mockStorageService.getContainers = jest.fn().mockResolvedValue([]);
      mockStorageService.setContainers = jest.fn();
      (browser.contextualIdentities.query as jest.Mock).mockResolvedValue([mockFirefoxContainer]);

      const syncSpy = jest.spyOn(containerManager, 'syncWithFirefox');

      await listener({ contextualIdentity: mockFirefoxContainer });

      expect(syncSpy).toHaveBeenCalled();

      syncSpy.mockRestore();
    });

    it('should handle Firefox container removal', async () => {
      const listener = (browser.contextualIdentities.onRemoved.addListener as jest.Mock)
        .mock.calls[0][0];

      mockStorageService.getContainers = jest.fn().mockResolvedValue([mockContainer]);
      mockStorageService.removeContainer = jest.fn();

      await listener({ contextualIdentity: { cookieStoreId: mockContainer.cookieStoreId } });

      expect(mockStorageService.removeContainer).toHaveBeenCalledWith(mockContainer.id);
    });

    it('should handle Firefox container update', async () => {
      const listener = (browser.contextualIdentities.onUpdated.addListener as jest.Mock)
        .mock.calls[0][0];

      mockStorageService.getContainers = jest.fn().mockResolvedValue([mockContainer]);
      mockStorageService.setContainers = jest.fn();
      (browser.contextualIdentities.query as jest.Mock).mockResolvedValue([mockFirefoxContainer]);

      const syncSpy = jest.spyOn(containerManager, 'syncWithFirefox');

      await listener({ contextualIdentity: mockFirefoxContainer });

      expect(syncSpy).toHaveBeenCalled();

      syncSpy.mockRestore();
    });
  });

  describe('cleanupTemporaryContainersAsync', () => {
    it('should call the private cleanup method', async () => {
      mockStorageService.getContainers = jest.fn().mockResolvedValue([]);

      await containerManager.cleanupTemporaryContainersAsync();

      expect(mockStorageService.getContainers).toHaveBeenCalled();
    });
  });

  describe('handleFirefoxContainerRemoved', () => {
    it('should remove container when found in storage', async () => {
      // Access private method through event listener
      const listener = (browser.contextualIdentities.onRemoved.addListener as jest.Mock)
        .mock.calls[0][0];

      mockStorageService.getContainers = jest.fn().mockResolvedValue([mockContainer]);
      mockStorageService.removeContainer = jest.fn().mockResolvedValue(undefined);

      await listener({ contextualIdentity: { cookieStoreId: mockContainer.cookieStoreId } });

      expect(mockStorageService.removeContainer).toHaveBeenCalledWith(mockContainer.id);
    });

    it('should do nothing when container not found in storage', async () => {
      const listener = (browser.contextualIdentities.onRemoved.addListener as jest.Mock)
        .mock.calls[0][0];

      mockStorageService.getContainers = jest.fn().mockResolvedValue([]);
      mockStorageService.removeContainer = jest.fn();

      await listener({ contextualIdentity: { cookieStoreId: 'unknown-container' } });

      expect(mockStorageService.removeContainer).not.toHaveBeenCalled();
    });
  });

  describe('utility methods', () => {
    it('should generate unique IDs', () => {
      const id1 = (containerManager as unknown as { generateId: () => string }).generateId();
      const id2 = (containerManager as unknown as { generateId: () => string }).generateId();

      expect(id1).toMatch(/^container_\d+_[a-z0-9]+$/);
      expect(id2).toMatch(/^container_\d+_[a-z0-9]+$/);
      expect(id1).not.toBe(id2);
    });

    it('should get random icon from default icons', () => {
      const icon = (containerManager as unknown as { getRandomIcon: () => string }).getRandomIcon();

      expect(DEFAULT_CONTAINER_ICONS).toContain(icon as typeof DEFAULT_CONTAINER_ICONS[number]);
    });

    it('should get random color from default colors', () => {
      const color = (containerManager as unknown as { getRandomColor: () => string }).getRandomColor();

      expect(DEFAULT_CONTAINER_COLORS).toContain(color as typeof DEFAULT_CONTAINER_COLORS[number]);
    });
  });
});