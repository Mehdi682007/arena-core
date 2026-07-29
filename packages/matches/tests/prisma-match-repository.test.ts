import { describe, expect, it, vi } from 'vitest';
import type { ArenaPrismaClient } from '@arena-core/database';
import { PrismaMatchRepository } from '../src';
import { context } from './fixtures';

describe('Prisma match repository', () => {
  it('uses accepted proposal source joins without sensitive identity selects', async () => {
    const findUnique = vi.fn(async (_input: unknown) => null);
    const client = { matchmakingProposal: { findUnique } } as unknown as ArenaPrismaClient;
    await new PrismaMatchRepository(client).loadAcceptedProposalContext('proposal');
    const query = findUnique.mock.calls[0]?.[0];
    expect(query).toMatchObject({ where: { id: 'proposal' } });
    expect(JSON.stringify(query)).not.toMatch(
      /normalizedHandle|verificationMetadata|email|password|session|token/,
    );
  });
  it('queries user matches through participant ownership and bounded ordering', async () => {
    const findMany = vi.fn(async (_input: unknown) => []);
    const client = { match: { findMany } } as unknown as ArenaPrismaClient;
    await new PrismaMatchRepository(client).listForUser('user', 50);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { participants: { some: { userId: 'user' } } },
        take: 50,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      }),
    );
  });
  it('creates exactly two canonical participant sides and versioned snapshots', async () => {
    const create = vi.fn(async (_input: unknown) => {
      throw new Error('capture');
    });
    const client = { match: { create } } as unknown as ArenaPrismaClient;
    await expect(
      new PrismaMatchRepository(client).createMatch({
        context,
        readyDeadlineAt: new Date('2026-07-26T00:02:00Z'),
      }),
    ).rejects.toMatchObject({ code: 'MATCH_PERSISTENCE_FAILURE' });
    const data = (create.mock.calls[0]?.[0] as { data: Record<string, unknown> }).data as {
      matchmakingProposalId: string;
      participants: { create: Array<{ side: string }> };
      gameSnapshot: unknown;
      auditEvents: unknown;
    };
    expect(data.matchmakingProposalId).toBe('proposal');
    expect(data.participants.create).toHaveLength(2);
    expect(data.participants.create.map((item) => item.side)).toEqual(['SIDE_A', 'SIDE_B']);
    expect(data.gameSnapshot).toMatchObject({ schemaVersion: 1 });
    expect(data.auditEvents).toEqual({ create: { action: 'CREATED' } });
  });
  it('uses bounded expiration candidates and optimistic match versions', async () => {
    const findMany = vi.fn(async (_input: unknown) => []);
    const client = { match: { findMany } } as unknown as ArenaPrismaClient;
    await new PrismaMatchRepository(client).expireUnready(new Date(), 100);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          status: 'AWAITING_READY',
          readyDeadlineAt: { lte: expect.any(Date) },
        },
        take: 100,
      }),
    );
  });
});
