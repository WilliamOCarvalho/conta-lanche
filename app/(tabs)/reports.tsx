import { useCallback, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { listPurchases } from '../../src/db/repository';
import type { Purchase } from '../../src/types';
import { filterPurchases, groupPurchasesByVendor, summarizePurchases } from '../../src/services/analytics';
import { formatBRL } from '../../src/services/money';
import { formatDate, parseBRDate } from '../../src/services/dates';
import { Button, Card, Field, PageHeader, Screen, SectionTitle } from '../../src/components/ui';
import { exportCSV, exportPDF } from '../../src/services/exports';
import { colors } from '../../src/theme';

type ReportType = 'monthly' | 'vendor' | 'pending' | 'paid' | 'period' | 'months';
const reportTypes: Array<{ id: ReportType; title: string }> = [
  { id: 'monthly', title: 'Resumo mensal' }, { id: 'vendor', title: 'Por vendedor' }, { id: 'pending', title: 'Pendentes' },
  { id: 'paid', title: 'Pagas' }, { id: 'period', title: 'Por período' }, { id: 'months', title: 'Totais por mês' },
];
const monthStart = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`; };
const monthEnd = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()).padStart(2, '0')}`; };

export default function ReportsScreen() {
  const [type, setType] = useState<ReportType>('monthly'), [allItems, setAllItems] = useState<Purchase[]>([]), [from, setFrom] = useState(formatDate(monthStart())), [to, setTo] = useState(formatDate(monthEnd()));
  useFocusEffect(useCallback(() => { void listPurchases().then(setAllItems).catch(() => Alert.alert('Erro', 'Não foi possível carregar os relatórios.')); }, []));
  const parsedFrom = type === 'period' ? parseBRDate(from) : monthStart(), parsedTo = type === 'period' ? parseBRDate(to) : monthEnd();
  const items = type === 'months' ? allItems : type === 'period' && (!parsedFrom || !parsedTo) ? [] : filterPurchases(allItems, { from: parsedFrom ?? undefined, to: parsedTo ?? undefined, status: type === 'pending' ? 'pending' : type === 'paid' ? 'paid' : undefined });
  const total = summarizePurchases(items), groups = groupPurchasesByVendor(items);
  const exportItems = type === 'months' ? allItems : items;
  const periodLabel = type === 'period' ? `${from} a ${to}` : type === 'months' ? 'todo o histórico' : `${formatDate(monthStart())} a ${formatDate(monthEnd())}`;
  const doExport = async (format: 'csv' | 'pdf') => { try { if (format === 'csv') await exportCSV(exportItems); else await exportPDF(exportItems, `${reportTypes.find((r) => r.id === type)?.title ?? 'Relatório'} · ${periodLabel}`); } catch (e) { Alert.alert('Falha ao exportar', e instanceof Error ? e.message : 'Tente novamente.'); } };
  const monthly = new Map<string, Purchase[]>();
  for (const item of allItems) { const key = item.purchaseDate.slice(0, 7), bucket = monthly.get(key) ?? []; bucket.push(item); monthly.set(key, bucket); }
  const monthsSorted = [...monthly.entries()].sort(([a], [b]) => b.localeCompare(a)).slice(0, 12);
  return <Screen>
    <PageHeader title="Relatórios" subtitle="Entenda seus gastos e pagamentos." />
    <View style={styles.typeGrid}>{reportTypes.map((report) => <Pressable key={report.id} onPress={() => setType(report.id)} style={[styles.typePill, type === report.id && styles.typeActive]}><Text style={[styles.typeText, type === report.id && styles.typeTextActive]}>{report.title}</Text></Pressable>)}</View>
    {type === 'period' ? <Card style={{ gap: 12 }}><Field label="De (DD/MM/AAAA)" value={from} onChangeText={setFrom} placeholder="01/01/2026" keyboardType="numbers-and-punctuation" /><Field label="Até (DD/MM/AAAA)" value={to} onChangeText={setTo} placeholder="31/01/2026" keyboardType="numbers-and-punctuation" /></Card> : null}
    <Card style={styles.summary}><Text style={styles.kicker}>{periodLabel}</Text><Text style={styles.total}>{formatBRL(total.totalCents)}</Text><Text style={styles.muted}>{total.count} compras · {formatBRL(total.paidCents)} pagas · {formatBRL(total.pendingCents)} pendentes</Text></Card>
    {type === 'months' ? <View style={{ gap: 12 }}><SectionTitle>Totais por mês</SectionTitle>{monthsSorted.length ? monthsSorted.map(([month, monthItems]) => { const monthTotal = summarizePurchases(monthItems), [year, monthNumber] = month.split('-'); const label = new Date(Number(year), Number(monthNumber) - 1, 1, 12).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }); return <Card key={month} style={styles.monthCard}><View style={{ flex: 1 }}><Text style={styles.lineTitle}>{label}</Text><Text style={styles.muted}>{monthTotal.count} compras · {formatBRL(monthTotal.paidCents)} pagas · {formatBRL(monthTotal.pendingCents)} pendentes</Text></View><Text style={styles.lineValue}>{formatBRL(monthTotal.totalCents)}</Text></Card>; }) : <Card><Text style={styles.muted}>Ainda não há compras registradas.</Text></Card>}</View> : <View style={{ gap: 12 }}><SectionTitle>{type === 'vendor' ? 'Compras por vendedor' : 'Totais por vendedor'}</SectionTitle>{groups.length ? groups.map((group) => <Card key={group.vendorId} style={styles.line}><View><Text style={styles.lineTitle}>{group.vendorName}</Text><Text style={styles.muted}>{group.count} compras · {formatBRL(group.paidCents)} pagas · {formatBRL(group.pendingCents)} pendentes</Text></View><Text style={styles.lineValue}>{formatBRL(group.totalCents)}</Text></Card>) : <Card><Text style={styles.muted}>Nenhuma compra neste relatório.</Text></Card>}</View>}
    <View style={styles.exportRow}><Button title="Exportar CSV" variant="secondary" onPress={() => void doExport('csv')} icon={<Ionicons name="document-text-outline" size={18} color={colors.green} />} /><Button title="Exportar PDF" onPress={() => void doExport('pdf')} icon={<Ionicons name="share-outline" size={18} color="#fff" />} /></View>
  </Screen>;
}

const styles = StyleSheet.create({ typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, typePill: { backgroundColor: '#EEF0ED', paddingHorizontal: 12, paddingVertical: 9, borderRadius: 99 }, typeActive: { backgroundColor: colors.green }, typeText: { color: colors.muted, fontSize: 11, fontWeight: '700' }, typeTextActive: { color: '#fff' }, summary: { backgroundColor: colors.greenLight, borderColor: colors.greenLight, gap: 8 }, kicker: { fontSize: 10, fontWeight: '800', letterSpacing: 1.2, color: colors.green }, total: { fontSize: 31, color: colors.ink, fontWeight: '800' }, muted: { color: colors.muted, fontSize: 12, lineHeight: 18 }, line: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, monthCard: { flexDirection: 'row', alignItems: 'center', gap: 12 }, lineTitle: { color: colors.ink, fontWeight: '800', fontSize: 14, textTransform: 'capitalize' }, lineValue: { color: colors.ink, fontWeight: '800', fontSize: 14 }, exportRow: { flexDirection: 'row', gap: 9, paddingBottom: 10 } });
