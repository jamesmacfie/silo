import React from 'react';
import browser from 'webextension-polyfill';

interface Props {
  isOpen: boolean;
  mode: 'create' | 'edit';
  container?: {
    id: string;
    name: string;
    cookieStoreId: string;
    color?: string;
    icon?: string;
  };
  onClose: () => void;
  onSuccess: () => void;
}

const COLOR_OPTIONS = ['blue', 'turquoise', 'green', 'yellow', 'orange', 'red', 'pink', 'purple', 'toolbar'];
const ICON_OPTIONS = ['fingerprint', 'briefcase', 'dollar', 'cart', 'fence', 'fruit', 'gift', 'vacation', 'tree', 'chill'];

function iconToEmoji(icon: string): string {
  switch ((icon || '').toLowerCase()) {
    case 'briefcase': return '💼';
    case 'dollar': return '💵';
    case 'cart': return '🛒';
    case 'fence': return '🚧';
    case 'fruit': return '🍎';
    case 'gift': return '🎁';
    case 'vacation': return '🏖️';
    case 'tree': return '🌳';
    case 'chill': return '❄️';
    case 'fingerprint': return '🆔';
    default: return '🗂️';
  }
}

function colorToCss(color: string): string {
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
    default: return '#ccc';
  }
}

export function ContainerModal({ isOpen, mode, container, onClose, onSuccess }: Props): JSX.Element | null {
  const [name, setName] = React.useState('');
  const [color, setColor] = React.useState('toolbar');
  const [icon, setIcon] = React.useState('fingerprint');
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (isOpen) {
      if (mode === 'edit' && container) {
        setName(container.name || '');
        setColor(container.color || 'toolbar');
        setIcon(container.icon || 'fingerprint');
      } else {
        setName('');
        setColor('toolbar');
        setIcon('fingerprint');
      }
    }
  }, [isOpen, mode, container]);

  const handleSave = React.useCallback(async () => {
    if (!name.trim()) return;

    setSaving(true);
    try {
      if (mode === 'create') {
        const response = await browser.runtime.sendMessage({
          type: 'CREATE_CONTAINER',
          payload: { name: name.trim(), color, icon },
        });
        if (!response?.success) throw new Error(response?.error || 'No response');
      } else if (mode === 'edit' && container) {
        await browser.runtime.sendMessage({
          type: 'UPDATE_CONTAINER',
          payload: { 
            id: container.cookieStoreId, 
            updates: { name: name.trim(), color, icon } 
          },
        });
      }
      
      onSuccess();
      onClose();
    } catch (e: unknown) {
      const msg = (e instanceof Error) ? e.message : String(e);
      alert(`Save failed: ${msg}`);
    } finally {
      setSaving(false);
    }
  }, [name, color, icon, mode, container, onSuccess, onClose]);

  if (!isOpen) return null;

  return (
    <div className="modalRoot open">
      <div className="backdrop" onClick={onClose} />
      <div className="modal">
        <div className="modalHeader">
          <div className="title">{mode === 'create' ? 'New Container' : 'Edit Container'}</div>
          <button className="btn ghost" onClick={onClose}>Close</button>
        </div>
        <div className="modalBody">
          <div className="formRow">
            <label className="label">Name</label>
            <input 
              className="input" 
              type="text" 
              placeholder="e.g. Work"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>
          <div className="formRow">
            <div className="label">Color</div>
            <div className="palette">
              {COLOR_OPTIONS.map(colorOption => (
                <button
                  key={colorOption}
                  className={`chip ${color === colorOption ? 'selected' : ''}`}
                  onClick={() => setColor(colorOption)}
                >
                  <span className="swatch" style={{ background: colorToCss(colorOption) }} />
                  {colorOption}
                </button>
              ))}
            </div>
          </div>
          <div className="formRow">
            <div className="label">Icon</div>
            <div className="icons">
              {ICON_OPTIONS.map(iconOption => (
                <button
                  key={iconOption}
                  className={`iconBox ${icon === iconOption ? 'selected' : ''}`}
                  onClick={() => setIcon(iconOption)}
                  title={iconOption}
                >
                  <span style={{ fontSize: '18px' }}>{iconToEmoji(iconOption)}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="modalFooter">
          <button className="btn ghost" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button className="btn" onClick={handleSave} disabled={saving || !name.trim()}>
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}