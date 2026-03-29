interface TopBarProps {
  services: string[];
  selectedService?: string;
  onServiceChange: (service: string) => void;
  viewMode: 'business' | 'infra';
  onViewModeChange: (mode: 'business' | 'infra') => void;
  query: string;
  onQueryChange: (value: string) => void;
  live: boolean;
  onToggleLive: () => void;
  onRefresh: () => void;
  onOpenQuickJump: () => void;
  total: number;
  errors: number;
  slow: number;
}

export function TopBar({
  services,
  selectedService,
  onServiceChange,
  viewMode,
  onViewModeChange,
  query,
  onQueryChange,
  live,
  onToggleLive,
  onRefresh,
  onOpenQuickJump,
  total,
  errors,
  slow
}: TopBarProps) {
  return (
    <header className="topbar">
      <div className="brand-block">
        <div className="brand-dot" />
        <div>
          <p className="brand-name">Debug Flow Visualizer</p>
          <p className="brand-subtitle">Trace Explorer</p>
        </div>
      </div>

      <div className="topbar-controls">
        <div className="control-cluster">
          <select className="input input-select" value={selectedService ?? ''} onChange={(event) => onServiceChange(event.target.value)}>
            {services.length === 0 ? <option value="">No services</option> : null}
            {services.map((service) => (
              <option key={service} value={service}>
                {service}
              </option>
            ))}
          </select>

          <div className="mode-toggle" role="tablist" aria-label="Trace view mode">
            <button
              type="button"
              className={`mode-chip ${viewMode === 'business' ? 'mode-chip-active' : ''}`}
              onClick={() => onViewModeChange('business')}
            >
              Business Mode
            </button>
            <button
              type="button"
              className={`mode-chip ${viewMode === 'infra' ? 'mode-chip-active' : ''}`}
              onClick={() => onViewModeChange('infra')}
            >
              Infra Mode
            </button>
          </div>
        </div>

        <input
          className="input"
          placeholder="Search trace id, route, step"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
        />

        <button type="button" className={`button ${live ? 'button-live' : ''}`} onClick={onToggleLive}>
          {live ? 'Live On' : 'Live Off'}
        </button>

        <button type="button" className="button" onClick={onRefresh}>
          Refresh
        </button>

        <button type="button" className="button" onClick={onOpenQuickJump}>
          Jump (Ctrl+K)
        </button>

        <div className="stats-row" aria-label="Trace stats">
          <span className="top-stat">{total} traces</span>
          <span className="top-stat top-stat-error">{errors} errors</span>
          <span className="top-stat top-stat-slow">{slow} slow</span>
        </div>
      </div>
    </header>
  );
}
