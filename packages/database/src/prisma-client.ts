import { PrismaPg } from '@prisma/adapter-pg';
import type { EnabledDatabaseConfig } from '@arena-core/config';
import { Prisma, PrismaClient } from './generated/prisma/client';

export type ArenaPrismaClient = PrismaClient;

export function createPrismaClient(config: EnabledDatabaseConfig): PrismaClient {
  const adapter = new PrismaPg({
    connectionString: config.url,
    connectionTimeoutMillis: config.connectTimeoutSeconds * 1_000,
  });
  return new PrismaClient({
    adapter,
    log: config.logQueries ? [{ emit: 'stdout', level: 'query' }] : [],
  });
}

export async function connectPrisma(client: Pick<PrismaClient, '$connect'>): Promise<void> {
  await client.$connect();
}

const disconnectedClients = new WeakSet<object>();

export async function disconnectPrisma(
  client: Pick<PrismaClient, '$disconnect'> & object,
): Promise<void> {
  if (disconnectedClients.has(client)) return;
  await client.$disconnect();
  disconnectedClients.add(client);
}

export interface DatabaseProbeClient {
  $queryRaw(query: Prisma.Sql): Promise<unknown>;
}

export async function checkDatabaseConnection(
  client: DatabaseProbeClient,
  timeoutMs = 5_000,
): Promise<void> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      reject(new Error('Database connection probe timed out.'));
    }, timeoutMs);
    timer.unref();
  });

  try {
    await Promise.race([client.$queryRaw(Prisma.sql`SELECT 1`), timeout]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}
