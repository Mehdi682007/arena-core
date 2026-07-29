import type {
  AcceptedProposalContext,
  MatchAuditEvent,
  MatchRecord,
  MatchVoidReasonCode,
} from '../domain/match-types';

export interface MatchRepository {
  findByProposalId(proposalId: string): Promise<MatchRecord | null>;
  loadAcceptedProposalContext(proposalId: string): Promise<AcceptedProposalContext | null>;
  createMatch(input: {
    context: AcceptedProposalContext;
    readyDeadlineAt: Date;
  }): Promise<MatchRecord>;
  listForUser(userId: string, limit: number): Promise<readonly MatchRecord[]>;
  findForUser(userId: string, matchId: string): Promise<MatchRecord | null>;
  findById(matchId: string): Promise<MatchRecord | null>;
  markReady(userId: string, matchId: string, now: Date): Promise<MatchRecord>;
  cancel(userId: string, matchId: string, now: Date): Promise<void>;
  expireUnready(now: Date, limit: number): Promise<number>;
  listAdmin(limit: number, status?: string): Promise<readonly MatchRecord[]>;
  listAudit(matchId: string): Promise<readonly MatchAuditEvent[]>;
  voidMatch(
    actorUserId: string,
    matchId: string,
    reasonCode: MatchVoidReasonCode,
    note: string | undefined,
    now: Date,
  ): Promise<void>;
  listAcceptedProposalIdsWithoutMatch(limit: number): Promise<readonly string[]>;
}
