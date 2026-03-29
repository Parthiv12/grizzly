import { FormEvent, useState } from 'react';

type User = {
  id: string;
  name: string;
  email: string;
  created_at: string;
  role?: string;
};

export function App() {
  const [users, setUsers] = useState<User[]>([]);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newsletter, setNewsletter] = useState(false);
  
  const [activeUser, setActiveUser] = useState<User | null>(null);
  const [stats, setStats] = useState<any>(null);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function loadUsers() {
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      // Intentional N+1 DB scenario!
      const response = await fetch('/api/users');
      if (!response.ok) throw new Error('Failed to load users');
      const data = await response.json();
      setUsers(data ?? []);
    } catch (e: any) {
      setError(e.message || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }

  async function onRegister(event: FormEvent) {
    event.preventDefault();
    if (!email.trim() || !password) return;

    setError(null);
    setSuccess(null);
    setLoading(true);
    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          password,
          subscribeToNewsletter: newsletter
        })
      });

      if (!response.ok) {
        throw new Error('500: Server crashed during registration');
      }

      setSuccess('Successfully registered User!');
      setName(''); setEmail(''); setPassword('');
      await loadUsers();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function onLogin() {
    if (!email.trim() || !password) return;

    setError(null);
    setSuccess(null);
    setLoading(true);
    try {
      // Intentional slow scenario!
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password })
      });

      if (!response.ok) {
        throw new Error('401: Invalid Credentials');
      }
      
      const data = await response.json();
      setSuccess('Successfully Logged in! (Token received)');
      setActiveUser(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-block">
          <div className="brand-dot" />
          <div>
            <p className="brand-name">Auth Center</p>
            <p className="brand-subtitle">Monitored App</p>
          </div>
        </div>

        <div className="topbar-controls">
          {activeUser ? (
            <button type="button" className="button" onClick={() => setActiveUser(null)}>
              Sign Out
            </button>
          ) : (
            <button type="button" className="button" onClick={() => void loadUsers()}>
              Fetch Users (GET /api/users)
            </button>
          )}
        </div>
      </header>

      {activeUser ? (
        <main className="layout-grid" style={{ gridTemplateColumns: 'minmax(420px, 1fr)' }}>
           <section className="panel" style={{ display: 'flex', flexDirection: 'column' }}>
            <div className="panel-header">
              <h2>Dashboard for {activeUser.name}</h2>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', alignItems: 'center', justifyContent: 'center', flex: 1, padding: '40px' }}>
              <div className="empty-state" style={{ maxWidth: '600px' }}>
                <h3 style={{ margin: '0 0 12px', color: '#0f172a' }}>Welcome to the Authenticated Dashboard!</h3>
                <p style={{ margin: 0, color: '#64748b' }}>You are now logged in as {activeUser.email}. Try fetching the dashboard metrics below to see another trace mapped out in TraceLens.</p>
              </div>

              <button 
                type="button" 
                className="button button-primary" 
                onClick={async () => {
                  setLoading(true);
                  try {
                    const res = await fetch('/api/users/stats');
                    setStats(await res.json());
                  } finally {
                    setLoading(false);
                  }
                }}
              >
                Fetch Dashboard Stats (GET /api/users/stats)
              </button>

              {stats && (
                <div style={{ display: 'flex', gap: '24px', marginTop: '16px' }}>
                  <div className="panel" style={{ padding: '24px', textAlign: 'center' }}>
                    <div style={{ fontSize: '32px', fontWeight: 700, color: '#2563eb' }}>{stats.activeUsers}</div>
                    <div style={{ fontSize: '13px', color: '#64748b', marginTop: '8px', textTransform: 'uppercase', fontWeight: 600 }}>Active Users</div>
                  </div>
                  <div className="panel" style={{ padding: '24px', textAlign: 'center' }}>
                    <div style={{ fontSize: '32px', fontWeight: 700, color: '#2563eb' }}>{stats.newSignups}</div>
                    <div style={{ fontSize: '13px', color: '#64748b', marginTop: '8px', textTransform: 'uppercase', fontWeight: 600 }}>New Signups</div>
                  </div>
                  <div className="panel" style={{ padding: '24px', textAlign: 'center' }}>
                    <div style={{ fontSize: '32px', fontWeight: 700, color: '#16a34a' }}>{stats.serverHealth}</div>
                    <div style={{ fontSize: '13px', color: '#64748b', marginTop: '8px', textTransform: 'uppercase', fontWeight: 600 }}>Server Health</div>
                  </div>
                </div>
              )}
            </div>
          </section>
        </main>
      ) : (
        <main className="layout-grid">
          <aside className="panel composer-panel">
            <div className="panel-header">
              <h2>Authentication</h2>
            </div>

            <form onSubmit={onRegister} className="form-stack">
              <label className="field-label" htmlFor="user-name">Full Name</label>
              <input
                id="user-name"
                className="input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: John Doe"
              />

              <label className="field-label" htmlFor="user-email">Email Address</label>
              <input
                id="user-email"
                className="input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="user@example.com"
              />

              <label className="field-label" htmlFor="user-pass">Password</label>
              <input
                id="user-pass"
                type="password"
                className="input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="******"
              />

              <label className="field-label" style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', marginTop: '12px', color: '#10b981' }}>
                <input 
                  type="checkbox" 
                  checked={newsletter} 
                  onChange={(e) => setNewsletter(e.target.checked)} 
                />
                Subscribe to Newsletter (Bug Generator)
              </label>

              <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
                <button type="submit" className="button button-primary" style={{ flex: 1 }} disabled={loading}>
                  Register User
                </button>
                <button type="button" className="button" onClick={onLogin} style={{ flex: 1 }} disabled={loading}>
                  Login (Slow)
                </button>
              </div>
            </form>
          </aside>

          <section className="panel list-panel" style={{ gridColumn: 'span 2' }}>
            <div className="panel-header">
              <h2>User Database</h2>
              <span className="muted">{users.length} registered</span>
            </div>

            <div className="issue-list">
              {loading && !activeUser ? <div className="empty-state">Processing Request...</div> : null}
              {!loading && users.length === 0 ? <div className="empty-state">No users fetched. Click "Fetch Users" to load dummy data.</div> : null}

              {!loading && users.map((u) => (
                <div key={u.id} className="issue-row">
                  <div className="issue-row-line">
                    <span className="issue-id">{u.id.split('-')[0]}</span>
                    <span className="issue-title">{u.name} ({u.email})</span>
                    <span className={`status-pill status-closed`}>Role: {u.role || 'user'}</span>
                  </div>
                  <div className="issue-row-line issue-row-meta">
                    <span>Joined: {new Date(u.created_at).toLocaleTimeString()}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </main>
      )}

      {error ? <div className="toast-error">🚨 {error}</div> : null}
      {success ? <div className="toast-error" style={{ background: '#dcfce7', color: '#16a34a', borderColor: '#86efac' }}>✅ {success}</div> : null}
    </div>
  );
}
