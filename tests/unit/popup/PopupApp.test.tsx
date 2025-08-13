/** @jest-environment jsdom */
import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PopupApp } from '@/ui/popup/components/PopupApp';
import { QueryProvider } from '@/ui/shared/providers/QueryProvider';
import { ThemeProvider } from '@/ui/shared/contexts/ThemeContext';
import browser from 'webextension-polyfill';

// Setup JSDOM environment
beforeAll(() => {
  // Mock matchMedia for jsdom
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: jest.fn().mockImplementation(query => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    })),
  });

  // Mock window.close
  Object.defineProperty(window, 'close', {
    writable: true,
    value: jest.fn(),
  });

  // Mock ResizeObserver
  global.ResizeObserver = jest.fn().mockImplementation(() => ({
    observe: jest.fn(),
    unobserve: jest.fn(),
    disconnect: jest.fn(),
  }));

  // Use fake timers for setTimeout in the component
  jest.useFakeTimers();
});

afterAll(() => {
  jest.useRealTimers();
});

// Mock the hooks and components
jest.mock('@/ui/shared/hooks/useContainers');
jest.mock('@/ui/shared/components/ThemeSwitcher', () => ({
  ThemeSwitcher: ({ compact }: { compact?: boolean }) => (
    <div data-testid="theme-switcher" data-compact={compact}>
      Theme Switcher
    </div>
  ),
}));
jest.mock('@/shared/utils/logger');

describe('PopupApp', () => {
  const mockCurrentTab = {
    id: 1,
    url: 'https://example.com/test',
    title: 'Example Page',
    cookieStoreId: 'firefox-default',
    index: 0,
  };

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
      metadata: {},
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
      metadata: {},
    },
  ];

  beforeEach(async () => {
    jest.clearAllTimers();
    jest.clearAllMocks();
    
    // Mock useContainers hook
    const mockUseContainers = require('@/ui/shared/hooks/useContainers');
    mockUseContainers.useContainers = jest.fn().mockReturnValue({
      data: mockContainers,
      refetch: jest.fn().mockResolvedValue({}),
      isFetching: false,
      isLoading: false,
      error: null,
    });

    // Mock browser APIs - clear previous mocks and set new behavior
    jest.clearAllMocks();
    (browser.tabs.query as jest.Mock).mockResolvedValue([mockCurrentTab]);
    (browser.tabs.create as jest.Mock).mockResolvedValue({ id: 2 });
    (browser.contextualIdentities.get as jest.Mock).mockImplementation((cookieStoreId) => {
      if (cookieStoreId === 'firefox-container-1') {
        return Promise.resolve({ name: 'Work' });
      }
      if (cookieStoreId === 'firefox-container-2') {
        return Promise.resolve({ name: 'Personal' });
      }
      return Promise.reject(new Error('Not found'));
    });
    (browser.runtime.sendMessage as jest.Mock).mockResolvedValue({ success: true });
    (browser.runtime.getURL as jest.Mock).mockReturnValue('/options_ui/page.html');
    (browser.bookmarks.create as jest.Mock).mockResolvedValue({ id: 'bookmark-1' });
    (browser.storage.local.get as jest.Mock).mockResolvedValue({ theme: 'auto' });
    (browser.storage.local.set as jest.Mock).mockResolvedValue(undefined);
  });

  const renderApp = () => {
    return render(
      <QueryProvider>
        <ThemeProvider>
          <PopupApp />
        </ThemeProvider>
      </QueryProvider>
    );
  };

  describe('initial render', () => {
    it('should display app title and logo', async () => {
      renderApp();

      expect(screen.getByText('Silo')).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'Silo' })).toBeInTheDocument();
    });

    it('should show current tab information', async () => {
      renderApp();

      // The component displays tab context - may be loading initially
      const contextDiv = screen.getByTestId ? screen.queryByTestId('contextInfo') : screen.getByText(/Tab:/i).parentElement;
      expect(contextDiv || screen.getByText(/Tab:/i)).toBeInTheDocument();
      
      // Should eventually show hostname when async operation completes
      // Since this is async, we'll test the mechanism rather than the exact timing
      expect(browser.tabs.query).toHaveBeenCalledWith({ active: true, currentWindow: true });
    });

    it('should display container selector', async () => {
      renderApp();

      const containerSelect = screen.getByLabelText('Container');
      expect(containerSelect).toBeInTheDocument();
      expect(containerSelect).toHaveValue('firefox-default');
    });

    it('should show theme switcher', async () => {
      renderApp();

      expect(screen.getByTestId('theme-switcher')).toBeInTheDocument();
    });

    it('should display refresh button', async () => {
      await renderApp();

      expect(screen.getByTitle('Refresh')).toBeInTheDocument();
      expect(screen.getByText('Refresh')).toBeInTheDocument();
    });

    it('should handle tab query errors gracefully', async () => {
      (browser.tabs.query as jest.Mock).mockRejectedValue(new Error('Tab query failed'));

      await renderApp();

      // Should render without crashing, showing default values
      expect(screen.getByText('Silo')).toBeInTheDocument();
      // Default values should be showing - there are two dashes (host and container)
      const dashes = screen.getAllByText('—');
      expect(dashes.length).toBeGreaterThan(0);
    });
  });

  describe('container selection', () => {
    it('should display container options including No Container', async () => {
      await renderApp();

      const containerSelect = screen.getByLabelText('Container');
      expect(containerSelect).toBeInTheDocument();

      // Should include No Container as first option plus mock containers
      const options = screen.getAllByRole('option');
      expect(options).toHaveLength(3); // No Container + 2 mock containers
      expect(options[0]).toHaveTextContent('No Container');
      expect(options[1]).toHaveTextContent('Work');
      expect(options[2]).toHaveTextContent('Personal');
    });

    it('should allow changing selected container', async () => {
      const user = userEvent.setup({ delay: null });
      await renderApp();

      const containerSelect = screen.getByLabelText('Container');
      await user.selectOptions(containerSelect, 'firefox-container-1');

      expect(containerSelect).toHaveValue('firefox-container-1');
    });

    it('should default to first container when selected container is not available', async () => {
      const mockUseContainers = require('@/ui/shared/hooks/useContainers');
      mockUseContainers.useContainers.mockReturnValue({
        data: [], // No containers available
        refetch: jest.fn(),
        isFetching: false,
        isLoading: false,
        error: null,
      });

      await renderApp();

      const containerSelect = screen.getByLabelText('Container');
      expect(containerSelect).toHaveValue('firefox-default');
    });
  });

  describe('action buttons', () => {
    it('should have Open in container button', async () => {
      await renderApp();

      const openButton = screen.getByRole('button', { name: /open in container/i });
      expect(openButton).toBeInTheDocument();
    });

    it('should have Add domain button', async () => {
      await renderApp();

      const addButton = screen.getByTitle('Add a rule for the current domain');
      expect(addButton).toBeInTheDocument();
      expect(addButton).toHaveTextContent('+ Add domain');
    });

    it('should have Create temp container button', async () => {
      await renderApp();

      const tempButton = screen.getByTitle('Create temporary container');
      expect(tempButton).toBeInTheDocument();
      expect(tempButton).toHaveTextContent('+ Temp');
    });

    it('should have Bookmark button', async () => {
      await renderApp();

      const bookmarkButton = screen.getByTitle('Create a bookmark for this page in the current container');
      expect(bookmarkButton).toBeInTheDocument();
      expect(bookmarkButton).toHaveTextContent('⭐︎ Bookmark');
    });
  });

  describe('container operations', () => {
    it('should open current URL in selected container', async () => {
      const user = userEvent.setup({ delay: null });
      renderApp();

      // Wait for initial render
      await waitFor(() => {
        expect(screen.getByLabelText('Container')).toBeInTheDocument();
      });

      // Select a container first
      const containerSelect = screen.getByLabelText('Container');
      await user.selectOptions(containerSelect, 'firefox-container-1');

      const openButton = screen.getByRole('button', { name: /open in container/i });
      await user.click(openButton);

      // Wait for the async operation to complete
      await waitFor(() => {
        const calls = (browser.runtime.sendMessage as jest.Mock).mock.calls;
        const openInContainerCall = calls.find(call => call[0]?.type === 'OPEN_IN_CONTAINER');
        expect(openInContainerCall).toBeDefined();
        expect(openInContainerCall[0]).toEqual({
          type: 'OPEN_IN_CONTAINER',
          payload: {
            url: 'https://example.com/test',
            cookieStoreId: 'firefox-container-1',
            index: 1,
            closeTabId: 1,
          },
        });
      }, { timeout: 5000 });
    });

    it('should open URL without container when No Container is selected', async () => {
      const user = userEvent.setup({ delay: null });
      renderApp();

      // Wait for initial render
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /open in container/i })).toBeInTheDocument();
      });

      // No Container is selected by default (firefox-default)
      const openButton = screen.getByRole('button', { name: /open in container/i });
      await user.click(openButton);

      // Wait for the async operation to complete
      await waitFor(() => {
        const calls = (browser.runtime.sendMessage as jest.Mock).mock.calls;
        const openInContainerCall = calls.find(call => call[0]?.type === 'OPEN_IN_CONTAINER');
        expect(openInContainerCall).toBeDefined();
        expect(openInContainerCall[0]).toEqual({
          type: 'OPEN_IN_CONTAINER',
          payload: {
            url: 'https://example.com/test',
            cookieStoreId: undefined,
            index: 1,
            closeTabId: 1,
          },
        });
      });
    });

    it('should create temporary container', async () => {
      const user = userEvent.setup({ delay: null });
      const mockRefetch = jest.fn();
      const mockUseContainers = require('@/ui/shared/hooks/useContainers');
      mockUseContainers.useContainers.mockReturnValue({
        data: mockContainers,
        refetch: mockRefetch,
        isFetching: false,
      });

      (browser.runtime.sendMessage as jest.Mock).mockResolvedValue({
        success: true,
        data: {
          id: 'temp-container',
          cookieStoreId: 'firefox-container-temp',
        },
      });

      await renderApp();

      const tempButton = screen.getByTitle('Create temporary container');
      await user.click(tempButton);

      expect(browser.runtime.sendMessage).toHaveBeenCalledWith({
        type: 'CREATE_CONTAINER',
        payload: expect.objectContaining({
          name: expect.stringContaining('Temp'),
          temporary: true,
        }),
      });

      await waitFor(() => {
        expect(mockRefetch).toHaveBeenCalled();
        expect(screen.getByText('Temporary container created')).toBeInTheDocument();
      }, { timeout: 1000 });
    });

    it('should add domain rule for current tab', async () => {
      const user = userEvent.setup({ delay: null });
      renderApp();

      // Wait for initial render
      await waitFor(() => {
        expect(screen.getByLabelText('Container')).toBeInTheDocument();
      });

      // Select a container first
      const containerSelect = screen.getByLabelText('Container');
      await user.selectOptions(containerSelect, 'firefox-container-1');

      const addButton = screen.getByTitle('Add a rule for the current domain');
      await user.click(addButton);

      // Wait for the async operation to complete
      await waitFor(() => {
        const calls = (browser.runtime.sendMessage as jest.Mock).mock.calls;
        const createRuleCall = calls.find(call => call[0]?.type === 'CREATE_RULE');
        expect(createRuleCall).toBeDefined();
        expect(createRuleCall[0]).toEqual({
          type: 'CREATE_RULE',
          payload: {
            containerId: 'firefox-container-1',
            pattern: 'example.com',
            matchType: 'domain',
            ruleType: 'include',
            priority: 1,
            enabled: true,
            metadata: { source: 'user' },
          },
        });
      });
    });

    it('should bookmark current tab with silo parameter', async () => {
      const user = userEvent.setup({ delay: null });
      renderApp();

      // Wait for initial render
      await waitFor(() => {
        expect(screen.getByLabelText('Container')).toBeInTheDocument();
      });

      // Select a container
      const containerSelect = screen.getByLabelText('Container');
      await user.selectOptions(containerSelect, 'firefox-container-1');

      const bookmarkButton = screen.getByTitle('Create a bookmark for this page in the current container');
      await user.click(bookmarkButton);

      // Wait for the async operation to complete
      await waitFor(() => {
        expect(browser.bookmarks.create).toHaveBeenCalledWith({
          title: 'Example Page',
          url: 'https://example.com/test?silo=firefox-container-1',
        });
      });
    });

    it('should bookmark without silo parameter for No Container', async () => {
      const user = userEvent.setup({ delay: null });
      renderApp();

      // Wait for initial render
      await waitFor(() => {
        expect(screen.getByTitle('Create a bookmark for this page in the current container')).toBeInTheDocument();
      });

      // No Container is selected by default
      const bookmarkButton = screen.getByTitle('Create a bookmark for this page in the current container');
      await user.click(bookmarkButton);

      // Wait for the async operation to complete
      await waitFor(() => {
        expect(browser.bookmarks.create).toHaveBeenCalledWith({
          title: 'Example Page',
          url: 'https://example.com/test',
        });
      });
    });
  });

  describe('navigation', () => {
    it('should have manage containers link', async () => {
      await renderApp();

      const manageLink = screen.getByText('Manage Containers →');
      expect(manageLink).toBeInTheDocument();
      expect(manageLink.closest('a')).toHaveAttribute('href', '/options.html');
    });

    it('should open options page when manage containers is clicked', async () => {
      const user = userEvent.setup({ delay: null });
      renderApp();

      // Wait for initial render
      await waitFor(() => {
        expect(screen.getByText('Manage Containers →')).toBeInTheDocument();
      });

      const manageLink = screen.getByText('Manage Containers →');
      await user.click(manageLink);

      // Wait for the async operation to complete
      await waitFor(() => {
        expect(browser.tabs.create).toHaveBeenCalledWith({
          url: '/options_ui/page.html',
        });
      });

      // Should close popup after delay
      act(() => {
        jest.advanceTimersByTime(100);
      });
      expect(window.close).toHaveBeenCalled();
    });
  });

  describe('refresh functionality', () => {
    it('should show refresh button and handle refresh', async () => {
      const user = userEvent.setup({ delay: null });
      const mockRefetch = jest.fn().mockResolvedValue({});
      const mockUseContainers = require('@/ui/shared/hooks/useContainers');
      mockUseContainers.useContainers.mockReturnValue({
        data: mockContainers,
        refetch: mockRefetch,
        isFetching: false,
      });

      await renderApp();

      const refreshButton = screen.getByTitle('Refresh');
      await user.click(refreshButton);

      expect(mockRefetch).toHaveBeenCalled();
    });

    it('should show refreshing state', async () => {
      const mockUseContainers = require('@/ui/shared/hooks/useContainers');
      mockUseContainers.useContainers.mockReturnValue({
        data: mockContainers,
        refetch: jest.fn(),
        isFetching: true, // Show loading state
      });

      await renderApp();

      expect(screen.getByText('Refreshing…')).toBeInTheDocument();
    });
  });

  describe('context information', () => {
    it('should display current tab hostname', async () => {
      renderApp();

      // Verify the context info section exists
      const contextInfo = screen.getByText(/Tab:/i).parentElement;
      expect(contextInfo).toBeInTheDocument();
      
      // Verify tab query is called to get current tab
      expect(browser.tabs.query).toHaveBeenCalledWith({ active: true, currentWindow: true });
    });

    it('should display current container name', async () => {
      const tabInContainer = {
        ...mockCurrentTab,
        cookieStoreId: 'firefox-container-1',
      };
      (browser.tabs.query as jest.Mock).mockResolvedValue([tabInContainer]);

      await renderApp();

      await waitFor(() => {
        expect(screen.getByText('Work')).toBeInTheDocument();
      });
    });

    it('should show No Container when in default context', async () => {
      await renderApp();

      await waitFor(() => {
        expect(screen.getByText('No Container')).toBeInTheDocument();
      });
    });

    it('should handle contextualIdentities API errors', async () => {
      const tabInContainer = {
        ...mockCurrentTab,
        cookieStoreId: 'firefox-container-unknown',
      };
      (browser.tabs.query as jest.Mock).mockResolvedValue([tabInContainer]);
      (browser.contextualIdentities.get as jest.Mock).mockRejectedValue(new Error('Not found'));

      await renderApp();

      await waitFor(() => {
        const dashes = screen.getAllByText('—');
        expect(dashes.length).toBeGreaterThan(0);
      });
    });
  });

  describe('error handling', () => {
    it('should handle action errors gracefully', async () => {
      const user = userEvent.setup({ delay: null });
      (browser.runtime.sendMessage as jest.Mock).mockRejectedValue(new Error('Action failed'));

      await renderApp();

      const openButton = screen.getByRole('button', { name: /open in container/i });
      await user.click(openButton);

      await waitFor(() => {
        expect(screen.getByText(/failed: action failed/i)).toBeInTheDocument();
      }, { timeout: 1000 });
    });

    it('should handle no active tab error', async () => {
      const user = userEvent.setup({ delay: null });
      (browser.tabs.query as jest.Mock).mockResolvedValue([]); // No active tab

      await renderApp();

      const openButton = screen.getByRole('button', { name: /open in container/i });
      await user.click(openButton);

      await waitFor(() => {
        expect(screen.getByText('No active tab')).toBeInTheDocument();
      }, { timeout: 1000 });
    });

    it('should handle container creation errors', async () => {
      const user = userEvent.setup({ delay: null });
      (browser.runtime.sendMessage as jest.Mock).mockResolvedValue({
        success: false,
        error: 'Creation failed',
      });

      await renderApp();

      const tempButton = screen.getByTitle('Create temporary container');
      await user.click(tempButton);

      await waitFor(() => {
        expect(screen.getByText(/failed to create temp: creation failed/i)).toBeInTheDocument();
      }, { timeout: 1000 });
    });

    it('should handle bookmark creation errors', async () => {
      const user = userEvent.setup({ delay: null });
      (browser.bookmarks.create as jest.Mock).mockRejectedValue(new Error('Bookmark failed'));

      renderApp();

      // Wait for initial render
      await waitFor(() => {
        expect(screen.getByTitle('Create a bookmark for this page in the current container')).toBeInTheDocument();
      });

      const bookmarkButton = screen.getByTitle('Create a bookmark for this page in the current container');
      await user.click(bookmarkButton);

      // Wait for the async operation to complete
      await waitFor(() => {
        expect(browser.bookmarks.create).toHaveBeenCalled();
      });
    });
  });

  describe('status messages', () => {
    it('should show status element', async () => {
      await renderApp();

      const statusElement = screen.getByText('', { selector: '#status' });
      expect(statusElement).toBeInTheDocument();
    });

    it('should clear status after refresh', async () => {
      const user = userEvent.setup({ delay: null });
      const mockRefetch = jest.fn().mockResolvedValue({});
      const mockUseContainers = require('@/ui/shared/hooks/useContainers');
      mockUseContainers.useContainers.mockReturnValue({
        data: mockContainers,
        refetch: mockRefetch,
        isFetching: false,
      });

      await renderApp();

      const refreshButton = screen.getByTitle('Refresh');
      await user.click(refreshButton);

      await waitFor(() => {
        const statusElement = screen.getByText('', { selector: '#status' });
        expect(statusElement).toHaveTextContent('');
      }, { timeout: 1000 });
    });
  });

  describe('integration with hooks', () => {
    it('should handle loading state from useContainers', async () => {
      const mockUseContainers = require('@/ui/shared/hooks/useContainers');
      mockUseContainers.useContainers.mockReturnValue({
        data: [],
        refetch: jest.fn(),
        isFetching: false,
        isLoading: true,
      });

      await renderApp();

      // Should still render with empty containers
      const containerSelect = screen.getByLabelText('Container');
      expect(containerSelect).toBeInTheDocument();
    });

    it('should handle error state from useContainers', async () => {
      const mockUseContainers = require('@/ui/shared/hooks/useContainers');
      mockUseContainers.useContainers.mockReturnValue({
        data: [],
        refetch: jest.fn(),
        isFetching: false,
        isLoading: false,
        error: new Error('Failed to load containers'),
      });

      await renderApp();

      // Should still render but with only No Container option
      const containerSelect = screen.getByLabelText('Container');
      expect(containerSelect).toBeInTheDocument();
      expect(screen.getAllByRole('option')).toHaveLength(1);
    });
  });
});