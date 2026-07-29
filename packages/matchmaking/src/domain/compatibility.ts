import type {
  CompatibilityResult,
  MatchmakingIncompatibilityReason,
  MatchmakingRequest,
} from './matchmaking-types';

export function evaluateCompatibility(
  left: MatchmakingRequest,
  right: MatchmakingRequest,
  now: Date,
  activeProposalExists = false,
): CompatibilityResult {
  const reasons: MatchmakingIncompatibilityReason[] = [];
  if (left.userId === right.userId) reasons.push('SAME_USER');
  if (left.status !== 'SEARCHING' || right.status !== 'SEARCHING')
    reasons.push('REQUEST_NOT_SEARCHING');
  if (left.expiresAt <= now || right.expiresAt <= now) reasons.push('REQUEST_EXPIRED');
  if (left.gameId !== right.gameId) reasons.push('GAME_MISMATCH');
  if (left.gameModeId !== right.gameModeId) reasons.push('MODE_MISMATCH');
  if (left.gameRulesetId !== right.gameRulesetId) reasons.push('RULESET_MISMATCH');
  if (left.crossplayGroupId !== right.crossplayGroupId) reasons.push('CROSSPLAY_GROUP_MISMATCH');
  if (
    (left.searchScope === 'SAME_PLATFORM' || right.searchScope === 'SAME_PLATFORM') &&
    left.gamePlatformId !== right.gamePlatformId
  )
    reasons.push('PLATFORM_SCOPE_MISMATCH');
  if (!left.accountVerified || !right.accountVerified || !left.catalogValid || !right.catalogValid)
    reasons.push('ACCOUNT_NOT_VERIFIED');
  const leftLanguage = left.criteria.preferences.language;
  const rightLanguage = right.criteria.preferences.language;
  if (leftLanguage && rightLanguage && leftLanguage !== rightLanguage)
    reasons.push('LANGUAGE_MISMATCH');
  const leftRegion = left.criteria.preferences.region;
  const rightRegion = right.criteria.preferences.region;
  if (leftRegion && rightRegion && leftRegion !== rightRegion) reasons.push('REGION_MISMATCH');
  if (activeProposalExists) reasons.push('ACTIVE_PROPOSAL_EXISTS');
  if (reasons.length > 0) return { compatible: false, reasons, score: 0 };
  let score = 100;
  if (leftLanguage && leftLanguage === rightLanguage) score += 10;
  if (leftRegion && leftRegion === rightRegion) score += 5;
  if (left.gamePlatformId === right.gamePlatformId) score += 3;
  return { compatible: true, reasons: [], score: Math.min(score, 118) };
}
