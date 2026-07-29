import { type ArenaPrismaClient, Prisma } from '@arena-core/database';
import { MatchResultError } from '../domain/match-result-errors';
import { deriveOutcome, sameCanonicalResult } from '../domain/match-result-policies';
import type {
  MatchResultContext,
  MatchResultPayload,
  MatchResultRecord,
  MatchResultResolutionReasonCode,
  MatchResultSubmissionRecord,
} from '../domain/match-result-types';
import type { MatchResultRepository } from '../ports/match-result-repository';
import { mapMatch, matchSelect } from './prisma-match-repository';

type Client = ArenaPrismaClient | Prisma.TransactionClient;
const submissionSelect = {
  id: true,
  matchId: true,
  participantId: true,
  submittedByUserId: true,
  status: true,
  resultPayload: true,
  submittedAt: true,
  withdrawnAt: true,
  supersededAt: true,
  version: true,
} satisfies Prisma.MatchResultSubmissionSelect;
const resultSelect = {
  id: true,
  matchId: true,
  status: true,
  resultPayload: true,
  winnerParticipantId: true,
  loserParticipantId: true,
  isDraw: true,
  confirmationMethod: true,
  conflictReason: true,
  confirmedAt: true,
  resolvedByUserId: true,
  resolutionReasonCode: true,
} satisfies Prisma.MatchResultSelect;
export const resultContextSelect = {
  ...matchSelect,
  resultSubmissions: {
    select: submissionSelect,
    orderBy: [{ submittedAt: 'asc' as const }, { id: 'asc' as const }],
  },
  result: { select: resultSelect },
  settlement: { select: { id: true } },
  ratingApplication: { select: { id: true } },
} satisfies Prisma.MatchSelect;
type ContextRow = Prisma.MatchGetPayload<{ select: typeof resultContextSelect }>;

function submission(row: ContextRow['resultSubmissions'][number]): MatchResultSubmissionRecord {
  return { ...row, resultPayload: row.resultPayload as unknown as MatchResultPayload };
}
function result(row: NonNullable<ContextRow['result']>): MatchResultRecord {
  return {
    ...row,
    resultPayload: row.resultPayload as unknown as MatchResultPayload | null,
  };
}
export function mapResultContext(row: ContextRow): MatchResultContext {
  return {
    match: mapMatch(row),
    submissions: row.resultSubmissions.map(submission),
    result: row.result ? result(row.result) : null,
    startedAt: row.startedAt,
    resultSubmissionDeadlineAt: row.resultSubmissionDeadlineAt,
    resultConflictDeadlineAt: row.resultConflictDeadlineAt,
    completedAt: row.completedAt,
    settlementExists: row.settlement !== null,
    ratingApplicationExists: row.ratingApplication !== null,
  };
}
function persistence(error: unknown): never {
  if (error instanceof MatchResultError) throw error;
  throw new MatchResultError('MATCH_RESULT_PERSISTENCE_FAILURE');
}
async function transact<T>(
  client: Client,
  operation: (tx: Prisma.TransactionClient) => Promise<T>,
) {
  if ('$transaction' in client) return client.$transaction(operation);
  return operation(client);
}

export class PrismaMatchResultRepository implements MatchResultRepository {
  public constructor(private readonly client: Client) {}
  private async reload(client: Client, matchId: string): Promise<MatchResultContext> {
    const row = await client.match.findUnique({
      where: { id: matchId },
      select: resultContextSelect,
    });
    if (!row) throw new MatchResultError('MATCH_RESULT_NOT_FOUND');
    return mapResultContext(row);
  }
  public async findForUser(userId: string, matchId: string) {
    const row = await this.client.match.findFirst({
      where: { id: matchId, participants: { some: { userId } } },
      select: resultContextSelect,
    });
    return row ? mapResultContext(row) : null;
  }
  public async findForAdmin(matchId: string) {
    const row = await this.client.match.findUnique({
      where: { id: matchId },
      select: resultContextSelect,
    });
    return row ? mapResultContext(row) : null;
  }
  public async start(userId: string, matchId: string, now: Date, deadline: Date) {
    try {
      return await transact(this.client, async (tx) => {
        const row = await tx.match.findFirst({
          where: {
            id: matchId,
            status: 'READY',
            participants: { some: { userId } },
          },
          select: { version: true, participants: { select: { status: true } } },
        });
        if (
          !row ||
          row.participants.length !== 2 ||
          row.participants.some((item) => item.status !== 'READY')
        )
          throw new MatchResultError('MATCH_START_INVALID');
        const updated = await tx.match.updateMany({
          where: { id: matchId, version: row.version, status: 'READY' },
          data: {
            status: 'IN_PROGRESS',
            startedAt: now,
            resultSubmissionDeadlineAt: deadline,
            version: { increment: 1 },
          },
        });
        if (updated.count !== 1) throw new MatchResultError('MATCH_ALREADY_STARTED');
        await tx.matchAuditEvent.create({
          data: { matchId, actorUserId: userId, action: 'MATCH_STARTED' },
        });
        return this.reload(tx, matchId);
      });
    } catch (error) {
      return persistence(error);
    }
  }
  public async submit(
    userId: string,
    matchId: string,
    payload: MatchResultPayload,
    now: Date,
    conflictDeadlineAt: Date,
  ) {
    try {
      return await transact(this.client, async (tx) => {
        const row = await tx.match.findFirst({
          where: {
            id: matchId,
            status: { in: ['IN_PROGRESS', 'AWAITING_RESULT'] },
            resultSubmissionDeadlineAt: { gt: now },
            participants: { some: { userId } },
          },
          select: resultContextSelect,
        });
        if (!row) throw new MatchResultError('MATCH_RESULT_SUBMISSION_NOT_ALLOWED');
        const current = mapResultContext(row);
        const mine = current.match.participants.find((item) => item.userId === userId);
        if (!mine) throw new MatchResultError('MATCH_RESULT_PERMISSION_DENIED');
        const activeMine = current.submissions.find(
          (item) => item.participantId === mine.id && item.status === 'ACTIVE',
        );
        if (activeMine && sameCanonicalResult(activeMine.resultPayload, payload)) return current;
        if (activeMine)
          await tx.matchResultSubmission.update({
            where: { id: activeMine.id },
            data: { status: 'SUPERSEDED', supersededAt: now, version: { increment: 1 } },
          });
        const created = await tx.matchResultSubmission.create({
          data: {
            matchId,
            participantId: mine.id,
            submittedByUserId: userId,
            status: 'ACTIVE',
            resultPayload: payload as unknown as Prisma.InputJsonValue,
            submittedAt: now,
          },
          select: submissionSelect,
        });
        await tx.matchAuditEvent.create({
          data: {
            matchId,
            actorUserId: userId,
            action: 'RESULT_SUBMITTED',
            note: `submission:${created.id}`,
          },
        });
        const opponent = current.submissions.find(
          (item) => item.participantId !== mine.id && item.status === 'ACTIVE',
        );
        if (!opponent) {
          await tx.match.updateMany({
            where: { id: matchId, version: current.match.version },
            data: { status: 'AWAITING_RESULT', version: { increment: 1 } },
          });
          return this.reload(tx, matchId);
        }
        if (sameCanonicalResult(opponent.resultPayload, payload)) {
          const outcome = deriveOutcome(payload, current.match);
          await tx.matchResultSubmission.updateMany({
            where: { matchId, status: 'ACTIVE' },
            data: { status: 'CONFIRMED', version: { increment: 1 } },
          });
          await tx.matchResult.create({
            data: {
              matchId,
              status: 'CONFIRMED',
              resultPayload: payload as unknown as Prisma.InputJsonValue,
              ...outcome,
              confirmationMethod: 'PARTICIPANT_AGREEMENT',
              confirmedAt: now,
            },
          });
          await tx.match.update({
            where: { id: matchId },
            data: { status: 'COMPLETED', completedAt: now, version: { increment: 1 } },
          });
          await tx.matchAuditEvent.create({ data: { matchId, action: 'RESULT_CONFIRMED' } });
        } else {
          await tx.matchResultSubmission.updateMany({
            where: { matchId, status: 'ACTIVE' },
            data: { status: 'CONFLICTING', version: { increment: 1 } },
          });
          await tx.matchResult.create({
            data: { matchId, status: 'CONFLICT', conflictReason: 'SUBMISSIONS_DIFFER' },
          });
          await tx.match.update({
            where: { id: matchId },
            data: {
              status: 'RESULT_CONFLICT',
              resultConflictDeadlineAt: conflictDeadlineAt,
              version: { increment: 1 },
            },
          });
          await tx.matchAuditEvent.create({ data: { matchId, action: 'RESULT_CONFLICTED' } });
        }
        return this.reload(tx, matchId);
      });
    } catch (error) {
      return persistence(error);
    }
  }
  public async withdraw(userId: string, matchId: string, now: Date) {
    try {
      await transact(this.client, async (tx) => {
        const row = await tx.match.findFirst({
          where: { id: matchId, status: 'AWAITING_RESULT', participants: { some: { userId } } },
          select: {
            version: true,
            resultSubmissions: {
              where: { status: 'ACTIVE' },
              select: { id: true, submittedByUserId: true },
            },
          },
        });
        if (!row) throw new MatchResultError('MATCH_RESULT_WITHDRAW_NOT_ALLOWED');
        if (row.resultSubmissions.some((item) => item.submittedByUserId !== userId))
          throw new MatchResultError('MATCH_RESULT_WITHDRAW_NOT_ALLOWED');
        const mine = row.resultSubmissions.find((item) => item.submittedByUserId === userId);
        if (!mine) return;
        await tx.matchResultSubmission.update({
          where: { id: mine.id },
          data: { status: 'WITHDRAWN', withdrawnAt: now, version: { increment: 1 } },
        });
        await tx.match.updateMany({
          where: { id: matchId, version: row.version },
          data: { status: 'IN_PROGRESS', version: { increment: 1 } },
        });
        await tx.matchAuditEvent.create({
          data: { matchId, actorUserId: userId, action: 'RESULT_WITHDRAWN' },
        });
      });
    } catch (error) {
      persistence(error);
    }
  }
  public async expire(now: Date, limit: number, conflictDeadlineAt: Date) {
    const rows = await this.client.match.findMany({
      where: {
        status: { in: ['IN_PROGRESS', 'AWAITING_RESULT'] },
        resultSubmissionDeadlineAt: { lte: now },
      },
      select: {
        id: true,
        status: true,
        version: true,
        resultSubmissions: { where: { status: 'ACTIVE' }, select: { id: true } },
      },
      orderBy: { resultSubmissionDeadlineAt: 'asc' },
      take: limit,
    });
    let count = 0;
    for (const row of rows) {
      await transact(this.client, async (tx) => {
        if (row.resultSubmissions.length === 0) {
          const updated = await tx.match.updateMany({
            where: { id: row.id, version: row.version, status: row.status },
            data: { status: 'VOIDED', voidedAt: now, version: { increment: 1 } },
          });
          if (!updated.count) return;
        } else {
          const updated = await tx.match.updateMany({
            where: { id: row.id, version: row.version, status: row.status },
            data: {
              status: 'RESULT_CONFLICT',
              resultConflictDeadlineAt: conflictDeadlineAt,
              version: { increment: 1 },
            },
          });
          if (!updated.count) return;
          await tx.matchResult.create({
            data: {
              matchId: row.id,
              status: 'CONFLICT',
              conflictReason: 'OPPONENT_DID_NOT_SUBMIT',
            },
          });
          await tx.matchResultSubmission.updateMany({
            where: { matchId: row.id, status: 'ACTIVE' },
            data: { status: 'CONFLICTING', version: { increment: 1 } },
          });
        }
        await tx.matchAuditEvent.create({
          data: { matchId: row.id, action: 'RESULT_SUBMISSION_EXPIRED' },
        });
        count += 1;
      });
    }
    return count;
  }
  public async listConflicts(limit: number) {
    return (
      await this.client.match.findMany({
        where: { status: 'RESULT_CONFLICT' },
        select: resultContextSelect,
        orderBy: [{ resultConflictDeadlineAt: 'asc' }, { id: 'asc' }],
        take: limit,
      })
    ).map(mapResultContext);
  }
  public async resolve(
    actorUserId: string,
    matchId: string,
    payload: MatchResultPayload,
    reasonCode: MatchResultResolutionReasonCode,
    note: string | undefined,
    now: Date,
  ) {
    try {
      return await transact(this.client, async (tx) => {
        const row = await tx.match.findFirst({
          where: { id: matchId, status: 'RESULT_CONFLICT' },
          select: resultContextSelect,
        });
        if (!row) throw new MatchResultError('MATCH_RESULT_CONFLICT_NOT_FOUND');
        const current = mapResultContext(row);
        const outcome = deriveOutcome(payload, current.match);
        await tx.matchResult.update({
          where: { matchId },
          data: {
            status: 'ADMIN_RESOLVED',
            resultPayload: payload as unknown as Prisma.InputJsonValue,
            ...outcome,
            confirmationMethod: 'ADMIN_RESOLUTION',
            conflictReason: null,
            confirmedAt: now,
            resolvedByUserId: actorUserId,
            resolutionReasonCode: reasonCode,
            ...(note === undefined ? {} : { resolutionNote: note }),
            version: { increment: 1 },
          },
        });
        const updated = await tx.match.updateMany({
          where: { id: matchId, version: current.match.version, status: 'RESULT_CONFLICT' },
          data: { status: 'COMPLETED', completedAt: now, version: { increment: 1 } },
        });
        if (!updated.count) throw new MatchResultError('MATCH_RESULT_RESOLUTION_INVALID');
        await tx.matchAuditEvent.create({
          data: {
            matchId,
            actorUserId,
            action: 'RESULT_ADMIN_RESOLVED',
            reasonCode,
            ...(note === undefined ? {} : { note }),
          },
        });
        return this.reload(tx, matchId);
      });
    } catch (error) {
      return persistence(error);
    }
  }
}
