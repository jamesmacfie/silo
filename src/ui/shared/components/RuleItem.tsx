import React from 'react';
import type { Rule, Container } from '@/shared/types';
import { RuleType, MatchType } from '@/shared/types';

interface Props {
  rule: Rule;
  containers: Container[];
  onEdit?: (rule: Rule) => void;
  onDelete?: (rule: Rule) => void;
  onToggleEnabled?: (rule: Rule) => void;
}

export function RuleItem({ rule, containers, onEdit, onDelete, onToggleEnabled }: Props): JSX.Element {
  const container = containers.find(c => c.cookieStoreId === rule.containerId);

  const getRuleTypeInfo = (ruleType: RuleType) => {
    switch (ruleType) {
      case RuleType.INCLUDE:
        return { label: 'Include', color: '#28a745', icon: '✓', description: 'Open in container' };
      case RuleType.EXCLUDE:
        return { label: 'Exclude', color: '#ffc107', icon: '⊘', description: 'Break out of container' };
      case RuleType.RESTRICT:
        return { label: 'Restrict', color: '#dc3545', icon: '🔒', description: 'Only allow in this container' };
      default:
        return { label: 'Unknown', color: '#6c757d', icon: '?', description: 'Unknown rule type' };
    }
  };

  const getMatchTypeInfo = (matchType: MatchType) => {
    switch (matchType) {
      case MatchType.EXACT:
        return { label: 'Exact', description: 'Exact URL match' };
      case MatchType.DOMAIN:
        return { label: 'Domain', description: 'Domain match' };
      case MatchType.GLOB:
        return { label: 'Glob', description: 'Glob pattern match' };
      case MatchType.REGEX:
        return { label: 'Regex', description: 'Regular expression match' };
      default:
        return { label: 'Unknown', description: 'Unknown match type' };
    }
  };

  const ruleTypeInfo = getRuleTypeInfo(rule.ruleType);
  const matchTypeInfo = getMatchTypeInfo(rule.matchType);

  return (
    <div className={`rule-item ${!rule.enabled ? 'disabled' : ''}`}>
      <div className="rule-header">
        <div className="rule-pattern">
          <span className="pattern">{rule.pattern}</span>
          {rule.ruleType === RuleType.EXCLUDE && (
            <span className="no-container-note">(No Container)</span>
          )}
        </div>
        <div className="rule-priority">#{rule.priority}</div>
      </div>

      <div className="rule-details">
        <div className="rule-badges">
          <span 
            className="rule-type-badge"
            style={{ 
              backgroundColor: ruleTypeInfo.color + '20',
              color: ruleTypeInfo.color,
              border: `1px solid ${ruleTypeInfo.color}40`
            }}
            title={ruleTypeInfo.description}
          >
            {ruleTypeInfo.icon} {ruleTypeInfo.label}
          </span>
          
          <span className="match-type-badge" title={matchTypeInfo.description}>
            {matchTypeInfo.label}
          </span>

          {container && (
            <span className="container-badge" style={{ 
              backgroundColor: `var(--container-${container.color}, #4a90e2)20`,
              color: `var(--container-${container.color}, #4a90e2)`
            }}>
              {container.name}
            </span>
          )}

          {!rule.enabled && (
            <span className="status-badge disabled">Disabled</span>
          )}
        </div>

        {rule.metadata.description && (
          <div className="rule-description">{rule.metadata.description}</div>
        )}
      </div>

      <div className="rule-actions">
        <button 
          className={`action-btn ${rule.enabled ? 'enabled' : 'disabled'}`}
          onClick={() => onToggleEnabled?.(rule)}
          title={rule.enabled ? 'Disable rule' : 'Enable rule'}
        >
          {rule.enabled ? 'Enabled' : 'Disabled'}
        </button>
        <button 
          className="action-btn edit"
          onClick={() => onEdit?.(rule)}
          title="Edit rule"
        >
          Edit
        </button>
        <button 
          className="action-btn delete"
          onClick={() => onDelete?.(rule)}
          title="Delete rule"
        >
          Delete
        </button>
      </div>

      <style>{`
        .rule-item {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
          padding: 1rem;
          border: 1px solid #e5e7eb;
          border-radius: 0.75rem;
          background: white;
          box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
          transition: all 0.2s ease;
        }

        .rule-item:hover {
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
        }

        .rule-item.disabled {
          opacity: 0.7;
        }

        .rule-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 1rem;
        }

        .rule-pattern {
          flex: 1;
          min-width: 0;
        }

        .pattern {
          font-family: monospace;
          font-weight: 500;
          word-break: break-all;
        }

        .no-container-note {
          font-size: 0.8rem;
          color: var(--text-secondary, #6c757d);
          font-style: italic;
          margin-left: 0.5rem;
        }

        .rule-priority {
          font-size: 0.8rem;
          color: var(--text-secondary, #6c757d);
          background: var(--background, #ffffff);
          border: 1px solid var(--border, #dee2e6);
          padding: 0.25rem 0.5rem;
          border-radius: 4px;
          white-space: nowrap;
        }

        .rule-details {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .rule-badges {
          display: flex;
          gap: 0.5rem;
          flex-wrap: wrap;
          align-items: center;
        }

        .rule-type-badge,
        .match-type-badge,
        .container-badge,
        .status-badge {
          padding: 0.25rem 0.5rem;
          border-radius: 4px;
          font-size: 0.75rem;
          font-weight: 500;
          white-space: nowrap;
        }

        .match-type-badge {
          background: var(--text-secondary, #6c757d)20;
          color: var(--text-secondary, #6c757d);
          border: 1px solid var(--text-secondary, #6c757d)40;
        }

        .container-badge {
          border: 1px solid currentColor;
        }

        .status-badge.disabled {
          background: #dc354520;
          color: #dc3545;
          border: 1px solid #dc354540;
        }

        .rule-description {
          font-size: 0.85rem;
          color: var(--text-secondary, #6c757d);
          font-style: italic;
        }

        .rule-actions {
          display: flex;
          gap: 0.5rem;
          justify-content: flex-end;
          margin-top: 0.5rem;
        }

        .action-btn {
          padding: 0.375rem 0.75rem;
          border: 1px solid #e5e7eb;
          background: white;
          border-radius: 0.375rem;
          cursor: pointer;
          font-size: 0.875rem;
          font-weight: 500;
          transition: all 0.2s ease;
        }

        .action-btn:hover {
          background: #f9fafb;
        }

        .action-btn.enabled {
          background: #10b981;
          color: white;
          border-color: #10b981;
        }

        .action-btn.enabled:hover {
          background: #059669;
          border-color: #059669;
        }

        .action-btn.disabled {
          background: #6b7280;
          color: white;
          border-color: #6b7280;
        }

        .action-btn.disabled:hover {
          background: #4b5563;
          border-color: #4b5563;
        }

        .action-btn.edit {
          color: #3b82f6;
          border-color: #3b82f6;
        }

        .action-btn.edit:hover {
          background: #3b82f6;
          color: white;
        }

        .action-btn.delete {
          color: #ef4444;
          border-color: #ef4444;
        }

        .action-btn.delete:hover {
          background: #ef4444;
          color: white;
        }

        /* Dark theme adjustments */
        :root.dark .rule-item {
          background: linear-gradient(to bottom, #1e293b, #0f172a);
          border-color: #334155;
        }

        :root.dark .rule-priority {
          background: #1e293b;
          border-color: #334155;
        }

        :root.dark .action-btn {
          background: #1e293b;
          border-color: #334155;
          color: #e2e8f0;
        }

        :root.dark .action-btn:hover {
          background: #334155;
        }

        :root.dark .action-btn.enabled {
          background: #10b981;
          color: white;
          border-color: #10b981;
        }

        :root.dark .action-btn.disabled {
          background: #6b7280;
          color: white;
          border-color: #6b7280;
        }

        :root.dark .action-btn.edit {
          color: #60a5fa;
          border-color: #60a5fa;
        }

        :root.dark .action-btn.delete {
          color: #f87171;
          border-color: #f87171;
        }
      `}</style>
    </div>
  );
}