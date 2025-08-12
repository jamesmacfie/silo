/** @jest-environment jsdom */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PopupApp } from '@/ui/popup/components/PopupApp';
import { QueryProvider } from '@/ui/shared/providers/QueryProvider';
import { ThemeProvider } from '@/ui/shared/contexts/ThemeContext';
import browser from 'webextension-polyfill';

// Mock child components
jest.mock('@/ui/popup/components/ContainerSelector', () => ({
  ContainerSelector: ({ onSelect }: any) => (
    <div data-testid="container-selector" onClick={() => onSelect({ id: '1', name: 'Test' })}>
      Container Selector
    </div>
  ),
}));

jest.mock('@/ui/shared/components/RuleItem', () => ({
  RuleItem: ({ rule, onEdit, onDelete }: any) => (
    <div data-testid={`rule-${rule.id}`}>
      {rule.pattern}
      <button onClick={() => onEdit(rule)}>Edit</button>
      <button onClick={() => onDelete(rule.id)}>Delete</button>
    </div>
  ),
}));

describe('PopupApp', () => {
  const mockCurrentTab = {
    id: 1,
    url: 'https://example.com/test',
    title: 'Example Page',
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

  const mockRules = [
    {
      id: 'rule-1',
      pattern: 'github.com',
      containerId: 'container-1',
      matchType: 'domain',
      ruleType: 'include',
      priority: 1,
      enabled: true,
      created: Date.now(),
      modified: Date.now(),
      metadata: {},
    },
    {
      id: 'rule-2',
      pattern: '*.example.com',
      containerId: 'container-1',
      matchType: 'glob',
      ruleType: 'include',
      priority: 2,
      enabled: true,
      created: Date.now(),
      modified: Date.now(),
      metadata: {},
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock browser APIs
    (browser.tabs.query as jest.Mock).mockResolvedValue([mockCurrentTab]);
    (browser.runtime.sendMessage as jest.Mock).mockImplementation((message) => {
      if (message.type === 'GET_CONTAINERS') {
        return Promise.resolve({ success: true, data: mockContainers });
      }
      if (message.type === 'GET_RULES') {
        return Promise.resolve({ success: true, data: mockRules });
      }
      if (message.type === 'ADD_RULE') {
        return Promise.resolve({ success: true, data: { ...message.data, id: 'new-rule' } });
      }
      if (message.type === 'UPDATE_RULE') {
        return Promise.resolve({ success: true });
      }
      if (message.type === 'DELETE_RULE') {
        return Promise.resolve({ success: true });
      }
      return Promise.resolve({ success: false });
    });

    // Mock browser storage
    global.browser.storage = {
      local: {
        get: jest.fn().mockResolvedValue({
          theme: 'auto',
          preferences: {
            keepOldTabs: false,
            matchDomainOnly: false,
          },
        }),
        set: jest.fn().mockResolvedValue(undefined),
      },
      onChanged: {
        addListener: jest.fn(),
        removeListener: jest.fn(),
      },
    } as any;
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
    it('should display current tab information', async () => {
      renderApp();

      await waitFor(() => {
        expect(screen.getByText(/example\.com/i)).toBeInTheDocument();
      });
    });

    it('should show container selector', async () => {
      renderApp();

      await waitFor(() => {
        expect(screen.getByTestId('container-selector')).toBeInTheDocument();
      });
    });

    it('should display loading state initially', () => {
      renderApp();
      expect(screen.getByText(/loading/i)).toBeInTheDocument();
    });

    it('should handle error when fetching current tab fails', async () => {
      (browser.tabs.query as jest.Mock).mockRejectedValue(new Error('Tab query failed'));

      renderApp();

      await waitFor(() => {
        expect(screen.queryByText(/example\.com/i)).not.toBeInTheDocument();
      });
    });
  });

  describe('quick actions', () => {
    it('should add current domain to selected container', async () => {
      const user = userEvent.setup();
      renderApp();

      await waitFor(() => {
        expect(screen.getByText(/add current domain/i)).toBeInTheDocument();
      });

      const addButton = screen.getByText(/add current domain/i);
      await user.click(addButton);

      await waitFor(() => {
        expect(browser.runtime.sendMessage).toHaveBeenCalledWith({
          type: 'ADD_RULE',
          data: expect.objectContaining({
            pattern: 'example.com',
            containerId: expect.any(String),
          }),
        });
      });
    });

    it('should open current URL in different container', async () => {
      const user = userEvent.setup();
      renderApp();

      await waitFor(() => {
        expect(screen.getByTestId('container-selector')).toBeInTheDocument();
      });

      const selector = screen.getByTestId('container-selector');
      await user.click(selector);

      expect(browser.runtime.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'OPEN_IN_CONTAINER',
        })
      );
    });

    it('should handle quick action errors gracefully', async () => {
      (browser.runtime.sendMessage as jest.Mock).mockRejectedValue(
        new Error('Message failed')
      );

      const user = userEvent.setup();
      renderApp();

      await waitFor(() => {
        expect(screen.getByText(/add current domain/i)).toBeInTheDocument();
      });

      const addButton = screen.getByText(/add current domain/i);
      await user.click(addButton);

      // Should not crash the app
      await waitFor(() => {
        expect(screen.getByTestId('container-selector')).toBeInTheDocument();
      });
    });
  });

  describe('rules management', () => {
    it('should display rules for selected container', async () => {
      renderApp();

      await waitFor(() => {
        expect(screen.getByTestId('rule-rule-1')).toBeInTheDocument();
        expect(screen.getByTestId('rule-rule-2')).toBeInTheDocument();
      });

      expect(screen.getByText('github.com')).toBeInTheDocument();
      expect(screen.getByText('*.example.com')).toBeInTheDocument();
    });

    it('should allow editing a rule', async () => {
      const user = userEvent.setup();
      renderApp();

      await waitFor(() => {
        expect(screen.getByTestId('rule-rule-1')).toBeInTheDocument();
      });

      const editButton = screen.getAllByText('Edit')[0];
      await user.click(editButton);

      // Should trigger edit modal/form
      expect(browser.runtime.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'UPDATE_RULE',
        })
      );
    });

    it('should allow deleting a rule', async () => {
      const user = userEvent.setup();
      renderApp();

      await waitFor(() => {
        expect(screen.getByTestId('rule-rule-1')).toBeInTheDocument();
      });

      const deleteButton = screen.getAllByText('Delete')[0];
      await user.click(deleteButton);

      expect(browser.runtime.sendMessage).toHaveBeenCalledWith({
        type: 'DELETE_RULE',
        data: { id: 'rule-1' },
      });
    });

    it('should filter rules by selected container', async () => {
      const filteredRules = [mockRules[0]]; // Only Work container rules
      (browser.runtime.sendMessage as jest.Mock).mockImplementation((message) => {
        if (message.type === 'GET_RULES' && message.data?.containerId === 'container-1') {
          return Promise.resolve({ success: true, data: filteredRules });
        }
        return Promise.resolve({ success: true, data: [] });
      });

      renderApp();

      await waitFor(() => {
        expect(screen.getByTestId('rule-rule-1')).toBeInTheDocument();
        expect(screen.queryByTestId('rule-rule-2')).not.toBeInTheDocument();
      });
    });

    it('should show empty state when no rules', async () => {
      (browser.runtime.sendMessage as jest.Mock).mockImplementation((message) => {
        if (message.type === 'GET_RULES') {
          return Promise.resolve({ success: true, data: [] });
        }
        return Promise.resolve({ success: true, data: mockContainers });
      });

      renderApp();

      await waitFor(() => {
        expect(screen.getByText(/no rules configured/i)).toBeInTheDocument();
      });
    });
  });

  describe('search functionality', () => {
    it('should filter domains by search input', async () => {
      const user = userEvent.setup();
      renderApp();

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/search domains/i)).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText(/search domains/i);
      await user.type(searchInput, 'github');

      await waitFor(() => {
        expect(screen.getByTestId('rule-rule-1')).toBeInTheDocument();
        expect(screen.queryByTestId('rule-rule-2')).not.toBeInTheDocument();
      });
    });

    it('should clear search when X is clicked', async () => {
      const user = userEvent.setup();
      renderApp();

      const searchInput = screen.getByPlaceholderText(/search domains/i);
      await user.type(searchInput, 'test');

      const clearButton = screen.getByLabelText(/clear search/i);
      await user.click(clearButton);

      expect(searchInput).toHaveValue('');
    });
  });

  describe('navigation', () => {
    it('should open settings page', async () => {
      const user = userEvent.setup();
      renderApp();

      await waitFor(() => {
        expect(screen.getByLabelText(/settings/i)).toBeInTheDocument();
      });

      const settingsButton = screen.getByLabelText(/settings/i);
      await user.click(settingsButton);

      expect(browser.runtime.openOptionsPage).toHaveBeenCalled();
    });

    it('should navigate to manage containers', async () => {
      const user = userEvent.setup();
      renderApp();

      await waitFor(() => {
        expect(screen.getByText(/manage containers/i)).toBeInTheDocument();
      });

      const manageButton = screen.getByText(/manage containers/i);
      await user.click(manageButton);

      expect(browser.tabs.create).toHaveBeenCalledWith({
        url: expect.stringContaining('options.html#containers'),
      });
    });
  });

  describe('keyboard shortcuts', () => {
    it('should focus search on / key', async () => {
      const user = userEvent.setup();
      renderApp();

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/search domains/i)).toBeInTheDocument();
      });

      await user.keyboard('/');

      expect(screen.getByPlaceholderText(/search domains/i)).toHaveFocus();
    });

    it('should close popup on Escape', async () => {
      window.close = jest.fn();
      const user = userEvent.setup();
      renderApp();

      await user.keyboard('{Escape}');

      expect(window.close).toHaveBeenCalled();
    });
  });

  describe('responsive behavior', () => {
    it('should handle narrow popup window', () => {
      // Mock narrow window
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 300,
      });

      renderApp();

      // Should still render without crashing
      expect(screen.getByTestId('container-selector')).toBeInTheDocument();
    });
  });

  describe('error handling', () => {
    it('should display error message when API calls fail', async () => {
      (browser.runtime.sendMessage as jest.Mock).mockRejectedValue(
        new Error('API Error')
      );

      renderApp();

      await waitFor(() => {
        expect(screen.getByText(/error loading data/i)).toBeInTheDocument();
      });
    });

    it('should retry failed requests', async () => {
      let callCount = 0;
      (browser.runtime.sendMessage as jest.Mock).mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.reject(new Error('First attempt failed'));
        }
        return Promise.resolve({ success: true, data: mockContainers });
      });

      renderApp();

      const retryButton = await screen.findByText(/retry/i);
      fireEvent.click(retryButton);

      await waitFor(() => {
        expect(screen.getByTestId('container-selector')).toBeInTheDocument();
      });
    });
  });

  describe('real-time updates', () => {
    it('should update when storage changes', async () => {
      renderApp();

      const storageListener = (browser.storage.onChanged.addListener as jest.Mock)
        .mock.calls[0][0];

      // Simulate storage change
      storageListener({
        theme: { newValue: 'dark', oldValue: 'light' },
      });

      await waitFor(() => {
        expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
      });
    });
  });
});