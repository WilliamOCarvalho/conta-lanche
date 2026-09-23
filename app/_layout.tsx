import { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { getDatabase } from '../src/db/database';
import { getSetting } from '../src/db/repository';
import { brazilianNationalHolidays } from '../src/services/businessDays';
import { colors } from '../src/theme';

void SplashScreen.preventAutoHideAsync().catch(() => undefined);

export default function RootLayout() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const fallback = setTimeout(() => {
      if (!mounted) return;
      setError('A inicialização demorou mais que o esperado. Feche e abra o aplicativo novamente.');
      setReady(true);
      void SplashScreen.hideAsync().catch(() => undefined);
    }, 10000);

    void (async () => {
      try {
        const db = await getDatabase();
        const year = new Date().getFullYear();
        const storedYear = Number(await getSetting('national_holidays_seeded_through', ''));
        const lastSeededYear = Number.isInteger(storedYear) && storedYear >= 1900 && storedYear <= year + 10 ? storedYear : year - 2;
        await db.withTransactionAsync(async () => {
          for (let y = lastSeededYear + 1; y <= year + 3; y += 1) {
            for (const holiday of brazilianNationalHolidays(y)) {
              await db.runAsync('INSERT OR IGNORE INTO non_working_days (id,date,description,type) VALUES (?,?,?,?)', `${holiday.date}-br`, holiday.date, holiday.description, 'holiday');
            }
          }
          if (lastSeededYear < year + 3) await db.runAsync("INSERT OR REPLACE INTO settings (key,value) VALUES ('national_holidays_seeded_through',?)", String(year + 3));
        });
        if (mounted) setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Não foi possível abrir o banco local.');
      } finally {
        clearTimeout(fallback);
        if (mounted) {
          setReady(true);
          await SplashScreen.hideAsync().catch(() => undefined);
        }
      }
    })();

    return () => {
      mounted = false;
      clearTimeout(fallback);
    };
  }, []);

  return <SafeAreaProvider><StatusBar style="dark" />
    {ready && !error ? <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
      <Stack.Screen name="(tabs)" /><Stack.Screen name="purchase/new" options={{ presentation: 'modal' }} /><Stack.Screen name="purchase/[id]" options={{ presentation: 'modal' }} />
    </Stack> : ready ? <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', padding: 28 }}><Text style={{ color: colors.ink, textAlign: 'center' }}>{error}</Text></View> : null}
  </SafeAreaProvider>;
}
