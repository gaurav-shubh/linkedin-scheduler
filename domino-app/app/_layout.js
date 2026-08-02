import { useEffect, useRef } from 'react';
import { Stack, useRouter } from 'expo-router';
import { SQLiteProvider } from 'expo-sqlite';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';
import { initializeDatabase } from '../src/db/schema';

function NotificationRouter() {
  const router = useRouter();
  const subRef = useRef(null);

  useEffect(() => {
    subRef.current = Notifications.addNotificationResponseReceivedListener((response) => {
      const type = response.notification.request.content.data?.type;
      if (type === 'daily-prompt') {
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
