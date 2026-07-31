import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Redirect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { getSetting } from '../src/db/queries';
import { colors } from '../src/theme';

export default function Index() {
  const db = useSQLiteContext();
  const [onboarded, setOnboarded] = useState(null);

  useEffect(() => {
    getSetting(db, 'onboarded').then((value) => setOnboarded(value === 'true'));
  }, [db]);

  if (onboarded === null) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  return <Redirect href={onboarded ? '/(tabs)/today' : '/onboarding'} />;
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
});
