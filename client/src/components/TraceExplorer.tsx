import type { TraceHealth, TraceSummary } from '../types/trace';
import { formatDuration, formatTime, shortTraceId } from '../utils/format';

interface TraceExplorerProps {
  traces: TraceSummary[];
  activeTraceId?: string;
  onSelectTrace: (traceId: string) => void;
  statusFilter: 'all' | TraceHealth;
  onStatusFilterChange: (value: 'all' | TraceHealth) => void;
  shortcutsHint?: string;
  newTraceIds?: Set<string>;
  appMode?: 'explorer' | 'compare';
  compareTraceAId?: string;
  compareTraceBId?: string;
  onSetCompareA?: (traceId: string) => void;
  onSetCompareB?: (traceId: string) => void;
}

export function TraceExplorer({
  traces,
  activeTraceId,
  onSelectTrace,
  statusFilter,
  onStatusFilterChange,
  shortcutsHint,
  newTraceIds = new Set(),
  appMode = 'explorer',
  compareTraceAId,
  compareTraceBId,
  onSetCompareA,
  onSetCompareB
}: TraceExplorerProps) {
  return (
    <aside className="panel explorer-panel">
      <div className="panel-header">
        <h2>Trace Explorer</h2>
        <div className="trace-header-meta">
          {shortcutsHint ? <span className="keyboard-hint">{shortcutsHint}</span> : null}
          <span className="muted">{traces.length} traces</span>
        </div>
      </div>

      <div className="filter-row">
        <button type="button" className={`chip ${statusFilter === 'all' ? 'chip-active' : ''}`} onClick={() => onStatusFilterChange('all')}>
          All
        </button>
        <button
          type="button"
          className={`chip ${statusFilter === 'success' ? 'chip-active' : ''}`}
          onClick={() => onStatusFilterChange('success')}
        >
          Success
        </button>
        <button type="button" className={`chip ${statusFilter === 'error' ? 'chip-active' : ''}`} onClick={() => onStatusFilterChange('error')}>
          Error
        </button>
        <button type="button" className={`chip ${statusFilter === 'slow' ? 'chip-active' : ''}`} onClick={() => onStatusFilterChange('slow')}>
          Slow
        </button>
      </div>

      <div className="trace-list" role="listbox" aria-label="Trace list">
        {traces.map((trace) => {
          const active = appMode === 'explorer' && activeTraceId === trace.traceId;
          const isCompareA = appMode === 'compare' && compareTraceAId === trace.traceId;
          const isCompareB = appMode === 'compare' && compareTraceBId === trace.traceId;
          const isNew = newTraceIds.has(trace.traceId);
          const statusClass = `status-${trace.health}`;
          
          let compareClass = '';
          if (isCompareA) compareClass = 'trace-row-compare-a';
          else if (isCompareB) compareClass = 'trace-row-compare-b';

          return (
            <div
              key={trace.traceId}
              className={`trace-row ${active ? 'trace-row-active' : ''} trace-row-${trace.health} ${isNew ? 'trace-row-new' : ''} ${compareClass}`}
              onClick={(e) => {
                // Ignore general click if in compare mode and they are trying to click the buttons.
                // But honestly, we can just let row clicks set activeTraceId if they want in explorer
                if (appMode === 'explorer') {
                  onSelectTrace(trace.traceId);
                }
              }}
              role="option"
              aria-selected={active}
            >
              <div className="trace-row-main" style={{ display: 'flex', alignItems: 'center' }}>
                <span className="method">{trace.method}</span>
                <span className="route" style={{ flex: 1 }}>
                  {trace.route}
                  {isNew && <span className="new-badge">NEW</span>}
                </span>

                {appMode === 'compare' ? (
                  <div className="compare-actions">
                    <button 
                      type="button" 
                      className={`compare-btn ${isCompareA ? 'active' : ''}`} 
                      onClick={(e) => { e.stopPropagation(); onSetCompareA?.(trace.traceId); }}
                    >A</button>
                    <button 
                      type="button" 
                      className={`compare-btn ${isCompareB ? 'active' : ''}`} 
                      onClick={(e) => { e.stopPropagation(); onSetCompareB?.(trace.traceId); }}
                    >B</button>
                  </div>
                ) : (
                  <div className={`status-indicator indicator-${trace.health}`} />
                )}
              </div>
              <div className="trace-row-sub">
                <span className="trace-id" title={trace.traceId}>{shortTraceId(trace.traceId)}</span>
                <span className="duration">{formatDuration(trace.durationMs)}</span>
              </div>
              <div className="trace-row-meta">
                <span>{formatTime(trace.startedAt)}</span>
                <span className="trace-signal trace-signal-business">B {trace.businessSpanCount}</span>
                <span className="trace-signal trace-signal-infra">I {trace.infraSpanCount}</span>
                {trace.hasDatabaseInteraction ? <span className="trace-signal trace-signal-db">DB</span> : null}
              </div>
            </div>
          );
        })}

        {traces.length === 0 ? (
          <div className="empty-state">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{margin: '0 auto 10px', display: 'block', opacity: 0.5}}>
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            No traces found for this exact filter.
          </div>
        ) : null}
      </div>
    </aside>
  );
}
