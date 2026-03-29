import React, { useState } from 'react';
import { useTraceMetrics } from '../../hooks/useTraceMetrics';
import { MetricCard, TimeWindowSelector } from './MetricComponents';

interface MetricsPanelProps {
  traceId: string;
  onClose: () => void;
}

export function MetricsPanel({ traceId, onClose }: MetricsPanelProps) {
  const [window, setWindow] = useState('15m');
  const { data, loading, error } = useTraceMetrics(traceId, window);

  return (
    <aside className="panel metrics-panel" style={{ width: '420px', display: 'flex', flexDirection: 'column' }}>
      <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ fontSize: '15px', fontWeight: 600, margin: 0 }}>Metrics Context</h2>
        <button 
          type="button" 
          className="button button-secondary" 
          style={{ width: '28px', height: '28px', padding: 0, display: 'flex', justifyContent: 'center', alignItems: 'center', marginLeft: 'auto' }}
          onClick={onClose}
          aria-label="Close Metrics"
          title="Close Metrics"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
      </div>

      <div className="metrics-body" style={{ padding: '16px', overflowY: 'auto', flex: 1 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <span style={{ fontSize: '14px', color: '#94a3b8' }}>Time Window</span>
          <TimeWindowSelector window={window} onSelect={setWindow} />
        </div>

        {loading ? (
          <div className="metrics-loading" style={{ color: '#94a3b8', textAlign: 'center', padding: '40px' }}>Loading metrics...</div>
        ) : error ? (
          <div className="metrics-error" style={{ color: '#ef4444', textAlign: 'center', padding: '40px' }}>{error}</div>
        ) : !data ? (
          <div className="metrics-empty" style={{ color: '#94a3b8', textAlign: 'center', padding: '40px' }}>No metrics available</div>
        ) : (
          <div className="metrics-content" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            
            {/* Health Summary */}
            <div className="metrics-section">
              <h3 className="metrics-section-title">Health Summary</h3>
              <div className="health-pills" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '8px' }}>
                {data.routeMetrics.errorRate > 0.05 ? (
                  <span className="health-pill error">Error rate elevated</span>
                ) : (
                  <span className="health-pill success">Route healthy</span>
                )}
                {data.routeMetrics.p95LatencyMs > 500 ? (
                  <span className="health-pill warn">Latency trending high</span>
                ) : null}
                {data.routeMetrics.dbHeavyCount > Math.floor(data.routeMetrics.requestCount * 0.1) && data.routeMetrics.dbHeavyCount > 0 ? (
                  <span className="health-pill warn">DB-heavy pattern detected</span>
                ) : null}
              </div>
            </div>

            {/* Route Metrics */}
            <div className="metrics-section">
              <div style={{ display: 'flex', flexDirection: 'column', marginBottom: '12px' }}>
                <h3 className="metrics-section-title" style={{ margin: 0 }}>Route Metrics</h3>
                <span style={{ fontSize: '13px', color: '#c4d4eb' }}>{data.route || 'Unknown Route'}</span>
              </div>
              <div className="metrics-grid">
                <MetricCard label="Requests" value={data.routeMetrics.requestCount} />
                <MetricCard label="Error Rate" value={`${(data.routeMetrics.errorRate * 100).toFixed(1)}%`} isError={data.routeMetrics.errorRate > 0.05} />
                <MetricCard label="Avg Latency" value={`${data.routeMetrics.avgLatencyMs}ms`} />
                <MetricCard label="P95 Latency" value={`${data.routeMetrics.p95LatencyMs}ms`} />
              </div>
              <div className="metrics-grid" style={{ marginTop: '12px' }}>
                <MetricCard label="Slow Traces" value={data.routeMetrics.slowCount} subValue={`>500ms`} />
                <MetricCard label="DB-Heavy" value={data.routeMetrics.dbHeavyCount} subValue={`>5 calls`} />
              </div>
            </div>

            {/* Service Metrics */}
            <div className="metrics-section">
              <div style={{ display: 'flex', flexDirection: 'column', marginBottom: '12px' }}>
                <h3 className="metrics-section-title" style={{ margin: 0 }}>Service Metrics</h3>
                <span style={{ fontSize: '13px', color: '#c4d4eb' }}>{data.primaryService || 'Unknown Service'}</span>
              </div>
              <div className="metrics-grid">
                <MetricCard label="Requests" value={data.serviceMetrics.requestCount} />
                <MetricCard label="Error Rate" value={`${(data.serviceMetrics.errorRate * 100).toFixed(1)}%`} isError={data.serviceMetrics.errorRate > 0.05} />
                <MetricCard label="Avg Latency" value={`${data.serviceMetrics.avgLatencyMs}ms`} />
                <MetricCard label="P95 Latency" value={`${data.serviceMetrics.p95LatencyMs}ms`} />
              </div>
              <div className="metrics-grid" style={{ marginTop: '12px', gridTemplateColumns: 'repeat(1, 1fr)' }}>
                <MetricCard label="Most Common Bottleneck" value={data.serviceMetrics.mostCommonBottleneck} />
              </div>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
