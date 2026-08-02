import { createHash } from 'node:crypto';
import { z } from 'zod';

export const evidenceReviewResultSchema = z.object({
  detectedGame: z.string().max(80).nullable(),
  detectedMode: z.string().max(80).nullable(),
  playerIdentifiers: z.array(z.string().max(120)).max(8),
  displayedScore: z.string().max(40).nullable(),
  suggestedWinner: z.string().max(120).nullable(),
  confidence: z.number().min(0).max(1),
  qualityFlags: z.array(z.string().max(80)).max(12),
  manipulationIndicators: z.array(z.string().max(160)).max(12),
  contradictions: z.array(z.string().max(240)).max(12),
  humanReviewNotes: z.string().max(1000),
});
export type EvidenceReviewResult = z.infer<typeof evidenceReviewResultSchema>;
export type EvidenceReviewInput = Readonly<{
  opaqueEvidenceId: string;
  mimeType: 'image/png' | 'image/jpeg' | 'image/webp';
  bytes: Uint8Array;
  submittedClaim?: string;
}>;
export interface EvidenceReviewProvider {
  readonly name: string;
  readonly model: string;
  analyze(input: EvidenceReviewInput, signal: AbortSignal): Promise<unknown>;
}
export class DisabledEvidenceReviewProvider implements EvidenceReviewProvider {
  readonly name = 'disabled';
  readonly model = 'none';
  analyze(): Promise<never> {
    return Promise.reject(new Error('EVIDENCE_REVIEW_DISABLED'));
  }
}
export const evidenceHash = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
export class EvidenceReviewService {
  readonly #completed = new Map<string, EvidenceReviewResult>();
  constructor(
    private readonly provider: EvidenceReviewProvider,
    private readonly maximumBytes = 8_388_608,
  ) {}
  async review(input: EvidenceReviewInput, timeoutMs = 15_000): Promise<EvidenceReviewResult> {
    if (input.bytes.byteLength === 0) throw new Error('EVIDENCE_MISSING');
    if (input.bytes.byteLength > this.maximumBytes) throw new Error('EVIDENCE_TOO_LARGE');
    const key = evidenceHash(input.bytes);
    const cached = this.#completed.get(key);
    if (cached) return cached;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      controller.abort();
    }, timeoutMs);
    try {
      const raw = await this.provider.analyze(
        {
          ...input,
          ...(input.submittedClaim === undefined
            ? {}
            : { submittedClaim: input.submittedClaim.slice(0, 500) }),
        },
        controller.signal,
      );
      const result = evidenceReviewResultSchema.parse(raw);
      this.#completed.set(key, result);
      return result;
    } catch (error) {
      if (controller.signal.aborted) throw new Error('EVIDENCE_REVIEW_TIMEOUT');
      if (error instanceof z.ZodError) throw new Error('EVIDENCE_REVIEW_MALFORMED');
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }
}
