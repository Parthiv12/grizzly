import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Edge, Node } from 'reactflow';
import { fetchTraceEventsByService, fetchTraceServices } from './api/traces';
import { SpanInspector } from './components/SpanInspector';
import { TopBar } from './components/TopBar';
import { TraceExplorer } from './components/TraceExplorer';
import { TraceGraph } from './components/TraceGraph';
import { TraceQuickJump } from './components/TraceQuickJump';
import type { RawTraceEvent, SpanViewModel, TraceHealth } from './types/trace';
import { createGraph, createSpanView, createTraceSummaries, groupEventsByTraceId } from './utils/trace-transform';

export function App() {
  const [events, setEvents] = useState<RawTraceEvent[]>([]);
  const [services, setServices] = useState<string[]>([]);
  const [selectedService, setSelectedService] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [live, setLive] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'all' | TraceHealth>('all');
  const [activeTraceId, setActiveTraceId] = useState<string | undefined>(undefined);
  const [selectedNodeId, setSelectedNodeId] = useState<string | undefined>(undefined);
  const [quickJumpOpen, setQuickJumpOpen] = useState(false);

  const loadServices = useCallback(async () => {
    try {
      const discoveredServices = await fetchTraceServices();
      setServices(discoveredServices);
      if (!selectedService && discoveredServices.length > 0) {
        setSelectedService(discoveredServices[0]);
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
      const data = await fetchTraceEventsByService(selectedService);
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
    if (!live) {
      return;
    }
    const intervalId = window.setInterval(() => {
      void loadEvents();
    }, 2500);
    return () => window.clearInterval(intervalId);
  }, [live, loadEvents]);

  const traceSummaries = useMemo(() => createTraceSummaries(events), [events]);
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
      const hasStepMatch = traceEvents.some((event) => event.step.toLowerCase().includes(q));
      return (
        trace.traceId.toLowerCase().includes(q) ||
        trace.route.toLowerCase().includes(q) ||
        trace.method.toLowerCase().includes(q) ||
        hasStepMatch
      );
    });
  }, [groupedTraceEvents, query, statusFilter, traceSummaries]);

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

  const spans = useMemo<SpanViewModel[]>(() => createSpanView(activeTraceEvents), [activeTraceEvents]);
  const graph = useMemo<{ nodes: Node[]; edges: Edge[] }>(() => createGraph(spans), [spans]);

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

  return (
    <div className="app-shell">
      <TopBar
        services={services}
        selectedService={selectedService}
        onServiceChange={setSelectedService}
        query={query}
        onQueryChange={setQuery}
        live={live}
        onToggleLive={() => setLive((value) => !value)}
        onRefresh={() => void loadEvents()}
        onOpenQuickJump={() => setQuickJumpOpen(true)}
        total={traceSummaries.length}
        errors={errorCount}
        slow={slowCount}
      />

      <main className="layout-grid">
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
        />

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
          />
        )}

        <SpanInspector span={selectedSpan} />
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
