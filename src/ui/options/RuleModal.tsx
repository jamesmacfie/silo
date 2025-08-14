import React from 'react';
import browser from 'webextension-polyfill';
import { MatchType, RuleType, type Rule } from '@/shared/types';
import { validatePattern } from '@/shared/utils/patternValidator';
import { PatternTester } from '@/ui/shared/components/PatternTester';

interface Container {
  id: string;
  name: string;
  cookieStoreId: string;
  color?: string;
  icon?: string;
}

interface Props {
  isOpen: boolean;
  mode: 'create' | 'edit';
  rule?: Rule;
  containers: Container[];
  onClose: () => void;
  onSuccess: () => void;
}

const MATCH_TYPE_OPTIONS = [
  { value: MatchType.EXACT, label: 'Exact URL' },
  { value: MatchType.DOMAIN, label: 'Domain' },
  { value: MatchType.GLOB, label: 'Glob Pattern' },
  { value: MatchType.REGEX, label: 'Regex Pattern' },
];

const RULE_TYPE_OPTIONS = [
  { value: RuleType.INCLUDE, label: 'Include', description: 'Open URLs in this container' },
  { value: RuleType.EXCLUDE, label: 'Exclude', description: 'Break out of containers for this URL' },
  { value: RuleType.RESTRICT, label: 'Restrict', description: 'Only allow this URL in this container' },
];

export function RuleModal({ isOpen, mode, rule, containers, onClose, onSuccess }: Props): JSX.Element | null {
  const [pattern, setPattern] = React.useState('');
  const [matchType, setMatchType] = React.useState<MatchType>(MatchType.DOMAIN);
  const [ruleType, setRuleType] = React.useState<RuleType>(RuleType.INCLUDE);
  const [containerId, setContainerId] = React.useState('');
  const [priority, setPriority] = React.useState(50);
  const [enabled, setEnabled] = React.useState(true);
  const [description, setDescription] = React.useState('');
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (isOpen) {
      if (mode === 'edit' && rule) {
        setPattern(rule.pattern);
        setMatchType(rule.matchType);
        setRuleType(rule.ruleType);
        setContainerId(rule.containerId || '');
        setPriority(rule.priority);
        setEnabled(rule.enabled);
        setDescription(rule.metadata.description || '');
      } else {
        setPattern('');
        setMatchType(MatchType.DOMAIN);
        setRuleType(RuleType.INCLUDE);
        setContainerId(containers[0]?.cookieStoreId || '');
        setPriority(50);
        setEnabled(true);
        setDescription('');
      }
    }
  }, [isOpen, mode, rule, containers]);

  const validation = React.useMemo(() => {
    if (!pattern) return { isValid: false, error: 'Pattern is required' };
    return validatePattern(pattern, matchType);
  }, [pattern, matchType]);

  const handleSave = React.useCallback(async () => {
    // For EXCLUDE rules, containerId is not required
    const isContainerRequired = ruleType !== RuleType.EXCLUDE;
    if (!validation.isValid || !pattern.trim() || (isContainerRequired && !containerId)) return;

    setSaving(true);
    try {
      const ruleData = {
        pattern: pattern.trim(),
        matchType,
        ruleType,
        containerId: ruleType === RuleType.EXCLUDE ? undefined : containerId,
        priority,
        enabled,
        metadata: {
          description: description.trim() || undefined,
          source: 'user' as const,
        },
      };

      if (mode === 'create') {
        const response = await browser.runtime.sendMessage({
          type: 'CREATE_RULE',
          payload: ruleData,
        });
        if (!response?.success) throw new Error(response?.error || 'Failed to create rule');
      } else if (mode === 'edit' && rule) {
        const response = await browser.runtime.sendMessage({
          type: 'UPDATE_RULE',
          payload: {
            id: rule.id,
            updates: ruleData,
          },
        });
        if (!response?.success) throw new Error(response?.error || 'Failed to update rule');
      }

      onSuccess();
      onClose();
    } catch (e: unknown) {
      const msg = (e instanceof Error) ? e.message : String(e);
      alert(`Save failed: ${msg}`);
    } finally {
      setSaving(false);
    }
  }, [pattern, matchType, ruleType, containerId, priority, enabled, description, validation.isValid, mode, rule, onSuccess, onClose]);

  if (!isOpen) return null;

  return (
    <div className="modalRoot open">
      <div className="backdrop" onClick={onClose} onKeyDown={onClose} onKeyUp={onClose} />
      <div className="modal large">
        <div className="modalHeader">
          <div className="title">{mode === 'create' ? 'New Rule' : 'Edit Rule'}</div>
          <button type="button" className="btn ghost" onClick={onClose}>Close</button>
        </div>
        <div className="modalBody">
          <div className="formRow">
            <label htmlFor="pattern" className="label">Pattern</label>
            <input
              className={`input ${!validation.isValid ? 'error' : ''}`}
              type="text"
              placeholder="e.g. example.com or *.google.com"
              value={pattern}
              onChange={(e) => setPattern(e.target.value)}
            />
            {validation.error && (
              <div className="errorText">{validation.error}</div>
            )}
            {validation.warning && (
              <div className="warningText">{validation.warning}</div>
            )}
          </div>

          <div className="formRow">
            <label htmlFor="matchType" className="label">Match Type</label>
            <select
              id="matchType"
              className="input"
              value={matchType}
              onChange={(e) => setMatchType(e.target.value as MatchType)}
            >
              {MATCH_TYPE_OPTIONS.map(option => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>

          <div className="formRow">
            <label htmlFor="ruleType" className="label">Rule Type</label>
            <div className="radioGroup">
              {RULE_TYPE_OPTIONS.map(option => (
                <label key={option.value} className="radioLabel">
                  <input
                    type="radio"
                    name="ruleType"
                    value={option.value}
                    checked={ruleType === option.value}
                    onChange={(e) => setRuleType(e.target.value as RuleType)}
                  />
                  <div className="radioInfo">
                    <div className="radioTitle">{option.label}</div>
                    <div className="radioDescription">{option.description}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {ruleType !== RuleType.EXCLUDE && (
            <div className="formRow">
              <label htmlFor="container" className="label">Container</label>
              <select
                className="input"
                value={containerId}
                onChange={(e) => setContainerId(e.target.value)}
              >
                {containers.map(container => (
                  <option key={container.cookieStoreId} value={container.cookieStoreId}>
                    {container.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="formRow">
            <label htmlFor="priority" className="label">Priority ({priority})</label>
            <input
              type="range"
              className="slider"
              min="1"
              max="100"
              value={priority}
              onChange={(e) => setPriority(Number(e.target.value))}
            />
            <div className="sliderHelp">Higher priority rules are evaluated first</div>
          </div>

          <div className="formRow">
            <label htmlFor="description" className="label">Description (optional)</label>
            <input
              className="input"
              type="text"
              placeholder="What does this rule do?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="formRow">
            <label className="checkboxLabel">
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
              />
              Enabled
            </label>
          </div>

          <PatternTester
            pattern={pattern}
            matchType={matchType}
            onPatternChange={setPattern}
            onMatchTypeChange={setMatchType}
          />
        </div>
        <div className="modalFooter">
          <button type="button" className="btn ghost" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button
            type="button"
            className="btn"
            onClick={handleSave}
            disabled={saving || !validation.isValid || !pattern.trim() || (ruleType !== RuleType.EXCLUDE && !containerId)}
          >
            {saving ? 'Saving...' : 'Save Rule'}
          </button>
        </div>
      </div>

      <style>{`
        .modal.large {
          max-width: 700px;
          max-height: 80vh;
          overflow-y: auto;
        }

        .formRow {
          margin-bottom: 1rem;
        }

        .label {
          display: block;
          font-weight: 600;
          margin-bottom: 0.5rem;
          color: var(--text-primary, #212529);
        }

        .input {
          width: 100%;
          padding: 0.5rem;
          border: 1px solid var(--border, #dee2e6);
          border-radius: 4px;
          background: var(--background, #ffffff);
          color: var(--text-primary, #212529);
          font-size: 0.9rem;
        }

        .input.error {
          border-color: var(--danger, #d9534f);
        }

        .errorText {
          color: var(--danger, #d9534f);
          font-size: 0.8rem;
          margin-top: 0.25rem;
        }

        .warningText {
          color: var(--warning, #f0ad4e);
          font-size: 0.8rem;
          margin-top: 0.25rem;
        }

        .radioGroup {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .radioLabel {
          display: flex;
          align-items: flex-start;
          gap: 0.5rem;
          cursor: pointer;
          padding: 0.75rem;
          border: 1px solid var(--border, #dee2e6);
          border-radius: 4px;
          background: var(--surface, #f8f9fa);
          transition: all 0.2s ease;
        }

        .radioLabel:hover {
          border-color: var(--primary, #4a90e2);
          background: var(--primary, #4a90e2)10;
        }

        .radioLabel input[type="radio"] {
          margin-top: 0.25rem;
        }

        .radioInfo {
          flex: 1;
        }

        .radioTitle {
          font-weight: 600;
          margin-bottom: 0.25rem;
          color: var(--text-primary, #212529);
        }

        .radioDescription {
          font-size: 0.85rem;
          color: var(--text-secondary, #6c757d);
        }

        .slider {
          width: 100%;
          margin: 0.5rem 0;
        }

        .sliderHelp {
          font-size: 0.8rem;
          color: var(--text-secondary, #6c757d);
          text-align: center;
        }

        .checkboxLabel {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          cursor: pointer;
          font-weight: 600;
        }

        /* Dark theme */
        :root.dark .input {
          background: #2d2d2d;
          border-color: #495057;
          color: #e9ecef;
        }

        :root.dark .radioLabel {
          background: #343a40;
          border-color: #495057;
        }

        :root.dark .radioLabel:hover {
          border-color: #5ba0f2;
          background: #5ba0f220;
        }

        :root.dark .radioTitle {
          color: #e9ecef;
        }

        :root.dark .radioDescription {
          color: #adb5bd;
        }
      `}</style>
    </div>
  );
}