import { ContainerManager } from '@/background/services/ContainerManager';
import { Container, CreateContainerRequest } from '@/shared/types';
import browser from 'webextension-polyfill';
import StorageService from '@/background/services/StorageService';

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
    containerManager = ContainerManager.getInstance();

    // Mock browser.contextualIdentities API
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
  });

  describe('getInstance', () => {
    it('should return singleton instance', () => {
      const instance1 = ContainerManager.getInstance();
      const instance2 = ContainerManager.getInstance();
      expect(instance1).toBe(instance2);
    });

    it('should setup event listeners on creation', () => {
      const instance = ContainerManager.getInstance();
      expect(browser.contextualIdentities.onCreated.addListener).toHaveBeenCalled();
      expect(browser.contextualIdentities.onRemoved.addListener).toHaveBeenCalled();
      expect(browser.contextualIdentities.onUpdated.addListener).toHaveBeenCalled();
    });
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
        icon: request.icon,
        color: request.color,
        cookieStoreId: mockFirefoxContainer.cookieStoreId,
        temporary: false,
        syncEnabled: true,
      });

      expect(mockStorageService.addContainer).toHaveBeenCalledWith(
        expect.objectContaining({
          name: request.name,
          icon: request.icon,
          color: request.color,
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

    it('should use default values when not provided', async () => {
      const request: CreateContainerRequest = {
        name: 'Minimal Container',
      };

      (browser.contextualIdentities.create as jest.Mock).mockResolvedValue(mockFirefoxContainer);
      mockStorageService.addContainer = jest.fn().mockResolvedValue(undefined);

      const result = await containerManager.create(request);

      expect(browser.contextualIdentities.create).toHaveBeenCalledWith({
        name: request.name,
        color: 'blue',
        icon: 'circle',
      });
    });
  });

  describe('update', () => {
    it('should update an existing container', async () => {
      const updates = {
        name: 'Updated Name',
        color: 'green',
      };

      mockStorageService.getContainer = jest.fn().mockResolvedValue(mockContainer);
      mockStorageService.updateContainer = jest.fn().mockResolvedValue(undefined);
      (browser.contextualIdentities.update as jest.Mock).mockResolvedValue(mockFirefoxContainer);

      await containerManager.update(mockContainer.id, updates);

      expect(browser.contextualIdentities.update).toHaveBeenCalledWith(
        mockContainer.cookieStoreId,
        expect.objectContaining({
          name: updates.name,
          color: updates.color,
        })
      );

      expect(mockStorageService.updateContainer).toHaveBeenCalledWith(
        mockContainer.id,
        expect.objectContaining(updates)
      );
    });

    it('should throw error if container not found', async () => {
      mockStorageService.getContainer = jest.fn().mockResolvedValue(null);

      await expect(
        containerManager.update('non-existent', { name: 'Test' })
      ).rejects.toThrow('Container not found');
    });
  });

  describe('delete', () => {
    it('should delete a container and associated rules', async () => {
      mockStorageService.getContainer = jest.fn().mockResolvedValue(mockContainer);
      mockStorageService.deleteContainer = jest.fn().mockResolvedValue(undefined);
      mockStorageService.deleteRulesForContainer = jest.fn().mockResolvedValue(undefined);
      (browser.contextualIdentities.remove as jest.Mock).mockResolvedValue(mockFirefoxContainer);

      await containerManager.delete(mockContainer.id);

      expect(browser.contextualIdentities.remove).toHaveBeenCalledWith(
        mockContainer.cookieStoreId
      );
      expect(mockStorageService.deleteContainer).toHaveBeenCalledWith(mockContainer.id);
      expect(mockStorageService.deleteRulesForContainer).toHaveBeenCalledWith(mockContainer.id);
    });

    it('should not delete if container has active tabs', async () => {
      mockStorageService.getContainer = jest.fn().mockResolvedValue(mockContainer);
      (browser.tabs.query as jest.Mock).mockResolvedValue([{ id: 1 }]);

      await expect(containerManager.delete(mockContainer.id)).rejects.toThrow(
        'Cannot delete container with active tabs'
      );
    });
  });

  describe('get', () => {
    it('should retrieve a container by id', async () => {
      mockStorageService.getContainer = jest.fn().mockResolvedValue(mockContainer);

      const result = await containerManager.get(mockContainer.id);
      
      expect(result).toEqual(mockContainer);
      expect(mockStorageService.getContainer).toHaveBeenCalledWith(mockContainer.id);
    });

    it('should return null for non-existent container', async () => {
      mockStorageService.getContainer = jest.fn().mockResolvedValue(null);

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
      mockStorageService.addContainer = jest.fn().mockResolvedValue(undefined);

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
      mockStorageService.addContainer = jest.fn().mockResolvedValue(undefined);

      await containerManager.syncWithFirefox();

      expect(mockStorageService.addContainer).toHaveBeenCalledWith(
        expect.objectContaining({
          name: newFirefoxContainer.name,
          cookieStoreId: newFirefoxContainer.cookieStoreId,
        })
      );
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
      (browser.tabs.query as jest.Mock).mockResolvedValue([]);
      mockStorageService.deleteContainer = jest.fn().mockResolvedValue(undefined);
      (browser.contextualIdentities.remove as jest.Mock).mockResolvedValue(undefined);

      await (containerManager as any).cleanupTemporaryContainers();

      expect(browser.tabs.query).toHaveBeenCalledWith({
        cookieStoreId: tempContainer.cookieStoreId,
      });
      expect(mockStorageService.deleteContainer).toHaveBeenCalledWith(tempContainer.id);
      expect(browser.contextualIdentities.remove).toHaveBeenCalledWith(
        tempContainer.cookieStoreId
      );
    });

    it('should not remove temporary containers with active tabs', async () => {
      const tempContainer = {
        ...mockContainer,
        temporary: true,
        metadata: { lifetime: 'untilLastTab' },
      };

      mockStorageService.getContainers = jest.fn().mockResolvedValue([tempContainer]);
      (browser.tabs.query as jest.Mock).mockResolvedValue([{ id: 1 }]);

      await (containerManager as any).cleanupTemporaryContainers();

      expect(mockStorageService.deleteContainer).not.toHaveBeenCalled();
      expect(browser.contextualIdentities.remove).not.toHaveBeenCalled();
    });
  });

  describe('mapToFirefoxContainer', () => {
    it('should map container to Firefox container ID', async () => {
      const result = await containerManager.mapToFirefoxContainer(mockContainer);
      expect(result).toBe(mockContainer.cookieStoreId);
    });
  });

  describe('event handlers', () => {
    it('should handle Firefox container creation', async () => {
      const listener = (browser.contextualIdentities.onCreated.addListener as jest.Mock)
        .mock.calls[0][0];

      mockStorageService.getContainers = jest.fn().mockResolvedValue([]);
      (browser.contextualIdentities.query as jest.Mock).mockResolvedValue([mockFirefoxContainer]);
      mockStorageService.addContainer = jest.fn();

      await listener({ contextualIdentity: mockFirefoxContainer });

      expect(mockStorageService.getContainers).toHaveBeenCalled();
    });

    it('should handle Firefox container removal', async () => {
      const listener = (browser.contextualIdentities.onRemoved.addListener as jest.Mock)
        .mock.calls[0][0];

      mockStorageService.getContainers = jest.fn().mockResolvedValue([mockContainer]);
      mockStorageService.deleteContainer = jest.fn();
      mockStorageService.deleteRulesForContainer = jest.fn();

      await listener({ contextualIdentity: { cookieStoreId: mockContainer.cookieStoreId } });

      expect(mockStorageService.deleteContainer).toHaveBeenCalledWith(mockContainer.id);
      expect(mockStorageService.deleteRulesForContainer).toHaveBeenCalledWith(mockContainer.id);
    });

    it('should handle Firefox container update', async () => {
      const listener = (browser.contextualIdentities.onUpdated.addListener as jest.Mock)
        .mock.calls[0][0];

      mockStorageService.getContainers = jest.fn().mockResolvedValue([mockContainer]);
      (browser.contextualIdentities.query as jest.Mock).mockResolvedValue([mockFirefoxContainer]);

      await listener({ contextualIdentity: mockFirefoxContainer });

      expect(mockStorageService.getContainers).toHaveBeenCalled();
    });
  });
});