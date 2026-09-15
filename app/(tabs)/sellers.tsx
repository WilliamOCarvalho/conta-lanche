import { useCallback, useState } from 'react';
import { Alert, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { listVendors, saveVendor, setVendorActive } from '../../src/db/repository';
import type { Vendor } from '../../src/types';
import { Button, Card, EmptyState, Field, PageHeader, Screen } from '../../src/components/ui';
import { colors } from '../../src/theme';
import { maskPixKey, validatePixKey } from '../../src/services/pix';

export default function SellersScreen() {
  const insets = useSafeAreaInsets();
  const [vendors, setVendors] = useState<Vendor[]>([]), [modal, setModal] = useState(false), [editing, setEditing] = useState<Vendor | null>(null);
  const [name, setName] = useState(''), [pixKey, setPixKey] = useState(''), [pixBeneficiaryName, setPixBeneficiaryName] = useState(''), [contact, setContact] = useState(''), [observation, setObservation] = useState(''), [saving, setSaving] = useState(false);
  const load = useCallback(() => { void listVendors().then(setVendors).catch(() => Alert.alert('Erro', 'Não foi possível carregar os vendedores.')); }, []);
  useFocusEffect(load);
  const startNew = () => { setEditing(null); setName(''); setPixKey(''); setPixBeneficiaryName(''); setContact(''); setObservation(''); setModal(true); };
  const startEdit = (vendor: Vendor) => { setEditing(vendor); setName(vendor.name); setPixKey(vendor.pixKey ?? ''); setPixBeneficiaryName(vendor.pixBeneficiaryName ?? ''); setContact(vendor.contact ?? ''); setObservation(vendor.observation ?? ''); setModal(true); };
  const save = async () => {
    if (!name.trim()) { Alert.alert('Informe o nome', 'O nome do vendedor é obrigatório.'); return; }
    const pixValidation = pixKey.trim() ? validatePixKey(pixKey) : null;
    if (pixValidation && !pixValidation.valid) { Alert.alert('Chave Pix inválida', pixValidation.error); return; }
    setSaving(true);
    try { await saveVendor({ id: editing?.id, name, pixKey: pixValidation?.normalized, pixBeneficiaryName, contact, observation, active: editing?.active ?? true }); setModal(false); load(); }
    catch { Alert.alert('Não foi possível salvar', 'Tente novamente.'); }
    finally { setSaving(false); }
  };
  const toggle = (vendor: Vendor) => Alert.alert(vendor.active ? 'Inativar vendedor?' : 'Ativar vendedor?', vendor.active ? 'Ele continuará no histórico de compras.' : 'Ele ficará disponível nos novos registros.', [
    { text: 'Cancelar', style: 'cancel' }, { text: vendor.active ? 'Inativar' : 'Ativar', onPress: () => { void setVendorActive(vendor.id, !vendor.active).then(load); } },
  ]);
  const active = vendors.filter((v) => v.active), inactive = vendors.filter((v) => !v.active);
  return <Screen>
    <PageHeader title="Vendedores" subtitle="Quem prepara seus lanches." action={<Pressable onPress={startNew} style={styles.add}><Ionicons name="add" color="#fff" size={24} /></Pressable>} />
    {active.length ? <View style={{ gap: 11 }}>{active.map((vendor) => <Card key={vendor.id} style={styles.vendorCard}><View style={styles.avatar}><Text style={styles.initial}>{vendor.name.trim().charAt(0).toUpperCase()}</Text></View><View style={{ flex: 1, gap: 4 }}><Text style={styles.name}>{vendor.name}</Text><Text style={styles.meta}>{vendor.pixKey ? `Pix: ${maskPixKey(vendor.pixKey)}` : 'Chave Pix não cadastrada'}</Text>{vendor.pixBeneficiaryName ? <Text style={styles.meta}>Beneficiário: {vendor.pixBeneficiaryName}</Text> : null}<Text style={styles.meta}>{vendor.contact || 'Sem contato cadastrado'}</Text>{vendor.observation ? <Text style={styles.meta}>{vendor.observation}</Text> : null}</View><View style={styles.actions}><Pressable onPress={() => startEdit(vendor)} accessibilityLabel={`Editar ${vendor.name}`} style={styles.action}><Ionicons name="create-outline" size={20} color={colors.green} /></Pressable><Pressable onPress={() => toggle(vendor)} accessibilityLabel={`Inativar ${vendor.name}`} style={styles.action}><Ionicons name="person-remove-outline" size={19} color={colors.muted} /></Pressable></View></Card>)}</View> : <Card><EmptyState title="Cadastre seu primeiro vendedor" detail="Os vendedores aparecem como opção quando você registra uma compra." icon={<Ionicons name="people-outline" size={30} color={colors.green} />} /></Card>}
    {inactive.length ? <View style={{ gap: 10, marginTop: 5 }}><Text style={styles.inactiveHeading}>Inativos</Text>{inactive.map((vendor) => <Card key={vendor.id} style={[styles.vendorCard, { opacity: 0.68 }]}><View style={[styles.avatar, { backgroundColor: '#EEF0ED' }]}><Text style={[styles.initial, { color: colors.muted }]}>{vendor.name.trim().charAt(0).toUpperCase()}</Text></View><View style={{ flex: 1 }}><Text style={styles.name}>{vendor.name}</Text><Text style={styles.meta}>{vendor.contact || 'Inativo'}</Text></View><Pressable onPress={() => toggle(vendor)} style={styles.action}><Ionicons name="person-add-outline" size={19} color={colors.green} /></Pressable></Card>)}</View> : null}
    <Modal visible={modal} transparent animationType="slide" onRequestClose={() => setModal(false)}><View style={styles.modalShade}><KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalKeyboard}><ScrollView style={styles.modalScroll} contentContainerStyle={[styles.modal, { paddingBottom: Math.max(30, insets.bottom + 18) }]} keyboardShouldPersistTaps="handled" keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}><View style={styles.modalHeader}><Text style={styles.modalTitle}>{editing ? 'Editar vendedor' : 'Novo vendedor'}</Text><Pressable onPress={() => setModal(false)}><Ionicons name="close" size={23} color={colors.muted} /></Pressable></View><Field label="Nome *" value={name} onChangeText={setName} placeholder="Ex.: Ana" autoFocus /><Field label="Chave Pix" value={pixKey} onChangeText={setPixKey} placeholder="CPF, e-mail, telefone ou chave aleatória" autoCapitalize="none" /><Field label="Nome do beneficiário Pix" value={pixBeneficiaryName} onChangeText={setPixBeneficiaryName} placeholder="Somente se for diferente do vendedor" /><Field label="Telefone ou contato" value={contact} onChangeText={setContact} placeholder="Opcional" keyboardType="phone-pad" /><Field label="Observação" value={observation} onChangeText={setObservation} placeholder="Opcional" multiline /><Button title={saving ? 'Salvando…' : 'Salvar vendedor'} onPress={() => void save()} disabled={saving} /></ScrollView></KeyboardAvoidingView></View></Modal>
  </Screen>;
}

const styles = StyleSheet.create({ add: { width: 45, height: 45, borderRadius: 15, backgroundColor: colors.green, alignItems: 'center', justifyContent: 'center' }, vendorCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 }, avatar: { width: 44, height: 44, borderRadius: 15, backgroundColor: colors.greenLight, alignItems: 'center', justifyContent: 'center' }, initial: { color: colors.green, fontSize: 18, fontWeight: '800' }, name: { color: colors.ink, fontSize: 15, fontWeight: '800' }, meta: { color: colors.muted, fontSize: 11 }, actions: { flexDirection: 'row', gap: 3 }, action: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 12 }, inactiveHeading: { color: colors.muted, fontWeight: '800', fontSize: 13 }, modalShade: { flex: 1, justifyContent: 'flex-end', backgroundColor: '#15231F88' }, modalKeyboard: { maxHeight: '92%' }, modalScroll: { marginHorizontal: 20, borderTopLeftRadius: 26, borderTopRightRadius: 26, overflow: 'hidden' }, modal: { backgroundColor: colors.background, padding: 20, paddingBottom: 30, gap: 14 }, modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, modalTitle: { color: colors.ink, fontSize: 21, fontWeight: '800' } });
