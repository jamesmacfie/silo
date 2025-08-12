/** @jest-environment jsdom */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BookmarkManager } from '@/ui/shared/components/BookmarkManager';
import { QueryProvider } from '@/ui/shared/providers/QueryProvider';
import browser from 'webextension-polyfill';

describe('BookmarkManager', () => {
  const mockBookmarks = [
    {
      id: 'bookmark-1',
      title: 'GitHub',
      url: 'https://github.com',
      parentId: 'folder-1',
    },
    {
      id: 'bookmark-2',
      title: 'GitLab',
      url: 'https://gitlab.com',
      parentId: 'folder-1',
    },
    {
      id: 'folder-1',
      title: 'Work',
      children: [],
      parentId: '0',
    },
  ];

  const mockContainers = [
    {
      id: 'container-1',
      name: 'Work',
      icon: 'briefcase',
      color: 'blue',
      cookieStoreId: 'firefox-container-1',
      created: Date.now(),
      modified: Date.now(),
      temporary: false,
      syncEnabled: true,
    },
    {
      id: 'container-2',
      name: 'Personal',
      icon: 'gift',
      color: 'red',
      cookieStoreId: 'firefox-container-2',
      created: Date.now(),
      modified: Date.now(),
      temporary: false,
      syncEnabled: true,
    },
  ];

  const mockAssociations = [
    {
      bookmarkId: 'bookmark-1',
      containerId: 'container-1',
      url: 'https://github.com',
      autoOpen: true,
      created: Date.now(),
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock browser bookmarks API
    global.browser.bookmarks = {
      getTree: jest.fn().mockResolvedValue([
        {
          id: '0',
          title: 'Root',
          children: mockBookmarks,
        },
      ]),
      get: jest.fn().mockResolvedValue(mockBookmarks),
      onCreated: { addListener: jest.fn(), removeListener: jest.fn() },
      onRemoved: { addListener: jest.fn(), removeListener: jest.fn() },
      onChanged: { addListener: jest.fn(), removeListener: jest.fn() },
      onMoved: { addListener: jest.fn(), removeListener: jest.fn() },
    } as any;

    // Mock runtime messages
    (browser.runtime.sendMessage as jest.Mock).mockImplementation((message) => {
      if (message.type === 'GET_CONTAINERS') {
        return Promise.resolve({ success: true, data: mockContainers });
      }
      if (message.type === 'GET_BOOKMARK_ASSOCIATIONS') {
        return Promise.resolve({ success: true, data: mockAssociations });
      }
      if (message.type === 'ASSOCIATE_BOOKMARK') {
        return Promise.resolve({ success: true });
      }
      if (message.type === 'DISASSOCIATE_BOOKMARK') {
        return Promise.resolve({ success: true });
      }
      if (message.type === 'BULK_ASSOCIATE_BOOKMARKS') {
        return Promise.resolve({ success: true });
      }
      return Promise.resolve({ success: false });
    });
  });

  const renderComponent = (props = {}) => {
    return render(
      <QueryProvider>
        <BookmarkManager {...props} />
      </QueryProvider>
    );
  };

  describe('initial render', () => {
    it('should display bookmark folders and bookmarks', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Work')).toBeInTheDocument();
        expect(screen.getByText('GitHub')).toBeInTheDocument();
        expect(screen.getByText('GitLab')).toBeInTheDocument();
      });
    });

    it('should show loading state initially', () => {
      renderComponent();
      expect(screen.getByText(/loading bookmarks/i)).toBeInTheDocument();
    });

    it('should handle bookmarks API error', async () => {
      (browser.bookmarks.getTree as jest.Mock).mockRejectedValue(
        new Error('Bookmarks API error')
      );

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText(/error loading bookmarks/i)).toBeInTheDocument();
      });
    });
  });

  describe('bookmark associations', () => {
    it('should show associated containers for bookmarks', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('GitHub')).toBeInTheDocument();
      });

      // GitHub should show Work container association
      expect(screen.getByText(/work/i)).toBeInTheDocument();
    });

    it('should allow associating bookmark with container', async () => {
      const user = userEvent.setup();
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('GitLab')).toBeInTheDocument();
      });

      // Click on unassociated bookmark
      const gitlabBookmark = screen.getByText('GitLab');
      const associateButton = gitlabBookmark
        .closest('[data-testid="bookmark-item"]')
        ?.querySelector('[data-testid="associate-button"]');

      if (associateButton) {
        await user.click(associateButton as Element);
      }

      // Select container from dropdown
      const containerSelect = screen.getByRole('combobox');
      await user.selectOptions(containerSelect, 'container-2');

      expect(browser.runtime.sendMessage).toHaveBeenCalledWith({
        type: 'ASSOCIATE_BOOKMARK',
        data: {
          bookmarkId: 'bookmark-2',
          containerId: 'container-2',
          url: 'https://gitlab.com',
          autoOpen: true,
        },
      });
    });

    it('should allow removing bookmark association', async () => {
      const user = userEvent.setup();
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('GitHub')).toBeInTheDocument();
      });

      const removeButton = screen.getByLabelText(/remove association/i);
      await user.click(removeButton);

      expect(browser.runtime.sendMessage).toHaveBeenCalledWith({
        type: 'DISASSOCIATE_BOOKMARK',
        data: { bookmarkId: 'bookmark-1' },
      });
    });

    it('should toggle auto-open setting', async () => {
      const user = userEvent.setup();
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('GitHub')).toBeInTheDocument();
      });

      const autoOpenToggle = screen.getByLabelText(/auto-open/i);
      await user.click(autoOpenToggle);

      expect(browser.runtime.sendMessage).toHaveBeenCalledWith({
        type: 'UPDATE_BOOKMARK_ASSOCIATION',
        data: {
          bookmarkId: 'bookmark-1',
          autoOpen: false,
        },
      });
    });
  });

  describe('bulk operations', () => {
    it('should allow bulk associating folder with container', async () => {
      const user = userEvent.setup();
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Work')).toBeInTheDocument();
      });

      const folderItem = screen.getByText('Work').closest('[data-testid="folder-item"]');
      const bulkAssociateButton = folderItem?.querySelector(
        '[data-testid="bulk-associate-button"]'
      );

      if (bulkAssociateButton) {
        await user.click(bulkAssociateButton as Element);
      }

      // Select container
      const containerSelect = screen.getByRole('combobox');
      await user.selectOptions(containerSelect, 'container-1');

      const confirmButton = screen.getByText(/associate all/i);
      await user.click(confirmButton);

      expect(browser.runtime.sendMessage).toHaveBeenCalledWith({
        type: 'BULK_ASSOCIATE_BOOKMARKS',
        data: {
          folderId: 'folder-1',
          containerId: 'container-1',
          includeSubfolders: true,
        },
      });
    });

    it('should show confirmation for bulk operations', async () => {
      const user = userEvent.setup();
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Work')).toBeInTheDocument();
      });

      const folderItem = screen.getByText('Work').closest('[data-testid="folder-item"]');
      const bulkAssociateButton = folderItem?.querySelector(
        '[data-testid="bulk-associate-button"]'
      );

      if (bulkAssociateButton) {
        await user.click(bulkAssociateButton as Element);
      }

      expect(
        screen.getByText(/associate all bookmarks in this folder/i)
      ).toBeInTheDocument();
      expect(screen.getByText(/this will affect \d+ bookmarks/i)).toBeInTheDocument();
    });

    it('should allow canceling bulk operations', async () => {
      const user = userEvent.setup();
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Work')).toBeInTheDocument();
      });

      const folderItem = screen.getByText('Work').closest('[data-testid="folder-item"]');
      const bulkAssociateButton = folderItem?.querySelector(
        '[data-testid="bulk-associate-button"]'
      );

      if (bulkAssociateButton) {
        await user.click(bulkAssociateButton as Element);
      }

      const cancelButton = screen.getByText(/cancel/i);
      await user.click(cancelButton);

      expect(screen.queryByText(/associate all bookmarks/i)).not.toBeInTheDocument();
    });
  });

  describe('filtering and search', () => {
    it('should filter bookmarks by search query', async () => {
      const user = userEvent.setup();
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('GitHub')).toBeInTheDocument();
        expect(screen.getByText('GitLab')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText(/search bookmarks/i);
      await user.type(searchInput, 'GitHub');

      await waitFor(() => {
        expect(screen.getByText('GitHub')).toBeInTheDocument();
        expect(screen.queryByText('GitLab')).not.toBeInTheDocument();
      });
    });

    it('should filter by container association', async () => {
      const user = userEvent.setup();
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('GitHub')).toBeInTheDocument();
      });

      const filterSelect = screen.getByLabelText(/filter by container/i);
      await user.selectOptions(filterSelect, 'container-1');

      // Should show only bookmarks associated with Work container
      expect(screen.getByText('GitHub')).toBeInTheDocument();
      expect(screen.queryByText('GitLab')).not.toBeInTheDocument();
    });

    it('should show unassociated bookmarks when filter is set', async () => {
      const user = userEvent.setup();
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('GitLab')).toBeInTheDocument();
      });

      const filterSelect = screen.getByLabelText(/filter by container/i);
      await user.selectOptions(filterSelect, 'unassociated');

      // Should show only unassociated bookmarks
      expect(screen.getByText('GitLab')).toBeInTheDocument();
      expect(screen.queryByText('GitHub')).not.toBeInTheDocument();
    });
  });

  describe('tree navigation', () => {
    it('should expand and collapse bookmark folders', async () => {
      const user = userEvent.setup();
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Work')).toBeInTheDocument();
      });

      const expandButton = screen.getByLabelText(/expand folder/i);
      await user.click(expandButton);

      expect(screen.getByText('GitHub')).toBeInTheDocument();
      expect(screen.getByText('GitLab')).toBeInTheDocument();

      // Click again to collapse
      const collapseButton = screen.getByLabelText(/collapse folder/i);
      await user.click(collapseButton);

      expect(screen.queryByText('GitHub')).not.toBeInTheDocument();
    });

    it('should show folder bookmark counts', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Work')).toBeInTheDocument();
      });

      expect(screen.getByText(/2 bookmarks/i)).toBeInTheDocument();
    });

    it('should handle nested folders', async () => {
      const nestedBookmarks = [
        {
          id: 'folder-1',
          title: 'Work',
          children: [
            {
              id: 'subfolder-1',
              title: 'Projects',
              children: [
                {
                  id: 'bookmark-1',
                  title: 'GitHub',
                  url: 'https://github.com',
                },
              ],
            },
          ],
        },
      ];

      (browser.bookmarks.getTree as jest.Mock).mockResolvedValue([
        { id: '0', title: 'Root', children: nestedBookmarks },
      ]);

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Work')).toBeInTheDocument();
        expect(screen.getByText('Projects')).toBeInTheDocument();
      });
    });
  });

  describe('error handling', () => {
    it('should handle association errors', async () => {
      (browser.runtime.sendMessage as jest.Mock).mockRejectedValue(
        new Error('Association failed')
      );

      const user = userEvent.setup();
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('GitLab')).toBeInTheDocument();
      });

      const associateButton = screen.getByTestId('associate-button');
      await user.click(associateButton);

      await waitFor(() => {
        expect(screen.getByText(/error associating bookmark/i)).toBeInTheDocument();
      });
    });

    it('should handle bulk operation errors', async () => {
      (browser.runtime.sendMessage as jest.Mock).mockImplementation((message) => {
        if (message.type === 'BULK_ASSOCIATE_BOOKMARKS') {
          return Promise.reject(new Error('Bulk operation failed'));
        }
        return Promise.resolve({ success: true, data: [] });
      });

      const user = userEvent.setup();
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Work')).toBeInTheDocument();
      });

      const bulkAssociateButton = screen.getByTestId('bulk-associate-button');
      await user.click(bulkAssociateButton);

      const confirmButton = screen.getByText(/associate all/i);
      await user.click(confirmButton);

      await waitFor(() => {
        expect(screen.getByText(/error performing bulk operation/i)).toBeInTheDocument();
      });
    });
  });

  describe('real-time updates', () => {
    it('should update when bookmarks are added', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('GitHub')).toBeInTheDocument();
      });

      // Simulate bookmark added event
      const onCreatedListener = (browser.bookmarks.onCreated.addListener as jest.Mock)
        .mock.calls[0][0];

      onCreatedListener('bookmark-3', {
        id: 'bookmark-3',
        title: 'New Bookmark',
        url: 'https://new.com',
        parentId: 'folder-1',
      });

      await waitFor(() => {
        expect(screen.getByText('New Bookmark')).toBeInTheDocument();
      });
    });

    it('should update when bookmarks are removed', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('GitHub')).toBeInTheDocument();
      });

      // Simulate bookmark removed event
      const onRemovedListener = (browser.bookmarks.onRemoved.addListener as jest.Mock)
        .mock.calls[0][0];

      onRemovedListener('bookmark-1', {
        parentId: 'folder-1',
        index: 0,
        node: mockBookmarks[0],
      });

      await waitFor(() => {
        expect(screen.queryByText('GitHub')).not.toBeInTheDocument();
      });
    });
  });

  describe('accessibility', () => {
    it('should have proper ARIA labels', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByLabelText(/bookmark tree/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/search bookmarks/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/filter by container/i)).toBeInTheDocument();
      });
    });

    it('should support keyboard navigation', async () => {
      const user = userEvent.setup();
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Work')).toBeInTheDocument();
      });

      const folderItem = screen.getByText('Work');
      folderItem.focus();

      await user.keyboard('{Enter}');
      
      expect(screen.getByText('GitHub')).toBeInTheDocument();
    });
  });
});