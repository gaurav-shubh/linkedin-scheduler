import { useEffect, useRef } from 'react';
import { View } from 'react-native';
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
import { colors } from '../src/theme';
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
    Figtree_500Medium,
    Figtree_700Bold,
    Figtree_800ExtraBold,
  });
  const ready = fontsLoaded || fontError;

  useEffect(() => {
    // Hide the native splash once fonts settle either way — a font failure should
    // degrade to system type, never hold the app hostage.
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  // Never render nothing at the root: an empty first frame can freeze the Android
  // surface at the wrong size. While fonts settle, hold a full-bleed navy frame —
  // visually identical to the native splash it sits behind.
  if (!ready) {
    return <View style={{ flex: 1, backgroundColor: colors.ink }} />;
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.ink }}>
      <SafeAreaProvider>
        <SQLiteProvider databaseName="domino.db" onInit={initializeDatabase}>
          <NotificationRouter />
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: colors.background },
            }}
          >
            <Stack.Screen name="index" />
            <Stack.Screen name="onboarding" />
            <Stack.Screen name="(tabs)" />
          </Stack>
        </SQLiteProvider>
      </SafeAreaProvider>
    </View>
  );
}
