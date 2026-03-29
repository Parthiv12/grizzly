import { TraceDiffResult } from '../../../utils/trace-diff';
import { SpanViewModel } from '../../../types/trace';

export function getPrimaryChangedSpan(diff: TraceDiffResult, spansA: SpanViewModel[]) {
  const changedIds = Object.keys(diff.aDiffs).filter(id => diff.aDiffs[id].state === 'changed');
  if (changedIds.length === 0) return null;
  
  let topA = spansA.find(s => s.id === changedIds[0])!;
  let topInfo = diff.aDiffs[topA.id];
  
  for (const id of changedIds) {
    const info = diff.aDiffs[id];
    const spanA = spansA.find(s => s.id === id);
    if (!spanA) continue;
    
    // priority: status change > larger absolute duration > divergence-adjacent (we'll simplify here and just use largest dur/status)
    if (info.statusChanged && !topInfo.statusChanged) {
      topA = spanA;
      topInfo = info;
    } else if (info.statusChanged === topInfo.statusChanged && Math.abs(info.durationDiffMs || 0) > Math.abs(topInfo.durationDiffMs || 0)) {
      topA = spanA;
      topInfo = info;
    }
  }
  
  return { spanA: topA, diffInfo: topInfo };
}

export function buildMatchedSpanLookup(diff: TraceDiffResult) {
  const aToB: Record<string, string> = {};
  const bToA: Record<string, string> = {};
  
  for (const aId in diff.aDiffs) {
    const pairedId = diff.aDiffs[aId].pairedSpanId;
    if (pairedId) {
      aToB[aId] = pairedId;
      bToA[pairedId] = aId;
    }
  }
  
  return { aToB, bToA };
}
