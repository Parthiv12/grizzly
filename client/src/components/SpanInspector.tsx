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
        <div className="empty-state">Select a span node to inspect details.</div>
      ) : (
        <div className="inspector-body">
          <div className="span-summary">
            <p className="span-title">{span.step}</p>
            <p className="span-subtitle">{span.layer}</p>
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
