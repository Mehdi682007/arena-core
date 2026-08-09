import { Inject, Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class DatabaseAuthorizationService {
  public constructor(@Inject(DatabaseService) private readonly database: DatabaseService) {}

  public async hasPermission(userId: string, permission: string): Promise<boolean> {
    const client = this.database.getClient();
    if (!client) return false;

    return (
      (await client.userRole.findFirst({
        where: {
          userId,
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
          role: { permissions: { some: { permission: { key: permission } } } },
        },
        select: { userId: true },
      })) !== null
    );
  }
}
