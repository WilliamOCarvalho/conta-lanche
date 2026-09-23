import { useCallback, useMemo, useState } from 'react';
import { Alert, KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { deletePurchase, getSetting, listPayments, listPurchases, listVendors, saveSetting, setPurchasesPaid } from '../../src/db/repository';
import type { Purchase, Vendor } from '../../src/types';
import { formatBRL, formatCurrencyInput, parseBRLToCents } from '../../src/services/money';
import { formatDate, monthRange, parseBRDate, todayISO } from '../../src/services/dates';
import { consolidatePixPurchases, generatePixPayload, maskPixKey, normalizePixText, validatePixGeneration, validatePixKey } from '../../src/services/pix';
import { Button, Card, EmptyState, Field, PageHeader, Screen, SectionTitle } from '../../src/components/ui';
import { PurchaseCard } from '../../src/components/PurchaseCard';
import { colors } from '../../src/theme';
import { removePhoto } from '../../src/services/photos';

const months = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const shift = (date: Date, step: number) => new Date(date.getFullYear(), date.getMonth() + step, 1, 12);

export default function HistoryScreen() {
  const router = useRouter();
  const [month, setMonth] = useState(() => new Date()), [vendors, setVendors] = useState<Vendor[]>([]), [vendorId, setVendorId] = useState('');
  const [status, setStatus] = useState<'all' | 'pending' | 'paid'>('all'), [items, setItems] = useState<Purchase[]>([]), [payments, setPayments] = useState<{ id: string; vendorName: string; paymentDate: string; totalCents: number; purchaseCount: number }[]>([]);
  const [selected, setSelected] = useState<string[]>([]), [payModal, setPayModal] = useState(false), [payDate, setPayDate] = useState(todayISO());
  const [showFilters, setShowFilters] = useState(false), [customPeriod, setCustomPeriod] = useState(false), [from, setFrom] = useState(formatDate(monthRange().from)), [to, setTo] = useState(formatDate(monthRange().to)), [minimum, setMinimum] = useState(''), [maximum, setMaximum] = useState('');
  const [pixCity, setPixCity] = useState(''), [pixCityDraft, setPixCityDraft] = useState(''), [cityModal, setCityModal] = useState(false), [confirmPixModal, setConfirmPixModal] = useState(false), [pixPayload, setPixPayload] = useState('');

  const load = useCallback(() => { void (async () => {
    const range = customPeriod ? { from: parseBRDate(from), to: parseBRDate(to) } : monthRange(month);
    const minCents = minimum ? parseBRLToCents(minimum) ?? undefined : undefined, maxCents = maximum ? parseBRLToCents(maximum) ?? undefined : undefined;
    const itemQuery = customPeriod && (!range.from || !range.to) ? Promise.resolve([] as Purchase[]) : listPurchases({ from: range.from ?? undefined, to: range.to ?? undefined, vendorId: vendorId || undefined, status: status === 'all' ? undefined : status, minCents, maxCents });
    const [allItems, sellerList, paymentRows, city] = await Promise.all([itemQuery, listVendors(), listPayments(), getSetting('pix_city', '')]);
    setItems(allItems); setVendors(sellerList); setPayments(paymentRows); setPixCity(city); setSelected([]);
  })().catch(() => Alert.alert('Erro', 'Não foi possível carregar o histórico.')); }, [month, vendorId, status, customPeriod, from, to, minimum, maximum]);
  useFocusEffect(load);

  const selectedItems = useMemo(() => {
    const selectedIds = new Set(selected);
    return items.filter((item) => selectedIds.has(item.id) && item.paymentStatus === 'pending');
  }, [items, selected]);
  const pixSelection = useMemo(() => consolidatePixPurchases(selectedItems), [selectedItems]);
  const selectedVendor = pixSelection.valid ? vendors.find((vendor) => vendor.id === pixSelection.summary.vendorId) : undefined;
  const selectedPixKey = selectedVendor?.pixKey ? validatePixKey(selectedVendor.pixKey, selectedVendor.pixKeyType) : null;
  const canStartPix = Boolean(selectedVendor?.pixKey && selectedPixKey?.valid);
  const visiblePending = items.filter((item) => item.paymentStatus === 'pending');
  const allVisibleSelected = visiblePending.length > 0 && visiblePending.every((item) => selected.includes(item.id));

  const togglePurchase = (item: Purchase) => {
    if (selected.includes(item.id)) { setSelected((previous) => previous.filter((id) => id !== item.id)); return; }
    const firstSelected = items.find((purchase) => selected.includes(purchase.id));
    if (firstSelected && firstSelected.vendorId !== item.vendorId) { Alert.alert('Vendedores diferentes', 'Selecione compras de apenas um vendedor por Pix.'); return; }
    setSelected((previous) => [...previous, item.id]);
  };

  const toggleAllVisible = () => {
    const vendorIds = new Set(visiblePending.map((item) => item.vendorId));
    if (vendorIds.size > 1) { Alert.alert('Escolha um vendedor', 'Use o filtro de vendedor antes de selecionar todas as compras visíveis.'); return; }
    setSelected(allVisibleSelected ? [] : visiblePending.map((item) => item.id));
  };

  const paySelected = async () => {
    const parsedDate = parseBRDate(payDate);
    if (!parsedDate) { Alert.alert('Data inválida', 'Informe uma data no formato DD/MM/AAAA.'); return; }
    try { await setPurchasesPaid(selectedItems.map((item) => item.id), parsedDate); setPayModal(false); setSelected([]); load(); }
    catch { Alert.alert('Não foi possível salvar', 'Tente novamente.'); }
  };

  const openPixConfirmation = (city = pixCity) => {
    const validation = validatePixGeneration(selectedItems, selectedVendor, city);
    if (!validation.valid) { Alert.alert('Não foi possível gerar o Pix', validation.error); return; }
    setConfirmPixModal(true);
  };

  const startPix = () => {
    const selection = consolidatePixPurchases(selectedItems);
    if (!selection.valid) { Alert.alert('Não foi possível gerar o Pix', selection.error); return; }
    const vendor = vendors.find((item) => item.id === selection.summary.vendorId);
    if (!vendor?.pixKey) { Alert.alert('Vendedor sem chave Pix', 'Cadastre uma chave Pix válida para este vendedor.'); return; }
    const key = validatePixKey(vendor.pixKey, vendor.pixKeyType);
    if (!key.valid) { Alert.alert('Chave Pix inválida', key.error); return; }
    if (!pixCity.trim()) { setPixCityDraft(''); setCityModal(true); return; }
    setConfirmPixModal(true);
  };

  const saveFirstPixCity = async () => {
    const city = pixCityDraft.trim();
    if (!normalizePixText(city, 15)) { Alert.alert('Cidade inválida', 'Informe uma cidade com letras ou números para geração do Pix.'); return; }
    try {
      await saveSetting('pix_city', city);
      setPixCity(city); setCityModal(false);
      openPixConfirmation(city);
    } catch { Alert.alert('Não foi possível salvar a cidade', 'Tente novamente.'); }
  };

  const generatePix = () => {
    const validation = validatePixGeneration(selectedItems, selectedVendor, pixCity);
    if (!validation.valid || !selectedVendor?.pixKey) { Alert.alert('Não foi possível gerar o Pix', validation.valid ? 'Vendedor sem chave Pix.' : validation.error); return; }
    try {
      const payload = generatePixPayload({ pixKey: selectedVendor.pixKey, pixKeyType: selectedVendor.pixKeyType, amountCents: validation.summary.totalCents, beneficiaryName: selectedVendor.pixBeneficiaryName || selectedVendor.name, city: pixCity });
      setPixPayload(payload); setConfirmPixModal(false);
    } catch (error) { Alert.alert('Falha ao gerar o código', error instanceof Error ? error.message : 'Confira os dados e tente novamente.'); }
  };

  const copyPix = async () => {
    try {
      await Clipboard.setStringAsync(pixPayload);
      Alert.alert('Código Pix copiado', 'Agora cole na opção Pix Copia e Cola do seu banco. Copiar o código não confirma o pagamento.');
    } catch { Alert.alert('Falha ao copiar', 'Não foi possível copiar para a área de transferência. Tente novamente.'); }
  };

  const remove = (item: Purchase) => Alert.alert(
    'Excluir esta compra?',
    `Vendedor: ${item.vendorName}\nData: ${formatDate(item.purchaseDate)}\n${item.description ? `Descrição: ${item.description}\n` : ''}Valor: ${formatBRL(item.amountCents)}\n\nEssa ação removerá a compra do histórico e dos totais. Não será possível desfazer.`,
    [{ text: 'Cancelar', style: 'cancel' }, { text: 'Excluir compra', style: 'destructive', onPress: () => { void (async () => { try { const photoPath = await deletePurchase(item.id); await removePhoto(photoPath).catch(() => undefined); setSelected((previous) => previous.filter((id) => id !== item.id)); load(); } catch { Alert.alert('Erro', 'Não foi possível excluir a compra.'); } })(); } }],
  );

  return <Screen>
    <PageHeader title="Histórico" subtitle="Todas as compras em um só lugar." action={<Pressable onPress={() => router.push('/purchase/new')} style={styles.iconButton}><Ionicons name="add" size={24} color="#fff" /></Pressable>} />
    <Card style={styles.monthCard}><Pressable onPress={() => { setCustomPeriod(false); setMonth(shift(month, -1)); }} style={styles.arrow}><Ionicons name="chevron-back" color={colors.green} size={20} /></Pressable><View style={{ alignItems: 'center' }}><Text style={styles.monthLabel}>{customPeriod ? 'PERÍODO PERSONALIZADO' : 'MÊS DAS COMPRAS'}</Text><Text style={styles.month}>{customPeriod ? `${formatDate(from)} – ${formatDate(to)}` : `${months[month.getMonth()]} ${month.getFullYear()}`}</Text></View><Pressable onPress={() => { setCustomPeriod(false); setMonth(shift(month, 1)); }} style={styles.arrow}><Ionicons name="chevron-forward" color={colors.green} size={20} /></Pressable></Card>
    <Pressable onPress={() => setShowFilters((value) => !value)} style={styles.filterToggle}><Ionicons name="options-outline" size={18} color={colors.green} /><Text style={styles.filterToggleText}>{showFilters ? 'Ocultar filtros' : 'Mais filtros'}</Text><Ionicons name={showFilters ? 'chevron-up' : 'chevron-down'} size={16} color={colors.green} /></Pressable>
    {showFilters ? <Card style={{ gap: 12 }}><Pressable onPress={() => setCustomPeriod((value) => !value)} style={styles.customToggle}><Ionicons name={customPeriod ? 'checkbox' : 'square-outline'} size={20} color={colors.green} /><Text style={styles.customText}>Usar período personalizado</Text></Pressable>{customPeriod ? <View style={styles.dateFields}><Field label="De (DD/MM/AAAA)" value={from} onChangeText={setFrom} placeholder="01/01/2026" keyboardType="numbers-and-punctuation" /><Field label="Até (DD/MM/AAAA)" value={to} onChangeText={setTo} placeholder="31/01/2026" keyboardType="numbers-and-punctuation" /></View> : null}<View style={styles.dateFields}><Field label="Valor mínimo" value={minimum} onChangeText={(value) => setMinimum(formatCurrencyInput(value))} placeholder="0,00" keyboardType="decimal-pad" /><Field label="Valor máximo" value={maximum} onChangeText={(value) => setMaximum(formatCurrencyInput(value))} placeholder="0,00" keyboardType="decimal-pad" /></View></Card> : null}
    <View style={styles.filterRow}>{(['all', 'pending', 'paid'] as const).map((value) => <Pressable key={value} onPress={() => setStatus(value)} style={[styles.pill, status === value && styles.pillActive]}><Text style={[styles.pillText, status === value && styles.pillTextActive]}>{value === 'all' ? 'Todas' : value === 'pending' ? 'Pendentes' : 'Pagas'}</Text></Pressable>)}</View>
    <View style={styles.vendorScroll}><Pressable onPress={() => setVendorId('')} style={[styles.vendorPill, !vendorId && styles.vendorSelected]}><Text style={[styles.vendorText, !vendorId && styles.vendorTextActive]}>Todos</Text></Pressable>{vendors.map((vendor) => <Pressable key={vendor.id} onPress={() => setVendorId(vendor.id === vendorId ? '' : vendor.id)} style={[styles.vendorPill, vendorId === vendor.id && styles.vendorSelected]}><Text style={[styles.vendorText, vendorId === vendor.id && styles.vendorTextActive]}>{vendor.name}</Text></Pressable>)}</View>
    {visiblePending.length ? <Pressable onPress={toggleAllVisible} style={styles.selectAll}><Ionicons name={allVisibleSelected ? 'checkbox' : 'square-outline'} size={19} color={colors.green} /><Text style={styles.selectAllText}>{allVisibleSelected ? 'Desmarcar compras visíveis' : 'Selecionar todas as visíveis'}</Text></Pressable> : null}
    {pixSelection.valid && selectedVendor ? <Card style={styles.summary}><Text style={styles.summaryVendor}>{selectedVendor.name}</Text><Text style={styles.summaryText}>{pixSelection.summary.count} {pixSelection.summary.count === 1 ? 'compra selecionada' : 'compras selecionadas'}</Text><Text style={styles.summaryText}>Período: {formatDate(pixSelection.summary.from)} a {formatDate(pixSelection.summary.to)}</Text><Text style={styles.summaryTotal}>Total: {formatBRL(pixSelection.summary.totalCents)}</Text>{!selectedVendor.pixKey ? <Text style={styles.pixError}>Cadastre uma chave Pix para gerar o código.</Text> : selectedPixKey && !selectedPixKey.valid ? <Text style={styles.pixError}>{selectedPixKey.error}</Text> : null}<Button title="Gerar Pix Copia e Cola" onPress={startPix} disabled={!canStartPix} icon={<Ionicons name="copy-outline" size={18} color="#fff" />} /><Button title={`Marcar ${selectedItems.length} como paga${selectedItems.length > 1 ? 's' : ''}`} variant="secondary" onPress={() => { setPayDate(formatDate(todayISO())); setPayModal(true); }} icon={<Ionicons name="checkmark-circle-outline" size={19} color={colors.green} />} /></Card> : null}
    <SectionTitle>{items.length} {items.length === 1 ? 'compra' : 'compras'}</SectionTitle>
    {items.length ? <View style={{ gap: 9 }}>{items.map((item) => <PurchaseCard key={item.id} item={item} onPress={() => router.push({ pathname: '/purchase/[id]', params: { id: item.id } })} onDelete={() => remove(item)} selected={selected.includes(item.id)} onToggle={item.paymentStatus === 'pending' ? () => togglePurchase(item) : undefined} />)}</View> : <Card><EmptyState title="Nenhuma compra por aqui" detail="Ajuste os filtros ou registre um lanche novo." icon={<Ionicons name="receipt-outline" size={30} color={colors.green} />} /></Card>}
    <View style={{ gap: 10 }}><SectionTitle>Histórico de pagamentos</SectionTitle>{payments.length ? payments.slice(0, 12).map((payment) => <Card key={payment.id} style={styles.paymentRow}><View style={{ flex: 1 }}><Text style={styles.paymentVendor}>{payment.vendorName}</Text><Text style={styles.paymentMeta}>{formatDate(payment.paymentDate)} · {payment.purchaseCount} {payment.purchaseCount === 1 ? 'compra' : 'compras'}</Text></View><Text style={styles.paymentTotal}>{formatBRL(payment.totalCents)}</Text></Card>) : <Card><Text style={styles.noPayments}>Pagamentos confirmados aparecerão aqui.</Text></Card>}</View>

    <Modal visible={payModal} transparent animationType="fade" onRequestClose={() => setPayModal(false)}><View style={styles.modalShade}><View style={styles.modal}><Text style={styles.modalTitle}>Confirmar pagamento</Text><Text style={styles.modalCopy}>Data em que essas compras foram pagas.</Text><Text style={styles.label}>Data do pagamento (DD/MM/AAAA)</Text><TextInput value={payDate} onChangeText={setPayDate} placeholder="14/09/2026" keyboardType="numbers-and-punctuation" style={styles.dateInput} /><View style={styles.modalButtons}><Button title="Voltar" variant="secondary" onPress={() => setPayModal(false)} /><Button title="Confirmar" onPress={() => void paySelected()} /></View></View></View></Modal>
    <Modal visible={cityModal} transparent animationType="fade" onRequestClose={() => setCityModal(false)}><KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalShade}><View style={styles.modal}><Text style={styles.modalTitle}>Cidade para geração do Pix</Text><Text style={styles.modalCopy}>Informe uma vez; você poderá alterar esse valor em Ajustes.</Text><Field label="Cidade" value={pixCityDraft} onChangeText={setPixCityDraft} placeholder="Ex.: São Paulo" autoFocus autoCapitalize="words" /><View style={styles.modalButtons}><Button title="Cancelar" variant="secondary" onPress={() => setCityModal(false)} /><Button title="Salvar e continuar" onPress={() => void saveFirstPixCity()} /></View></View></KeyboardAvoidingView></Modal>
    <Modal visible={confirmPixModal} transparent animationType="fade" onRequestClose={() => setConfirmPixModal(false)}><View style={styles.modalShade}><View style={styles.modal}><Text style={styles.modalTitle}>Pagamento para {selectedVendor?.name}</Text><Text style={styles.modalCopy}>{pixSelection.valid ? `${pixSelection.summary.count} ${pixSelection.summary.count === 1 ? 'compra selecionada' : 'compras selecionadas'}\nTotal: ${formatBRL(pixSelection.summary.totalCents)}` : ''}</Text><Text style={styles.pixKey}>Chave Pix: {selectedVendor?.pixKey ? maskPixKey(selectedVendor.pixKey, selectedVendor.pixKeyType) : 'não cadastrada'}</Text><Text style={styles.warning}>Confira o nome do destinatário no aplicativo do banco antes de confirmar o pagamento.</Text><View style={styles.modalButtons}><Button title="Cancelar" variant="secondary" onPress={() => setConfirmPixModal(false)} /><Button title="Gerar Pix" onPress={generatePix} /></View></View></View></Modal>
    <Modal visible={Boolean(pixPayload)} transparent animationType="slide" onRequestClose={() => setPixPayload('')}><View style={styles.modalShade}><View style={styles.modal}><Text style={styles.modalTitle}>Pix Copia e Cola</Text><Text style={styles.modalCopy}>O código contém a chave e o valor consolidado. Confira os dados no aplicativo do banco.</Text><TextInput value={pixPayload} editable={false} multiline selectTextOnFocus style={styles.payload} /><Button title="Copiar código Pix" onPress={() => void copyPix()} icon={<Ionicons name="copy-outline" size={18} color="#fff" />} /><Button title="Fechar" variant="quiet" onPress={() => setPixPayload('')} /></View></View></Modal>
  </Screen>;
}

const styles = StyleSheet.create({
  iconButton: { height: 44, width: 44, borderRadius: 15, backgroundColor: colors.green, alignItems: 'center', justifyContent: 'center' }, monthCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 11 }, arrow: { width: 38, height: 38, borderRadius: 12, backgroundColor: colors.greenLight, alignItems: 'center', justifyContent: 'center' },
  monthLabel: { color: colors.muted, fontSize: 9, letterSpacing: 1, fontWeight: '800' }, month: { color: colors.ink, fontSize: 16, textTransform: 'capitalize', fontWeight: '800', marginTop: 3 }, filterToggle: { minHeight: 42, flexDirection: 'row', alignItems: 'center', gap: 7 }, filterToggleText: { color: colors.green, fontSize: 13, fontWeight: '800' }, customToggle: { flexDirection: 'row', alignItems: 'center', gap: 8 }, customText: { color: colors.ink, fontWeight: '700', fontSize: 13 }, dateFields: { flexDirection: 'row', gap: 10 },
  selectAll: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 2 }, selectAllText: { color: colors.green, fontWeight: '700', fontSize: 12 }, filterRow: { flexDirection: 'row', gap: 8 }, pill: { backgroundColor: '#EEF0ED', paddingHorizontal: 15, paddingVertical: 9, borderRadius: 99 }, pillActive: { backgroundColor: colors.green }, pillText: { color: colors.muted, fontSize: 12, fontWeight: '700' }, pillTextActive: { color: '#fff' }, vendorScroll: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 }, vendorPill: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 99, backgroundColor: colors.surface, borderColor: colors.line, borderWidth: 1 }, vendorSelected: { backgroundColor: colors.greenLight, borderColor: colors.green }, vendorText: { color: colors.muted, fontSize: 11, fontWeight: '600' }, vendorTextActive: { color: colors.green },
  summary: { gap: 9, backgroundColor: colors.greenLight, borderColor: colors.greenLight }, summaryVendor: { color: colors.ink, fontSize: 18, fontWeight: '800' }, summaryText: { color: colors.muted, fontSize: 12 }, summaryTotal: { color: colors.green, fontSize: 20, fontWeight: '800', marginBottom: 4 }, pixError: { color: colors.red, fontSize: 12, lineHeight: 18 }, paymentRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14 }, paymentVendor: { color: colors.ink, fontWeight: '800', fontSize: 13 }, paymentMeta: { color: colors.muted, fontSize: 11, marginTop: 4 }, paymentTotal: { color: colors.green, fontWeight: '800' }, noPayments: { color: colors.muted, fontSize: 12 },
  modalShade: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: '#15231FCC' }, modal: { padding: 20, borderRadius: 22, backgroundColor: '#fff', gap: 12, maxHeight: '90%' }, modalTitle: { fontSize: 20, color: colors.ink, fontWeight: '800' }, modalCopy: { color: colors.muted, lineHeight: 20 }, label: { fontSize: 12, color: colors.ink, fontWeight: '700', marginTop: 8 }, dateInput: { borderRadius: 12, borderColor: colors.line, borderWidth: 1, paddingHorizontal: 13, height: 48, color: colors.ink }, modalButtons: { flexDirection: 'row', gap: 9, justifyContent: 'flex-end', marginTop: 5 }, pixKey: { color: colors.ink, fontWeight: '700' }, warning: { color: colors.amber, fontSize: 12, lineHeight: 18, backgroundColor: colors.amberLight, padding: 12, borderRadius: 12 }, payload: { minHeight: 150, maxHeight: 230, borderWidth: 1, borderColor: colors.line, borderRadius: 12, padding: 12, color: colors.ink, backgroundColor: '#F7F8F6', textAlignVertical: 'top', fontSize: 11 },
});
