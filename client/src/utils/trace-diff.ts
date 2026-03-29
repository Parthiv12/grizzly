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

