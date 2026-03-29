import { TraceDiffResult } from '../../../utils/trace-diff';
import { SpanViewModel } from '../../../types/trace';

export function getOutcomeComparison(
  diff: TraceDiffResult, 
  healthA: string, 
  healthB: string, 
  divA?: SpanViewModel, 
  divB?: SpanViewModel
) {
  if (healthA === 'error' && healthB !== 'error') {
    return {
      headline: `Trace A fails during ${divA ? divA.step : 'execution'} while Trace B completes successfully`
    };
  } else if (healthB === 'error' && healthA !== 'error') {
    return {
      headline: `Trace B fails during ${divB ? divB.step : 'execution'} while Trace A completes successfully`
    };
  }
  return null;
}

export function getSkippedSpanSummary(
  diff: TraceDiffResult, 
  spansA: SpanViewModel[], 
  spansB: SpanViewModel[]
) {
  if (diff.metrics.aOnlyCount > 0 && diff.metrics.bOnlyCount === 0) {
    const aUniqueLayers = new Set<string>();
    for (const a of spansA) if (diff.aDiffs[a.id]?.state === 'unique') aUniqueLayers.add(a.layer);
    
    return {
      headline: `Trace B diverges earlier and avoids downstream ${Array.from(aUniqueLayers).join('/')} work`,
      bullet: `Trace B does not execute ${Array.from(aUniqueLayers).join(' and ')} spans found in Trace A.`
    };
  } else if (diff.metrics.bOnlyCount > 0 && diff.metrics.aOnlyCount === 0) {
    const bUniqueLayers = new Set<string>();
    for (const b of spansB) if (diff.bDiffs[b.id]?.state === 'unique') bUniqueLayers.add(b.layer);

    return {
      headline: `Trace A diverges earlier and avoids downstream ${Array.from(bUniqueLayers).join('/')} work`,
      bullet: `Trace A does not execute ${Array.from(bUniqueLayers).join(' and ')} spans found in Trace B.`
    };
  }
  return null;
}

export function getSpeedDifferenceReason(
  diff: TraceDiffResult, 
  durationA: number, 
  durationB: number,
  spansA: SpanViewModel[]
) {
  const durationDiff = Math.abs(durationA - durationB);
  if (durationDiff <= 5) return null; // Insignificant
  
  if (durationA < durationB) {
    if (diff.metrics.bOnlyCount > diff.metrics.aOnlyCount) {
      return { headline: `Trace A is faster because it skipped downstream operations` };
    } else if (diff.metrics.aOnlyCount === diff.metrics.bOnlyCount) {
      return { headline: `Trace A is faster due to improved latencies in matched spans` };
    }
  } else {
    if (diff.metrics.aOnlyCount > diff.metrics.bOnlyCount) {
      return { headline: `Trace B is faster because it skipped downstream operations` };
    } else if (diff.metrics.aOnlyCount === diff.metrics.bOnlyCount) {
      return { headline: `Trace B is faster due to improved latencies in matched spans` };
    }
  }
  return null;
}
