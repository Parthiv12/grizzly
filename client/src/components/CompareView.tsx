import { useMemo, useState, useRef, useEffect } from 'react';
import type { RawTraceEvent, TraceSummary, TraceViewMode } from '../types/trace';
import { createSpanView, createGraph } from '../utils/trace-transform';
import { computeTraceDiff, type SpanDiffInfo } from '../utils/trace-diff';
import { generateHumanReadableExplanation } from '../features/compare/explanation/generateHumanReadableExplanation';
import { getPrimaryChangedSpan } from '../features/compare/explanation/explanationHelpers';
import { TraceGraph } from './TraceGraph';
import { formatDuration, formatTime } from '../utils/format';

function TraceCombobox({ value, onChange, traces, placeholder, disabledId }: { value?: string; onChange: (id?: string) => void; traces: TraceSummary[]; placeholder: string; disabledId?: string }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const selected = traces.find(t => t.traceId === value);
  const displayValue = selected ? `${formatTime(selected.startedAt)} - ${selected.method} ${selected.route} (${selected.traceId.slice(0, 6)})` : (value ? `Custom ID: ${value.slice(0,8)}...` : '');

  const filtered = useMemo(() => {
    if (!query) return traces;
    const lower = query.toLowerCase();
    return traces.filter(t => t.traceId.toLowerCase().includes(lower) || t.method.toLowerCase().includes(lower) || t.route.toLowerCase().includes(lower));
  }, [traces, query]);

  return (
    <div className="trace-combo" ref={ref}>
      <div className="trace-combo-input-wrapper">
        <input
           title={value || placeholder}
           className="input trace-combo-input"
           placeholder={displayValue || placeholder}
           value={query}
           onChange={e => {
             setQuery(e.target.value);
             setOpen(true);
           }}
           onFocus={() => setOpen(true)}
           onKeyDown={e => {
              if (e.key === 'Enter') {
                 const exact = traces.find(t => t.traceId === query);
                 if (exact && exact.traceId !== disabledId) { 
                   onChange(exact.traceId); 
                   setOpen(false); 
                   setQuery(''); 
                   return; 
                 }
                 // Allow arbitrary IDs to be pasted (TODO: Backend must support fetching single arbitrary trace if not mocked)
                 if (query && query !== disabledId) {
                    onChange(query);
                    setOpen(false);
                    setQuery('');
                 }
              }
           }}
        />
        <svg className={`trace-combo-icon ${open ? 'open' : ''}`} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"></polyline></svg>
      </div>
      {open && (
         <div className="trace-combo-dropdown">
           {filtered.length > 0 ? filtered.map(t => {
              const isDisabled = t.traceId === disabledId;
              const isActive = t.traceId === value;
              return (
                 <button 
                   type="button"
                   key={t.traceId} 
                   className={`trace-combo-item ${isActive ? 'active' : ''}`}
                   disabled={isDisabled}
                   onClick={() => { onChange(t.traceId); setOpen(false); setQuery(''); }}
                 >
                   <span className="combo-item-method">{t.method}</span>
                   <span className="combo-item-route">{t.route}</span>
                   <span className="combo-item-id">{t.traceId.slice(0, 6)}</span>
                 </button>
              );
           }) : (
             <div className="trace-combo-empty">
               {query ? 'Press Enter to apply custom ID overlay.' : 'No available traces.'}
             </div>
           )}
         </div>
      )}
    </div>
  );
}

interface CompareViewProps {
  traces: TraceSummary[];
  traceAId?: string;
  traceBId?: string;
  eventsA: RawTraceEvent[];
  eventsB: RawTraceEvent[];
  summaryA?: TraceSummary;
  summaryB?: TraceSummary;
  viewMode: TraceViewMode;
  onSetCompareA: (id?: string) => void;
  onSetCompareB: (id?: string) => void;
  onSwap: () => void;
  onReset: () => void;
}

export function CompareView({ traces, traceAId, traceBId, eventsA, eventsB, summaryA, summaryB, viewMode, onSetCompareA, onSetCompareB, onSwap, onReset }: CompareViewProps) {
  const spansA = useMemo(() => createSpanView(eventsA, viewMode), [eventsA, viewMode]);
  const spansB = useMemo(() => createSpanView(eventsB, viewMode), [eventsB, viewMode]);

  const [hoveredSpanId, setHoveredSpanId] = useState<string>();

  const { nodesA, edgesA, nodesB, edgesB, diffSummary, diffResult } = useMemo(() => {
    const gA = createGraph(spansA);
    const gB = createGraph(spansB);

    const diffResult = computeTraceDiff(spansA, spansB);

    const enhanceNodes = (nodes: any[], diffs: Record<string, SpanDiffInfo>, isTraceA: boolean) => {
      return nodes.map((n: any) => {
        const d = diffs[n.id];
        if (!d) return n;
        
        return {
          ...n,
          data: {
            ...n.data,
            isTraceA,
            comparisonState: d.state, // 'identical', 'changed', 'unique'
            diffInfo: d
          }
        };
      });
    };

    const enhancedA = enhanceNodes(gA.nodes, diffResult.aDiffs, true);
    const enhancedB = enhanceNodes(gB.nodes, diffResult.bDiffs, false);
    
    const { aOnlyCount: aUnique, bOnlyCount: bUnique, changedCount } = diffResult.metrics;
    const explanation = summaryA && summaryB ? generateHumanReadableExplanation(
       diffResult, spansA, spansB, summaryA.durationMs, summaryB.durationMs, summaryA.health, summaryB.health
    ) : null;
    
    const topChanged = getPrimaryChangedSpan(diffResult, spansA);

    let diffSummaryNode = (
      <p className="compare-subtitle">Select two traces from the dropdowns below or the sidebar to begin topological comparison.</p>
    );

    if (summaryA && summaryB) {
      const durationDiff = Math.abs(summaryA.durationMs - summaryB.durationMs);
      const faster = summaryA.durationMs <= summaryB.durationMs ? 'A' : 'B';
      const isStatusDiff = summaryA.health !== summaryB.health;
      const isHealthError = summaryA.health === 'error' || summaryB.health === 'error';
      
      diffSummaryNode = (
        <>
          <div className="diff-stats-bar">
            <div className={`diff-stat ${isStatusDiff || isHealthError ? 'diff-stat-warning' : ''}`}>
               <span className="diff-label">Outcome</span>
               <span className="diff-value">{summaryA.health.toUpperCase()} vs {summaryB.health.toUpperCase()}</span>
            </div>
            <div className="diff-stat">
               <span className="diff-label">Speed diff</span>
               <span className="diff-value">Trace {faster} was {formatDuration(durationDiff)} faster</span>
            </div>
            <div className={`diff-stat ${aUnique > 0 || bUnique > 0 || changedCount > 0 ? 'diff-stat-divergent' : 'diff-stat-identical'}`}>
               <span className="diff-label">Topology</span>
               <span className="diff-value">
                 {aUnique > 0 || bUnique > 0 
                   ? `${aUnique} unique A, ${bUnique} unique B, ${changedCount} changed`
                   : (changedCount > 0
                      ? `${changedCount} changed${topChanged ? `: ${topChanged.spanA.step}` : ''}`
                      : `Identical Execution Paths`)}
               </span>
            </div>
            <div className="diff-stat">
               <span className="diff-label">Span count</span>
               <span className="diff-value">{spansA.length} vs {spansB.length} spans</span>
            </div>
          </div>
          
          {explanation && (
            <div className="diff-explanations">
              <h4 className="diff-explanation-headline" style={{ margin: '0 0 8px 0', color: '#f8fafc', fontSize: '14px' }}>{explanation.headline}</h4>
              <ul className="diff-explanation-bullets" style={{ margin: 0, paddingLeft: '20px' }}>
                {explanation.bullets.map((part: string, i: number) => (
                  <li key={i} className="diff-explanation-text">{part}</li>
                ))}
              </ul>
            </div>
          )}
        </>
      );
    }

    return {
      nodesA: enhancedA,
      edgesA: gA.edges,
      nodesB: enhancedB,
      edgesB: gB.edges,
      diffSummary: diffSummaryNode,
      diffResult
    };
  }, [eventsA, eventsB, summaryA, summaryB, viewMode]);

  const displayNodesA = useMemo(() => {
    if (!hoveredSpanId || !diffResult) return nodesA;
    const pairedId = diffResult.aDiffs[hoveredSpanId]?.pairedSpanId || diffResult.bDiffs[hoveredSpanId]?.pairedSpanId;
    return nodesA.map((n: any) => ({
      ...n,
      data: { ...n.data, faded: n.id !== hoveredSpanId && n.id !== pairedId, highlighted: n.id === hoveredSpanId || n.id === pairedId }
    }));
  }, [nodesA, hoveredSpanId, diffResult]);

  const displayNodesB = useMemo(() => {
    if (!hoveredSpanId || !diffResult) return nodesB;
    const pairedId = diffResult.aDiffs[hoveredSpanId]?.pairedSpanId || diffResult.bDiffs[hoveredSpanId]?.pairedSpanId;
    return nodesB.map((n: any) => ({
      ...n,
      data: { ...n.data, faded: n.id !== hoveredSpanId && n.id !== pairedId, highlighted: n.id === hoveredSpanId || n.id === pairedId }
    }));
  }, [nodesB, hoveredSpanId, diffResult]);

  return (
    <div className="compare-workspace">
      <div className="compare-hero">
        <div className="compare-hero-header">
          <h2 className="compare-title">Compare Executions</h2>
          <div className="compare-hero-actions">
            <button className="button button-secondary" onClick={onSwap} disabled={!traceAId || !traceBId}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 3 21 3 21 8"></polyline><line x1="4" y1="20" x2="21" y2="3"></line><polyline points="21 16 21 21 16 21"></polyline><line x1="15" y1="15" x2="21" y2="21"></line><line x1="4" y1="4" x2="9" y2="9"></line></svg>
              Swap A/B
            </button>
            <button className="button button-danger" onClick={onReset} disabled={!traceAId && !traceBId}>
              Reset
            </button>
          </div>
        </div>
        {diffSummary}
      </div>
      <div className="compare-split-view">
        <div className="compare-graph-container">
          <div className="compare-panel-header compare-a">
            <span className="compare-badge compare-badge-a">A</span>
            <TraceCombobox 
              value={traceAId} 
              onChange={onSetCompareA} 
              traces={traces} 
              placeholder="Search or paste Trace ID A..." 
              disabledId={traceBId} 
            />
          </div>
          {traceAId ? (
            <TraceGraph
              nodes={displayNodesA}
              edges={edgesA}
              onSelectNode={() => {}}
              onNodeHover={setHoveredSpanId}
              summary={summaryA}
              viewMode={viewMode}
              mostlyInfraTrace={viewMode === 'business' && eventsA.length > 0 && nodesA.length === 0}
            />
          ) : (
            <div className="compare-empty-state">
              <span className="compare-badge compare-badge-a compare-badge-large">A</span>
              <h3>No Trace Selected</h3>
              <p>Choose Trace A to set the comparison baseline.</p>
            </div>
          )}
        </div>
        <div className="compare-graph-container">
          <div className="compare-panel-header compare-b">
            <span className="compare-badge compare-badge-b">B</span>
            <TraceCombobox 
              value={traceBId} 
              onChange={onSetCompareB} 
              traces={traces} 
              placeholder="Search or paste Trace ID B..." 
              disabledId={traceAId} 
            />
          </div>
          {traceBId ? (
            <TraceGraph
              nodes={displayNodesB}
              edges={edgesB}
              onSelectNode={() => {}}
              onNodeHover={setHoveredSpanId}
              summary={summaryB}
              viewMode={viewMode}
              mostlyInfraTrace={viewMode === 'business' && eventsB.length > 0 && nodesB.length === 0}
            />
          ) : (
            <div className="compare-empty-state">
              <span className="compare-badge compare-badge-b compare-badge-large">B</span>
              <h3>No Trace Selected</h3>
              <p>Choose Trace B to analyze execution differences.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
