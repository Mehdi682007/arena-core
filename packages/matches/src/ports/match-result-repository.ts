import type {
  MatchResultContext,
  MatchResultPayload,
  MatchResultResolutionReasonCode,
} from '../domain/match-result-types';

export interface MatchResultRepository {
  findForUser(userId: string, matchId: string): Promise<MatchResultContext | null>;
  findForAdmin(matchId: string): Promise<MatchResultContext | null>;
  start(
    userId: string,
    matchId: string,
    now: Date,
    submissionDeadlineAt: Date,
  ): Promise<MatchResultContext>;
  submit(
    userId: string,
    matchId: string,
    payload: MatchResultPayload,
    now: Date,
    conflictDeadlineAt: Date,
  ): Promise<MatchResultContext>;
  withdraw(userId: string, matchId: string, now: Date): Promise<void>;
  expire(now: Date, limit: number, conflictDeadlineAt: Date): Promise<number>;
  listConflicts(limit: number): Promise<readonly MatchResultContext[]>;
  resolve(
    actorUserId: string,
    matchId: string,
    payload: MatchResultPayload,
    reasonCode: MatchResultResolutionReasonCode,
    note: string | undefined,
    now: Date,
  ): Promise<MatchResultContext>;
}
