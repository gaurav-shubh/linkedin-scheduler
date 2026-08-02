import { useEffect, useRef } from 'react';
import { Stack, useRouter } from 'expo-router';
import { SQLiteProvider } from 'expo-sqlite';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';
import * as SplashScreen from 'expo-splash-screen';
import {
  Fraunces_400Regular_Italic,
  Fraunces_600SemiBold,
  useFonts,
} from '@expo-google-fonts/fraunces';
import { initializeDatabase } from '../src/db/schema';
import { NOTIF } from '../src/lib/notifications';

SplashScreen.preventAutoHideAsync().catch(() => {});

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
  const [fontsLoaded, fontError] = useFonts({
    Fraunces_600SemiBold,
    Fraunces_400Regular_Italic,
  });

  useEffect(() => {
    // Hide the splash once fonts settle either way — a font failure should
    // degrade to system type, never hold the app hostage.
    if (fontsLoaded || fontError) SplashScreen.hideAsync().catch(() => {});
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

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
