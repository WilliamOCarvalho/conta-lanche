import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Purchase } from '../types';
import { PhotoViewer } from './PhotoViewer';
import { colors, radius } from '../theme';
import { formatBRL } from '../services/money';
import { formatDate } from '../services/dates';

export function PurchaseCard({ item, onPress, selected, onToggle }: { item: Purchase; onPress?: () => void; selected?: boolean; onToggle?: () => void }) {
  const detail = <View style={styles.detail}>
    <Text style={styles.name} numberOfLines={1}>{item.description || 'Lanche'}</Text>
    <Text style={styles.meta} numberOfLines={1}>{item.vendorName} · {formatDate(item.purchaseDate)}</Text>
    <View style={styles.bottom}><Text style={styles.value}>{formatBRL(item.amountCents)}</Text><View style={[styles.badge, item.paymentStatus === 'paid' ? styles.paid : styles.pending]}><Text style={[styles.badgeText, { color: item.paymentStatus === 'paid' ? colors.green : colors.amber }]}>{item.paymentStatus === 'paid' ? 'Pago' : 'Pendente'}</Text></View></View>
  </View>;

  return <View style={styles.card}><View style={styles.row}>
    {onToggle ? <Pressable onPress={onToggle} accessibilityRole="checkbox" accessibilityState={{ checked: Boolean(selected) }} style={styles.check}>
      <Ionicons name={selected ? 'checkbox' : 'square-outline'} size={23} color={selected ? colors.green : colors.muted} />
    </Pressable> : null}
    <PhotoViewer uri={item.photoPath} style={styles.photo} accessibilityLabel={`Ampliar foto de ${item.description || 'lanche'}`} />
    {onPress ? <Pressable onPress={onPress} style={({ pressed }) => [styles.detailPressable, pressed && { opacity: 0.75 }]}>{detail}</Pressable> : detail}
  </View></View>;
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, padding: 11 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  check: { paddingVertical: 8, paddingRight: 1 },
  photo: { width: 60, height: 60, borderRadius: 13, backgroundColor: colors.greenLight },
  detailPressable: { flex: 1 }, detail: { flex: 1, gap: 5 },
  name: { color: colors.ink, fontWeight: '800', fontSize: 14 }, meta: { color: colors.muted, fontSize: 12 },
  bottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 1 },
  value: { color: colors.ink, fontWeight: '800' }, badge: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 99 },
  paid: { backgroundColor: colors.greenLight }, pending: { backgroundColor: colors.amberLight }, badgeText: { fontSize: 10, fontWeight: '800' },
});
