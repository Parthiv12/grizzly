import { useEffect, useMemo, useState } from 'react';
import type { TraceSummary } from '../types/trace';
import { formatDuration, formatTime, shortTraceId } from '../utils/format';

interface TraceQuickJumpProps {
  open: boolean;
  traces: TraceSummary[];
  activeTraceId?: string;
  onClose: () => void;
  onSelectTrace: (traceId: string) => void;
}

export function TraceQuickJump({ open, traces, activeTraceId, onClose, onSelectTrace }: TraceQuickJumpProps) {
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!open) {
      setQuery('');
    }
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose, open]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      return traces.slice(0, 12);
    }
    return traces
      .filter((trace) => {
        return (
          trace.traceId.toLowerCase().includes(q) ||
          trace.route.toLowerCase().includes(q) ||
          trace.method.toLowerCase().includes(q)
        );
      })
      .slice(0, 12);
  }, [query, traces]);

  if (!open) {
    return null;
  }

  return (
    <div className="quick-jump-overlay" onClick={onClose}>
      <div className="quick-jump-modal" onClick={(event) => event.stopPropagation()}>
        <div className="quick-jump-head">
          <p className="quick-jump-title">Jump To Trace</p>
          <span className="keyboard-hint">Esc to close</span>
        </div>

        <input
          className="input quick-jump-input"
          placeholder="Type route, method, or trace id"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          autoFocus
        />

        <div className="quick-jump-list">
          {visible.map((trace) => {
            const isActive = trace.traceId === activeTraceId;
            return (
              <button
                key={trace.traceId}
                type="button"
                className={`quick-jump-row ${isActive ? 'quick-jump-row-active' : ''}`}
                onClick={() => {
                  onSelectTrace(trace.traceId);
                  onClose();
                }}
              >
                <span className="method">{trace.method}</span>
                <span className="quick-jump-route">{trace.route}</span>
                <span className="muted">{shortTraceId(trace.traceId)}</span>
                <span className="muted">{formatDuration(trace.durationMs)}</span>
                <span className="muted">{formatTime(trace.startedAt)}</span>
              </button>
            );
          })}

          {visible.length === 0 ? <div className="empty-state">No traces match this query.</div> : null}
        </div>
      </div>
    </div>
  );
}
