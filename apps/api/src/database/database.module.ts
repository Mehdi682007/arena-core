import { Global, Module } from '@nestjs/common';
import { createPrismaClient } from '@arena-core/database';
import { DATABASE_CLIENT_FACTORY, DatabaseService } from './database.service';

@Global()
@Module({
  providers: [{ provide: DATABASE_CLIENT_FACTORY, useValue: createPrismaClient }, DatabaseService],
  exports: [DatabaseService],
})
export class DatabaseModule {}
