import React from 'react';
import type { Rule, Container } from '@/shared/types';
import { RuleType, MatchType } from '@/shared/types';
import { Card, CardHeader, CardContent, CardActions } from './Card';
import { 
  Target, 
  Globe, 
  Sparkles, 
  Search, 
  Plus, 
  Minus, 
  Lock, 
  HelpCircle, 
} from 'lucide-react';

interface Props {
  rule: Rule;
  containers: Container[];
  onEdit?: (rule: Rule) => void;
  onDelete?: (rule: Rule) => void;
  onToggleEnabled?: (rule: Rule) => void;
}

function ExpandableDescription({ description }: { description: string }): JSX.Element {
  const [isExpanded, setIsExpanded] = React.useState(false);
  const maxLength = 100; // Max characters to show before truncating
  const needsTruncation = description.length > maxLength;
  
  const displayText = needsTruncation && !isExpanded 
    ? description.substring(0, maxLength) + '...'
    : description;

  return (
    <div className="rule-description">
      <span>{displayText}</span>
      {needsTruncation && (
        <button
          className="expand-btn"
          onClick={() => setIsExpanded(!isExpanded)}
          type="button"
        >
          {isExpanded ? 'Show Less' : 'Show More'}
        </button>
      )}
    </div>
  );
}

export function RuleItem({ rule, containers, onEdit, onDelete, onToggleEnabled }: Props): JSX.Element {
  const container = containers.find(c => c.cookieStoreId === rule.containerId);

  const getContainerColor = (color: string | undefined): string => {
    switch ((color || '').toLowerCase()) {
      case 'blue': return '#4A90E2';
      case 'turquoise': return '#30D5C8';
      case 'green': return '#5CB85C';
      case 'yellow': return '#F0AD4E';
      case 'orange': return '#FF8C42';
      case 'red': return '#D9534F';
      case 'pink': return '#FF69B4';
      case 'purple': return '#7B68EE';
      case 'toolbar': return '#999';
      default: return '#6c757d';
    }
  };

  const getRuleTypeInfo = (ruleType: RuleType) => {
    switch (ruleType) {
      case RuleType.INCLUDE:
        return { label: 'Include', color: '#28a745', icon: Plus, description: 'Open in container' };
      case RuleType.EXCLUDE:
        return { label: 'Exclude', color: '#ffc107', icon: Minus, description: 'Break out of container' };
      case RuleType.RESTRICT:
        return { label: 'Restrict', color: '#dc3545', icon: Lock, description: 'Only allow in this container' };
      default:
        return { label: 'Unknown', color: '#6c757d', icon: HelpCircle, description: 'Unknown rule type' };
    }
  };

  const getMatchTypeInfo = (matchType: MatchType) => {
    switch (matchType) {
      case MatchType.EXACT:
        return { label: 'Exact', icon: Target, description: 'Exact URL match' };
      case MatchType.DOMAIN:
        return { label: 'Domain', icon: Globe, description: 'Domain match' };
      case MatchType.GLOB:
        return { label: 'Glob', icon: Sparkles, description: 'Glob pattern match (wildcards)' };
      case MatchType.REGEX:
        return { label: 'Regex', icon: Search, description: 'Regular expression match' };
      default:
        return { label: 'Unknown', icon: HelpCircle, description: 'Unknown match type' };
    }
  };

  const ruleTypeInfo = getRuleTypeInfo(rule.ruleType);
  const matchTypeInfo = getMatchTypeInfo(rule.matchType);

  return (
    <Card className={!rule.enabled ? 'disabled' : ''}>
      <CardHeader>
        <div className="rule-left">
          <matchTypeInfo.icon 
            className="match-type-icon" 
            size={16}
            title={matchTypeInfo.description}
          />
          <ruleTypeInfo.icon 
            className="rule-type-icon"
            size={16}
            style={{ color: ruleTypeInfo.color }}
            title={ruleTypeInfo.description}
          />
          <span className="pattern" title={rule.pattern}>{rule.pattern}</span>
        </div>
        <div className="rule-right">
          {container && (
            <span 
              className="container-name" 
              title={container.name}
              style={{ color: getContainerColor(container.color) }}
            >
              {container.name}
            </span>
          )}
          {rule.ruleType === RuleType.EXCLUDE && (
            <span className="no-container-note">No Container</span>
          )}
          <div className="rule-priority">#{rule.priority}</div>
        </div>
      </CardHeader>

      <CardContent>
        {rule.metadata.description && (
          <ExpandableDescription description={rule.metadata.description} />
        )}
        {!rule.enabled && (
          <div className="status-indicator">
            <span className="status-badge disabled">Disabled</span>
          </div>
        )}
      </CardContent>

      <div className="row">
        <div />
        <CardActions>
          <button 
            className={`btn ghost sm ${rule.enabled ? 'enabled' : 'disabled'}`}
            onClick={() => onToggleEnabled?.(rule)}
            title={rule.enabled ? 'Disable rule' : 'Enable rule'}
          >
            {rule.enabled ? 'Enabled' : 'Disabled'}
          </button>
          <button 
            className="btn ghost sm"
            onClick={() => onEdit?.(rule)}
            title="Edit rule"
          >
            Edit
          </button>
          <button 
            className="btn danger sm"
            onClick={() => onDelete?.(rule)}
            title="Delete rule"
          >
            Delete
          </button>
        </CardActions>
      </div>

      <style>{`
        .card {
          height: 100%;
          display: flex;
          flex-direction: column;
        }

        .card.disabled {
          opacity: 0.7;
        }

        .cardHead {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 0.75rem;
          min-height: 2.5rem;
        }

        .rule-left {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          flex: 1;
          min-width: 0;
        }

        .rule-right {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          flex-shrink: 0;
        }

        .match-type-icon,
        .rule-type-icon {
          font-size: 1.1rem;
          flex-shrink: 0;
        }

        .pattern {
          font-family: monospace;
          font-weight: 500;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          flex: 1;
          min-width: 0;
        }

        .container-name {
          font-size: 0.8rem;
          font-weight: 500;
          max-width: 120px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .no-container-note {
          font-size: 0.75rem;
          color: var(--text-secondary, #6c757d);
          font-style: italic;
        }

        .rule-priority {
          font-size: 0.75rem;
          color: var(--text-secondary, #6c757d);
          background: var(--background, #ffffff);
          border: 1px solid var(--border, #dee2e6);
          padding: 0.25rem 0.5rem;
          border-radius: 4px;
          white-space: nowrap;
        }

        .card-content {
          flex: 1;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          min-height: 3rem;
        }

        .rule-description {
          font-size: 0.85rem;
          color: var(--text-secondary, #6c757d);
          font-style: italic;
          line-height: 1.4;
        }

        .expand-btn {
          background: none;
          border: none;
          color: #3b82f6;
          cursor: pointer;
          font-size: 0.8rem;
          font-weight: 500;
          margin-left: 0.5rem;
          padding: 0;
          text-decoration: underline;
        }

        .expand-btn:hover {
          color: #1d4ed8;
        }

        .status-indicator {
          margin-top: 0.5rem;
        }

        .status-badge {
          padding: 0.25rem 0.5rem;
          border-radius: 4px;
          font-size: 0.75rem;
          font-weight: 500;
          white-space: nowrap;
        }

        .status-badge.disabled {
          background: #dc354520;
          color: #dc3545;
          border: 1px solid #dc354540;
        }

        .btn.enabled {
          background: #10b981;
          color: white;
          border-color: #10b981;
        }

        .btn.enabled:hover {
          background: #059669;
          border-color: #059669;
        }

        .btn.disabled {
          background: #6b7280;
          color: white;
          border-color: #6b7280;
        }

        .btn.disabled:hover {
          background: #4b5563;
          border-color: #4b5563;
        }

        /* Dark theme adjustments */
        :root.dark .rule-priority {
          background: #1e293b;
          border-color: #334155;
        }

        :root.dark .expand-btn {
          color: #60a5fa;
        }

        :root.dark .expand-btn:hover {
          color: #93c5fd;
        }
      `}</style>
    </Card>
  );
}