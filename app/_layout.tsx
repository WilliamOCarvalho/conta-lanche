import { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { getDatabase } from '../src/db/database';
import { brazilianNationalHolidays } from '../src/services/businessDays';
import { colors } from '../src/theme';

export default function RootLayout() {
  const [ready, setReady] = useState(false), [error, setError] = useState<string | null>(null);
  useEffect(() => {
    void (async () => {
      try {
        const db = await getDatabase(), year = new Date().getFullYear();
        const seeded = await db.getFirstAsync<{ value: string }>("SELECT value FROM settings WHERE key='national_holidays_seeded_through'");
        const lastSeededYear = Number(seeded?.value ?? year - 2);
        await db.withTransactionAsync(async () => {
          for (let y = lastSeededYear + 1; y <= year + 3; y += 1) {
            for (const holiday of brazilianNationalHolidays(y)) {
              await db.runAsync('INSERT OR IGNORE INTO non_working_days (id,date,description,type) VALUES (?,?,?,?)', `${holiday.date}-br`, holiday.date, holiday.description, 'holiday');
            }
          }
          if (lastSeededYear < year + 3) await db.runAsync("INSERT OR REPLACE INTO settings (key,value) VALUES ('national_holidays_seeded_through',?)", String(year + 3));
        });
        setReady(true);
      } catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível abrir o banco local.'); }
    })();
  }, []);
  return <SafeAreaProvider><StatusBar style="dark" />
    {ready ? <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
      <Stack.Screen name="(tabs)" /><Stack.Screen name="purchase/new" options={{ presentation: 'modal' }} /><Stack.Screen name="purchase/[id]" options={{ presentation: 'modal' }} />
    </Stack> : <View style={{ flex:  1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', padding: 28 }}>
      {error ? <Text style={{ color: colors.ink, textAlign: 'center' }}>{error}</Text> : <ActivityIndicator color={colors.green} />}
    </View>}
  </SafeAreaProvider>;
}
