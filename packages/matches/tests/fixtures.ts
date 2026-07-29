import type { AcceptedProposalContext } from '../src';

export const context: AcceptedProposalContext = {
  proposalId: 'proposal',
  proposalStatus: 'ACCEPTED',
  game: { gameId: 'game', key: 'FC26', slug: 'fc-26', name: 'EA SPORTS FC 26' },
  mode: {
    gameModeId: 'mode',
    key: 'ONE_V_ONE',
    slug: '1v1',
    name: '1v1',
    teamSizeMin: 1,
    teamSizeMax: 1,
    participantCountMin: 2,
    participantCountMax: 2,
  },
  ruleset: {
    gameRulesetId: 'ruleset',
    key: 'ARENA_CORE_1V1',
    name: 'Arena Core 1v1',
    version: 1,
    configuration: { halves: 6 },
    publishedAt: '2026-07-25T00:00:00.000Z',
    status: 'ACTIVE',
  },
  crossplay: { crossplayGroupId: 'group', key: 'CURRENT_GEN', name: 'Current Gen' },
  participants: [
    {
      userId: 'user-a',
      userGameAccountId: 'account-a',
      gamePlatformId: 'gp-a',
      platformKey: 'PS5',
      platformName: 'PlayStation 5',
      displayHandle: 'Player A',
      accountVerified: true,
      requestMatched: true,
    },
    {
      userId: 'user-b',
      userGameAccountId: 'account-b',
      gamePlatformId: 'gp-b',
      platformKey: 'XBOX_SERIES',
      platformName: 'Xbox Series',
      displayHandle: 'Player B',
      accountVerified: true,
      requestMatched: true,
    },
  ],
};
