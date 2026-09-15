import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../../src/theme';

const icons: Record<string, keyof typeof Ionicons.glyphMap> = { index: 'home-outline', history: 'receipt-outline', reports: 'bar-chart-outline', sellers: 'people-outline', settings: 'settings-outline' };
const labels: Record<string, string> = { index: 'Início', history: 'Histórico', reports: 'Relatórios', sellers: 'Vendedores', settings: 'Ajustes' };

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const bottomInset = Math.max(8, insets.bottom);
  return <Tabs screenOptions={({ route }) => ({
    headerShown: false, tabBarHideOnKeyboard: true, tabBarActiveTintColor: colors.green, tabBarInactiveTintColor: colors.muted,
    tabBarLabel: labels[route.name], tabBarStyle: { height: 60 + bottomInset, paddingTop: 8, paddingBottom: bottomInset, backgroundColor: '#FFFFFF', borderTopColor: colors.line },
    tabBarLabelStyle: { fontSize: 10, fontWeight: '700' },
    tabBarIcon: ({ color, size }) => <Ionicons name={icons[route.name] ?? 'ellipse-outline'} size={size} color={color} />,
  })}>
    <Tabs.Screen name="index" /><Tabs.Screen name="history" /><Tabs.Screen name="reports" /><Tabs.Screen name="sellers" /><Tabs.Screen name="settings" />
  </Tabs>;
}
