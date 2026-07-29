import { MatchEvidenceError } from './match-evidence-errors';
import type { MatchEvidencePayload } from './match-evidence-types';

const types = [
  'SCREENSHOT_DECLARATION',
  'VIDEO_DECLARATION',
  'MATCH_SUMMARY_DECLARATION',
  'TEXT_STATEMENT',
] as const;
export function validateEvidencePayload(input: unknown, now: Date): MatchEvidencePayload {
  if (input === null || typeof input !== 'object' || Array.isArray(input))
    throw new MatchEvidenceError('MATCH_EVIDENCE_INVALID');
  const value = input as Record<string, unknown>;
  if (
    Object.keys(value).some(
      (key) => !['schemaVersion', 'type', 'description', 'capturedAt'].includes(key),
    )
  )
    throw new MatchEvidenceError('MATCH_EVIDENCE_INVALID');
  if (value.schemaVersion !== 1 || !types.includes(value.type as (typeof types)[number]))
    throw new MatchEvidenceError('MATCH_EVIDENCE_INVALID');
  if (
    (value.description !== undefined &&
      (typeof value.description !== 'string' ||
        !value.description.trim() ||
        value.description.length > 2000)) ||
    (value.capturedAt !== undefined && typeof value.capturedAt !== 'string')
  )
    throw new MatchEvidenceError('MATCH_EVIDENCE_INVALID');
  const captured = value.capturedAt ? new Date(value.capturedAt) : null;
  if (
    captured &&
    (!Number.isFinite(captured.getTime()) || captured.getTime() > now.getTime() + 300_000)
  )
    throw new MatchEvidenceError('MATCH_EVIDENCE_INVALID');
  return {
    schemaVersion: 1,
    type: value.type as MatchEvidencePayload['type'],
    ...(value.description ? { description: value.description.trim() } : {}),
    ...(captured ? { capturedAt: captured.toISOString() } : {}),
  };
}
