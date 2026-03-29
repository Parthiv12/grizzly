import { FormEvent, useEffect, useMemo, useState } from 'react';

type Issue = {
  id: string;
  title: string;
  description: string | null;
  status: 'open' | 'in_progress' | 'closed';
  priority: 'low' | 'medium' | 'high';
  createdAt: string;
};

export function App() {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [statusFilter, setStatusFilter] = useState<'all' | Issue['status']>('all');
  const [query, setQuery] = useState('');
  const [activeIssueId, setActiveIssueId] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadIssues() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/issues');
      const data = await response.json();
      setIssues(data.items ?? []);
    } catch {
      setError('Failed to load issues');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadIssues();
  }, []);

  useEffect(() => {
    if (!activeIssueId && issues.length > 0) {
      setActiveIssueId(issues[0].id);
      return;
    }
    if (activeIssueId && !issues.some((issue) => issue.id === activeIssueId)) {
      setActiveIssueId(issues[0]?.id);
    }
  }, [activeIssueId, issues]);

  const filteredIssues = useMemo(() => {
    const q = query.trim().toLowerCase();
    return issues.filter((issue) => {
      const statusMatch = statusFilter === 'all' || issue.status === statusFilter;
      if (!statusMatch) {
        return false;
      }
      if (!q) {
        return true;
      }
      return (
        issue.id.toLowerCase().includes(q) ||
        issue.title.toLowerCase().includes(q) ||
        (issue.description ?? '').toLowerCase().includes(q)
      );
    });
  }, [issues, query, statusFilter]);

  const activeIssue = useMemo(() => {
    if (!activeIssueId) {
      return undefined;
    }
    return issues.find((issue) => issue.id === activeIssueId);
  }, [activeIssueId, issues]);

  const stats = useMemo(() => {
    return {
      total: issues.length,
      open: issues.filter((issue) => issue.status === 'open').length,
      inProgress: issues.filter((issue) => issue.status === 'in_progress').length,
      closed: issues.filter((issue) => issue.status === 'closed').length
    };
  }, [issues]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!title.trim()) {
      return;
    }

    setError(null);
    setSubmitting(true);
    try {
      const response = await fetch('/api/issues', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || undefined,
          priority
        })
      });

      if (!response.ok) {
        throw new Error('Request failed');
      }

      setTitle('');
      setDescription('');
      setPriority('medium');
      await loadIssues();
    } catch {
      setError('Failed to create issue');
    } finally {
      setSubmitting(false);
    }
  }

  async function updateStatus(id: string, status: Issue['status']) {
    setError(null);
    try {
      const response = await fetch(`/api/issues/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      if (!response.ok) {
        throw new Error('Request failed');
      }
      await loadIssues();
    } catch {
      setError('Failed to update issue status');
    }
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-block">
          <div className="brand-dot" />
          <div>
            <p className="brand-name">Issue Tracker</p>
            <p className="brand-subtitle">Monitored App</p>
          </div>
        </div>

        <div className="topbar-controls">
          <input
            className="input"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search issue id, title, description"
          />
          <button type="button" className="button" onClick={() => void loadIssues()}>
            Refresh
          </button>
          <div className="stats-row" aria-label="Issue stats">
            <span className="top-stat">{stats.total} total</span>
            <span className="top-stat">{stats.open} open</span>
            <span className="top-stat">{stats.inProgress} in progress</span>
            <span className="top-stat top-stat-closed">{stats.closed} closed</span>
          </div>
        </div>
      </header>

      <main className="layout-grid">
        <aside className="panel composer-panel">
          <div className="panel-header">
            <h2>Create Issue</h2>
          </div>

          <form onSubmit={onSubmit} className="form-stack">
            <label className="field-label" htmlFor="issue-title">
              Title
            </label>
            <input
              id="issue-title"
              className="input"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Ex: Null pointer in auth flow"
            />

            <label className="field-label" htmlFor="issue-description">
              Description
            </label>
            <textarea
              id="issue-description"
              className="textarea"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Context, repro steps, expected behavior"
            />

            <label className="field-label" htmlFor="issue-priority">
              Priority
            </label>
            <select
              id="issue-priority"
              className="input"
              value={priority}
              onChange={(event) => setPriority(event.target.value as 'low' | 'medium' | 'high')}
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>

            <button type="submit" className="button button-primary" disabled={submitting}>
              {submitting ? 'Creating...' : 'Create Issue'}
            </button>
          </form>
        </aside>

        <section className="panel list-panel">
          <div className="panel-header">
            <h2>Issue Explorer</h2>
            <span className="muted">{filteredIssues.length} issues</span>
          </div>

          <div className="filter-row">
            <button type="button" className={`chip ${statusFilter === 'all' ? 'chip-active' : ''}`} onClick={() => setStatusFilter('all')}>
              All
            </button>
            <button type="button" className={`chip ${statusFilter === 'open' ? 'chip-active' : ''}`} onClick={() => setStatusFilter('open')}>
              Open
            </button>
            <button
              type="button"
              className={`chip ${statusFilter === 'in_progress' ? 'chip-active' : ''}`}
              onClick={() => setStatusFilter('in_progress')}
            >
              In Progress
            </button>
            <button type="button" className={`chip ${statusFilter === 'closed' ? 'chip-active' : ''}`} onClick={() => setStatusFilter('closed')}>
              Closed
            </button>
          </div>

          <div className="issue-list">
            {loading ? <div className="empty-state">Loading issues...</div> : null}
            {!loading && filteredIssues.length === 0 ? <div className="empty-state">No issues found for this filter.</div> : null}

            {!loading
              ? filteredIssues.map((issue) => {
                  const active = issue.id === activeIssueId;
                  return (
                    <button
                      type="button"
                      key={issue.id}
                      className={`issue-row ${active ? 'issue-row-active' : ''}`}
                      onClick={() => setActiveIssueId(issue.id)}
                    >
                      <div className="issue-row-line">
                        <span className="issue-id">#{issue.id}</span>
                        <span className="issue-title">{issue.title}</span>
                        <span className={`status-pill status-${issue.status}`}>{issue.status.replace('_', ' ')}</span>
                      </div>
                      <div className="issue-row-line issue-row-meta">
                        <span>{issue.priority}</span>
                        <span>{new Date(issue.createdAt).toLocaleTimeString()}</span>
                      </div>
                    </button>
                  );
                })
              : null}
          </div>
        </section>

        <aside className="panel inspector-panel">
          <div className="panel-header">
            <h2>Issue Inspector</h2>
          </div>

          {!activeIssue ? (
            <div className="empty-state inspector-empty">Select an issue to inspect details.</div>
          ) : (
            <div className="inspector-body">
              <div className="inspector-title-row">
                <h3>{activeIssue.title}</h3>
                <span className={`status-pill status-${activeIssue.status}`}>{activeIssue.status.replace('_', ' ')}</span>
              </div>

              <div className="inspector-block">
                <p className="inspector-label">Issue ID</p>
                <p>#{activeIssue.id}</p>
              </div>

              <div className="inspector-block">
                <p className="inspector-label">Description</p>
                <p>{activeIssue.description || 'No description provided.'}</p>
              </div>

              <div className="inspector-block">
                <p className="inspector-label">Priority</p>
                <p className="priority-pill">{activeIssue.priority}</p>
              </div>

              <div className="inspector-block">
                <p className="inspector-label">Created</p>
                <p>{new Date(activeIssue.createdAt).toLocaleString()}</p>
              </div>

              <div className="status-actions">
                <button type="button" className="button" onClick={() => void updateStatus(activeIssue.id, 'open')}>
                  Mark Open
                </button>
                <button type="button" className="button" onClick={() => void updateStatus(activeIssue.id, 'in_progress')}>
                  Mark In Progress
                </button>
                <button type="button" className="button" onClick={() => void updateStatus(activeIssue.id, 'closed')}>
                  Mark Closed
                </button>
              </div>
            </div>
          )}
        </aside>
      </main>

      {error ? <div className="toast-error">{error}</div> : null}
    </div>
  );
}
