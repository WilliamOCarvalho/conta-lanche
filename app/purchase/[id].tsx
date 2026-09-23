import { useCallback, useRef, useState } from 'react';
import { Alert, Image, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { deletePurchase, getPaymentForPurchase, getPurchase, listVendors, savePurchase, setPurchasesPaid, setPurchasesPending } from '../../src/db/repository';
import type { Payment, Purchase, Vendor } from '../../src/types';
import { Button, Card, Field, PageHeader, Screen } from '../../src/components/ui';
import { PhotoViewer } from '../../src/components/PhotoViewer';
import { formatBRL, formatCurrencyInput, parseBRLToCents } from '../../src/services/money';
import { formatDate, parseBRDate, todayISO } from '../../src/services/dates';
import { persistPhoto, removePhoto } from '../../src/services/photos';
import { colors } from '../../src/theme';
import { maskPixKey } from '../../src/services/pix';

export default function PurchaseDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>(), router = useRouter();
  const savingRef = useRef(false);
  const [purchase, setPurchase] = useState<Purchase | null>(null), [vendors, setVendors] = useState<Vendor[]>([]), [payment, setPayment] = useState<(Payment & { vendorName: string; purchaseCount: number }) | null>(null);
  const [editing, setEditing] = useState(false), [vendorId, setVendorId] = useState(''), [date, setDate] = useState(''), [amount, setAmount] = useState(''), [description, setDescription] = useState(''), [observation, setObservation] = useState(''), [photo, setPhoto] = useState<string | null>(null);
  const [saving, setSaving] = useState(false), [paymentModal, setPaymentModal] = useState(false), [paymentDate, setPaymentDate] = useState(formatDate(todayISO()));
  const load = useCallback(() => { void (async () => {
    const [item, sellerList] = await Promise.all([getPurchase(id), listVendors()]);
    if (!item) { setPurchase(null); return; }
    setPurchase(item); setVendors(sellerList);
    setPayment(item.paymentStatus === 'paid' ? await getPaymentForPurchase(item.id) : null);
    setVendorId(item.vendorId); setDate(formatDate(item.purchaseDate)); setAmount(formatCurrencyInput(String(item.amountCents)));
    setDescription(item.description ?? ''); setObservation(item.observation ?? ''); setPhoto(item.photoPath);
  })().catch(() => Alert.alert('Erro', 'Não foi possível abrir esta compra.')); }, [id]);
  useFocusEffect(load);
  const choosePhoto = () => Alert.alert('Trocar foto', 'Escolha de onde vem a nova imagem.', [
    { text: 'Cancelar', style: 'cancel' }, { text: 'Câmera', onPress: () => { void (async () => { const permission = await ImagePicker.requestCameraPermissionsAsync(); if (!permission.granted) { Alert.alert('Câmera não autorizada', 'Permita o acesso nas configurações.'); return; } const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.8 }); if (!result.canceled && result.assets[0]) setPhoto(result.assets[0].uri); })(); } },
    { text: 'Galeria', onPress: () => { void (async () => { const permission = await ImagePicker.requestMediaLibraryPermissionsAsync(); if (!permission.granted) { Alert.alert('Galeria não autorizada', 'Permita o acesso às fotos nas configurações.'); return; } const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 }); if (!result.canceled && result.assets[0]) setPhoto(result.assets[0].uri); })(); } },
  ]);
  const save = async () => {
    if (savingRef.current) return;
    if (!purchase || !vendorId || !photo) { Alert.alert('Dados obrigatórios', 'Vendedor e foto são necessários.'); return; }
    const cents = parseBRLToCents(amount);
    if (!cents || cents <= 0) { Alert.alert('Valor inválido', 'Informe um valor maior que zero.'); return; }
    const purchaseDate = parseBRDate(date);
    if (!purchaseDate) { Alert.alert('Data inválida', 'Use o formato DD/MM/AAAA.'); return; }
    savingRef.current = true; setSaving(true); let newPath: string | null = null;
    try {
      const photoChanged = photo !== purchase.photoPath;
      if (photoChanged) newPath = await persistPhoto(photo);
      await savePurchase({ id: purchase.id, vendorId, purchaseDate, amountCents: cents, description, observation, photoPath: newPath ?? purchase.photoPath });
      if (newPath) await removePhoto(purchase.photoPath);
      setEditing(false); load();
    } catch (e) { if (newPath) await removePhoto(newPath).catch(() => undefined); Alert.alert('Não foi possível salvar', e instanceof Error ? e.message : 'Tente novamente.'); }
    finally { savingRef.current = false; setSaving(false); }
  };
  const markPaid = async () => {
    if (!purchase) return;
    const parsedPaymentDate = parseBRDate(paymentDate);
    if (!parsedPaymentDate) { Alert.alert('Data inválida', 'Use o formato DD/MM/AAAA.'); return; }
    try { await setPurchasesPaid([purchase.id], parsedPaymentDate); setPaymentModal(false); load(); } catch { Alert.alert('Erro', 'O pagamento não foi registrado.'); }
  };
  const undoPayment = () => Alert.alert('Desfazer pagamento?', 'A compra voltará para o status pendente.', [{ text: 'Cancelar', style: 'cancel' }, { text: 'Desfazer', style: 'destructive', onPress: () => { void setPurchasesPending([purchase!.id]).then(load); } }]);
  const remove = () => Alert.alert('Excluir esta compra?', `Vendedor: ${purchase?.vendorName ?? '—'}\nData: ${purchase ? formatDate(purchase.purchaseDate) : '—'}\n${purchase?.description ? `Descrição: ${purchase.description}\n` : ''}Valor: ${purchase ? formatBRL(purchase.amountCents) : '—'}\n\nEssa ação removerá a compra do histórico e dos totais. Não será possível desfazer.`, [{ text: 'Cancelar', style: 'cancel' }, { text: 'Excluir compra', style: 'destructive', onPress: () => { void (async () => { try { const path = await deletePurchase(id); await removePhoto(path).catch(() => undefined); router.back(); } catch { Alert.alert('Erro', 'Não foi possível excluir a compra.'); } })(); } }]);
  if (!purchase) return <Screen><PageHeader title="Compra" action={<Pressable onPress={() => router.back()}><Ionicons name="close" size={24} color={colors.ink} /></Pressable>} /><Card><Text style={styles.muted}>Compra não encontrada.</Text></Card></Screen>;
  return <Screen>
    <PageHeader title={editing ? 'Editar compra' : 'Detalhe da compra'} action={<Pressable onPress={() => router.back()} style={styles.close}><Ionicons name="close" size={22} color={colors.ink} /></Pressable>} />
    {editing ? <View style={{ gap: 15 }}>
      <Pressable onPress={choosePhoto}><Image source={{ uri: photo ?? purchase.photoPath }} style={styles.editImage} /><Text style={styles.changePhoto}>Toque para trocar a foto</Text></Pressable>
      <View><Text style={styles.label}>Vendedor</Text><View style={styles.sellerChoices}>{vendors.filter((v) => v.active || v.id === vendorId).map((v) => <Pressable key={v.id} onPress={() => purchase.paymentStatus === 'pending' ? setVendorId(v.id) : undefined} style={[styles.sellerPill, vendorId === v.id && styles.sellerSelected]}><Text style={[styles.sellerText, vendorId === v.id && { color: colors.green }]}>{v.name}</Text></Pressable>)}</View>{purchase.paymentStatus === 'paid' ? <Text style={styles.note}>O vendedor não pode ser alterado após o pagamento.</Text> : null}</View>
      <Field label="Data (DD/MM/AAAA)" value={date} onChangeText={setDate} keyboardType="numbers-and-punctuation" /><Field label="Valor em reais" value={amount} onChangeText={(value) => setAmount(formatCurrencyInput(value))} keyboardType="decimal-pad" /><Field label="Descrição" value={description} onChangeText={setDescription} placeholder="Opcional" /><Field label="Observação" value={observation} onChangeText={setObservation} placeholder="Opcional" multiline />
      <View style={styles.actions}><Button title="Cancelar" variant="secondary" onPress={() => { setEditing(false); load(); }} /><Button title={saving ? 'Salvando…' : 'Salvar alterações'} onPress={() => void save()} disabled={saving} /></View>
    </View> : <View style={{ gap: 14 }}>
      <PhotoViewer uri={purchase.photoPath} style={styles.image} accessibilityLabel="Ampliar foto da compra" />
      <Card style={{ gap: 13 }}><View style={styles.titleRow}><Text style={styles.name}>{purchase.description || 'Lanche'}</Text><View style={[styles.badge, purchase.paymentStatus === 'paid' ? styles.paid : styles.pending]}><Text style={[styles.badgeText, { color: purchase.paymentStatus === 'paid' ? colors.green : colors.amber }]}>{purchase.paymentStatus === 'paid' ? 'Pago' : 'Pendente'}</Text></View></View><Info label="Vendedor" value={purchase.vendorName ?? ''} />{vendors.find((v) => v.id === purchase.vendorId)?.pixKey ? <Info label="Chave Pix do vendedor" value={maskPixKey(vendors.find((v) => v.id === purchase.vendorId)?.pixKey ?? '', vendors.find((v) => v.id === purchase.vendorId)?.pixKeyType)} /> : null}<Info label="Data da compra" value={formatDate(purchase.purchaseDate)} /><Info label="Valor" value={formatBRL(purchase.amountCents)} strong /><Info label="Observação" value={purchase.observation || '—'} />{purchase.paymentStatus === 'paid' ? <Info label="Data do pagamento" value={purchase.paymentDate ? formatDate(purchase.paymentDate) : '—'} /> : null}{payment ? <Text style={styles.note}>Pagamento em lote · {payment.purchaseCount} compras no total</Text> : null}</Card>
      {purchase.paymentStatus === 'pending' ? <Button title="Marcar como paga" onPress={() => { setPaymentDate(formatDate(todayISO())); setPaymentModal(true); }} icon={<Ionicons name="checkmark-circle-outline" size={19} color="#fff" />} /> : <Button title="Desfazer pagamento" variant="secondary" onPress={undoPayment} icon={<Ionicons name="arrow-undo-outline" size={19} color={colors.green} />} />}
      <View style={styles.actions}><Button title="Editar" variant="secondary" onPress={() => setEditing(true)} icon={<Ionicons name="create-outline" size={18} color={colors.green} />} /><Button title="Excluir" variant="danger" onPress={remove} icon={<Ionicons name="trash-outline" size={18} color={colors.red} />} /></View>
    </View>}
    <Modal visible={paymentModal} transparent animationType="fade" onRequestClose={() => setPaymentModal(false)}><View style={styles.shade}><View style={styles.modal}><Text style={styles.modalTitle}>Confirmar pagamento</Text><Text style={styles.muted}>Informe a data real em que pagou.</Text><Text style={styles.label}>Data (DD/MM/AAAA)</Text><TextInput value={paymentDate} onChangeText={setPaymentDate} style={styles.dateInput} keyboardType="numbers-and-punctuation" /><View style={styles.actions}><Button title="Cancelar" variant="secondary" onPress={() => setPaymentModal(false)} /><Button title="Confirmar" onPress={() => void markPaid()} /></View></View></View></Modal>
  </Screen>;
}

function Info({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) { return <View style={styles.info}><Text style={styles.muted}>{label}</Text><Text style={[styles.infoValue, strong && { fontSize: 21, color: colors.green }]}>{value}</Text></View>; }
const styles = StyleSheet.create({ close: { width: 40, height: 40, borderRadius: 13, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' }, image: { width: '100%', height: 320, borderRadius: 22, backgroundColor: colors.greenLight }, editImage: { width: '100%', height: 190, borderRadius: 18, backgroundColor: colors.greenLight }, changePhoto: { textAlign: 'center', color: colors.green, fontWeight: '700', fontSize: 12, marginTop: 6 }, titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 }, name: { color: colors.ink, fontSize: 20, fontWeight: '800', flex: 1 }, badge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 99 }, paid: { backgroundColor: colors.greenLight }, pending: { backgroundColor: colors.amberLight }, badgeText: { fontSize: 11, fontWeight: '800' }, info: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 }, muted: { color: colors.muted, fontSize: 13 }, infoValue: { color: colors.ink, fontSize: 14, fontWeight: '700', textAlign: 'right', flexShrink: 1 }, note: { color: colors.green, fontSize: 11, lineHeight: 17 }, actions: { flexDirection: 'row', gap: 10 }, label: { color: colors.ink, fontSize: 13, fontWeight: '700', marginBottom: 7 }, sellerChoices: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 }, sellerPill: { paddingHorizontal: 11, paddingVertical: 8, borderRadius: 99, backgroundColor: '#EEF0ED' }, sellerSelected: { backgroundColor: colors.greenLight }, sellerText: { color: colors.muted, fontSize: 11, fontWeight: '700' }, shade: { flex: 1, justifyContent: 'center', padding: 22, backgroundColor: '#15231F88' }, modal: { padding: 20, borderRadius: 21, backgroundColor: '#fff', gap: 12 }, modalTitle: { fontSize: 20, color: colors.ink, fontWeight: '800' }, dateInput: { height: 48, borderWidth: 1, borderColor: colors.line, paddingHorizontal: 13, borderRadius: 12, color: colors.ink } });
