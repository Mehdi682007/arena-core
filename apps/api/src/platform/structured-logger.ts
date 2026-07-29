import type { LoggerService, LogLevel } from '@nestjs/common';
import type { RuntimeEnvironment } from '@arena-core/config';
import { redactSensitive } from './redaction';
import { requestContext } from './request-context';

export class StructuredLogger implements LoggerService {
  public constructor(
    private readonly service: string,
    private readonly environment: RuntimeEnvironment,
    private readonly sink: (line: string) => void = (line) => process.stdout.write(`${line}\n`),
  ) {}

  public log(message: unknown, context?: string): void {
    this.write('info', message, context);
  }
  public fatal(message: unknown, context?: string): void {
    this.write('fatal', message, context);
  }
  public error(message: unknown, trace?: string, context?: string): void {
    this.write('error', message, context, trace ? { trace: '[REDACTED]' } : undefined);
  }
  public warn(message: unknown, context?: string): void {
    this.write('warn', message, context);
  }
  public debug(message: unknown, context?: string): void {
    this.write('debug', message, context);
  }
  public verbose(message: unknown, context?: string): void {
    this.write('trace', message, context);
  }
  public setLogLevels(levels: LogLevel[]): void {
    void levels;
  }

  public write(level: string, message: unknown, component?: string, fields?: object): void {
    const request = requestContext.get();
    const record = redactSensitive({
      timestamp: new Date().toISOString(),
      level,
      message: typeof message === 'string' ? message : 'event',
      service: this.service,
      environment: this.environment,
      component,
      ...request,
      ...fields,
    });
    this.sink(JSON.stringify(record));
  }
}
