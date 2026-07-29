import { ArgumentsHost, Catch, HttpStatus, type ExceptionFilter } from '@nestjs/common';
import { NotificationError } from '@arena-core/notifications';
const statuses: Record<string, number> = {
  NOTIFICATION_NOT_FOUND: 404,
  NOTIFICATION_OUTBOX_NOT_FOUND: 404,
  NOTIFICATION_OWNERSHIP_INVALID: 403,
  NOTIFICATION_DEDUPLICATION_CONFLICT: 409,
  NOTIFICATION_OUTBOX_STATE_INVALID: 409,
  NOTIFICATION_DELIVERY_RETRY_EXHAUSTED: 409,
  NOTIFICATION_PAYLOAD_INVALID: 422,
  NOTIFICATION_TEMPLATE_NOT_FOUND: 422,
  NOTIFICATION_PREFERENCE_INVALID: 422,
  NOTIFICATION_REQUIRED_CHANNEL: 422,
  NOTIFICATION_SERVICE_UNAVAILABLE: 503,
  NOTIFICATION_DELIVERY_UNAVAILABLE: 503,
  NOTIFICATION_PERSISTENCE_FAILURE: 503,
};
@Catch(NotificationError)
export class NotificationsHttpFilter implements ExceptionFilter {
  public catch(error: NotificationError, host: ArgumentsHost): void {
    const unavailable =
      error.code.includes('UNAVAILABLE') || error.code === 'NOTIFICATION_PERSISTENCE_FAILURE';
    host
      .switchToHttp()
      .getResponse<{ status(code: number): { json(body: unknown): void } }>()
      .status(statuses[error.code] ?? HttpStatus.INTERNAL_SERVER_ERROR)
      .json({
        error: {
          code: unavailable ? 'NOTIFICATION_SERVICE_UNAVAILABLE' : error.code,
          message: 'Notification operation could not be completed.',
        },
      });
  }
}
