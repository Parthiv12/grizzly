import { BrandLogo } from './BrandLogo';

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
  autoSelectNew: boolean;
  onToggleAutoSelect: () => void;
  appMode: 'explorer' | 'compare';
  onAppModeChange: (mode: 'explorer' | 'compare') => void;
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
  slow,
  autoSelectNew,
  onToggleAutoSelect,
  appMode,
  onAppModeChange
}: TopBarProps) {
  return (
    <header className="topbar">
      <div className="brand-block">
        <BrandLogo size={22} className="brand-logo" />
        <div className="brand-text">
          <p className="brand-name">TraceLens</p>
          <div className="app-mode-tabs" role="tablist">
            <button
              type="button"
              className={`app-tab ${appMode === 'explorer' ? 'active' : ''}`}
              onClick={() => onAppModeChange('explorer')}
            >
              Explorer
            </button>
            <button
              type="button"
              className={`app-tab ${appMode === 'compare' ? 'active' : ''}`}
              onClick={() => onAppModeChange('compare')}
            >
              Compare
            </button>
          </div>
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

          <div className="mode-toggle" role="tablist" aria-label="Backend layer view mode">
            <button
              type="button"
              className={`mode-chip ${viewMode === 'business' ? 'mode-chip-active' : ''}`}
              onClick={() => onViewModeChange('business')}
            >
              Logical Flow
            </button>
            <button
              type="button"
              className={`mode-chip ${viewMode === 'infra' ? 'mode-chip-active' : ''}`}
              onClick={() => onViewModeChange('infra')}
            >
              Raw Spans
            </button>
          </div>
        </div>

        <input
          className="input"
          placeholder="Search trace id, route, step"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
        />

        {live && (
          <label className="auto-select-toggle" title="Automatically centers important nodes">
            <input type="checkbox" checked={autoSelectNew} onChange={onToggleAutoSelect} />
            <span className="toggle-label">Auto-focus</span>
          </label>
        )}

        <button type="button" className={`button ${live ? 'button-live' : ''}`} onClick={onToggleLive}>
          {live ? 'Live On' : 'Live Off'}
        </button>

        <button type="button" className="button" onClick={onRefresh} disabled={live}>
          Refresh Data
        </button>

        <button type="button" className="button" onClick={onOpenQuickJump}>
          Jump (Ctrl+K)
        </button>

        <div className="stats-row" aria-label="Trace stats">
          <div className="stats-snapshot-label">Live System Snapshot</div>
          <div className="stats-pills">
            <span className="top-stat">{total} Traces</span>
            <span className="top-stat top-stat-error">{errors} Errors</span>
            <span className="top-stat top-stat-slow">{slow} Slow</span>
          </div>
        </div>
      </div>
    </header>
  );
}
