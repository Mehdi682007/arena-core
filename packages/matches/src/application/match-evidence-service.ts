import { MatchEvidenceError } from '../domain/match-evidence-errors';
import { validateEvidencePayload } from '../domain/match-evidence-policies';
import type { MatchEvidenceRecord, MatchEvidenceView } from '../domain/match-evidence-types';
import type { Clock } from '../ports/clock';
import type { MatchDisputeRepository } from '../ports/match-dispute-repository';

const view = (item: MatchEvidenceRecord): MatchEvidenceView => ({
  id: item.id,
  type: item.type,
  status: item.status,
  ...(item.payload.description ? { description: item.payload.description } : {}),
  ...(item.capturedAt ? { capturedAt: item.capturedAt } : {}),
  submittedAt: item.submittedAt,
});
export class MatchEvidenceService {
  public constructor(
    private readonly repository: MatchDisputeRepository,
    private readonly clock: Clock,
    private readonly ttlSeconds: number,
  ) {}
  public async listMine(userId: string, matchId: string) {
    const context = await this.repository.loadForUser(userId, matchId);
    if (!context) throw new MatchEvidenceError('MATCH_EVIDENCE_NOT_FOUND');
    return context.evidence.filter((item) => item.submittedByUserId === userId).map(view);
  }
  public async submit(userId: string, matchId: string, input: unknown) {
    const context = await this.repository.loadForUser(userId, matchId);
    if (!context) throw new MatchEvidenceError('MATCH_EVIDENCE_NOT_FOUND');
    if (
      !['IN_PROGRESS', 'AWAITING_RESULT', 'RESULT_CONFLICT', 'COMPLETED'].includes(
        context.resultContext.match.status,
      )
    )
      throw new MatchEvidenceError('MATCH_EVIDENCE_SUBMISSION_NOT_ALLOWED');
    const anchor =
      context.resultContext.completedAt ??
      context.resultContext.resultConflictDeadlineAt ??
      context.resultContext.startedAt;
    const now = this.clock.now();
    if (anchor && now.getTime() > anchor.getTime() + this.ttlSeconds * 1000)
      throw new MatchEvidenceError('MATCH_EVIDENCE_SUBMISSION_NOT_ALLOWED');
    return view(
      await this.repository.createEvidence({
        userId,
        matchId,
        payload: validateEvidencePayload(input, now),
        now,
      }),
    );
  }
  public async withdraw(userId: string, matchId: string, evidenceId: string): Promise<void> {
    const context = await this.repository.loadForUser(userId, matchId);
    const evidence = context?.evidence.find(
      (item) => item.id === evidenceId && item.submittedByUserId === userId,
    );
    if (!evidence) throw new MatchEvidenceError('MATCH_EVIDENCE_NOT_FOUND');
    if (evidence.status === 'WITHDRAWN') return;
    if (evidence.status !== 'ACTIVE')
      throw new MatchEvidenceError('MATCH_EVIDENCE_WITHDRAW_NOT_ALLOWED');
    await this.repository.withdrawEvidence(userId, matchId, evidenceId, this.clock.now());
  }
}
