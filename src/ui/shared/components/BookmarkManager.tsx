import React from 'react';
import browser from 'webextension-polyfill';
import type { Container, BookmarkAssociation } from '@/shared/types';
import { useBookmarkAssociations, useBookmarkActions, useBookmarksTree } from '../hooks/useBookmarks';

interface Props {
  containers?: Container[];
}

interface BookmarkWithAssociation extends browser.Bookmarks.BookmarkTreeNode {
  association?: BookmarkAssociation;
  containerName?: string;
}

export function BookmarkManager({ containers = [] }: Props): JSX.Element {
  const { data: associations = [], isLoading: associationsLoading, error: associationsError } = useBookmarkAssociations();
  const { data: bookmarksTree = [], isLoading: treeLoading, error: treeError } = useBookmarksTree();
  const { addAssociation, removeAssociation } = useBookmarkActions();
  const [_expandedFolders, _setExpandedFolders] = React.useState<Set<string>>(new Set());
  const [selectedContainer, setSelectedContainer] = React.useState<string>('');
  const [filter, setFilter] = React.useState('');

  // Flatten bookmarks tree and enrich with associations
  const allBookmarks = React.useMemo(() => {
    const bookmarks: BookmarkWithAssociation[] = [];

    const traverse = (nodes: browser.Bookmarks.BookmarkTreeNode[], path: string[] = []) => {
      for (const node of nodes) {
        if (node.url) {
          const association = associations.find(a => a.bookmarkId === node.id);
          const container = association ? containers?.find(c => c.cookieStoreId === association.containerId) : undefined;

          bookmarks.push({
            ...node,
            association,
            containerName: container?.name,
            title: `${path.length > 0 ? path.join(' > ') + ' > ' : ''}${node.title || node.url}`,
          });
        }

        if (node.children) {
          traverse(node.children, [...path, node.title || 'Unnamed Folder']);
        }
      }
    };

    traverse(bookmarksTree);
    return bookmarks;
  }, [bookmarksTree, associations, containers]);

  // Filter bookmarks
  const filteredBookmarks = React.useMemo(() => {
    let filtered = allBookmarks;

    if (filter) {
      const lowerFilter = filter.toLowerCase();
      filtered = filtered.filter(bookmark =>
        (bookmark.title?.toLowerCase().includes(lowerFilter)) ||
        (bookmark.url?.toLowerCase().includes(lowerFilter)) ||
        (bookmark.containerName?.toLowerCase().includes(lowerFilter)),
      );
    }

    return filtered.sort((a, b) => {
      // Sort by container association status, then by title
      if (a.association && !b.association) return -1;
      if (!a.association && b.association) return 1;
      return (a.title || '').localeCompare(b.title || '');
    });
  }, [allBookmarks, filter]);

  const handleAssignContainer = React.useCallback(async (bookmark: BookmarkWithAssociation) => {
    if (!selectedContainer || !bookmark.url) return;

    try {
      await addAssociation(bookmark.id, selectedContainer, bookmark.url, true);
    } catch (error) {
      console.error('Failed to assign container:', error);
    }
  }, [selectedContainer, addAssociation]);

  const handleRemoveAssociation = React.useCallback(async (bookmark: BookmarkWithAssociation) => {
    if (!bookmark.association) return;

    try {
      await removeAssociation(bookmark.id);
    } catch (error) {
      console.error('Failed to remove association:', error);
    }
  }, [removeAssociation]);

  const handleBulkAssign = React.useCallback(async () => {
    if (!selectedContainer) return;

    const unassignedBookmarks = filteredBookmarks.filter(b => !b.association && b.url);

    if (!confirm(`Assign ${unassignedBookmarks.length} bookmarks to the selected container?`)) {
      return;
    }

    for (const bookmark of unassignedBookmarks) {
      try {
        await addAssociation(bookmark.id, selectedContainer, bookmark.url!, true);
      } catch (error) {
        console.error('Failed to assign bookmark:', bookmark.title, error);
      }
    }
  }, [selectedContainer, filteredBookmarks, addAssociation]);

  if (associationsLoading || treeLoading) {
    return <div className="bookmark-manager loading">Loading bookmarks...</div>;
  }

  if (associationsError || treeError) {
    return (
      <div className="bookmark-manager error">
        <div className="error-message">
          <h3>Error loading bookmarks</h3>
          <p>
            {associationsError?.message || treeError?.message || 'An unexpected error occurred'}
          </p>
        </div>
      </div>
    );
  }

  const associatedCount = filteredBookmarks.filter(b => b.association).length;
  const totalCount = filteredBookmarks.length;

  return (
    <div className="bookmark-manager">
      <div className="bookmark-header">
        <h3>Bookmark Associations</h3>
        <p className="description">
          Manage which containers bookmarks open in. Bookmarks with query parameters
          like <code>?silo=container-name</code> are automatically associated.
        </p>
      </div>

      <div className="bookmark-controls">
        <input
          type="text"
          className="filter-input"
          placeholder="Filter bookmarks..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          aria-label="Search bookmarks"
        />

        <div className="bulk-controls">
          <select
            className="container-select"
            value={selectedContainer}
            onChange={(e) => setSelectedContainer(e.target.value)}
            aria-label="Filter by container"
          >
            <option value="">Select Container</option>
            {containers?.map(container => (
              <option key={container.cookieStoreId} value={container.cookieStoreId}>
                {container.name}
              </option>
            ))}
          </select>

          <button
            type="button"
            className="bulk-assign-btn"
            onClick={handleBulkAssign}
            disabled={!selectedContainer || filteredBookmarks.filter(b => !b.association).length === 0}
            data-testid="bulk-associate-button"
          >
            Bulk Assign ({filteredBookmarks.filter(b => !b.association).length})
          </button>
        </div>
      </div>

      <div className="bookmark-stats">
        {associatedCount} of {totalCount} bookmarks have container associations
        {filter && ` (filtered: "${filter}")`}
      </div>

      <div className="bookmark-list">
        {filteredBookmarks.length === 0 ? (
          <div className="empty-state">
            {filter ? 'No bookmarks match your filter.' : 'No bookmarks found.'}
          </div>
        ) : (
          filteredBookmarks.map((bookmark) => (
            <div key={bookmark.id} className={`bookmark-item ${bookmark.association ? 'associated' : 'unassociated'}`}>
              <div className="bookmark-info">
                <div className="bookmark-title" title={bookmark.url}>
                  {bookmark.title || bookmark.url}
                </div>
                <div className="bookmark-url">{bookmark.url}</div>

                {bookmark.association && (
                  <div className="bookmark-association">
                    Associated with: <strong>{bookmark.containerName}</strong>
                    {bookmark.association.autoOpen && (
                      <span className="auto-open-badge">Auto-open</span>
                    )}
                  </div>
                )}
              </div>

              <div className="bookmark-actions">
                {bookmark.association ? (
                  <button
                    type="button"
                    className="remove-btn"
                    onClick={() => handleRemoveAssociation(bookmark)}
                    title="Remove association"
                  >
                    Remove
                  </button>
                ) : (
                  <button
                    type="button"
                    className="assign-btn"
                    onClick={() => handleAssignContainer(bookmark)}
                    disabled={!selectedContainer}
                    title="Assign to selected container"
                    data-testid="associate-button"
                  >
                    Assign
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      <style>{`
        .bookmark-manager {
          max-width: 800px;
        }

        .bookmark-manager.loading {
          opacity: 0.6;
          color: var(--text-secondary, #6c757d);
        }

        .bookmark-header h3 {
          margin: 0 0 0.5rem 0;
          font-size: 1.1rem;
          font-weight: 600;
        }

        .description {
          margin: 0 0 1.5rem 0;
          color: var(--text-secondary, #6c757d);
          font-size: 0.9rem;
          line-height: 1.4;
        }

        .description code {
          background: var(--surface, #f8f9fa);
          padding: 0.25rem 0.5rem;
          border-radius: 4px;
          font-size: 0.85rem;
          border: 1px solid var(--border, #dee2e6);
        }

        .bookmark-controls {
          display: flex;
          gap: 1rem;
          margin-bottom: 1rem;
          flex-wrap: wrap;
        }

        .filter-input {
          flex: 1;
          min-width: 200px;
          padding: 0.5rem;
          border: 1px solid var(--border, #dee2e6);
          border-radius: 4px;
          background: var(--background, #ffffff);
          color: var(--text-primary, #212529);
        }

        .bulk-controls {
          display: flex;
          gap: 0.5rem;
          align-items: center;
        }

        .container-select {
          padding: 0.5rem;
          border: 1px solid var(--border, #dee2e6);
          border-radius: 4px;
          background: var(--background, #ffffff);
          color: var(--text-primary, #212529);
          min-width: 150px;
        }

        .bulk-assign-btn {
          padding: 0.5rem 1rem;
          background: var(--primary, #4a90e2);
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 0.9rem;
        }

        .bulk-assign-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .bulk-assign-btn:hover:not(:disabled) {
          opacity: 0.9;
        }

        .bookmark-stats {
          margin-bottom: 1rem;
          padding: 0.75rem;
          background: var(--surface, #f8f9fa);
          border: 1px solid var(--border, #dee2e6);
          border-radius: 4px;
          font-size: 0.9rem;
          color: var(--text-secondary, #6c757d);
        }

        .bookmark-list {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .empty-state {
          padding: 2rem;
          text-align: center;
          color: var(--text-secondary, #6c757d);
          font-style: italic;
        }

        .bookmark-item {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 1rem;
          padding: 1rem;
          border: 1px solid var(--border, #dee2e6);
          border-radius: 8px;
          background: var(--background, #ffffff);
        }

        .bookmark-item.associated {
          border-left: 4px solid var(--primary, #4a90e2);
        }

        .bookmark-item.unassociated {
          opacity: 0.8;
        }

        .bookmark-info {
          flex: 1;
          min-width: 0;
        }

        .bookmark-title {
          font-weight: 500;
          margin-bottom: 0.25rem;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .bookmark-url {
          font-size: 0.8rem;
          color: var(--text-secondary, #6c757d);
          font-family: monospace;
          margin-bottom: 0.25rem;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .bookmark-association {
          font-size: 0.85rem;
          color: var(--primary, #4a90e2);
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .auto-open-badge {
          background: var(--primary, #4a90e2);
          color: white;
          padding: 0.125rem 0.375rem;
          border-radius: 3px;
          font-size: 0.7rem;
          font-weight: 500;
        }

        .bookmark-actions {
          flex-shrink: 0;
        }

        .assign-btn,
        .remove-btn {
          padding: 0.5rem 1rem;
          border: 1px solid var(--border, #dee2e6);
          border-radius: 4px;
          background: var(--background, #ffffff);
          color: var(--text-primary, #212529);
          cursor: pointer;
          font-size: 0.85rem;
        }

        .assign-btn:hover:not(:disabled) {
          border-color: var(--primary, #4a90e2);
          background: var(--primary, #4a90e2);
          color: white;
        }

        .assign-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .remove-btn:hover {
          border-color: #dc3545;
          background: #dc3545;
          color: white;
        }

        /* Dark theme adjustments */
        :root.dark .bookmark-item {
          background: #343a40;
          border-color: #495057;
        }

        :root.dark .filter-input,
        :root.dark .container-select {
          background: #2d2d2d;
          border-color: #495057;
          color: #e9ecef;
        }

        :root.dark .bookmark-stats {
          background: #343a40;
          border-color: #495057;
        }

        :root.dark .description code {
          background: #343a40;
          border-color: #495057;
        }

        :root.dark .assign-btn,
        :root.dark .remove-btn {
          background: #2d2d2d;
          border-color: #495057;
          color: #e9ecef;
        }
      `}</style>
    </div>
  );
}