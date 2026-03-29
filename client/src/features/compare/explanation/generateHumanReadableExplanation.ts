import { TraceDiffResult } from '../../../utils/trace-diff';
import { SpanViewModel } from '../../../types/trace';
import { getPrimaryChangedSpan } from './explanationHelpers';
import { getOutcomeComparison, getSkippedSpanSummary, getSpeedDifferenceReason } from './explanationRules';

export interface ExplanationResult {
  headline: string;
  bullets: string[];
}

export function generateHumanReadableExplanation(
  diff: TraceDiffResult,
  spansA: SpanViewModel[],
  spansB: SpanViewModel[],
  durationA: number,
  durationB: number,
  healthA: string,
  healthB: string
): ExplanationResult {
  const divAId = Object.keys(diff.aDiffs).find(id => diff.aDiffs[id].isDivergencePoint);
  const divBId = Object.keys(diff.bDiffs).find(id => diff.bDiffs[id].isDivergencePoint);
  
  const divA = spansA.find(s => s.id === divAId);
  const divB = spansB.find(s => s.id === divBId);

  const outcome = getOutcomeComparison(diff, healthA, healthB, divA, divB);
  const skipped = getSkippedSpanSummary(diff, spansA, spansB);
  const speed = getSpeedDifferenceReason(diff, durationA, durationB, spansA);

  let headline = '';
  
  if (outcome?.headline) {
    headline = outcome.headline;
  } else if (skipped?.headline) {
    headline = skipped.headline;
  } else if (speed?.headline) {
    headline = speed.headline;
  } else {
    headline = "Both traces follow structurally similar execution paths.";
  }

  const bullets: string[] = [];

  if (divA || divB) {
    bullets.push(`The first divergence occurs at ${divA ? divA.step : (divB ? divB.step : 'an unknown span')}.`);
  }

  if (skipped?.bullet) bullets.push(skipped.bullet);

  const topChanged = getPrimaryChangedSpan(diff, spansA);
  if (topChanged) {
     const ms = topChanged.diffInfo.durationDiffMs || 0;
     const deltaStr = ms > 0 ? `+${ms}` : `${ms}`;
     bullets.push(`The most significant changed span is ${topChanged.spanA.step} (${deltaStr}ms${topChanged.diffInfo.statusChanged ? ', success -> error' : ''}).`);
  }

  return { headline, bullets };
}
