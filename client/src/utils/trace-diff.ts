import type { SpanViewModel } from '../types/trace';

export type DiffState = 'identical' | 'changed' | 'unique';

export interface SpanDiffInfo {
  state: DiffState;
  pairedSpanId?: string;
  durationDiffMs?: number;
  statusChanged?: boolean;
  isDivergencePoint?: boolean;
}

export interface TraceDiffResult {
  aDiffs: Record<string, SpanDiffInfo>;
  bDiffs: Record<string, SpanDiffInfo>;
  metrics: {
    matchedCount: number;
    aOnlyCount: number;
    bOnlyCount: number;
    changedCount: number;
  };
}

export function computeTraceDiff(spansA: SpanViewModel[], spansB: SpanViewModel[]): TraceDiffResult {
  function getSig(span: SpanViewModel) {
    const op = span.metadata?.operation ?? '';
    const name = span.metadata?.name ?? '';
    return `${span.layer}:${span.step}:${op}:${name}`;
  }

  // Find LCS of signatures
  const m = spansA.length;
  const n = spansB.length;
  const dp: number[][] = Array(m + 1).fill(0).map(() => Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (getSig(spansA[i - 1]) === getSig(spansB[j - 1])) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  const matchA = new Map<number, number>();
  const matchB = new Map<number, number>();

  let i = m;
  let j = n;
  while (i > 0 && j > 0) {
    if (getSig(spansA[i - 1]) === getSig(spansB[j - 1])) {
      matchA.set(i - 1, j - 1);
      matchB.set(j - 1, i - 1);
      i--;
      j--;
    } else if (dp[i - 1][j] > dp[i][j - 1]) {
      i--;
    } else {
      j--;
    }
  }

  const aDiffs: Record<string, SpanDiffInfo> = {};
  const bDiffs: Record<string, SpanDiffInfo> = {};
  
  let changedCount = 0;
  let foundDivergenceA = false;
  let foundDivergenceB = false;

  for (let idxA = 0; idxA < spansA.length; idxA++) {
    const spanA = spansA[idxA];
    if (matchA.has(idxA)) {
      const idxB = matchA.get(idxA)!;
      const spanB = spansB[idxB];
      const statusChanged = spanA.status !== spanB.status;
      const durationDiffMs = spanA.durationMs - spanB.durationMs;
      // Consider it 'changed' if status differs or duration diverges by more than 25% or 50ms
      const durationChangedFlag = Math.abs(durationDiffMs) > 50 && (Math.abs(durationDiffMs) / Math.max(spanB.durationMs, 1)) > 0.25;
      
      const isChanged = statusChanged || durationChangedFlag;
      if (isChanged) changedCount++;
      
      aDiffs[spanA.id] = { state: isChanged ? 'changed' : 'identical', pairedSpanId: spanB.id, durationDiffMs, statusChanged };
    } else {
      const isDivergenceLine = !foundDivergenceA;
      foundDivergenceA = true;
      aDiffs[spanA.id] = { state: 'unique', isDivergencePoint: isDivergenceLine };
    }
  }

  for (let idxB = 0; idxB < spansB.length; idxB++) {
    const spanB = spansB[idxB];
    if (matchB.has(idxB)) {
      const idxA = matchB.get(idxB)!;
      const spanA = spansA[idxA];
      const durationDiffMs = spanB.durationMs - spanA.durationMs;
      bDiffs[spanB.id] = { 
        state: aDiffs[spanA.id].state, 
        pairedSpanId: spanA.id, 
        durationDiffMs, 
        statusChanged: spanB.status !== spanA.status 
      };
    } else {
      const isDivergenceLine = !foundDivergenceB;
      foundDivergenceB = true;
      bDiffs[spanB.id] = { state: 'unique', isDivergencePoint: isDivergenceLine };
    }
  }

  return {
    aDiffs,
    bDiffs,
    metrics: {
      matchedCount: matchA.size,
      aOnlyCount: spansA.length - matchA.size,
      bOnlyCount: spansB.length - matchB.size,
      changedCount: changedCount / 2 // Was incremented for A only
    }
  };
}

export function getTopChangedSpan(diff: TraceDiffResult, spansA: SpanViewModel[]) {
  const changedIds = Object.keys(diff.aDiffs).filter(id => diff.aDiffs[id].state === 'changed');
  if (changedIds.length === 0) return null;
  
  let topA = spansA.find(s => s.id === changedIds[0])!;
  let topInfo = diff.aDiffs[topA.id];
  
  for (const id of changedIds) {
    const info = diff.aDiffs[id];
    const spanA = spansA.find(s => s.id === id);
    if (!spanA) continue;
    
    if (info.statusChanged && !topInfo.statusChanged) {
      topA = spanA;
      topInfo = info;
    } else if (info.statusChanged === topInfo.statusChanged && Math.abs(info.durationDiffMs!) > Math.abs(topInfo.durationDiffMs!)) {
      topA = spanA;
      topInfo = info;
    }
  }
  
  return { spanA: topA, diffInfo: topInfo };
}

export function generateHumanReadableExplanation(
  diff: TraceDiffResult, 
  spansA: SpanViewModel[], 
  spansB: SpanViewModel[],
  durationA: number,
  durationB: number,
  healthA: string,
  healthB: string
): string[] {
  const parts: string[] = [];

  const divAId = Object.keys(diff.aDiffs).find(id => diff.aDiffs[id].isDivergencePoint);
  const divBId = Object.keys(diff.bDiffs).find(id => diff.bDiffs[id].isDivergencePoint);
  
  const divA = spansA.find(s => s.id === divAId);
  const divB = spansB.find(s => s.id === divBId);

  // Health based heuristic
  if (healthA === 'error' && healthB !== 'error') {
    parts.push(`Trace A failed during ${divA ? divA.step : 'execution'}, while Trace B completed successfully.`);
  } else if (healthB === 'error' && healthA !== 'error') {
    parts.push(`Trace B failed during ${divB ? divB.step : 'execution'}, while Trace A completed successfully.`);
  }

  // Missing downstream logic
  if (diff.metrics.aOnlyCount > 0 && diff.metrics.bOnlyCount === 0) {
    const skippedLayers = new Set<string>();
    for (const b of spansB) {
      const p = spansA.find(a => a.id === diff.bDiffs[b.id]?.pairedSpanId);
      if (!p) skippedLayers.add(b.layer);
    }
    const aUniqueLayers = new Set<string>();
    for (const a of spansA) if (diff.aDiffs[a.id]?.state === 'unique') aUniqueLayers.add(a.layer);
    
    parts.push(`Trace B skipped downstream execution (missing ${Array.from(aUniqueLayers).join(', ')} ops), resulting in ${diff.metrics.aOnlyCount} fewer spans.`);
  } else if (diff.metrics.bOnlyCount > 0 && diff.metrics.aOnlyCount === 0) {
    const bUniqueLayers = new Set<string>();
    for (const b of spansB) if (diff.bDiffs[b.id]?.state === 'unique') bUniqueLayers.add(b.layer);
    parts.push(`Trace A bypassed the ${Array.from(bUniqueLayers).join(' and ')} layer${bUniqueLayers.size > 1 ? 's' : ''}, skipping ${diff.metrics.bOnlyCount} operations relative to B.`);
  } else if (diff.metrics.aOnlyCount > 0 && diff.metrics.bOnlyCount > 0) {
    const divStep = divB ? divB.step : (divA ? divA.step : 'mid-flight');
    if (!parts.some(p => p.includes('failed'))) {
      parts.push(`Traces diverged structurally at ${divStep}. Trace A ran ${diff.metrics.aOnlyCount} unique spans while Trace B ran ${diff.metrics.bOnlyCount} different spans.`);
    }
  }

  // Duration optimization rationale
  const durationDiff = Math.abs(durationA - durationB);
  if (durationDiff > 10) {
    const faster = durationA < durationB ? 'Trace A' : 'Trace B';
    const missingOps = durationA < durationB ? diff.metrics.aOnlyCount : diff.metrics.bOnlyCount;
    if (missingOps > 0 && diff.metrics.aOnlyCount !== diff.metrics.bOnlyCount) {
       parts.push(`${faster} was ${durationDiff}ms faster overall, directly due to bypassing downstream operations.`);
    }
  }

  if (parts.length === 0) {
    parts.push("Both traces followed the exact same execution paths.");
  }

  return parts;
}
