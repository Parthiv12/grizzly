import type { TraceHealth, TraceSummary } from '../types/trace';
import { formatDuration, formatTime, shortTraceId } from '../utils/format';

interface TraceExplorerProps {
  traces: TraceSummary[];
  activeTraceId?: string;
  onSelectTrace: (traceId: string) => void;
  statusFilter: 'all' | TraceHealth;
  onStatusFilterChange: (value: 'all' | TraceHealth) => void;
  shortcutsHint?: string;
}

export function TraceExplorer({
  traces,
  activeTraceId,
  onSelectTrace,
  statusFilter,
  onStatusFilterChange,
  shortcutsHint
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
          const active = activeTraceId === trace.traceId;
          return (
            <button
              type="button"
              key={trace.traceId}
              className={`trace-row ${active ? 'trace-row-active' : ''}`}
              onClick={() => onSelectTrace(trace.traceId)}
              aria-pressed={active}
              role="option"
              aria-selected={active}
            >
              <div className="trace-row-line">
                <span className="method">{trace.method}</span>
                <span className="route">{trace.route}</span>
                <span className={`status-pill status-${trace.health}`}>{trace.health}</span>
              </div>
              <div className="trace-row-line trace-row-meta">
                <span>{shortTraceId(trace.traceId)}</span>
                <span>{trace.statusCode}</span>
                <span>{formatDuration(trace.durationMs)}</span>
                <span>{formatTime(trace.startedAt)}</span>
                <span className="trace-signal trace-signal-business">B {trace.businessSpanCount}</span>
                <span className="trace-signal trace-signal-infra">I {trace.infraSpanCount}</span>
                {trace.hasDatabaseInteraction ? <span className="trace-signal trace-signal-db">DB</span> : null}
              </div>
            </button>
          );
        })}

        {traces.length === 0 ? <div className="empty-state">No traces found for this filter.</div> : null}
      </div>
    </aside>
  );
}
