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
import './RuleItem.css';

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

  // Check for missing metadata
  if (!rule.metadata) {
    // Provide default metadata to prevent crash
    rule.metadata = {};
  }

  const container = containers.find(c => c.cookieStoreId === rule.containerId);
  if (rule.containerId && !container) {
  }

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

  // Render icons based on type
  const renderMatchIcon = () => {
    switch (rule.matchType) {
      case MatchType.EXACT:
        return <Target className="match-type-icon" size={16} title={matchTypeInfo.description} />;
      case MatchType.DOMAIN:
        return <Globe className="match-type-icon" size={16} title={matchTypeInfo.description} />;
      case MatchType.GLOB:
        return <Sparkles className="match-type-icon" size={16} title={matchTypeInfo.description} />;
      case MatchType.REGEX:
        return <Search className="match-type-icon" size={16} title={matchTypeInfo.description} />;
      default:
        return <HelpCircle className="match-type-icon" size={16} title={matchTypeInfo.description} />;
    }
  };

  const renderRuleIcon = () => {
    switch (rule.ruleType) {
      case RuleType.INCLUDE:
        return <Plus className="rule-type-icon" size={16} style={{ color: ruleTypeInfo.color }} title={ruleTypeInfo.description} />;
      case RuleType.EXCLUDE:
        return <Minus className="rule-type-icon" size={16} style={{ color: ruleTypeInfo.color }} title={ruleTypeInfo.description} />;
      case RuleType.RESTRICT:
        return <Lock className="rule-type-icon" size={16} style={{ color: ruleTypeInfo.color }} title={ruleTypeInfo.description} />;
      default:
        return <HelpCircle className="rule-type-icon" size={16} style={{ color: ruleTypeInfo.color }} title={ruleTypeInfo.description} />;
    }
  };

  return (
    <Card className={!rule.enabled ? 'disabled' : ''}>
      <CardHeader>
        <div className="rule-left">
          {renderMatchIcon()}
          {renderRuleIcon()}
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
        {rule.metadata?.description && (
          <ExpandableDescription description={rule.metadata.description} />
        )}
        {!rule.metadata?.description && <div className="description-spacer" />}
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
            type="button"
            className={`btn ghost sm ${rule.enabled ? 'enabled' : 'disabled'}`}
            onClick={() => onToggleEnabled?.(rule)}
            title={rule.enabled ? 'Disable rule' : 'Enable rule'}
          >
            {rule.enabled ? 'Enabled' : 'Disabled'}
          </button>
          <button 
            type="button"
            className="btn ghost sm"
            onClick={() => onEdit?.(rule)}
            title="Edit rule"
          >
            Edit
          </button>
          <button 
            type="button"
            className="btn danger sm"
            onClick={() => onDelete?.(rule)}
            title="Delete rule"
          >
            Delete
          </button>
        </CardActions>
      </div>
    </Card>
  );
}