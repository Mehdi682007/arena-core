import { type ArenaPrismaClient, Prisma } from '@arena-core/database';
import { MatchDisputeError } from '../domain/match-dispute-errors';
import type {
  MatchDisputeContext,
  MatchDisputeRecord,
  MatchDisputeResponseRecord,
} from '../domain/match-dispute-types';
import type { MatchEvidenceRecord } from '../domain/match-evidence-types';
import { deriveOutcome } from '../domain/match-result-policies';
import type { MatchDisputeRepository } from '../ports/match-dispute-repository';
import { PrismaMatchResultRepository } from './prisma-match-result-repository';

type Client = ArenaPrismaClient | Prisma.TransactionClient;
const evidenceSelect = {
  id: true,
  matchId: true,
  participantId: true,
  submittedByUserId: true,
  type: true,
  status: true,
  payload: true,
  capturedAt: true,
  submittedAt: true,
  withdrawnAt: true,
  version: true,
} satisfies Prisma.MatchEvidenceSelect;
const responseSelect = {
  id: true,
  disputeId: true,
  participantId: true,
  submittedByUserId: true,
  statement: true,
  evidenceIds: true,
  submittedAt: true,
} satisfies Prisma.MatchDisputeResponseSelect;
const disputeSelect = {
  id: true,
  matchId: true,
  openedByParticipantId: true,
  openedByUserId: true,
  status: true,
  reasonCode: true,
  claimPayload: true,
  resultSnapshot: true,
  responseDeadlineAt: true,
  reviewDeadlineAt: true,
  assignedReviewerUserId: true,
  assignedAt: true,
  resolvedAt: true,
  resolutionType: true,
  version: true,
  createdAt: true,
  response: { select: responseSelect },
} satisfies Prisma.MatchDisputeSelect;
type EvidenceRow = Prisma.MatchEvidenceGetPayload<{ select: typeof evidenceSelect }>;
type DisputeRow = Prisma.MatchDisputeGetPayload<{ select: typeof disputeSelect }>;
const mapEvidence = (row: EvidenceRow): MatchEvidenceRecord => ({
  ...row,
  payload: row.payload as unknown as MatchEvidenceRecord['payload'],
});
const mapResponse = (row: NonNullable<DisputeRow['response']>): MatchDisputeResponseRecord => ({
  ...row,
  evidenceIds: row.evidenceIds as unknown as readonly string[],
});
const mapDispute = (row: DisputeRow): MatchDisputeRecord => ({
  ...row,
  claimPayload: row.claimPayload as unknown as MatchDisputeRecord['claimPayload'],
  resultSnapshot: row.resultSnapshot as unknown as MatchDisputeRecord['resultSnapshot'],
  response: row.response ? mapResponse(row.response) : null,
});
function persistence(error: unknown): never {
  if (error instanceof MatchDisputeError) throw error;
  if (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    String((error as { code?: unknown }).code) === 'P2002'
  )
    throw new MatchDisputeError('MATCH_DISPUTE_ALREADY_ACTIVE');
  throw new MatchDisputeError('MATCH_DISPUTE_PERSISTENCE_FAILURE');
}
async function transact<T>(
  client: Client,
  operation: (tx: Prisma.TransactionClient) => Promise<T>,
) {
  if ('$transaction' in client) return client.$transaction(operation);
  return operation(client);
}

export class PrismaMatchDisputeRepository implements MatchDisputeRepository {
  public constructor(private readonly client: Client) {}
  private async load(client: Client, matchId: string): Promise<MatchDisputeContext | null> {
    const resultContext = await new PrismaMatchResultRepository(client).findForAdmin(matchId);
    if (!resultContext) return null;
    const [evidence, disputes, settlement, ratingApplication] = await Promise.all([
      client.matchEvidence.findMany({
        where: { matchId },
        select: evidenceSelect,
        orderBy: { submittedAt: 'asc' },
      }),
      client.matchDispute.findMany({
        where: { matchId },
        select: disputeSelect,
        orderBy: { createdAt: 'desc' },
      }),
      client.matchSettlement.findUnique({
        where: { matchId },
        select: { id: true },
      }),
      client.matchRatingApplication.findUnique({
        where: { matchId },
        select: { id: true },
      }),
    ]);
    return {
      resultContext,
      evidence: evidence.map(mapEvidence),
      disputes: disputes.map(mapDispute),
      settlementExists: settlement !== null,
      ratingApplicationExists: ratingApplication !== null,
    };
  }
  public async loadForUser(userId: string, matchId: string) {
    const owned = await new PrismaMatchResultRepository(this.client).findForUser(userId, matchId);
    if (!owned) return null;
    return this.load(this.client, matchId);
  }
  public async createEvidence(input: Parameters<MatchDisputeRepository['createEvidence']>[0]) {
    try {
      const participant = await this.client.matchParticipant.findFirstOrThrow({
        where: { matchId: input.matchId, userId: input.userId },
        select: { id: true },
      });
      return mapEvidence(
        await this.client.matchEvidence.create({
          data: {
            matchId: input.matchId,
            participantId: participant.id,
            submittedByUserId: input.userId,
            type: input.payload.type,
            payload: input.payload as unknown as Prisma.InputJsonValue,
            ...(input.payload.capturedAt ? { capturedAt: new Date(input.payload.capturedAt) } : {}),
            submittedAt: input.now,
          },
          select: evidenceSelect,
        }),
      );
    } catch (error) {
      return persistence(error);
    }
  }
  public async withdrawEvidence(userId: string, matchId: string, evidenceId: string, now: Date) {
    const updated = await this.client.matchEvidence.updateMany({
      where: { id: evidenceId, matchId, submittedByUserId: userId, status: 'ACTIVE' },
      data: { status: 'WITHDRAWN', withdrawnAt: now, version: { increment: 1 } },
    });
    if (!updated.count) throw new MatchDisputeError('MATCH_DISPUTE_STATE_INVALID');
  }
  public async createDispute(input: Parameters<MatchDisputeRepository['createDispute']>[0]) {
    try {
      return await transact(this.client, async (tx) => {
        const participant = await tx.matchParticipant.findFirst({
          where: { matchId: input.matchId, userId: input.userId },
          select: { id: true },
        });
        if (!participant) throw new MatchDisputeError('MATCH_DISPUTE_PERMISSION_DENIED');
        if (input.claim.evidenceIds.length)
          await tx.matchEvidence.updateMany({
            where: {
              id: { in: [...input.claim.evidenceIds] },
              matchId: input.matchId,
              submittedByUserId: input.userId,
              status: 'ACTIVE',
            },
            data: { status: 'LOCKED', version: { increment: 1 } },
          });
        const row = await tx.matchDispute.create({
          data: {
            matchId: input.matchId,
            openedByParticipantId: participant.id,
            openedByUserId: input.userId,
            status: 'AWAITING_RESPONSE',
            reasonCode: input.reasonCode,
            claimPayload: input.claim as unknown as Prisma.InputJsonValue,
            resultSnapshot: input.snapshot as unknown as Prisma.InputJsonValue,
            responseDeadlineAt: input.responseDeadlineAt,
            reviewDeadlineAt: input.reviewDeadlineAt,
          },
          select: disputeSelect,
        });
        await tx.matchAuditEvent.create({
          data: {
            matchId: input.matchId,
            actorUserId: input.userId,
            action: 'DISPUTE_OPENED',
            note: `dispute:${row.id}`,
          },
        });
        return mapDispute(row);
      });
    } catch (error) {
      return persistence(error);
    }
  }
  public async respond(input: Parameters<MatchDisputeRepository['respond']>[0]) {
    try {
      return await transact(this.client, async (tx) => {
        const dispute = await tx.matchDispute.findFirst({
          where: {
            id: input.disputeId,
            matchId: input.matchId,
            status: 'AWAITING_RESPONSE',
            openedByUserId: { not: input.userId },
            responseDeadlineAt: { gt: input.now },
          },
          select: { version: true },
        });
        const participant = await tx.matchParticipant.findFirst({
          where: { matchId: input.matchId, userId: input.userId },
          select: { id: true },
        });
        if (!dispute || !participant)
          throw new MatchDisputeError('MATCH_DISPUTE_RESPONSE_NOT_ALLOWED');
        if (input.evidenceIds.length)
          await tx.matchEvidence.updateMany({
            where: {
              id: { in: [...input.evidenceIds] },
              matchId: input.matchId,
              submittedByUserId: input.userId,
              status: 'ACTIVE',
            },
            data: { status: 'LOCKED', version: { increment: 1 } },
          });
        await tx.matchDisputeResponse.create({
          data: {
            disputeId: input.disputeId,
            participantId: participant.id,
            submittedByUserId: input.userId,
            statement: input.statement,
            evidenceIds: [...input.evidenceIds],
            submittedAt: input.now,
          },
        });
        await tx.matchDispute.updateMany({
          where: { id: input.disputeId, version: dispute.version },
          data: { status: 'UNDER_REVIEW', version: { increment: 1 } },
        });
        await tx.matchAuditEvent.create({
          data: { matchId: input.matchId, actorUserId: input.userId, action: 'DISPUTE_RESPONDED' },
        });
        const row = await tx.matchDispute.findUniqueOrThrow({
          where: { id: input.disputeId },
          select: disputeSelect,
        });
        return mapDispute(row);
      });
    } catch (error) {
      return persistence(error);
    }
  }
  public async cancel(userId: string, matchId: string, disputeId: string, now: Date) {
    const updated = await this.client.matchDispute.updateMany({
      where: {
        id: disputeId,
        matchId,
        openedByUserId: userId,
        status: 'AWAITING_RESPONSE',
        response: null,
      },
      data: { status: 'CANCELLED', version: { increment: 1 } },
    });
    if (!updated.count) throw new MatchDisputeError('MATCH_DISPUTE_CANCEL_NOT_ALLOWED');
    await this.client.matchAuditEvent.create({
      data: {
        matchId,
        actorUserId: userId,
        action: 'DISPUTE_CANCELLED',
        note: `dispute:${disputeId}`,
      },
    });
    void now;
  }
  public async listAdmin(limit: number, status?: string, actorUserId?: string) {
    const allowed = [
      'OPEN',
      'AWAITING_RESPONSE',
      'UNDER_REVIEW',
      'RESOLVED',
      'REJECTED',
      'CANCELLED',
      'EXPIRED',
    ];
    return (
      await this.client.matchDispute.findMany({
        where: {
          ...(status && allowed.includes(status) ? { status: status as DisputeRow['status'] } : {}),
          ...(actorUserId ? { assignedReviewerUserId: actorUserId } : {}),
        },
        select: disputeSelect,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: limit,
      })
    ).map(mapDispute);
  }
  public async findAdmin(disputeId: string) {
    const row = await this.client.matchDispute.findUnique({
      where: { id: disputeId },
      select: { matchId: true },
    });
    return row ? this.load(this.client, row.matchId) : null;
  }
  public async assignSelf(disputeId: string, actorUserId: string, now: Date) {
    const updated = await this.client.matchDispute.updateMany({
      where: {
        id: disputeId,
        status: { in: ['AWAITING_RESPONSE', 'UNDER_REVIEW'] },
        OR: [{ assignedReviewerUserId: null }, { assignedReviewerUserId: actorUserId }],
      },
      data: { assignedReviewerUserId: actorUserId, assignedAt: now, version: { increment: 1 } },
    });
    if (!updated.count) throw new MatchDisputeError('MATCH_DISPUTE_ASSIGNMENT_INVALID');
    const row = await this.client.matchDispute.findUniqueOrThrow({
      where: { id: disputeId },
      select: disputeSelect,
    });
    await this.client.matchAuditEvent.create({
      data: {
        matchId: row.matchId,
        actorUserId,
        action: 'DISPUTE_ASSIGNED',
        note: `dispute:${disputeId}`,
      },
    });
    return mapDispute(row);
  }
  public async startReview(disputeId: string, actorUserId: string, now: Date) {
    const updated = await this.client.matchDispute.updateMany({
      where: {
        id: disputeId,
        status: 'AWAITING_RESPONSE',
        assignedReviewerUserId: actorUserId,
        OR: [{ response: { isNot: null } }, { responseDeadlineAt: { lte: now } }],
      },
      data: { status: 'UNDER_REVIEW', version: { increment: 1 } },
    });
    if (!updated.count) {
      const current = await this.client.matchDispute.findFirst({
        where: { id: disputeId, status: 'UNDER_REVIEW', assignedReviewerUserId: actorUserId },
      });
      if (!current) throw new MatchDisputeError('MATCH_DISPUTE_STATE_INVALID');
    }
    const row = await this.client.matchDispute.findUniqueOrThrow({
      where: { id: disputeId },
      select: disputeSelect,
    });
    await this.client.matchAuditEvent.create({
      data: {
        matchId: row.matchId,
        actorUserId,
        action: 'DISPUTE_REVIEW_STARTED',
        note: `dispute:${disputeId}`,
      },
    });
    return mapDispute(row);
  }
  public async resolve(input: Parameters<MatchDisputeRepository['resolve']>[0]) {
    try {
      return await transact(this.client, async (tx) => {
        const dispute = await tx.matchDispute.findFirst({
          where: {
            id: input.disputeId,
            status: 'UNDER_REVIEW',
            assignedReviewerUserId: input.actorUserId,
          },
          select: { matchId: true, version: true },
        });
        if (!dispute) throw new MatchDisputeError('MATCH_DISPUTE_RESOLUTION_INVALID');
        const resultContext = await new PrismaMatchResultRepository(tx).findForAdmin(
          dispute.matchId,
        );
        if (!resultContext?.result) throw new MatchDisputeError('MATCH_DISPUTE_RESOLUTION_INVALID');
        if (resultContext.ratingApplicationExists && input.resolutionType !== 'REJECT_DISPUTE')
          throw new MatchDisputeError('MATCH_DISPUTE_RESOLUTION_INVALID');
        const previous = resultContext.result;
        if (input.resolutionType === 'CORRECT_RESULT' && input.correctedResult) {
          const outcome = deriveOutcome(input.correctedResult, resultContext.match);
          await tx.matchResultRevision.create({
            data: {
              matchResultId: previous.id,
              disputeId: input.disputeId,
              previousPayload: previous.resultPayload as unknown as Prisma.InputJsonValue,
              newPayload: input.correctedResult as unknown as Prisma.InputJsonValue,
              previousStatus: previous.status,
              resolutionType: 'CORRECT_RESULT',
              resolvedByUserId: input.actorUserId,
              reasonCode: input.reasonCode,
            },
          });
          await tx.matchResult.update({
            where: { id: previous.id },
            data: {
              status: 'ADMIN_RESOLVED',
              resultPayload: input.correctedResult as unknown as Prisma.InputJsonValue,
              ...outcome,
              confirmationMethod: 'ADMIN_RESOLUTION',
              confirmedAt: input.now,
              resolvedByUserId: input.actorUserId,
              resolutionReasonCode: input.reasonCode,
              ...(input.note === undefined ? {} : { resolutionNote: input.note }),
              version: { increment: 1 },
            },
          });
          await tx.match.update({
            where: { id: dispute.matchId },
            data: {
              status: 'COMPLETED',
              completedAt: input.now,
              voidedAt: null,
              version: { increment: 1 },
            },
          });
        } else if (input.resolutionType === 'VOID_MATCH') {
          await tx.matchResultRevision.create({
            data: {
              matchResultId: previous.id,
              disputeId: input.disputeId,
              previousPayload: previous.resultPayload as unknown as Prisma.InputJsonValue,
              newPayload: Prisma.DbNull,
              previousStatus: previous.status,
              resolutionType: 'VOID_MATCH',
              resolvedByUserId: input.actorUserId,
              reasonCode: input.reasonCode,
            },
          });
          await tx.matchResult.update({
            where: { id: previous.id },
            data: {
              status: 'VOIDED',
              resultPayload: Prisma.DbNull,
              winnerParticipantId: null,
              loserParticipantId: null,
              isDraw: false,
              confirmationMethod: null,
              confirmedAt: null,
              resolvedByUserId: input.actorUserId,
              resolutionReasonCode: input.reasonCode,
              version: { increment: 1 },
            },
          });
          await tx.match.update({
            where: { id: dispute.matchId },
            data: {
              status: 'VOIDED',
              voidedAt: input.now,
              version: { increment: 1 },
            },
          });
        }
        const rejected = input.resolutionType === 'REJECT_DISPUTE';
        const row = await tx.matchDispute.update({
          where: { id: input.disputeId, version: dispute.version },
          data: {
            status: rejected ? 'REJECTED' : 'RESOLVED',
            resolvedAt: input.now,
            resolutionType: input.resolutionType,
            resolutionReasonCode: input.reasonCode,
            ...(input.note === undefined ? {} : { resolutionNote: input.note }),
            resolvedByUserId: input.actorUserId,
            version: { increment: 1 },
          },
          select: disputeSelect,
        });
        await tx.matchAuditEvent.create({
          data: {
            matchId: dispute.matchId,
            actorUserId: input.actorUserId,
            action: 'DISPUTE_RESOLVED',
            reasonCode: input.reasonCode,
            note: `dispute:${input.disputeId}`,
          },
        });
        return mapDispute(row);
      });
    } catch (error) {
      return persistence(error);
    }
  }
  public async expireResponses(now: Date, limit: number) {
    const rows = await this.client.matchDispute.findMany({
      where: { status: 'AWAITING_RESPONSE', responseDeadlineAt: { lte: now } },
      select: { id: true, matchId: true, version: true },
      orderBy: { responseDeadlineAt: 'asc' },
      take: limit,
    });
    let count = 0;
    for (const row of rows) {
      const updated = await this.client.matchDispute.updateMany({
        where: { id: row.id, version: row.version, status: 'AWAITING_RESPONSE' },
        data: { status: 'UNDER_REVIEW', version: { increment: 1 } },
      });
      if (updated.count) {
        count += 1;
        await this.client.matchAuditEvent.create({
          data: {
            matchId: row.matchId,
            action: 'DISPUTE_RESPONSE_EXPIRED',
            note: `dispute:${row.id}`,
          },
        });
      }
    }
    return count;
  }
}
