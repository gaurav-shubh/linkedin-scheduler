import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { FOCUSING_QUESTION } from './content';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export const NOTIF = {
  MORNING: 'daily-prompt',
  EVENING: 'evening-checkin',
  WEEKLY: 'weekly-kickoff',
  MONTHLY: 'monthly-kickoff',
};

const CHANNEL = 'daily-domino';
const MONDAY = 2; // expo weekdays: 1 = Sunday

export async function ensurePermission() {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  const requested = await Notifications.requestPermissionsAsync({
    ios: { allowAlert: true, allowBadge: true, allowSound: true },
  });
  return !!requested.granted;
}

async function ensureChannel() {
  if (Platform.OS !== 'android') return undefined;
  await Notifications.setNotificationChannelAsync(CHANNEL, {
    name: 'Daily Domino',
    importance: Notifications.AndroidImportance.HIGH,
  });
  return CHANNEL;
}

/** Cancel every notification this app owns (identified by its data.type). */
export async function cancelAllPrompts() {
  const owned = new Set(Object.values(NOTIF));
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      .filter((n) => owned.has(n.content?.data?.type))
      .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier))
  );
}

/**
 * Cancels everything and reschedules from the given settings. Idempotent — safe to
 * call on every settings change without accumulating duplicate notifications.
 */
export async function syncNotifications({
  enabled,
  morningHour,
  morningMinute,
  eveningEnabled,
  eveningHour,
  eveningMinute,
  kickoffEnabled,
}) {
  await cancelAllPrompts();
  if (!enabled) return;

  const channelId = await ensureChannel();

  await Notifications.scheduleNotificationAsync({
    content: {
      title: "What's your ONE Thing today?",
      body: FOCUSING_QUESTION,
      data: { type: NOTIF.MORNING },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: morningHour,
      minute: morningMinute,
      channelId,
    },
  });

  if (eveningEnabled) {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Did you do your ONE Thing?',
        body: 'Take five seconds to close the loop on today.',
        data: { type: NOTIF.EVENING },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: eveningHour,
        minute: eveningMinute,
        channelId,
      },
    });
  }

  if (kickoffEnabled) {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'New week — set your ONE Thing',
        body: "What's the ONE thing this week that makes the rest of the month easier?",
        data: { type: NOTIF.WEEKLY },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
        weekday: MONDAY,
        hour: morningHour,
        minute: morningMinute,
        channelId,
      },
    });

    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'New month — set your ONE Thing',
        body: "What's the ONE thing this month that moves your one-year goal?",
        data: { type: NOTIF.MONTHLY },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.MONTHLY,
        day: 1,
        hour: morningHour,
        minute: morningMinute,
        channelId,
      },
    });
  }
}
