import { useEffect, useRef, useState } from 'react';
import { Stack, useRouter } from 'expo-router';
import { SQLiteProvider } from 'expo-sqlite';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';
import * as SplashScreen from 'expo-splash-screen';
import {
  Figtree_500Medium,
  Figtree_700Bold,
  Figtree_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/figtree';
import { initializeDatabase } from '../src/db/schema';
import { NOTIF } from '../src/lib/notifications';
import AnimatedIntro, { INTRO_TOTAL_MS } from '../src/components/AnimatedIntro';

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
  const [introDone, setIntroDone] = useState(false);
  const [fontsLoaded, fontError] = useFonts({
    Figtree_500Medium,
    Figtree_700Bold,
    Figtree_800ExtraBold,
  });
  const ready = fontsLoaded || fontError;

  useEffect(() => {
    // Hide the splash once fonts settle either way — a font failure should
    // degrade to system type, never hold the app hostage.
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  useEffect(() => {
    if (!ready) return undefined;
    const t = setTimeout(() => setIntroDone(true), INTRO_TOTAL_MS);
    return () => clearTimeout(t);
  }, [ready]);

  if (!ready) return null;

  return (
    <SafeAreaProvider>
      <SQLiteProvider databaseName="domino.db" onInit={initializeDatabase}>
        <NotificationRouter />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="onboarding" />
          <Stack.Screen name="(tabs)" />
        </Stack>
        {!introDone && <AnimatedIntro />}
      </SQLiteProvider>
    </SafeAreaProvider>
  );
}
