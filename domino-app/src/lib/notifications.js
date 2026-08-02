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

export const DAILY_NOTIFICATION_ID_KEY = 'daily_notification_id';

export async function ensurePermission() {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  const requested = await Notifications.requestPermissionsAsync({
    ios: { allowAlert: true, allowBadge: true, allowSound: true },
  });
  return !!requested.granted;
}

export async function scheduleDailyPrompt(hour, minute) {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('daily-domino', {
      name: 'Daily Domino',
      importance: Notifications.AndroidImportance.HIGH,
    });
  }
  await cancelDailyPrompt();
  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: 'What\'s your ONE Thing today?',
      body: FOCUSING_QUESTION,
      data: { type: 'daily-prompt' },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute,
      channelId: Platform.OS === 'android' ? 'daily-domino' : undefined,
    },
  });
  return id;
}

export async function cancelDailyPrompt() {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  const mine = scheduled.filter((n) => n.content?.data?.type === 'daily-prompt');
  await Promise.all(mine.map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)));
}
