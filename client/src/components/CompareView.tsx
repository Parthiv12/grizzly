import { useMemo, useState, useRef, useEffect } from 'react';
import type { RawTraceEvent, TraceSummary, TraceViewMode } from '../types/trace';
import { createSpanView, createGraph } from '../utils/trace-transform';
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

  const { nodesA, edgesA, nodesB, edgesB, diffSummary } = useMemo(() => {
    const gA = createGraph(spansA);
    const gB = createGraph(spansB);

    const matchSpan = (span: any, otherSpans: any[]) => {
      // Basic heuristic: same layer and step means they are "the same" conceptual node.
      return otherSpans.some(os => os.layer === span.layer && os.step === span.step);
    };

    let aUnique = 0;
    let bUnique = 0;

    const enhanceNodes = (nodes: any[], spans: any[], otherSpans: any[], isA: boolean) => {
      if (spans.length === 0 || otherSpans.length === 0) return nodes;
      return nodes.map(n => {
        const span = spans.find(s => s.id === n.id);
        if (!span) return n;
        const shared = matchSpan(span, otherSpans);
        
        if (!shared) {
          if (isA) aUnique++; else bUnique++;
        }

        return {
          ...n,
          data: {
            ...n.data,
            comparisonState: shared ? 'shared' : 'unique'
          }
        };
      });
    };

    const enhancedA = enhanceNodes(gA.nodes, spansA, spansB, true);
    const enhancedB = enhanceNodes(gB.nodes, spansB, spansA, false);

    let summaryText = `Select two traces to compare execution paths.`;
    if (summaryA && summaryB) {
      if (summaryA.health === 'success' && summaryB.health !== 'success') {
        summaryText = `Trace B failed to complete the path relative to Trace A.`;
      } else if (summaryB.health === 'success' && summaryA.health !== 'success') {
        summaryText = `Trace A failed to complete the path relative to Trace B.`;
      } else if (aUnique === 0 && bUnique === 0) {
        summaryText = `Identical topological execution paths. Time diff: ${Math.abs(summaryA.durationMs - summaryB.durationMs)}ms.`;
      } else {
        summaryText = `Trace A has ${aUnique} unique nodes. Trace B has ${bUnique} unique nodes.`;
      }
    }

    return {
      nodesA: enhancedA,
      edgesA: gA.edges,
      nodesB: enhancedB,
      edgesB: gB.edges,
      diffSummary: summaryText
    };
  }, [spansA, spansB, summaryA, summaryB]);

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
        <p className="compare-subtitle">{summaryA && summaryB ? diffSummary : 'Select two traces from the dropdowns below or the sidebar to begin topological comparison.'}</p>
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
              nodes={nodesA}
              edges={edgesA}
              onSelectNode={() => {}}
              summary={summaryA}
              viewMode={viewMode}
              mostlyInfraTrace={viewMode === 'business' && eventsA.length > 0 && spansA.length === 0}
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
              nodes={nodesB}
              edges={edgesB}
              onSelectNode={() => {}}
              summary={summaryB}
              viewMode={viewMode}
              mostlyInfraTrace={viewMode === 'business' && eventsB.length > 0 && spansB.length === 0}
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
