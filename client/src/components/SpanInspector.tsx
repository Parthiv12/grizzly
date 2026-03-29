import type { SpanViewModel } from '../types/trace';
import { formatDuration, formatTime } from '../utils/format';

interface SpanInspectorProps {
  span?: SpanViewModel;
}

export function SpanInspector({ span }: SpanInspectorProps) {
  return (
    <aside className="panel inspector-panel">
      <div className="panel-header">
        <h2>Span Inspector</h2>
      </div>

      {!span ? (
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
