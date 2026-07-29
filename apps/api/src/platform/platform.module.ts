import { Global, Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { PlatformErrorFilter } from './platform-error.filter';
import { RuntimeState } from './runtime-state';

@Global()
@Module({
  providers: [RuntimeState, { provide: APP_FILTER, useClass: PlatformErrorFilter }],
  exports: [RuntimeState],
})
export class PlatformModule {}
