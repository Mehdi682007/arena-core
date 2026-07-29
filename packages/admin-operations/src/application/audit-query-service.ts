import { AdminOperationError } from '../domain/admin-operation-errors';
import { auditActions, type AuditQuery } from '../domain/audit-types';
import { validateAuditMetadata } from '../domain/audit-policy';
import type {
  AdminOperationRepository,
  AppendAuditInput,
} from '../ports/admin-operation-repository';
export class AuditQueryService {
  public constructor(private readonly repository: AdminOperationRepository) {}
  public append(input: AppendAuditInput) {
    if (!auditActions.includes(input.action)) throw new AdminOperationError('ADMIN_AUDIT_INVALID');
    return this.repository.append({ ...input, metadata: validateAuditMetadata(input.metadata) });
  }
  public list(query: AuditQuery) {
    return this.repository.queryAudit({ ...query, limit: Math.min(Math.max(query.limit, 1), 100) });
  }
  public async detail(id: string) {
    const item = await this.repository.findAudit(id);
    if (!item) throw new AdminOperationError('ADMIN_AUDIT_NOT_FOUND');
    return item;
  }
}
