import { type ArenaPrismaClient, Prisma } from '@arena-core/database';
import { MatchError } from '../domain/match-errors';
import { buildSnapshots } from '../domain/match-snapshot';
import type {
  AcceptedProposalContext,
  MatchAuditEvent,
  MatchRecord,
  MatchVoidReasonCode,
} from '../domain/match-types';
import type { MatchRepository } from '../ports/match-repository';
import type { MatchTransactionManager } from '../ports/match-transaction-manager';

type Client = ArenaPrismaClient | Prisma.TransactionClient;
const participantSelect = {
  id: true,
  matchId: true,
  userId: true,
  userGameAccountId: true,
  gameId: true,
  gamePlatformId: true,
  side: true,
  status: true,
  participantSnapshot: true,
  readyAt: true,
} satisfies Prisma.MatchParticipantSelect;
export const matchSelect = {
  id: true,
  matchmakingProposalId: true,
  gameId: true,
  gameModeId: true,
  gameRulesetId: true,
  crossplayGroupId: true,
  status: true,
  gameSnapshot: true,
  modeSnapshot: true,
  rulesetSnapshot: true,
  crossplaySnapshot: true,
  readyDeadlineAt: true,
  cancelledAt: true,
  voidedAt: true,
  startedAt: true,
  resultSubmissionDeadlineAt: true,
  resultConflictDeadlineAt: true,
  completedAt: true,
  version: true,
  createdAt: true,
  participants: { select: participantSelect, orderBy: { side: 'asc' as const } },
} satisfies Prisma.MatchSelect;
type MatchRow = Prisma.MatchGetPayload<{ select: typeof matchSelect }>;
const proposalContextSelect = {
  id: true,
  status: true,
  game: { select: { id: true, key: true, slug: true, name: true } },
  gameMode: {
    select: {
      id: true,
      key: true,
      slug: true,
      name: true,
      teamSizeMin: true,
      teamSizeMax: true,
      participantCountMin: true,
      participantCountMax: true,
    },
  },
  gameRuleset: {
    select: {
      id: true,
      key: true,
      name: true,
      version: true,
      configuration: true,
      publishedAt: true,
      status: true,
    },
  },
  crossplayGroup: { select: { id: true, key: true, name: true } },
  requestA: {
    select: {
      status: true,
      userId: true,
      userGameAccount: {
        select: {
          id: true,
          status: true,
          gamePlatformId: true,
          displayHandle: true,
          gamePlatform: {
            select: { platform: { select: { key: true, name: true } } },
          },
        },
      },
    },
  },
  requestB: {
    select: {
      status: true,
      userId: true,
      userGameAccount: {
        select: {
          id: true,
          status: true,
          gamePlatformId: true,
          displayHandle: true,
          gamePlatform: {
            select: { platform: { select: { key: true, name: true } } },
          },
        },
      },
    },
  },
} satisfies Prisma.MatchmakingProposalSelect;
type ProposalContextRow = Prisma.MatchmakingProposalGetPayload<{
  select: typeof proposalContextSelect;
}>;

export function mapMatch(row: MatchRow): MatchRecord {
  return {
    ...row,
    gameSnapshot: row.gameSnapshot as unknown as MatchRecord['gameSnapshot'],
    modeSnapshot: row.modeSnapshot as unknown as MatchRecord['modeSnapshot'],
    rulesetSnapshot: row.rulesetSnapshot as unknown as MatchRecord['rulesetSnapshot'],
    crossplaySnapshot: row.crossplaySnapshot as unknown as MatchRecord['crossplaySnapshot'],
    participants: row.participants.map((participant) => ({
      ...participant,
      snapshot:
        participant.participantSnapshot as unknown as MatchRecord['participants'][number]['snapshot'],
    })),
  };
}
function mapContext(row: ProposalContextRow): AcceptedProposalContext {
  const participant = (
    request: ProposalContextRow['requestA'],
  ): AcceptedProposalContext['participants'][number] => ({
    userId: request.userId,
    userGameAccountId: request.userGameAccount.id,
    gamePlatformId: request.userGameAccount.gamePlatformId,
    platformKey: request.userGameAccount.gamePlatform.platform.key,
    platformName: request.userGameAccount.gamePlatform.platform.name,
    displayHandle: request.userGameAccount.displayHandle,
    accountVerified: request.userGameAccount.status === 'VERIFIED',
    requestMatched: request.status === 'MATCHED',
  });
  return {
    proposalId: row.id,
    proposalStatus: row.status === 'ACCEPTED' ? 'ACCEPTED' : 'OTHER',
    game: { gameId: row.game.id, key: row.game.key, slug: row.game.slug, name: row.game.name },
    mode: {
      gameModeId: row.gameMode.id,
      key: row.gameMode.key,
      slug: row.gameMode.slug,
      name: row.gameMode.name,
      teamSizeMin: row.gameMode.teamSizeMin,
      teamSizeMax: row.gameMode.teamSizeMax,
      participantCountMin: row.gameMode.participantCountMin,
      participantCountMax: row.gameMode.participantCountMax,
    },
    ruleset: {
      gameRulesetId: row.gameRuleset.id,
      key: row.gameRuleset.key,
      name: row.gameRuleset.name,
      version: row.gameRuleset.version,
      configuration: row.gameRuleset.configuration,
      publishedAt: row.gameRuleset.publishedAt?.toISOString() ?? '',
      status: row.gameRuleset.status,
    },
    crossplay: {
      crossplayGroupId: row.crossplayGroup.id,
      key: row.crossplayGroup.key,
      name: row.crossplayGroup.name,
    },
    participants: [participant(row.requestA), participant(row.requestB)],
  };
}
function persistence(error: unknown): never {
  if (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    String((error as { code?: unknown }).code) === 'P2002'
  )
    throw new MatchError('MATCH_CREATION_CONFLICT');
  throw new MatchError('MATCH_PERSISTENCE_FAILURE');
}
async function transact<T>(
  client: Client,
  operation: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  if ('$transaction' in client) return client.$transaction(operation);
  return operation(client);
}

export class PrismaMatchRepository implements MatchRepository {
  public constructor(private readonly client: Client) {}
  public async findByProposalId(proposalId: string) {
    const row = await this.client.match.findUnique({
      where: { matchmakingProposalId: proposalId },
      select: matchSelect,
    });
    return row && mapMatch(row);
  }
  public async loadAcceptedProposalContext(proposalId: string) {
    const row = await this.client.matchmakingProposal.findUnique({
      where: { id: proposalId },
      select: proposalContextSelect,
    });
    return row && mapContext(row);
  }
  public async createMatch(input: { context: AcceptedProposalContext; readyDeadlineAt: Date }) {
    const snapshots = buildSnapshots(input.context);
    try {
      return mapMatch(
        await this.client.match.create({
          data: {
            matchmakingProposalId: input.context.proposalId,
            gameId: input.context.game.gameId,
            gameModeId: input.context.mode.gameModeId,
            gameRulesetId: input.context.ruleset.gameRulesetId,
            crossplayGroupId: input.context.crossplay.crossplayGroupId,
            status: 'AWAITING_READY',
            gameSnapshot: snapshots.game as unknown as Prisma.InputJsonValue,
            modeSnapshot: snapshots.mode as unknown as Prisma.InputJsonValue,
            rulesetSnapshot: snapshots.ruleset as unknown as Prisma.InputJsonValue,
            crossplaySnapshot: snapshots.crossplay as unknown as Prisma.InputJsonValue,
            readyDeadlineAt: input.readyDeadlineAt,
            participants: {
              create: input.context.participants.map((participant, index) => ({
                userId: participant.userId,
                userGameAccountId: participant.userGameAccountId,
                gameId: input.context.game.gameId,
                gamePlatformId: participant.gamePlatformId,
                side: index === 0 ? ('SIDE_A' as const) : ('SIDE_B' as const),
                participantSnapshot: snapshots.participants[
                  index
                ] as unknown as Prisma.InputJsonValue,
              })),
            },
            auditEvents: { create: { action: 'CREATED' } },
          },
          select: matchSelect,
        }),
      );
    } catch (error) {
      return persistence(error);
    }
  }
  public async listForUser(userId: string, limit: number) {
    return (
      await this.client.match.findMany({
        where: { participants: { some: { userId } } },
        select: matchSelect,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: limit,
      })
    ).map(mapMatch);
  }
  public async findForUser(userId: string, matchId: string) {
    const row = await this.client.match.findFirst({
      where: { id: matchId, participants: { some: { userId } } },
      select: matchSelect,
    });
    return row && mapMatch(row);
  }
  public async findById(matchId: string) {
    const row = await this.client.match.findUnique({ where: { id: matchId }, select: matchSelect });
    return row && mapMatch(row);
  }
  public async markReady(userId: string, matchId: string, now: Date) {
    try {
      await transact(this.client, async (tx) => {
        const match = await tx.match.findFirst({
          where: { id: matchId, status: 'AWAITING_READY', readyDeadlineAt: { gt: now } },
          select: {
            version: true,
            participants: { select: { id: true, userId: true, status: true } },
          },
        });
        if (!match) throw new MatchError('MATCH_STATE_TRANSITION_INVALID');
        const mine = match.participants.find((participant) => participant.userId === userId);
        if (!mine) throw new MatchError('MATCH_PARTICIPANT_NOT_FOUND');
        if (mine.status !== 'READY')
          await tx.matchParticipant.updateMany({
            where: { id: mine.id, userId, status: 'PENDING' },
            data: { status: 'READY', readyAt: now },
          });
        const readyCount =
          match.participants.filter((participant) => participant.status === 'READY').length +
          (mine.status === 'READY' ? 0 : 1);
        const updated = await tx.match.updateMany({
          where: { id: matchId, version: match.version, status: 'AWAITING_READY' },
          data: {
            ...(readyCount === 2 ? { status: 'READY' as const } : {}),
            version: { increment: 1 },
          },
        });
        if (updated.count !== 1) throw new MatchError('MATCH_CREATION_CONFLICT');
      });
      const result = await this.findForUser(userId, matchId);
      if (!result) throw new MatchError('MATCH_NOT_FOUND');
      return result;
    } catch (error) {
      if (error instanceof MatchError) throw error;
      return persistence(error);
    }
  }
  public async cancel(userId: string, matchId: string, now: Date) {
    try {
      await transact(this.client, async (tx) => {
        const match = await tx.match.findFirst({
          where: {
            id: matchId,
            status: { in: ['CREATED', 'AWAITING_READY'] },
            participants: { some: { userId } },
          },
          select: { version: true },
        });
        if (!match) throw new MatchError('MATCH_STATE_TRANSITION_INVALID');
        const updated = await tx.match.updateMany({
          where: { id: matchId, version: match.version },
          data: { status: 'CANCELLED', cancelledAt: now, version: { increment: 1 } },
        });
        if (updated.count !== 1) throw new MatchError('MATCH_CREATION_CONFLICT');
        await tx.matchParticipant.updateMany({
          where: { matchId, userId, status: 'PENDING' },
          data: { status: 'CANCELLED', cancelledAt: now },
        });
        await tx.matchAuditEvent.create({
          data: { matchId, actorUserId: userId, action: 'USER_CANCELLED' },
        });
      });
    } catch (error) {
      if (error instanceof MatchError) throw error;
      persistence(error);
    }
  }
  public async expireUnready(now: Date, limit: number) {
    const rows = await this.client.match.findMany({
      where: { status: 'AWAITING_READY', readyDeadlineAt: { lte: now } },
      select: { id: true, version: true },
      orderBy: { readyDeadlineAt: 'asc' },
      take: limit,
    });
    let count = 0;
    for (const row of rows) {
      const updated = await this.client.match.updateMany({
        where: { id: row.id, version: row.version, status: 'AWAITING_READY' },
        data: { status: 'EXPIRED', version: { increment: 1 } },
      });
      if (updated.count === 1) {
        count += 1;
        await this.client.matchAuditEvent.create({
          data: { matchId: row.id, action: 'EXPIRED' },
        });
      }
    }
    return count;
  }
  public async listAdmin(limit: number, status?: string) {
    return (
      await this.client.match.findMany({
        where:
          status &&
          [
            'CREATED',
            'AWAITING_READY',
            'READY',
            'IN_PROGRESS',
            'AWAITING_RESULT',
            'RESULT_CONFLICT',
            'COMPLETED',
            'CANCELLED',
            'EXPIRED',
            'VOIDED',
          ].includes(status)
            ? { status: status as MatchRow['status'] }
            : {},
        select: matchSelect,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: limit,
      })
    ).map(mapMatch);
  }
  public async listAudit(matchId: string): Promise<readonly MatchAuditEvent[]> {
    return this.client.matchAuditEvent.findMany({
      where: { matchId },
      select: {
        id: true,
        matchId: true,
        actorUserId: true,
        action: true,
        reasonCode: true,
        note: true,
        createdAt: true,
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
  }
  public async voidMatch(
    actorUserId: string,
    matchId: string,
    reasonCode: MatchVoidReasonCode,
    note: string | undefined,
    now: Date,
  ) {
    try {
      await transact(this.client, async (tx) => {
        const updated = await tx.match.updateMany({
          where: {
            id: matchId,
            status: {
              in: [
                'CREATED',
                'AWAITING_READY',
                'READY',
                'IN_PROGRESS',
                'AWAITING_RESULT',
                'RESULT_CONFLICT',
              ],
            },
          },
          data: { status: 'VOIDED', voidedAt: now, version: { increment: 1 } },
        });
        if (updated.count !== 1) throw new MatchError('MATCH_STATE_TRANSITION_INVALID');
        await tx.matchAuditEvent.create({
          data: {
            matchId,
            actorUserId,
            action: 'ADMIN_VOIDED',
            reasonCode,
            ...(note === undefined ? {} : { note }),
          },
        });
      });
    } catch (error) {
      if (error instanceof MatchError) throw error;
      persistence(error);
    }
  }
  public async listAcceptedProposalIdsWithoutMatch(limit: number) {
    return (
      await this.client.matchmakingProposal.findMany({
        where: { status: 'ACCEPTED', match: null },
        select: { id: true },
        orderBy: [{ completedAt: 'asc' }, { id: 'asc' }],
        take: limit,
      })
    ).map(({ id }) => id);
  }
}

export class PrismaMatchTransactionManager implements MatchTransactionManager {
  public constructor(private readonly client: ArenaPrismaClient) {}
  public transaction<T>(operation: (repository: MatchRepository) => Promise<T>): Promise<T> {
    return this.client.$transaction((tx) => operation(new PrismaMatchRepository(tx)));
  }
}
