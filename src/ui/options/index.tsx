import React from 'react';
import { createRoot } from 'react-dom/client';
import '@/ui/options/index.css';
import { useAppInitialization, useStoreEffects } from '@/ui/shared/stores';
import { CSVImportExport } from '@/ui/shared/components/CSVImportExport';
import { ThemeSwitcher } from '@/ui/shared/components/ThemeSwitcher';
import { BookmarkManager } from '@/ui/shared/components/BookmarkManager';
import { 
  useRules, 
  useRuleActions, 
  useRuleLoading,
  useRuleError,
  useContainers, 
  useContainerActions, 
  useContainerLoading,
  useContainerError 
} from '@/ui/shared/stores';
import { ContainerModal } from '@/ui/options/ContainerModal';
import { RuleModal } from '@/ui/options/RuleModal';
import { SearchInput } from '@/ui/shared/components/SearchInput';
import { ContainerCard, type ContainerLite } from '@/ui/shared/components/ContainerCard';
import { RuleCard } from '@/ui/shared/components/RuleCard';
import { PageHeader } from '@/ui/shared/components/PageHeader';
import { InterceptorTest } from '@/ui/shared/components/InterceptorTest';
import { StatusBar } from '@/ui/shared/components/StatusBar';
import { DuplicateRuleManager } from '@/ui/shared/components/DuplicateRuleManager';
import type { CSVImportResult } from '@/shared/utils/csv';
import type { Rule } from '@/shared/types';
import { getDuplicateCount } from '@/shared/utils/duplicateRules';


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
      <PageHeader title="Dashboard" />
      <div className="small">Statistics and overview coming soon.</div>
    </div>
  );
}

// This hook is replaced by useContainers from Zustand stores

function ContainersPage(): JSX.Element {
  const containers = useContainers();
  const { load: refresh, delete: deleteContainerAction, clearCookies } = useContainerActions();
  const loading = useContainerLoading();
  const error = useContainerError();
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
      await deleteContainerAction(container.cookieStoreId);
    } catch (e: unknown) {
      const msg = (e instanceof Error) ? e.message : String(e);
      alert(`Delete failed: ${msg}`);
    }
  }, [deleteContainerAction]);

  const clearContainerCookies = React.useCallback(async (container: ContainerLite) => {
    try {
      await clearCookies(container.cookieStoreId);
      alert(`Cookies cleared for "${container.name}"`);
    } catch (e: unknown) {
      const msg = (e instanceof Error) ? e.message : String(e);
      alert(`Clear cookies failed: ${msg}`);
    }
  }, [clearCookies]);


  return (
    <div className="page">
      <PageHeader title="Containers">
        <div className="flex gap-2">
          <button className="btn ghost" type="button" onClick={refresh}>
            Sync with Firefox
          </button>
          <button className="btn" type="button" onClick={openCreateModal}>
            + New Container
          </button>
        </div>
      </PageHeader>
      <div className="toolbar">
        <SearchInput 
          value={query}
          onChange={setQuery}
          placeholder="Search containers..."
        />
      </div>
      {loading ? (<div className="small">Loading…</div>) : null}
      {error ? (<div className="small" role="alert">{error}</div>) : null}
      <div className="cards-grid">
        {filtered.map((c) => (
          <ContainerCard 
            key={c.id} 
            container={c} 
            onEdit={openEditModal} 
            onDelete={deleteContainer}
            onClearCookies={clearContainerCookies}
          />
        ))}
      </div>
      <StatusBar message={`${containers.length} container(s)`} />

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
  const containers = useContainers();
  const rules = useRules();
  const rulesLoading = useRuleLoading();
  const rulesError = useRuleError();
  const { update: updateRule, delete: deleteRule } = useRuleActions();
  const [filter, setFilter] = React.useState('');
  const [sortBy, setSortBy] = React.useState<'pattern' | 'priority' | 'type' | 'container'>('priority');
  const [showDuplicates, setShowDuplicates] = React.useState(false);
  const [ruleModalState, setRuleModalState] = React.useState<{
    isOpen: boolean;
    mode: 'create' | 'edit';
    rule?: Rule;
  }>({ isOpen: false, mode: 'create' });

  const duplicateCount = React.useMemo(() => getDuplicateCount(rules), [rules]);

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
    try {
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
    } catch (error) {
      return [];
    }
  }, [rules, containers, filter, sortBy]);

  const handleToggleEnabled = React.useCallback(async (rule: Rule) => {
    try {
      await updateRule(rule.id, { enabled: !rule.enabled });
    } catch (error) {
    }
  }, [updateRule]);

  const handleDeleteRule = React.useCallback(async (rule: Rule) => {
    if (!confirm(`Delete rule for "${rule.pattern}"?`)) return;

    try {
      await deleteRule(rule.id);
    } catch (error) {
    }
  }, [deleteRule]);


  if (rulesLoading) {
    return (
      <div className="page">
        <PageHeader title="Rules" />
        <div className="small">Loading rules...</div>
      </div>
    );
  }

  if (rulesError) {
    return (
      <div className="page">
        <PageHeader title="Rules" />
        <div className="small">Error loading rules: {rulesError}</div>
      </div>
    );
  }

  return (
    <div className="page">
      <PageHeader title="Rules">
        <div className="flex gap-2">
          {duplicateCount > 0 && (
            <button 
              className="btn ghost" 
              type="button" 
              onClick={() => setShowDuplicates(!showDuplicates)}
            >
              {showDuplicates ? 'Hide' : 'Show'} Duplicates ({duplicateCount})
            </button>
          )}
          <button className="btn" type="button" onClick={openCreateRuleModal}>
            + New Rule
          </button>
        </div>
      </PageHeader>

      <div className="toolbar">
        <SearchInput
          value={filter}
          onChange={setFilter}
          placeholder="Filter rules..."
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

      {showDuplicates && duplicateCount > 0 && (
        <div className="mb-6">
          <DuplicateRuleManager
            rules={rules}
            containers={containers}
            onDeleteRule={deleteRule}
          />
        </div>
      )}

      <div className="cards-grid">
        {filteredRules.length === 0 ? (
          <div className="small">
            {filter ? 'No rules match your filter.' : 'No rules configured. Add your first rule!'}
          </div>
        ) : (
          filteredRules.map((rule) => {
            try {
              return (
                <RuleCard
                  key={rule.id}
                  rule={rule}
                  containers={containers}
                  onToggleEnabled={handleToggleEnabled}
                  onEdit={openEditRuleModal}
                  onDelete={handleDeleteRule}
                />
              );
            } catch {
              return (
                <div key={rule.id} className="small">
                  Error rendering rule: {rule.id || 'unknown'}
                </div>
              );
            }
          })
        )}
      </div>

      <StatusBar message={`${filteredRules.length} of ${rules.length} rule(s)${filter ? ` (filtered: "${filter}")` : ''}`} />

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
      <PageHeader title="Import/Export" />
      {status && <StatusBar message={status} />}
      <CSVImportExport
        onImportComplete={handleImportComplete}
        onError={handleError}
      />
    </div>
  );
}

function BookmarksPage(): JSX.Element {
  const containers = useContainers();

  return (
    <div className="page">
      <PageHeader title="Bookmarks" />
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
  return (
    <div className="page">
      <PageHeader title="Settings" />
      <ThemeSwitcher />
      <InterceptorTest />
      <div className="small">More settings coming soon.</div>
    </div>
  );
}

function OptionsApp(): JSX.Element {
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

function App(): JSX.Element {
  const { isInitialized, initializationError, retry } = useAppInitialization();
  
  // Set up cross-store effects
  useStoreEffects();
  
  if (initializationError) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center min-h-screen">
        <div className="text-red-600 dark:text-red-400 mb-4 text-lg">
          Failed to initialize app
        </div>
        <div className="text-sm text-gray-600 dark:text-gray-400 mb-6 max-w-md">
          {initializationError}
        </div>
        <button 
          type="button"
          onClick={retry}
          className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }
  
  if (!isInitialized) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg text-gray-600 dark:text-gray-400">
          Loading...
        </div>
      </div>
    );
  }
  
  return <OptionsApp />;
}

const mount = document.getElementById('root');
if (mount) {
  const root = createRoot(mount);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
}


