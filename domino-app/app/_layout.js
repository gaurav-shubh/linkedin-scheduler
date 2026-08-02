import { useEffect, useRef } from 'react';
import { Stack, useRouter } from 'expo-router';
import { SQLiteProvider } from 'expo-sqlite';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';
import { initializeDatabase } from '../src/db/schema';
import { NOTIF } from '../src/lib/notifications';

function NotificationRouter() {
  const router = useRouter();
  const subRef = useRef(null);

  useEffect(() => {
    subRef.current = Notifications.addNotificationResponseReceivedListener((response) => {
      const type = response.notification.request.content.data?.type;
      if (type === NOTIF.WEEKLY || type === NOTIF.MONTHLY) {
        router.push('/(tabs)/periods');
      } else if (type === NOTIF.MORNING || type === NOTIF.EVENING) {
        router.push('/(tabs)/today');
      }
    });
    return () => subRef.current?.remove();
  }, [router]);

  return null;
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <SQLiteProvider databaseName="domino.db" onInit={initializeDatabase}>
        <NotificationRouter />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="onboarding" />
          <Stack.Screen name="(tabs)" />
        </Stack>
      </SQLiteProvider>
    </SafeAreaProvider>
  );
}
