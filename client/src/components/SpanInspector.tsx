import type { SpanViewModel, TraceSummary } from '../types/trace';
import { formatDuration, formatTime, shortTraceId } from '../utils/format';

interface SpanInspectorProps {
  span?: SpanViewModel;
  summary?: TraceSummary;
  spans?: SpanViewModel[];
  onClose?: () => void;
  onCompareTrace?: () => void;
}

export function SpanInspector({ span, summary, spans, onClose, onCompareTrace }: SpanInspectorProps) {
  const isClosed = !span;
  return (
    <aside className="panel inspector-panel">
      <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>{isClosed ? 'Trace Overview' : 'Span Inspector'}</h2>
        {!isClosed && (
          <button 
            type="button" 
            className="button" 
            style={{ width: '32px', height: '32px', padding: 0, display: 'flex', justifyContent: 'center', alignItems: 'center' }}
            onClick={onClose}
            aria-label="Close Inspector"
            title="Close (Esc)"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        )}
      </div>

      {isClosed && summary ? (
        <TraceOverviewPanel summary={summary} spans={spans || []} onCompareTrace={onCompareTrace} />
      ) : isClosed ? (
        <div className="inspector-empty">
          <div className="inspector-empty-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
              <line x1="16" y1="13" x2="8" y2="13"></line>
              <line x1="16" y1="17" x2="8" y2="17"></line>
              <polyline points="10 9 9 9 8 9"></polyline>
            </svg>
          </div>
          <h3 className="empty-title">No span selected</h3>
          <p className="empty-desc">Click on any node in the trace graph to inspect its metadata, timing, and properties.</p>
        </div>
      ) : (
        <div className="inspector-body">
          <div className={`span-summary status-${span.status}`}>
            <div className="span-summary-header">
              <span className={`status-pill status-${span.status}`}>{span.status}</span>
              <p className="span-subtitle">{span.layer}</p>
            </div>
            <p className="span-title">{span.step}</p>
          </div>

          <InspectorField label="Layer" value={span.layer} />
          <InspectorField label="Step" value={span.step} />
          <InspectorField label="Status" value={span.status} />
          <InspectorField label="Duration" value={formatDuration(span.durationMs)} />
          <InspectorField label="Timestamp" value={formatTime(span.timestamp)} />
          <InspectorField label="Trace ID" value={span.traceId} />

          <div className="inspector-block">
            <p className="inspector-label">Metadata</p>
            {Object.keys(span.metadata ?? {}).length === 0 ? (
              <div className="metadata-empty">No metadata available</div>
            ) : (
              <div className="metadata-list" role="table" aria-label="Span metadata">
                {Object.entries(span.metadata ?? {}).map(([key, value]) => (
                  <div key={key} className="metadata-row" role="row">
                    <span className="metadata-key" role="cell">
                      {key}
                    </span>
                    <span className="metadata-value" role="cell">
                      {formatMetadataValue(value)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </aside>
  );
}

function TraceOverviewPanel({ summary, spans, onCompareTrace }: { summary: TraceSummary; spans: SpanViewModel[]; onCompareTrace?: () => void }) {
  const errorCount = spans.filter(s => s.status === 'error').length;
  const slowestSpan = spans.reduce((slowest, current) => current.durationMs > slowest.durationMs ? current : slowest, spans[0]);
  const layers = Array.from(new Set(spans.map(s => s.layer)));

  const handleCopy = () => {
    navigator.clipboard.writeText(summary.traceId);
  };

  return (
    <div className="inspector-body trace-overview">
      <div className={`span-summary status-${summary.health}`}>
        <div className="span-summary-header">
          <span className={`status-pill status-${summary.health}`}>{summary.health}</span>
          <p className="span-subtitle">{summary.startedAt ? formatTime(summary.startedAt) : ''}</p>
        </div>
        <p className="span-title">{summary.route || summary.method || summary.traceId}</p>
      </div>

      <InspectorField label="Method / Route" value={summary.route ? `${summary.method} ${summary.route}` : summary.method} />
      <InspectorField label="Duration" value={formatDuration(summary.durationMs)} />
      <InspectorField label="Status" value={summary.health === 'error' ? `${errorCount} errors` : 'Success'} />
      
      <div className="inspector-block">
        <p className="inspector-label">Key Insights</p>
        <div className="insight-card">
          {errorCount > 0 ? (
            <p><span role="img" aria-label="alert">⚠️</span> Failed at <strong>{spans.find(s => s.status === 'error')?.step || 'unknown step'}</strong> layer.</p>
          ) : slowestSpan ? (
            <p><span role="img" aria-label="clock">⏱️</span> Slowest span is <strong>{slowestSpan.step}</strong> ({formatDuration(slowestSpan.durationMs)}).</p>
          ) : (
            <p><span role="img" aria-label="check">✅</span> Execution completed normally.</p>
          )}
        </div>
      </div>

      <InspectorField label="Layers Touched" value={layers.join(' → ')} />
      
      <div className="overview-actions" style={{ marginTop: '24px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <p className="inspector-label" style={{ marginBottom: '4px' }}>Actions</p>
        <button className="button button-secondary" onClick={onCompareTrace} style={{ width: '100%', justifyContent: 'center' }}>
          Compare This Trace
        </button>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="button button-secondary" onClick={handleCopy} style={{ flex: 1, justifyContent: 'center' }}>
            Copy Trace ID
          </button>
          <button className="button button-secondary" disabled style={{ flex: 1, justifyContent: 'center', opacity: 0.5 }}>
            Open Metrics
          </button>
        </div>
      </div>
    </div>
  );
}

interface InspectorFieldProps {
  label: string;
  value: string;
}

function InspectorField({ label, value }: InspectorFieldProps) {
  return (
    <div className="inspector-field">
      <p className="inspector-label">{label}</p>
      <p className="inspector-value">{value}</p>
    </div>
  );
}

function formatMetadataValue(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (value == null) {
    return 'null';
  }
  return JSON.stringify(value);
}
