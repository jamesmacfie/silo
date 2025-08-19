import React from 'react';
import type { Rule } from '@/shared/types/rule';
import type { ContainerLite } from '@/ui/shared/components/ContainerCard';
import { findDuplicateRules, suggestRulesToKeep, getDuplicateCount, type DuplicateGroup } from '@/shared/utils/duplicateRules';

interface DuplicateRuleManagerProps {
  rules: Rule[];
  containers: ContainerLite[];
  onDeleteRule: (ruleId: string) => Promise<void>;
}

interface DuplicateRuleGroupProps {
  group: DuplicateGroup;
  containers: ContainerLite[];
  selectedForRemoval: Set<string>;
  onToggleSelection: (ruleId: string) => void;
}

function DuplicateRuleGroup({ group, containers, selectedForRemoval, onToggleSelection }: DuplicateRuleGroupProps) {
  const getContainerName = (containerId?: string) => {
    if (!containerId) return 'No Container';
    const container = containers.find(c => c.cookieStoreId === containerId);
    return container?.name || 'Unknown Container';
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString();
  };

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-yellow-50 dark:bg-yellow-900/20">
      <div className="mb-3">
        <h4 className="font-medium text-sm text-gray-900 dark:text-gray-100">
          Duplicate Pattern: <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded text-xs">{group.pattern}</code>
        </h4>
        <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
          Type: {group.ruleType} | Match: {group.matchType} | Container: {getContainerName(group.containerId)}
        </div>
      </div>

      <div className="space-y-2">
        {group.rules.map((rule, index) => (
          <div 
            key={rule.id} 
            className={`flex items-center justify-between p-3 rounded border ${
              selectedForRemoval.has(rule.id) 
                ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800' 
                : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'
            }`}
          >
            <div className="flex items-center space-x-3">
              <input
                type="checkbox"
                checked={selectedForRemoval.has(rule.id)}
                onChange={() => onToggleSelection(rule.id)}
                className="rounded"
              />
              <div>
                <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  Priority: {rule.priority} | Created: {formatDate(rule.created)}
                  {index === 0 && <span className="ml-2 text-xs bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 px-2 py-1 rounded">Suggested Keep</span>}
                </div>
                {rule.metadata.description && (
                  <div className="text-xs text-gray-600 dark:text-gray-400">
                    {rule.metadata.description}
                  </div>
                )}
                <div className="text-xs text-gray-500 dark:text-gray-500">
                  Enabled: {rule.enabled ? 'Yes' : 'No'} | ID: {rule.id.slice(0, 8)}...
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function DuplicateRuleManager({ rules, containers, onDeleteRule }: DuplicateRuleManagerProps) {
  const [selectedForRemoval, setSelectedForRemoval] = React.useState<Set<string>>(new Set());
  const [isRemoving, setIsRemoving] = React.useState(false);

  const duplicateGroups = React.useMemo(() => findDuplicateRules(rules), [rules]);
  const duplicateCount = React.useMemo(() => getDuplicateCount(rules), [rules]);

  const suggestions = React.useMemo(() => {
    if (duplicateGroups.length === 0) return { keep: [], remove: [] };
    return suggestRulesToKeep(duplicateGroups);
  }, [duplicateGroups]);

  const handleToggleSelection = React.useCallback((ruleId: string) => {
    setSelectedForRemoval(prev => {
      const newSet = new Set(prev);
      if (newSet.has(ruleId)) {
        newSet.delete(ruleId);
      } else {
        newSet.add(ruleId);
      }
      return newSet;
    });
  }, []);

  const handleSelectSuggested = React.useCallback(() => {
    setSelectedForRemoval(new Set(suggestions.remove.map(rule => rule.id)));
  }, [suggestions.remove]);

  const handleClearSelection = React.useCallback(() => {
    setSelectedForRemoval(new Set());
  }, []);

  const handleRemoveSelected = React.useCallback(async () => {
    if (selectedForRemoval.size === 0) return;
    
    const confirmed = confirm(
      `Remove ${selectedForRemoval.size} duplicate rule(s)? This action cannot be undone.`,
    );
    
    if (!confirmed) return;

    setIsRemoving(true);
    const ruleIds = Array.from(selectedForRemoval);
    let successCount = 0;
    const errors: string[] = [];

    try {
      // Delete rules sequentially to avoid race conditions
      for (const ruleId of ruleIds) {
        try {
          await onDeleteRule(ruleId);
          successCount++;
        } catch (error) {
          console.error(`Failed to delete rule ${ruleId}:`, error);
          errors.push(ruleId);
        }
      }

      // Clear selection for successfully deleted rules
      if (successCount > 0) {
        setSelectedForRemoval(prev => {
          const newSet = new Set(prev);
          ruleIds.forEach(id => {
            if (!errors.includes(id)) {
              newSet.delete(id);
            }
          });
          return newSet;
        });
      }

      // Show results to user
      if (errors.length === 0) {
        // All deletions succeeded - no need to show message
      } else if (successCount > 0) {
        alert(`Successfully removed ${successCount} rule(s). Failed to remove ${errors.length} rule(s). Please try again for the remaining rules.`);
      } else {
        alert('Failed to remove any rules. Please try again.');
      }
    } catch (error) {
      console.error('Failed to remove duplicate rules:', error);
      alert('Failed to remove rules. Please try again.');
    } finally {
      setIsRemoving(false);
    }
  }, [selectedForRemoval, onDeleteRule]);

  if (duplicateGroups.length === 0) {
    return (
      <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
        <div className="flex items-center">
          <svg className="w-5 h-5 text-green-600 dark:text-green-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
          <span className="text-sm font-medium text-green-800 dark:text-green-200">
            No duplicate rules found
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <svg className="w-5 h-5 text-yellow-600 dark:text-yellow-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <span className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
              Found {duplicateCount} duplicate rule(s) in {duplicateGroups.length} group(s)
            </span>
          </div>
          <div className="flex space-x-2">
            <button
              type="button"
              onClick={handleSelectSuggested}
              className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-3 py-1 rounded hover:bg-blue-200 dark:hover:bg-blue-800"
            >
              Select Suggested ({suggestions.remove.length})
            </button>
            <button
              type="button"
              onClick={handleClearSelection}
              disabled={selectedForRemoval.size === 0}
              className="text-xs bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 px-3 py-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50"
            >
              Clear Selection
            </button>
            <button
              type="button"
              onClick={handleRemoveSelected}
              disabled={selectedForRemoval.size === 0 || isRemoving}
              className="text-xs bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 px-3 py-1 rounded hover:bg-red-200 dark:hover:bg-red-800 disabled:opacity-50"
            >
              {isRemoving ? 'Removing...' : `Remove Selected (${selectedForRemoval.size})`}
            </button>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {duplicateGroups.map(group => (
          <DuplicateRuleGroup
            key={group.id}
            group={group}
            containers={containers}
            selectedForRemoval={selectedForRemoval}
            onToggleSelection={handleToggleSelection}
          />
        ))}
      </div>
    </div>
  );
}