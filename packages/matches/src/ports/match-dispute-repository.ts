import type { MatchEvidencePayload, MatchEvidenceRecord } from '../domain/match-evidence-types';
import type {
  DisputeResolutionType,
  MatchDisputeClaimPayload,
  MatchDisputeContext,
  MatchDisputeRecord,
  MatchDisputeResultSnapshot,
  MatchDisputeReasonCode,
} from '../domain/match-dispute-types';
import type { MatchResultPayload } from '../domain/match-result-types';

export interface MatchDisputeRepository {
  loadForUser(userId: string, matchId: string): Promise<MatchDisputeContext | null>;
  createEvidence(input: {
    userId: string;
    matchId: string;
    payload: MatchEvidencePayload;
    now: Date;
  }): Promise<MatchEvidenceRecord>;
  withdrawEvidence(userId: string, matchId: string, evidenceId: string, now: Date): Promise<void>;
  createDispute(input: {
    userId: string;
    matchId: string;
    reasonCode: MatchDisputeReasonCode;
    claim: MatchDisputeClaimPayload;
    snapshot: MatchDisputeResultSnapshot;
    responseDeadlineAt: Date;
    reviewDeadlineAt: Date;
    now: Date;
  }): Promise<MatchDisputeRecord>;
  respond(input: {
    userId: string;
    matchId: string;
    disputeId: string;
    statement: string;
    evidenceIds: readonly string[];
    now: Date;
  }): Promise<MatchDisputeRecord>;
  cancel(userId: string, matchId: string, disputeId: string, now: Date): Promise<void>;
  listAdmin(
    limit: number,
    status?: string,
    actorUserId?: string,
  ): Promise<readonly MatchDisputeRecord[]>;
  findAdmin(disputeId: string): Promise<MatchDisputeContext | null>;
  assignSelf(disputeId: string, actorUserId: string, now: Date): Promise<MatchDisputeRecord>;
  startReview(disputeId: string, actorUserId: string, now: Date): Promise<MatchDisputeRecord>;
  resolve(input: {
    disputeId: string;
    actorUserId: string;
    resolutionType: DisputeResolutionType;
    correctedResult?: MatchResultPayload;
    reasonCode: string;
    note?: string;
    now: Date;
  }): Promise<MatchDisputeRecord>;
  expireResponses(now: Date, limit: number): Promise<number>;
}
