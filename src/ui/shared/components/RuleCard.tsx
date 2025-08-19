import React from 'react';
import type { Rule } from '@/shared/types';
import { getContainerColors } from '@/shared/utils/containerHelpers';
import type { ContainerLite } from './ContainerCard';

interface RuleCardProps {
  rule: Rule;
  containers: ContainerLite[];
  onToggleEnabled: (rule: Rule) => void;
  onEdit: (rule: Rule) => void;
  onDelete: (rule: Rule) => void;
}

export function RuleCard({
  rule,
  containers,
  onToggleEnabled,
  onEdit,
  onDelete,
}: RuleCardProps): JSX.Element {
  const safeRule = {
    ...rule,
    metadata: rule.metadata || {},
    priority: typeof rule.priority === 'number' ? rule.priority : 0,
    pattern: rule.pattern || '',
    ruleType: rule.ruleType || 'include',
    matchType: rule.matchType || 'exact',
    enabled: rule.enabled !== undefined ? rule.enabled : true,
  } as Rule;

  const container = containers.find(c => c.cookieStoreId === rule.containerId);
  const containerColors = container ? getContainerColors(container.color) : null;

  const getMatchTypeIcon = () => {
    switch (rule.matchType) {
      case 'exact': return '🎯';
      case 'domain': return '🌐';
      case 'glob': return '✨';
      default: return '🔍';
    }
  };

  const getRuleTypeIcon = () => {
    switch (rule.ruleType) {
      case 'include': return '➕';
      case 'exclude': return '➖';
      default: return '🔒';
    }
  };

  const getRuleTypeColor = () => {
    switch (rule.ruleType) {
      case 'include': return '#28a745';
      case 'exclude': return '#ffc107';
      default: return '#dc3545';
    }
  };

  return (
    <div className="card">
      <div className="cardHead" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem' }}>
        <div className="rule-left" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, minWidth: 0 }}>
          <span className="match-type-icon" title={`${rule.matchType} match`}>
            {getMatchTypeIcon()}
          </span>
          <span 
            className="rule-type-icon"
            style={{ color: getRuleTypeColor() }}
            title={`${rule.ruleType} rule`}
          >
            {getRuleTypeIcon()}
          </span>
          <span 
            className="pattern" 
            title={rule.pattern} 
            style={{ 
              fontFamily: 'monospace', 
              fontWeight: 500, 
              overflow: 'hidden', 
              textOverflow: 'ellipsis', 
              whiteSpace: 'nowrap', 
              flex: 1, 
              minWidth: 0 
            }}
          >
            {rule.pattern}
          </span>
        </div>
        <div className="rule-right" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
          {container && containerColors && (
            <span
              className="container-badge"
              style={{
                backgroundColor: containerColors.bg,
                borderColor: containerColors.border,
                color: containerColors.text,
                padding: '0.25rem 0.5rem',
                borderRadius: '9999px',
                fontSize: '0.75rem',
                fontWeight: '500',
                border: '1px solid',
                whiteSpace: 'nowrap',
              }}
              title={container.name}
            >
              {container.name}
            </span>
          )}
          {rule.ruleType === 'exclude' && !container && (
            <span
              className="no-container-badge"
              style={{
                backgroundColor: '#F3F4F6',
                borderColor: '#D1D5DB',
                color: '#6B7280',
                padding: '0.25rem 0.5rem',
                borderRadius: '9999px',
                fontSize: '0.75rem',
                fontWeight: '500',
                border: '1px solid',
                fontStyle: 'italic',
              }}
            >
              No Container
            </span>
          )}
          <div
            className="rule-priority"
            style={{
              backgroundColor: 'var(--background-secondary, #F8FAFC)',
              borderColor: 'var(--border, #E2E8F0)',
              color: 'var(--text-secondary, #475569)',
              padding: '0.25rem 0.5rem',
              borderRadius: '4px',
              fontSize: '0.75rem',
              fontWeight: '600',
              border: '1px solid',
              fontFamily: 'monospace',
            }}
          >
            #{rule.priority}
          </div>
        </div>
      </div>

      <div className="card-content">
        {rule.metadata?.description && (
          <div className="rule-description">
            {rule.metadata.description}
          </div>
        )}
        {!rule.enabled && (
          <div className="status-indicator">
            <span className="status-badge disabled">Disabled</span>
          </div>
        )}
      </div>

      <div className="row">
        <div />
        <div className="actions">
          <button
            className={`btn ghost sm ${rule.enabled ? 'enabled' : 'disabled'}`}
            onClick={() => onToggleEnabled(safeRule)}
            title={rule.enabled ? 'Disable rule' : 'Enable rule'}
          >
            {rule.enabled ? 'Enabled' : 'Disabled'}
          </button>
          <button
            className="btn ghost sm"
            onClick={() => onEdit(safeRule)}
            title="Edit rule"
          >
            Edit
          </button>
          <button
            className="btn danger sm"
            onClick={() => onDelete(safeRule)}
            title="Delete rule"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}