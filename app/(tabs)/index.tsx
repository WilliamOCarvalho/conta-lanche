import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { listHolidays, listPurchases } from '../../src/db/repository';
import type { Purchase } from '../../src/types';
import { groupPurchasesByVendor, summarizePurchases } from '../../src/services/analytics';
import { monthRange } from '../../src/services/dates';
import { formatBRL } from '../../src/services/money';
import { nextPaymentDate } from '../../src/services/businessDays';
import { Card, EmptyState, PageHeader, Screen, SectionTitle } from '../../src/components/ui';
import { PurchaseCard } from '../../src/components/PurchaseCard';
import { colors } from '../../src/theme';

const monthNames = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const shiftMonth = (value: Date, delta: number) => new Date(value.getFullYear(), value.getMonth() + delta, 1, 12);

export default function Dashboard() {
  const router = useRouter(); const [month, setMonth] = useState(() => new Date()); const [items, setItems] = useState<Purchase[]>([]); const [allItems, setAllItems] = useState<Purchase[]>([]); const [nextDate, setNextDate] = useState('');
  const load = useCallback(() => { void (async () => {
    const range = monthRange(month), [filtered, all, holidays] = await Promise.all([listPurchases(range), listPurchases(), listHolidays()]);
    setItems(filtered); setAllItems(all);
    const holidaySet = new Set(holidays.map((h) => h.date)); const date = nextPaymentDate(new Date(), holidaySet);
    setNextDate(`${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}`);
  })(); }, [month]);
  useFocusEffect(load);
  const totals = summarizePurchases(items), sellers = groupPurchasesByVendor(items), recent = allItems.slice(0, 4);
  return <Screen>
    <PageHeader title="Conta Lanche" subtitle="Seus lanches, sem perder a conta." action={<Pressable onPress={() => router.push('/purchase/new')} accessibilityLabel="Adicionar compra" style={styles.addButton}><Ionicons name="add" color="#fff" size={25} /></Pressable>} />
    <Card style={styles.hero}>
      <View style={styles.monthRow}><Pressable onPress={() => setMonth(shiftMonth(month, -1))} accessibilityLabel="Mês anterior" style={styles.monthArrow}><Ionicons name="chevron-back" size={19} color={colors.green} /></Pressable><Text style={styles.monthText}>{monthNames[month.getMonth()]} {month.getFullYear()}</Text><Pressable onPress={() => setMonth(shiftMonth(month, 1))} accessibilityLabel="Próximo mês" style={styles.monthArrow}><Ionicons name="chevron-forward" size={19} color={colors.green} /></Pressable></View>
      <Text style={styles.heroLabel}>Total consumido</Text><Text style={styles.heroValue}>{formatBRL(totals.totalCents)}</Text>
      <View style={styles.heroBottom}><Text style={styles.heroSmall}>{totals.count} {totals.count === 1 ? 'compra' : 'compras'}</Text><View style={styles.heroDivider} /><Text style={styles.heroSmall}>Pagamento previsto dia {nextDate}</Text></View>
    </Card>
    <View style={styles.stats}><Card style={styles.stat}><View style={styles.statIcon}><Ionicons name="time-outline" color={colors.amber} size={17} /></View><Text style={styles.statLabel}>Pendente</Text><Text style={styles.statValue}>{formatBRL(totals.pendingCents)}</Text></Card><Card style={styles.stat}><View style={[styles.statIcon, { backgroundColor: colors.greenLight }]}><Ionicons name="checkmark" color={colors.green} size={17} /></View><Text style={styles.statLabel}>Já pago</Text><Text style={styles.statValue}>{formatBRL(totals.paidCents)}</Text></Card></View>
    <Card style={styles.addCard}><View style={{ flex: 1 }}><Text style={styles.addTitle}>Comprou um lanche?</Text><Text style={styles.addCaption}>Fotografe e registre rapidinho.</Text></View><Pressable onPress={() => router.push('/purchase/new')} style={styles.roundAdd}><Ionicons name="add" size={24} color="#fff" /></Pressable></Card>
    <View style={styles.section}><SectionTitle>Por vendedor</SectionTitle>{sellers.length ? sellers.slice(0, 4).map((seller) => <View key={seller.vendorId} style={styles.sellerLine}><View style={styles.sellerNameWrap}><Text style={styles.sellerName}>{seller.vendorName}</Text><Text style={styles.sellerCount}>{seller.count} compras</Text></View><Text style={styles.sellerValue}>{formatBRL(seller.totalCents)}</Text></View>) : <Text style={styles.muted}>Sem compras neste mês.</Text>}</View>
    <View style={styles.section}><SectionTitle trailing={<Pressable onPress={() => router.push('/history')}><Text style={styles.link}>Ver todas</Text></Pressable>}>Mais recentes</SectionTitle>{recent.length ? recent.map((item) => <PurchaseCard key={item.id} item={item} onPress={() => router.push({ pathname: '/purchase/[id]', params: { id: item.id } })} />) : <EmptyState title="Sua lista começa aqui" detail="Adicione a foto do seu primeiro lanche para acompanhar os gastos." icon={<Ionicons name="fast-food-outline" size={30} color={colors.green} />} />}</View>
  </Screen>;
}

const styles = StyleSheet.create({ addButton: { width: 46, height: 46, alignItems: 'center', justifyContent: 'center', borderRadius: 16, backgroundColor: colors.green }, hero: { backgroundColor: colors.green, borderColor: colors.green, padding: 20, gap: 7 }, monthRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }, monthArrow: { width: 34, height: 34, backgroundColor: '#FFFFFF', borderRadius: 12, justifyContent: 'center', alignItems: 'center' }, monthText: { color: '#FFFFFF', fontSize: 14, textTransform: 'capitalize', fontWeight: '700' }, heroLabel: { color: '#D5E9DC', fontSize: 13 }, heroValue: { fontSize: 35, color: '#FFFFFF', fontWeight: '800', letterSpacing: -1 }, heroBottom: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 7 }, heroSmall: { color: '#E0EFE4', fontSize: 12, fontWeight: '600' }, heroDivider: { width: 1, height: 14, backgroundColor: '#78A88D' }, stats: { flexDirection: 'row', gap: 12 }, stat: { flex: 1, padding: 14, gap: 6 }, statIcon: { width: 30, height: 30, backgroundColor: colors.amberLight, borderRadius: 10, alignItems: 'center', justifyContent: 'center' }, statLabel: { color: colors.muted, fontSize: 12, fontWeight: '600' }, statValue: { color: colors.ink, fontSize: 16, fontWeight: '800' }, addCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.lime, borderColor: colors.lime }, addTitle: { color: colors.ink, fontSize: 16, fontWeight: '800' }, addCaption: { color: '#53654E', fontSize: 12, marginTop: 4 }, roundAdd: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 15, backgroundColor: colors.green }, section: { gap: 12 }, sellerLine: { paddingVertical: 5, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, sellerNameWrap: { gap: 3 }, sellerName: { color: colors.ink, fontWeight: '700', fontSize: 14 }, sellerCount: { color: colors.muted, fontSize: 11 }, sellerValue: { color: colors.ink, fontWeight: '800' }, muted: { color: colors.muted, paddingVertical: 10 }, link: { color: colors.green, fontWeight: '700', fontSize: 13 } });
