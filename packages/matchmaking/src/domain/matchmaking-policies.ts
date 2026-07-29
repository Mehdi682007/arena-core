import { MatchmakingError } from './matchmaking-errors';
import type { MatchmakingCriteria, MatchmakingRequestStatus } from './matchmaking-types';

const transitions: Record<MatchmakingRequestStatus, readonly MatchmakingRequestStatus[]> = {
  PENDING: ['SEARCHING', 'CANCELLED', 'EXPIRED'],
  SEARCHING: ['PROPOSED', 'CANCELLED', 'EXPIRED', 'FAILED'],
  PROPOSED: ['SEARCHING', 'MATCHED', 'CANCELLED', 'EXPIRED', 'FAILED'],
  MATCHED: [],
  CANCELLED: [],
  EXPIRED: [],
  FAILED: [],
};
export function assertRequestTransition(
  from: MatchmakingRequestStatus,
  to: MatchmakingRequestStatus,
): void {
  if (from !== to && !transitions[from].includes(to))
    throw new MatchmakingError('MATCHMAKING_REQUEST_STATE_INVALID');
}
export function validateCriteria(value: unknown): MatchmakingCriteria {
  if (value === undefined) return { schemaVersion: 1, preferences: {} };
  if (value === null || typeof value !== 'object' || Array.isArray(value))
    throw new MatchmakingError('MATCHMAKING_CRITERIA_INVALID');
  const candidate = value as Record<string, unknown>;
  const preferences = candidate.preferences;
  if (
    Object.keys(candidate).some((key) => !['schemaVersion', 'preferences'].includes(key)) ||
    (candidate.schemaVersion !== undefined && candidate.schemaVersion !== 1) ||
    preferences === null ||
    typeof preferences !== 'object' ||
    Array.isArray(preferences)
  )
    throw new MatchmakingError('MATCHMAKING_CRITERIA_INVALID');
  const entries = preferences as Record<string, unknown>;
  const language = entries.language;
  const region = entries.region;
  if (
    Object.keys(entries).some((key) => !['language', 'region'].includes(key)) ||
    (language !== undefined && language !== 'fa' && language !== 'en') ||
    (region !== undefined &&
      (typeof region !== 'string' ||
        !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(region) ||
        region.length > 32)) ||
    JSON.stringify(value).length > 512
  )
    throw new MatchmakingError('MATCHMAKING_CRITERIA_INVALID');
  return {
    schemaVersion: 1,
    preferences: {
      ...(language === undefined ? {} : { language }),
      ...(region === undefined ? {} : { region }),
    },
  };
}
