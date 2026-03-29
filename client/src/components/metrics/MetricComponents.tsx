import React from 'react';

interface MetricCardProps {
  label: string;
  value: string | number;
  subValue?: string;
  isError?: boolean;
}

export function MetricCard({ label, value, subValue, isError }: MetricCardProps) {
  return (
    <div className={`metric-card ${isError ? 'metric-card-error' : ''}`}>
      <span className="metric-label">{label}</span>
      <div className="metric-value">{value}</div>
      {subValue && <div className="metric-subvalue">{subValue}</div>}
    </div>
  );
}

export function TimeWindowSelector({ window, onSelect }: { window: string; onSelect: (w: string) => void }) {
  const options = ['5m', '15m', '1h'];
  return (
    <div className="window-selector">
      {options.map((w) => (
        <button
          key={w}
          type="button"
          className={`window-btn ${window === w ? 'active' : ''}`}
          onClick={() => onSelect(w)}
        >
          {w}
        </button>
      ))}
    </div>
  );
}
