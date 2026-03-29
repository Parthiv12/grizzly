import { useMemo } from 'react';
import type { RawTraceEvent, TraceSummary, TraceViewMode } from '../types/trace';
import { createSpanView, createGraph } from '../utils/trace-transform';
import { TraceGraph } from './TraceGraph';
import { formatDuration } from '../utils/format';

interface CompareViewProps {
  eventsA: RawTraceEvent[];
  eventsB: RawTraceEvent[];
  summaryA?: TraceSummary;
  summaryB?: TraceSummary;
  viewMode: TraceViewMode;
}

export function CompareView({ eventsA, eventsB, summaryA, summaryB, viewMode }: CompareViewProps) {
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
        <h2 className="compare-title">Compare Mode</h2>
        <p className="compare-subtitle">{diffSummary}</p>
      </div>
      <div className="compare-split-view">
        <div className="compare-graph-container">
          <div className="compare-panel-header compare-a">
            <span className="compare-badge compare-badge-a">A</span>
            {summaryA ? (
              <span>{summaryA.method} {summaryA.route} ({formatDuration(summaryA.durationMs)})</span>
            ) : (
              <span className="muted">Select Trace A</span>
            )}
          </div>
          <TraceGraph
            nodes={nodesA}
            edges={edgesA}
            onSelectNode={() => {}}
            summary={summaryA}
            viewMode={viewMode}
            mostlyInfraTrace={viewMode === 'business' && eventsA.length > 0 && spansA.length === 0}
          />
        </div>
        <div className="compare-graph-container">
          <div className="compare-panel-header compare-b">
            <span className="compare-badge compare-badge-b">B</span>
            {summaryB ? (
              <span>{summaryB.method} {summaryB.route} ({formatDuration(summaryB.durationMs)})</span>
            ) : (
              <span className="muted">Select Trace B</span>
            )}
          </div>
          <TraceGraph
            nodes={nodesB}
            edges={edgesB}
            onSelectNode={() => {}}
            summary={summaryB}
            viewMode={viewMode}
            mostlyInfraTrace={viewMode === 'business' && eventsB.length > 0 && spansB.length === 0}
          />
        </div>
      </div>
    </div>
  );
}
