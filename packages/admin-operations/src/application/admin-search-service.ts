import { AdminOperationError } from '../domain/admin-operation-errors';
import type { AdminSearchScope } from '../domain/audit-types';
import type { AdminOperationRepository } from '../ports/admin-operation-repository';
export class AdminSearchService {
  public constructor(private readonly repository: AdminOperationRepository) {}
  public search(scope: AdminSearchScope, term: string, limit = 25) {
    const clean = term.trim();
    if (clean.length < 2 || clean.length > 128)
      throw new AdminOperationError('ADMIN_SEARCH_INVALID');
    return this.repository.search(scope, clean, Math.min(Math.max(limit, 1), 50));
  }
}
