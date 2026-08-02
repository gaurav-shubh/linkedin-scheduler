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
  TIME_BLOCK: 'time-block',
};

/** The recurring prompts, i.e. everything syncNotifications owns. */
const RECURRING = [NOTIF.MORNING, NOTIF.EVENING, NOTIF.WEEKLY, NOTIF.MONTHLY];

const CHANNEL = 'daily-domino';
const MONDAY = 2; // expo weekdays: 1 = Sunday

/**
 * Scheduling only exists on the native platforms — expo-notifications throws on web
 * for the scheduling APIs. Beyond web, scheduling can also fail at runtime (revoked
 * permissions, OS limits). Reminders are an assist, never the source of truth, so a
 * failure here must not break the screen or discard what the user just chose.
 */
export const SCHEDULING_SUPPORTED = Platform.OS === 'ios' || Platform.OS === 'android';

async function guarded(operation, fallback) {
  if (!SCHEDULING_SUPPORTED) return fallback;
  try {
    return await operation();
  } catch (e) {
    console.warn('[notifications] scheduling failed:', e?.message ?? e);
    return fallback;
  }
}

export async function ensurePermission() {
  return guarded(async () => {
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) return true;
    if (!current.canAskAgain) return false;
    const requested = await Notifications.requestPermissionsAsync({
      ios: { allowAlert: true, allowBadge: true, allowSound: true },
    });
    return !!requested.granted;
  }, false);
}

async function ensureChannel() {
  if (Platform.OS !== 'android') return undefined;
  await Notifications.setNotificationChannelAsync(CHANNEL, {
    name: 'Daily Domino',
    importance: Notifications.AndroidImportance.HIGH,
  });
  return CHANNEL;
}

/** Cancel scheduled notifications this app owns; defaults to all of them. */
export async function cancelAllPrompts(types = Object.values(NOTIF)) {
  return guarded(async () => {
    const owned = new Set(types);
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    await Promise.all(
      scheduled
        .filter((n) => owned.has(n.content?.data?.type))
        .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier))
    );
  }, undefined);
}

/**
 * One-off reminder at the time the user blocked out for today's ONE Thing.
 * Returns false when the slot has already passed — a DATE trigger in the past
 * would either fire immediately or be dropped, so we skip it and say so.
 */
export async function scheduleTimeBlock({ hour, minute, oneThing }) {
  await cancelAllPrompts([NOTIF.TIME_BLOCK]);
  if (hour === null || hour === undefined) return false;

  const when = new Date();
  when.setHours(hour, minute ?? 0, 0, 0);
  if (when.getTime() <= Date.now()) return false;

  return guarded(async () => {
    const channelId = await ensureChannel();
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Time for your ONE Thing',
        body: oneThing || 'This is the block you set aside. Protect it.',
        data: { type: NOTIF.TIME_BLOCK },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: when,
        channelId,
      },
    });
    return true;
  }, false);
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
  // Only the recurring prompts — a settings change must not wipe today's time block.
  await cancelAllPrompts(RECURRING);
  if (!enabled) return;

  return guarded(async () => {
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
  }, undefined);
}
