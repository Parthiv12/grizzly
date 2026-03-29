import { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import type { Edge, Node } from 'reactflow';
import { fetchTraceEventsByServiceScoped, fetchTraceServices } from './api/traces';
import { SpanInspector } from './components/SpanInspector';
import { TopBar } from './components/TopBar';
import { TraceExplorer } from './components/TraceExplorer';
import { TraceGraph } from './components/TraceGraph';
import { TraceQuickJump } from './components/TraceQuickJump';
import { CompareView } from './components/CompareView';
import type { RawTraceEvent, SpanViewModel, TraceHealth, TraceViewMode } from './types/trace';
import { classifySpan, createGraph, createSpanView, createTraceSummaries, groupEventsByTraceId } from './utils/trace-transform';
import { executeReplayRequest, isReplaySafe } from './features/compare/replay/replayLogic';

const INTERNAL_SERVICE_NAMES = new Set(['debug-flow-visualizer-backend', 'jaeger-all-in-one']);

export function App() {
  const [events, setEvents] = useState<RawTraceEvent[]>([]);
  const [services, setServices] = useState<string[]>([]);
  const [selectedService, setSelectedService] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [live, setLive] = useState(false);
  const [viewMode, setViewMode] = useState<TraceViewMode>('business');
  const [statusFilter, setStatusFilter] = useState<'all' | TraceHealth>('all');
  const [activeTraceId, setActiveTraceId] = useState<string | undefined>(undefined);
  const [selectedNodeId, setSelectedNodeId] = useState<string | undefined>(undefined);
  const [quickJumpOpen, setQuickJumpOpen] = useState(false);
  const [autoSelectNew, setAutoSelectNew] = useState(false);
  const [isGraphHovered, setIsGraphHovered] = useState(false);
  const [replaying, setReplaying] = useState(false);
  const [newTraceIds, setNewTraceIds] = useState<Set<string>>(new Set());
  const seenTraceIds = useRef<Set<string>>(new Set());

  // Compare mode states
  const [appMode, setAppMode] = useState<'explorer' | 'compare'>('explorer');
  const [compareTraceAId, setCompareTraceAId] = useState<string | undefined>(undefined);
  const [compareTraceBId, setCompareTraceBId] = useState<string | undefined>(undefined);

  const loadServices = useCallback(async () => {
    try {
      const discoveredServices = await fetchTraceServices(true);
      setServices(discoveredServices);
      if (!selectedService && discoveredServices.length > 0) {
        const preferred = discoveredServices.find((service) => !INTERNAL_SERVICE_NAMES.has(service)) ?? discoveredServices[0];
        setSelectedService(preferred);
      }
      if (selectedService && !discoveredServices.includes(selectedService)) {
        setSelectedService(discoveredServices[0]);
      }
    } catch {
      setServices([]);
      if (!selectedService) {
        setError('Failed to load trace services from backend.');
      }
    }
  }, [selectedService]);

  const loadEvents = useCallback(async () => {
    if (!selectedService) {
      setEvents([]);
      setLoading(false);
      return;
    }

    try {
      setError(null);
      if (events.length === 0) {
        setLoading(true);
      }
      const includeInternal = INTERNAL_SERVICE_NAMES.has(selectedService);
      const data = await fetchTraceEventsByServiceScoped(selectedService, includeInternal);
      setEvents(data);
      if (!activeTraceId && data.length > 0) {
        const firstTraceId = data[0].traceId;
        setActiveTraceId(firstTraceId);
      }
    } catch (requestError) {
      setError('Failed to fetch traces. Ensure backend is running on localhost:3000.');
    } finally {
      setLoading(false);
    }
  }, [activeTraceId, events.length, selectedService]);

  useEffect(() => {
    void loadServices();
  }, [loadServices]);

  useEffect(() => {
    void loadEvents();
  }, [loadEvents]);

  useEffect(() => {
    setActiveTraceId(undefined);
    setSelectedNodeId(undefined);
  }, [selectedService]);

  useEffect(() => {
    setSelectedNodeId(undefined);
  }, [viewMode]);

  useEffect(() => {
    if (!live || isGraphHovered) {
      return;
    }
    const intervalId = window.setInterval(() => {
      void loadEvents();
    }, 2000);
    return () => window.clearInterval(intervalId);
  }, [live, isGraphHovered, loadEvents]);

  const traceSummaries = useMemo(() => createTraceSummaries(events, viewMode), [events, viewMode]);

  useEffect(() => {
    if (traceSummaries.length === 0) return;
    
    let isInitialLoad = seenTraceIds.current.size === 0;
    const newlyAdded: string[] = [];
    
    for (const t of traceSummaries) {
      if (!seenTraceIds.current.has(t.traceId)) {
        newlyAdded.push(t.traceId);
        seenTraceIds.current.add(t.traceId);
      }
    }

    if (newlyAdded.length > 0 && !isInitialLoad) {
      setNewTraceIds(prev => new Set([...prev, ...newlyAdded]));
      
      if (autoSelectNew) {
        const newest = traceSummaries.filter(t => newlyAdded.includes(t.traceId)).sort((a,b) => b.startedAt - a.startedAt)[0];
        if (newest) {
          setActiveTraceId(newest.traceId);
          setSelectedNodeId(undefined);
        }
      }

      setTimeout(() => {
        setNewTraceIds(prev => {
          const next = new Set(prev);
          newlyAdded.forEach(id => next.delete(id));
          return next;
        });
      }, 4000);
    }
  }, [traceSummaries, autoSelectNew]);
  const groupedTraceEvents = useMemo(() => groupEventsByTraceId(events), [events]);

  const summaryByTraceId = useMemo(() => {
    return new Map(traceSummaries.map((summary) => [summary.traceId, summary]));
  }, [traceSummaries]);

  const filteredTraces = useMemo(() => {
    const q = query.trim().toLowerCase();
    return traceSummaries.filter((trace) => {
      const matchesFilter = statusFilter === 'all' || trace.health === statusFilter;
      if (!matchesFilter) {
        return false;
      }
      if (!q) {
        return true;
      }
      const traceEvents = groupedTraceEvents.get(trace.traceId) ?? [];
      const searchableEvents = viewMode === 'business' ? traceEvents.filter((event) => classifySpan(event) === 'business') : traceEvents;
      const hasStepMatch = searchableEvents.some((event) => event.step.toLowerCase().includes(q));
      return (
        trace.traceId.toLowerCase().includes(q) ||
        trace.route.toLowerCase().includes(q) ||
        trace.method.toLowerCase().includes(q) ||
        hasStepMatch ||
        searchableEvents.some((event) => {
          const operation = String(event.metadata?.operation ?? '').toLowerCase();
          return operation.includes(q);
        })
      );
    });
  }, [groupedTraceEvents, query, statusFilter, traceSummaries, viewMode]);

  useEffect(() => {
    if (!activeTraceId && filteredTraces.length > 0) {
      setActiveTraceId(filteredTraces[0].traceId);
      return;
    }
    if (activeTraceId && !filteredTraces.some((trace) => trace.traceId === activeTraceId)) {
      setActiveTraceId(filteredTraces[0]?.traceId);
      setSelectedNodeId(undefined);
    }
  }, [activeTraceId, filteredTraces]);

  const activeTraceEvents = useMemo(() => {
    if (!activeTraceId) {
      return [];
    }
    return groupedTraceEvents.get(activeTraceId) ?? [];
  }, [activeTraceId, groupedTraceEvents]);

  const spans = useMemo<SpanViewModel[]>(() => createSpanView(activeTraceEvents, viewMode), [activeTraceEvents, viewMode]);
  const graph = useMemo<{ nodes: Node[]; edges: Edge[] }>(() => createGraph(spans), [spans]);
  const mostlyInfraTrace = useMemo(() => viewMode === 'business' && activeTraceEvents.length > 0 && spans.length === 0, [activeTraceEvents.length, spans.length, viewMode]);

  const selectedSpan = useMemo(() => spans.find((span) => span.id === selectedNodeId), [selectedNodeId, spans]);
  const activeSummary = activeTraceId ? summaryByTraceId.get(activeTraceId) : undefined;
  const errorCount = traceSummaries.filter((trace) => trace.health === 'error').length;
  const slowCount = traceSummaries.filter((trace) => trace.health === 'slow').length;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable)) {
        return;
      }

      if (event.key === 'Escape') {
         setSelectedNodeId(undefined);
         return;
      }

      if (filteredTraces.length === 0) {
        return;
      }

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setQuickJumpOpen(true);
        return;
      }

      const currentIndex = filteredTraces.findIndex((trace) => trace.traceId === activeTraceId);
      const safeIndex = currentIndex >= 0 ? currentIndex : 0;

      if (event.key === 'j' || event.key === 'ArrowDown') {
        event.preventDefault();
        const nextIndex = Math.min(safeIndex + 1, filteredTraces.length - 1);
        setActiveTraceId(filteredTraces[nextIndex].traceId);
        setSelectedNodeId(undefined);
      }

      if (event.key === 'k' || event.key === 'ArrowUp') {
        event.preventDefault();
        const nextIndex = Math.max(safeIndex - 1, 0);
        setActiveTraceId(filteredTraces[nextIndex].traceId);
        setSelectedNodeId(undefined);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeTraceId, filteredTraces]);

  const handleReplay = async () => {
    if (!activeSummary) return;

    if (!isReplaySafe(activeSummary)) {
      if (!window.confirm("This request uses an unsafe method (POST/PATCH) and may modify data. Do you want to proceed with replay?")) {
        return;
      }
    }

    setReplaying(true);
    const originalTraceId = activeSummary.traceId;
    const startTime = Date.now();

    try {
      console.log(`[Replay] Executing request for trace ${originalTraceId} on ${activeSummary.route}`);
      await executeReplayRequest(activeSummary);
      
      // Wait for the new trace to appear in the backend
      let retries = 20;
      let newTraceId: string | undefined;

      while (retries > 0) {
        console.log(`[Replay] Polling for new trace... (Retries left: ${retries})`);
        await new Promise(r => setTimeout(r, 1000));
        
        const data = await fetchTraceEventsByServiceScoped(selectedService!, true);
        const newSummaries = createTraceSummaries(data, viewMode);
        
        // Find the newest trace that matches the route/method and started around or after we clicked replay
        // Broadening the window further to 10s to account for potential server/client clock drift
        const candidates = newSummaries.filter(s => 
          s.route === activeSummary.route && 
          s.method === activeSummary.method &&
          s.startedAt >= (startTime - 10000) &&
          s.traceId !== originalTraceId
        );

        // Pick the one that started closest to our startTime
        if (candidates.length > 0) {
          candidates.sort((a, b) => Math.abs(a.startedAt - startTime) - Math.abs(b.startedAt - startTime));
          newTraceId = candidates[0].traceId;
          console.log(`[Replay] Found new trace: ${newTraceId}`);
          setEvents(data);
          break;
        }
        retries--;
      }

      if (newTraceId) {
        setCompareTraceAId(originalTraceId);
        setCompareTraceBId(newTraceId);
        setAppMode('compare');
      } else {
        console.warn(`[Replay] No new trace found after 20 retries for ${activeSummary.route}`);
        alert("Replay request sent, but couldn't find the new trace in Jaeger yet. This can happen due to collection delays. Please try clicking 'Refresh Data' in a few seconds.");
        void loadEvents();
      }
    } catch (err: any) {
      alert(`Replay failed: ${err.message}`);
    } finally {
      setReplaying(false);
    }
  };

  return (
    <div className={`app-shell view-${viewMode}`}>
      <TopBar
        services={services}
        selectedService={selectedService}
        onServiceChange={setSelectedService}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        query={query}
        onQueryChange={setQuery}
        live={live}
        onToggleLive={() => setLive((value) => !value)}
        onRefresh={() => void loadEvents()}
        onOpenQuickJump={() => setQuickJumpOpen(true)}
        total={traceSummaries.length}
        errors={errorCount}
        slow={slowCount}
        autoSelectNew={autoSelectNew}
        onToggleAutoSelect={() => setAutoSelectNew(!autoSelectNew)}
        appMode={appMode}
        onAppModeChange={setAppMode}
      />

      <main className={`layout-grid ${appMode === 'compare' ? 'layout-grid-compare' : ''}`}>
        <TraceExplorer
          traces={filteredTraces}
          activeTraceId={activeTraceId}
          onSelectTrace={(traceId) => {
            setActiveTraceId(traceId);
            setSelectedNodeId(undefined);
          }}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          shortcutsHint="J/K or Arrow keys"
          newTraceIds={newTraceIds}
          appMode={appMode}
          compareTraceAId={compareTraceAId}
          compareTraceBId={compareTraceBId}
          onSetCompareA={setCompareTraceAId}
          onSetCompareB={setCompareTraceBId}
        />

        {appMode === 'explorer' ? (
          <>
            {loading ? (
              <section className="panel graph-panel panel-message">Loading traces...</section>
            ) : error ? (
              <section className="panel graph-panel panel-message panel-error">{error}</section>
            ) : (
              <TraceGraph
                nodes={graph.nodes}
                edges={graph.edges}
                selectedNodeId={selectedNodeId}
                onSelectNode={setSelectedNodeId}
                summary={activeSummary}
                viewMode={viewMode}
                mostlyInfraTrace={mostlyInfraTrace}
                onMouseEnter={() => setIsGraphHovered(true)}
                onMouseLeave={() => setIsGraphHovered(false)}
                onReplay={handleReplay}
                replaying={replaying}
              />
            )}
            <SpanInspector span={selectedSpan} onClose={() => setSelectedNodeId(undefined)} />
          </>
        ) : (
          <CompareView
            traces={filteredTraces}
            traceAId={compareTraceAId}
            traceBId={compareTraceBId}
            eventsA={compareTraceAId ? (groupedTraceEvents.get(compareTraceAId) ?? []) : []}
            eventsB={compareTraceBId ? (groupedTraceEvents.get(compareTraceBId) ?? []) : []}
            summaryA={compareTraceAId ? summaryByTraceId.get(compareTraceAId) : undefined}
            summaryB={compareTraceBId ? summaryByTraceId.get(compareTraceBId) : undefined}
            viewMode={viewMode}
            onSetCompareA={setCompareTraceAId}
            onSetCompareB={setCompareTraceBId}
            onSwap={() => {
              const temp = compareTraceAId;
              setCompareTraceAId(compareTraceBId);
              setCompareTraceBId(temp);
            }}
            onReset={() => {
              setCompareTraceAId(undefined);
              setCompareTraceBId(undefined);
            }}
            onClose={() => setAppMode('explorer')}
          />
        )}
      </main>

      <TraceQuickJump
        open={quickJumpOpen}
        traces={filteredTraces}
        activeTraceId={activeTraceId}
        onClose={() => setQuickJumpOpen(false)}
        onSelectTrace={(traceId) => {
          setActiveTraceId(traceId);
          setSelectedNodeId(undefined);
        }}
      />
    </div>
  );
}
