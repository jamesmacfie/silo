import React from 'react';
import { useContainers } from '@/ui/shared/stores';
import useStatsStore from '@/ui/shared/stores/statsStore';
import { getContainerColor } from '@/shared/utils/containerColors';

interface ContainerStatsTableProps {
  className?: string;
}

export function ContainerStatsTable({ className = '' }: ContainerStatsTableProps): JSX.Element {
  const stats = useStatsStore(state => state.containerStats);
  const containers = useContainers();
  const activeTabs = useStatsStore(state => state.activeTabs);
  const [sortBy, setSortBy] = React.useState<'name' | 'tabs' | 'rules' | 'active' | 'lastUsed'>('tabs');
  const [sortOrder, setSortOrder] = React.useState<'asc' | 'desc'>('desc');

  const tableData = containers.map(container => {
    const containerStats = stats[container.cookieStoreId];
    const activeTabCount = activeTabs[container.cookieStoreId] || 0;
    
    return {
      container,
      stats: containerStats,
      activeTabCount,
      tabsOpened: containerStats?.tabsOpened || 0,
      rulesMatched: containerStats?.rulesMatched || 0,
      lastUsed: containerStats?.lastUsed || 0,
    };
  });

  const sortedData = React.useMemo(() => {
    return [...tableData].sort((a, b) => {
      let aValue: number | string;
      let bValue: number | string;

      switch (sortBy) {
        case 'name':
          aValue = a.container.name.toLowerCase();
          bValue = b.container.name.toLowerCase();
          break;
        case 'tabs':
          aValue = a.tabsOpened;
          bValue = b.tabsOpened;
          break;
        case 'rules':
          aValue = a.rulesMatched;
          bValue = b.rulesMatched;
          break;
        case 'active':
          aValue = a.activeTabCount;
          bValue = b.activeTabCount;
          break;
        case 'lastUsed':
          aValue = a.lastUsed;
          bValue = b.lastUsed;
          break;
        default:
          return 0;
      }

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortOrder === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
      }

      const numA = Number(aValue);
      const numB = Number(bValue);
      return sortOrder === 'asc' ? numA - numB : numB - numA;
    });
  }, [tableData, sortBy, sortOrder]);

  const handleSort = (column: typeof sortBy) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('desc');
    }
  };

  const formatLastUsed = (timestamp: number) => {
    if (!timestamp) return 'Never';
    
    const now = Date.now();
    const diff = now - timestamp;
    
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;
    return new Date(timestamp).toLocaleDateString();
  };

  const SortIcon = ({ column }: { column: typeof sortBy }) => {
    if (sortBy !== column) {
      return <span className="text-gray-400">↕️</span>;
    }
    return <span className="text-blue-600">{sortOrder === 'asc' ? '↑' : '↓'}</span>;
  };

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 ${className}`}>
      <div className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
          Container Statistics
        </h3>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              <th 
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600"
                onClick={() => handleSort('name')}
              >
                <div className="flex items-center gap-1">
                  Container <SortIcon column="name" />
                </div>
              </th>
              <th 
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600"
                onClick={() => handleSort('active')}
              >
                <div className="flex items-center gap-1">
                  Active Tabs <SortIcon column="active" />
                </div>
              </th>
              <th 
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600"
                onClick={() => handleSort('tabs')}
              >
                <div className="flex items-center gap-1">
                  Total Tabs <SortIcon column="tabs" />
                </div>
              </th>
              <th 
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600"
                onClick={() => handleSort('rules')}
              >
                <div className="flex items-center gap-1">
                  Rules Matched <SortIcon column="rules" />
                </div>
              </th>
              <th 
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600"
                onClick={() => handleSort('lastUsed')}
              >
                <div className="flex items-center gap-1">
                  Last Used <SortIcon column="lastUsed" />
                </div>
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {sortedData.map(({ container, activeTabCount, tabsOpened, rulesMatched, lastUsed }) => (
              <tr key={container.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center gap-3">
                    <div 
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: getContainerColor(container.color) }}
                    />
                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {container.name}
                    </span>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    activeTabCount > 0 
                      ? 'bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100' 
                      : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                  }`}>
                    {activeTabCount}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                  {tabsOpened.toLocaleString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                  {rulesMatched.toLocaleString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                  {formatLastUsed(lastUsed)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {sortedData.length === 0 && (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          No container data available
        </div>
      )}
    </div>
  );
}