import { useEffect, useRef, useState } from 'react';
import { Alert, Image, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { listVendors, savePurchase, saveVendor } from '../../src/db/repository';
import type { Vendor } from '../../src/types';
import { Button, Card, Field, PageHeader, Screen } from '../../src/components/ui';
import { formatCurrencyInput, parseBRLToCents } from '../../src/services/money';
import { formatDate, parseBRDate, todayISO } from '../../src/services/dates';
import { persistPhoto, removePhoto } from '../../src/services/photos';
import { colors } from '../../src/theme';

type Stage = 'capture' | 'preview' | 'form';

export default function NewPurchaseScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [stage, setStage] = useState<Stage>('capture');
  const [photo, setPhoto] = useState<string | null>(null);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const savingRef = useRef(false);
  const [vendorId, setVendorId] = useState('');
  const [date, setDate] = useState(formatDate(todayISO()));
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [observation, setObservation] = useState('');
  const [vendorModal, setVendorModal] = useState(false);
  const [newVendorModal, setNewVendorModal] = useState(false);
  const [vendorName, setVendorName] = useState('');
  const [vendorPixKey, setVendorPixKey] = useState('');
  const [vendorContact, setVendorContact] = useState('');
  const [saving, setSaving] = useState(false);
  const [opening, setOpening] = useState(false);

  useEffect(() => {
    void listVendors(true).then(setVendors);
    void takePhoto();
  }, []);

  async function takePhoto() {
    setOpening(true);
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Câmera não autorizada', 'Você pode permitir o acesso nas configurações ou escolher uma foto da galeria.', [
          { text: 'Agora não', style: 'cancel' },
          { text: 'Abrir galeria', onPress: () => { void pickPhoto(); } },
        ]);
        return;
      }
      const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.8, allowsEditing: false });
      if (!result.canceled && result.assets[0]) {
        setPhoto(result.assets[0].uri);
        setStage('preview');
      }
    } catch (error) {
      Alert.alert('Não foi possível abrir a câmera', error instanceof Error ? error.message : 'Tente escolher uma foto da galeria.');
    } finally {
      setOpening(false);
    }
  }

  async function pickPhoto() {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Galeria não autorizada', 'Permita o acesso às fotos nas configurações do aparelho.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8, allowsEditing: false });
      if (!result.canceled && result.assets[0]) {
        setPhoto(result.assets[0].uri);
        setStage('preview');
      }
    } catch (error) {
      Alert.alert('Não foi possível abrir a galeria', error instanceof Error ? error.message : 'Tente novamente.');
    }
  }

  const loadVendors = async () => setVendors(await listVendors(true));

  const addVendor = async () => {
    if (!vendorName.trim()) {
      Alert.alert('Nome obrigatório', 'Informe o nome do vendedor.');
      return;
    }
    try {
      const id = await saveVendor({ name: vendorName, pixKey: vendorPixKey, contact: vendorContact });
      await loadVendors();
      setVendorId(id);
      setNewVendorModal(false);
      setVendorModal(false);
      setVendorName('');
      setVendorPixKey('');
      setVendorContact('');
    } catch (error) {
      Alert.alert('Não foi possível cadastrar', error instanceof Error ? error.message : 'Confira os dados e tente novamente.');
    }
  };

  const submit = async () => {
    if (savingRef.current) return;
    if (!vendorId) {
      Alert.alert('Escolha um vendedor', 'O vendedor é obrigatório.');
      return;
    }
    const cents = parseBRLToCents(amount);
    if (!cents || cents <= 0) {
      Alert.alert('Valor inválido', 'Informe um valor maior que zero, como 8,50.');
      return;
    }
    const purchaseDate = parseBRDate(date);
    if (!purchaseDate) {
      Alert.alert('Data inválida', 'Informe uma data válida no formato DD/MM/AAAA.');
      return;
    }
    if (!photo) {
      Alert.alert('Foto obrigatória', 'Tire uma foto ou escolha uma imagem da galeria.');
      return;
    }

    savingRef.current = true;
    setSaving(true);
    let savedPath: string | null = null;
    let saveStep = 'preparar a foto';
    try {
      savedPath = await persistPhoto(photo);
      saveStep = 'gravar a compra';
      await savePurchase({ vendorId, purchaseDate, amountCents: cents, description, observation, photoPath: savedPath });
      router.back();
    } catch (error) {
      if (savedPath) await removePhoto(savedPath).catch(() => undefined);
      const detail = error instanceof Error ? error.message : String(error);
      Alert.alert('Compra não salva', `Falha ao ${saveStep}: ${detail}. Seus dados continuam no formulário.`);
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  return (
    <Screen edges={['top', 'bottom']}>
      <PageHeader
        title={stage === 'form' ? 'Nova compra' : 'Foto do lanche'}
        subtitle={stage === 'form' ? 'Preencha os detalhes para salvar.' : 'Uma foto ajuda a lembrar do que você comprou.'}
        action={<Pressable onPress={() => router.back()} style={styles.close}><Ionicons name="close" color={colors.ink} size={22} /></Pressable>}
      />

      {stage === 'capture' ? (
        <View style={styles.capture}>
          <Card style={styles.captureBox}>
            <Ionicons name="camera-outline" size={48} color={colors.green} />
            <Text style={styles.captureTitle}>{opening ? 'Abrindo câmera…' : 'Fotografe seu lanche'}</Text>
            <Text style={styles.captureCopy}>Você poderá conferir a imagem antes de continuar.</Text>
            <Button title="Abrir câmera" onPress={() => void takePhoto()} icon={<Ionicons name="camera" size={18} color="#fff" />} />
            <Button title="Escolher da galeria" variant="secondary" onPress={() => void pickPhoto()} icon={<Ionicons name="images-outline" size={18} color={colors.green} />} />
          </Card>
        </View>
      ) : null}

      {stage === 'preview' && photo ? (
        <View style={styles.previewWrap}>
          <Image source={{ uri: photo }} style={styles.preview} />
          <View style={styles.previewButtons}>
            <Button title="Tirar novamente" variant="secondary" onPress={() => void takePhoto()} icon={<Ionicons name="refresh" size={18} color={colors.green} />} />
            <Button title="Usar foto" onPress={() => setStage('form')} icon={<Ionicons name="checkmark" size={18} color="#fff" />} />
          </View>
          <Button title="Escolher outra imagem" variant="quiet" onPress={() => void pickPhoto()} />
        </View>
      ) : null}

      {stage === 'form' ? (
        <View style={styles.form}>
          {photo ? <Pressable onPress={() => setStage('preview')}><Image source={{ uri: photo }} style={styles.formPhoto} /><Text style={styles.changePhoto}>Toque para conferir ou trocar a foto</Text></Pressable> : null}
          <Pressable onPress={() => setVendorModal(true)}>
            <Text style={styles.label}>Vendedor *</Text>
            <View style={styles.select}>
              <Text style={[styles.selectText, !vendorId && { color: colors.muted }]}>{vendors.find((vendor) => vendor.id === vendorId)?.name ?? 'Selecionar vendedor'}</Text>
              <Ionicons name="chevron-down" color={colors.muted} size={18} />
            </View>
            {vendors.find((vendor) => vendor.id === vendorId)?.pixKey ? <Text style={styles.pixNote}>Chave Pix: {vendors.find((vendor) => vendor.id === vendorId)?.pixKey}</Text> : null}
          </Pressable>
          <Field label="Data da compra (DD/MM/AAAA) *" value={date} onChangeText={setDate} placeholder="14/09/2026" keyboardType="numbers-and-punctuation" />
          <Field label="Valor em reais *" value={amount} onChangeText={(value) => setAmount(formatCurrencyInput(value))} placeholder="0,00" keyboardType="decimal-pad" />
          <Field label="Descrição (opcional)" value={description} onChangeText={setDescription} placeholder="Ex.: pão de queijo e café" />
          <Field label="Observação (opcional)" value={observation} onChangeText={setObservation} placeholder="Alguma anotação para lembrar" multiline />
          <Button title={saving ? 'Salvando…' : 'Salvar compra'} onPress={() => void submit()} disabled={saving} icon={<Ionicons name="checkmark-circle-outline" size={19} color="#fff" />} />
        </View>
      ) : null}

      <Modal visible={vendorModal} transparent animationType="slide" onRequestClose={() => setVendorModal(false)}>
        <View style={styles.shade}>
          <View style={[styles.sheet, { paddingBottom: Math.max(32, insets.bottom + 16) }]}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Escolha o vendedor</Text>
              <Pressable onPress={() => setVendorModal(false)}><Ionicons name="close" size={22} color={colors.muted} /></Pressable>
            </View>
            <Pressable style={styles.newVendor} onPress={() => setNewVendorModal(true)}>
              <Ionicons name="add-circle-outline" color={colors.green} size={21} />
              <Text style={styles.newVendorText}>Cadastrar vendedor</Text>
            </Pressable>
            {vendors.length ? vendors.map((vendor) => (
              <Pressable key={vendor.id} onPress={() => { setVendorId(vendor.id); setVendorModal(false); }} style={styles.vendorOption}>
                <View style={{ flex: 1, gap: 3 }}>
                  <Text style={styles.vendorOptionText}>{vendor.name}</Text>
                  {vendor.pixKey ? <Text style={styles.pixNote}>{vendor.pixKey}</Text> : null}
                </View>
                {vendorId === vendor.id ? <Ionicons name="checkmark-circle" size={20} color={colors.green} /> : null}
              </Pressable>
            )) : <Text style={styles.emptyText}>Ainda não há vendedores cadastrados.</Text>}
          </View>
        </View>
      </Modal>

      <Modal visible={newVendorModal} transparent animationType="slide" onRequestClose={() => setNewVendorModal(false)}>
        <View style={styles.vendorFormShade}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.vendorFormKeyboard}>
            <ScrollView
              style={styles.quickFormScroll}
              contentContainerStyle={[styles.quickForm, { paddingBottom: Math.max(24, insets.bottom + 16) }]}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
            >
              <Text style={styles.sheetTitle}>Novo vendedor</Text>
              <Field label="Nome *" value={vendorName} onChangeText={setVendorName} placeholder="Nome do colega" autoFocus />
              <Field label="Chave Pix" value={vendorPixKey} onChangeText={setVendorPixKey} placeholder="CPF, e-mail, telefone ou chave aleatória" autoCapitalize="none" />
              <Field label="Telefone ou contato" value={vendorContact} onChangeText={setVendorContact} placeholder="Opcional" />
              <View style={styles.previewButtons}>
                <Button title="Cancelar" variant="secondary" onPress={() => setNewVendorModal(false)} />
                <Button title="Salvar" onPress={() => void addVendor()} />
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  close: { width: 40, height: 40, borderRadius: 13, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  capture: { flex: 1, justifyContent: 'center' },
  captureBox: { alignItems: 'center', gap: 13, padding: 24 },
  captureTitle: { fontSize: 20, color: colors.ink, fontWeight: '800', marginTop: 4 },
  captureCopy: { color: colors.muted, textAlign: 'center', lineHeight: 20, marginBottom: 6 },
  previewWrap: { gap: 12 },
  preview: { width: '100%', height: 410, borderRadius: 22, backgroundColor: colors.greenLight, resizeMode: 'cover' },
  previewButtons: { flexDirection: 'row', gap: 10 },
  form: { gap: 16 },
  formPhoto: { width: '100%', height: 150, borderRadius: 18, backgroundColor: colors.greenLight },
  changePhoto: { textAlign: 'center', color: colors.green, fontSize: 12, fontWeight: '700', marginTop: 7 },
  label: { fontSize: 13, fontWeight: '700', color: colors.ink, marginBottom: 7 },
  select: { height: 50, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, borderRadius: 13, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  selectText: { color: colors.ink, fontSize: 15 },
  pixNote: { color: colors.muted, fontSize: 12, marginTop: 6 },
  shade: { flex: 1, justifyContent: 'flex-end', backgroundColor: '#15231F88' },
  sheet: { backgroundColor: colors.background, padding: 20, borderTopLeftRadius: 25, borderTopRightRadius: 25, maxHeight: '75%' },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  sheetTitle: { fontSize: 20, fontWeight: '800', color: colors.ink },
  newVendor: { flexDirection: 'row', gap: 9, alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderColor: colors.line },
  newVendorText: { color: colors.green, fontWeight: '800' },
  vendorOption: { paddingVertical: 15, borderBottomWidth: 1, borderColor: colors.line, flexDirection: 'row', alignItems: 'center', gap: 12 },
  vendorOptionText: { color: colors.ink, fontSize: 15, fontWeight: '600' },
  emptyText: { color: colors.muted, paddingVertical: 22 },
  vendorFormShade: { flex: 1, justifyContent: 'flex-end', backgroundColor: '#15231F88' },
  vendorFormKeyboard: { flex: 1, justifyContent: 'flex-end' },
  quickFormScroll: { flexGrow: 0, maxHeight: '92%', marginHorizontal: 20, marginTop: 20, overflow: 'hidden', borderRadius: 22 },
  quickForm: { backgroundColor: colors.background, padding: 20, gap: 14 },
});
