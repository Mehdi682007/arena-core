import { NotificationError } from '../domain/notification-errors';
import { defaultPreference, validatePreference } from '../domain/notification-policies';
import {
  notificationTypes,
  type NotificationPreferenceView,
  type NotificationType,
} from '../domain/notification-types';
import type { Clock } from '../ports/clock';
import type { IdGenerator } from '../ports/id-generator';
import type { NotificationRepository } from '../ports/notification-repository';

export class NotificationPreferenceService {
  public constructor(
    private readonly repository: NotificationRepository,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
  ) {}

  public async list(userId: string): Promise<readonly NotificationPreferenceView[]> {
    const records = await this.repository.listPreferencesForUser(userId);
    const overrides = new Map(records.map((record) => [record.type, record]));
    return notificationTypes.map((type) => {
      const record = overrides.get(type);
      const defaults = defaultPreference(type);
      return {
        type,
        inAppEnabled: record?.inAppEnabled ?? defaults.inAppEnabled,
        emailEnabled: record?.emailEnabled ?? defaults.emailEnabled,
        requiredChannels: defaults.requiredChannels,
      };
    });
  }

  public async update(
    userId: string,
    type: string,
    input: { inAppEnabled: boolean; emailEnabled: boolean; expectedVersion?: number },
  ): Promise<NotificationPreferenceView> {
    if (!notificationTypes.includes(type as NotificationType))
      throw new NotificationError('NOTIFICATION_PREFERENCE_INVALID');
    const knownType = type as NotificationType;
    validatePreference(knownType, input.inAppEnabled, input.emailEnabled);
    const record = await this.repository.updatePreference({
      id: this.ids.generate(),
      userId,
      type: knownType,
      inAppEnabled: input.inAppEnabled,
      emailEnabled: input.emailEnabled,
      ...(input.expectedVersion === undefined ? {} : { expectedVersion: input.expectedVersion }),
      now: this.clock.now(),
    });
    return {
      type: record.type,
      inAppEnabled: record.inAppEnabled,
      emailEnabled: record.emailEnabled,
      requiredChannels: defaultPreference(record.type).requiredChannels,
    };
  }
}
