import React from 'react';
import { createRoot } from 'react-dom/client';
import browser from 'webextension-polyfill';
import '@/ui/options/index.css';
import { QueryProvider } from '@/ui/shared/providers/QueryProvider';
import { ThemeProvider } from '@/ui/shared/contexts/ThemeContext';
import { CSVImportExport } from '@/ui/shared/components/CSVImportExport';
import { ThemeSwitcher } from '@/ui/shared/components/ThemeSwitcher';
import { RuleItem } from '@/ui/shared/components/RuleItem';
import { BookmarkManager } from '@/ui/shared/components/BookmarkManager';
import { Card, CardHeader, CardContent, CardActions } from '@/ui/shared/components/Card';
import { useRules, useRuleActions } from '@/ui/shared/hooks/useRules';
import { ContainerModal } from '@/ui/options/ContainerModal';
import { RuleModal } from '@/ui/options/RuleModal';
import type { CSVImportResult } from '@/shared/utils/csv';
import type { Rule } from '@/shared/types';

interface ContainerLite {
  id: string;
  name: string;
  cookieStoreId: string;
  color?: string;
  icon?: string;
  created?: number;
  modified?: number;
  temporary?: boolean;
  syncEnabled?: boolean;
}

function PageShell(props: { children: React.ReactNode; }): JSX.Element {
  return (
    <div className="app">
      {props.children}
    </div>
  );
}

function Sidebar(props: { current: string; onNavigate(page: string): void; }): JSX.Element {
  const nav = [
    { key: 'dashboard', label: 'Dashboard' },
    { key: 'containers', label: 'Containers' },
    { key: 'rules', label: 'Rules' },
    { key: 'bookmarks', label: 'Bookmarks' },
    { key: 'import-export', label: 'Import/Export' },
    { key: 'settings', label: 'Settings' },
  ];
  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="logo" />
        <h1>Silo</h1>
      </div>
      <div className="nav">
        {nav.map((n) => (
          <button key={n.key} className={props.current === n.key ? 'active' : ''} type="button" onClick={() => { props.onNavigate(n.key); return; }}>{n.label}</button>
        ))}
      </div>
    </aside>
  );
}

function Content(props: { children: React.ReactNode; }): JSX.Element {
  return (
    <main className="content">
      {props.children}
    </main>
  );
}

function Dashboard(): JSX.Element {
  return (
    <div className="page">
      <div className="header">
        <h2 className="title">Dashboard</h2>
      </div>
      <div className="small">Statistics and overview coming soon.</div>
    </div>
  );
}

function useContainersData() {
  const [containers, setContainers] = React.useState<ContainerLite[]>([]);
  const [loading, setLoading] = React.useState<boolean>(false);
  const [error, setError] = React.useState<string | null>(null);
  const refresh = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await browser.runtime.sendMessage({ type: 'GET_CONTAINERS' });
      const data = Array.isArray(res?.data) ? (res.data as ContainerLite[]) : [];
      setContainers(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
    return;
  }, []);
  React.useEffect(() => { void refresh(); }, [refresh]);
  return { containers, loading, error, refresh };
}

function ContainersPage(): JSX.Element {
  const { containers, loading, error, refresh } = useContainersData();
  const [query, setQuery] = React.useState<string>('');
  const [modalState, setModalState] = React.useState<{
    isOpen: boolean;
    mode: 'create' | 'edit';
    container?: ContainerLite;
  }>({ isOpen: false, mode: 'create' });

  const filtered = React.useMemo(() => containers.filter((c) => !query || String(c.name || '').toLowerCase().includes(query.toLowerCase())), [containers, query]);

  const openCreateModal = React.useCallback(() => {
    setModalState({ isOpen: true, mode: 'create' });
  }, []);

  const openEditModal = React.useCallback((container: ContainerLite) => {
    setModalState({ isOpen: true, mode: 'edit', container });
  }, []);

  const closeModal = React.useCallback(() => {
    setModalState(prev => ({ ...prev, isOpen: false }));
  }, []);

  const deleteContainer = React.useCallback(async (container: ContainerLite) => {
    if (!confirm(`Delete container "${container.name}"?`)) return;

    try {
      await browser.runtime.sendMessage({
        type: 'DELETE_CONTAINER',
        payload: { id: container.cookieStoreId },
      });
      await refresh();
    } catch (e: unknown) {
      const msg = (e instanceof Error) ? e.message : String(e);
      alert(`Delete failed: ${msg}`);
    }
  }, [refresh]);

  const iconToEmoji = React.useCallback((icon: string | undefined): string => {
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
  }, []);

  const colorToCss = React.useCallback((color: string | undefined): string => {
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
  }, []);

  return (
    <div className="page">
      <div className="header">
        <h2 className="title">Containers</h2>
        <div className="flex gap-2">
          <button className="btn ghost" type="button" onClick={refresh}>
            Sync with Firefox
          </button>
          <button className="btn" type="button" onClick={openCreateModal}>
            + New Container
          </button>
        </div>
      </div>
      <div className="toolbar">
        <input
          className="input"
          placeholder="Search containers..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      {loading ? (<div className="small">Loading…</div>) : null}
      {error ? (<div className="small" role="alert">{error}</div>) : null}
      <div className="cards-grid">
        {filtered.map((c) => (
          <Card key={c.id}>
            <CardHeader>
              <span className="swatch" style={{ background: colorToCss(c.color) }} />
              <span className="mr-1.5 text-base">{iconToEmoji(c.icon)}</span>
              <div className="name">{c.name}</div>
            </CardHeader>
            <CardContent>
              <div className="small">{c.cookieStoreId}</div>
            </CardContent>
            <div className="row">
              <div />
              <CardActions>
                <button className="btn ghost sm" type="button" onClick={() => openEditModal(c)}>
                  Edit
                </button>
                <button className="btn danger sm" type="button" onClick={() => deleteContainer(c)}>
                  Delete
                </button>
              </CardActions>
            </div>
          </Card>
        ))}
      </div>
      <div className="status">{containers.length} container(s)</div>

      <ContainerModal
        isOpen={modalState.isOpen}
        mode={modalState.mode}
        container={modalState.container}
        onClose={closeModal}
        onSuccess={refresh}
      />
    </div>
  );
}

function RulesPage(): JSX.Element {
  const { containers } = useContainersData();
  const { data: rules = [], isLoading: rulesLoading, error: rulesError } = useRules();
  const { updateRule, deleteRule } = useRuleActions();
  const [filter, setFilter] = React.useState('');
  const [sortBy, setSortBy] = React.useState<'pattern' | 'priority' | 'type' | 'container'>('priority');
  const [ruleModalState, setRuleModalState] = React.useState<{
    isOpen: boolean;
    mode: 'create' | 'edit';
    rule?: Rule;
  }>({ isOpen: false, mode: 'create' });

  const openCreateRuleModal = React.useCallback(() => {
    setRuleModalState({ isOpen: true, mode: 'create' });
  }, []);

  const openEditRuleModal = React.useCallback((rule: Rule) => {
    setRuleModalState({ isOpen: true, mode: 'edit', rule });
  }, []);

  const closeRuleModal = React.useCallback(() => {
    setRuleModalState(prev => ({ ...prev, isOpen: false }));
  }, []);

  const filteredRules = React.useMemo(() => {
    let filtered = rules;

    if (filter) {
      const lowerFilter = filter.toLowerCase();
      filtered = rules.filter(rule =>
        rule.pattern.toLowerCase().includes(lowerFilter) ||
        rule.metadata.description?.toLowerCase().includes(lowerFilter) ||
        containers.find(c => c.cookieStoreId === rule.containerId)?.name.toLowerCase().includes(lowerFilter),
      );
    }

    return filtered.sort((a, b) => {
      switch (sortBy) {
        case 'pattern':
          return a.pattern.localeCompare(b.pattern);
        case 'priority':
          return b.priority - a.priority; // Higher priority first
        case 'type':
          return a.ruleType.localeCompare(b.ruleType);
        case 'container': {
          const containerA = containers.find(c => c.cookieStoreId === a.containerId)?.name || '';
          const containerB = containers.find(c => c.cookieStoreId === b.containerId)?.name || '';
          return containerA.localeCompare(containerB);
        }
        default:
          return 0;
      }
    });
  }, [rules, containers, filter, sortBy]);

  const handleToggleEnabled = React.useCallback(async (rule: Rule) => {
    try {
      await updateRule(rule.id, { enabled: !rule.enabled });
    } catch (error) {
      console.error('Failed to toggle rule:', error);
    }
  }, [updateRule]);

  const handleDeleteRule = React.useCallback(async (rule: Rule) => {
    if (!confirm(`Delete rule for "${rule.pattern}"?`)) return;

    try {
      await deleteRule(rule.id);
    } catch (error) {
      console.error('Failed to delete rule:', error);
    }
  }, [deleteRule]);

  if (rulesLoading) {
    return (
      <div className="page">
        <div className="header"><h2 className="title">Rules</h2></div>
        <div className="small">Loading rules...</div>
      </div>
    );
  }

  if (rulesError) {
    return (
      <div className="page">
        <div className="header"><h2 className="title">Rules</h2></div>
        <div className="small">Error loading rules: {rulesError.message}</div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="header">
        <h2 className="title">Rules</h2>
        <button className="btn" type="button" onClick={openCreateRuleModal}>
          + New Rule
        </button>
      </div>

      <div className="toolbar">
        <input
          type="text"
          className="input"
          placeholder="Filter rules..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        <select
          className="input"
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
        >
          <option value="priority">Sort by Priority</option>
          <option value="pattern">Sort by Pattern</option>
          <option value="type">Sort by Type</option>
          <option value="container">Sort by Container</option>
        </select>
      </div>

      <div className="cards-grid">
        {filteredRules.length === 0 ? (
          <div className="small">
            {filter ? 'No rules match your filter.' : 'No rules configured. Add your first rule!'}
          </div>
        ) : (
          filteredRules.map((rule) => (
            <RuleItem
              key={rule.id}
              rule={rule}
              containers={containers.map(c => ({
                ...c,
                icon: c.icon || 'fingerprint',
                color: c.color || 'toolbar',
                created: c.created || Date.now(),
                modified: c.modified || Date.now(),
                temporary: c.temporary || false,
                syncEnabled: c.syncEnabled || false,
              }))}
              onToggleEnabled={handleToggleEnabled}
              onDelete={handleDeleteRule}
              onEdit={openEditRuleModal}
            />
          ))
        )}
      </div>

      <div className="status">
        {filteredRules.length} of {rules.length} rule(s)
        {filter && ` (filtered: "${filter}")`}
      </div>

      <RuleModal
        isOpen={ruleModalState.isOpen}
        mode={ruleModalState.mode}
        rule={ruleModalState.rule}
        containers={containers.map(c => ({
          id: c.id,
          name: c.name,
          cookieStoreId: c.cookieStoreId,
          color: c.color,
          icon: c.icon,
        }))}
        onClose={closeRuleModal}
        onSuccess={() => {
          // Rules will be refetched automatically by the useRules hook
        }}
      />
    </div>
  );
}

function ImportExportPage(): JSX.Element {
  const [status, setStatus] = React.useState('');

  const handleImportComplete = React.useCallback((result: CSVImportResult) => {
    const { rules, errors, warnings } = result;
    let message = `Imported ${rules.length} rules`;
    if (warnings.length > 0) message += ` with ${warnings.length} warnings`;
    if (errors.length > 0) message += ` and ${errors.length} errors`;
    setStatus(message);

    // Clear status after 5 seconds
    setTimeout(() => setStatus(''), 5000);
  }, []);

  const handleError = React.useCallback((error: string) => {
    setStatus(`Error: ${error}`);
    setTimeout(() => setStatus(''), 5000);
  }, []);

  return (
    <div className="page">
      <div className="header">
        <h2 className="title">Import/Export</h2>
      </div>
      {status && <div className="status">{status}</div>}
      <CSVImportExport
        onImportComplete={handleImportComplete}
        onError={handleError}
      />
    </div>
  );
}

function BookmarksPage(): JSX.Element {
  const { containers } = useContainersData();

  return (
    <div className="page">
      <div className="header">
        <h2 className="title">Bookmarks</h2>
      </div>
      <BookmarkManager containers={containers.map(c => ({
        ...c,
        icon: c.icon || 'fingerprint',
        color: c.color || 'toolbar',
        created: c.created || Date.now(),
        modified: c.modified || Date.now(),
        temporary: c.temporary || false,
        syncEnabled: c.syncEnabled || false,
      }))} />
    </div>
  );
}

function SettingsPage(): JSX.Element {
  const [testUrl, setTestUrl] = React.useState('https://github.com');
  const [testResult, setTestResult] = React.useState<string>('');

  const testInterceptor = React.useCallback(async () => {
    try {
      const response = await browser.runtime.sendMessage({
        type: 'TEST_INTERCEPTOR',
        payload: { url: testUrl },
      });
      setTestResult(JSON.stringify(response, null, 2));
    } catch (error) {
      setTestResult(`Error: ${error}`);
    }
  }, [testUrl]);

  return (
    <div className="page">
      <div className="header"><h2 className="title">Settings</h2></div>
      <ThemeSwitcher />

      <div className="mt-8 p-4 border border-gray-300 rounded">
        <h3>Interceptor Test</h3>
        <div className="mb-4">
          <input
            type="text"
            value={testUrl}
            onChange={(e) => setTestUrl(e.target.value)}
            placeholder="Enter URL to test"
            className="w-80 mr-2.5"
          />
          <button type="button" onClick={testInterceptor}>Test Rules Engine</button>
        </div>
        {testResult && (
          <pre className="bg-gray-100 p-4 text-xs overflow-auto">
            {testResult}
          </pre>
        )}
      </div>

      <div className="small">More settings coming soon.</div>
    </div>
  );
}

function App(): JSX.Element {
  const [page, setPage] = React.useState<string>('containers');
  return (
    <PageShell>
      <Sidebar current={page} onNavigate={(p) => { setPage(p); return; }} />
      <Content>
        {page === 'dashboard' && <Dashboard />}
        {page === 'containers' && <ContainersPage />}
        {page === 'rules' && <RulesPage />}
        {page === 'bookmarks' && <BookmarksPage />}
        {page === 'import-export' && <ImportExportPage />}
        {page === 'settings' && <SettingsPage />}
      </Content>
    </PageShell>
  );
}

const mount = document.getElementById('root');
if (mount) {
  const root = createRoot(mount);
  root.render(
    <React.StrictMode>
      <ThemeProvider>
        <QueryProvider>
          <App />
        </QueryProvider>
      </ThemeProvider>
    </React.StrictMode>,
  );
}


