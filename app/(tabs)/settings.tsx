import { useCallback, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { deleteHoliday, getSetting, listHolidays, saveHoliday, saveSetting } from '../../src/db/repository';
import type { Holiday } from '../../src/types';
import { Button, Card, Field, PageHeader, Screen, SectionTitle } from '../../src/components/ui';
import { exportBackup, restoreBackup } from '../../src/services/exports';
import { formatDate, parseBRDate } from '../../src/services/dates';
import { colors } from '../../src/theme';
import { normalizePixText } from '../../src/services/pix';

export default function SettingsScreen() {
  const [holidays, setHolidays] = useState<Holiday[]>([]), [date, setDate] = useState(''), [description, setDescription] = useState(''), [kind, setKind] = useState<Holiday['type']>('holiday'), [working, setWorking] = useState(false);
  const [pixCity, setPixCity] = useState(''), [savingPixCity, setSavingPixCity] = useState(false);
  const load = useCallback(() => { void Promise.all([listHolidays(), getSetting('pix_city', '')]).then(([days, city]) => { setHolidays(days); setPixCity(city); }).catch(() => Alert.alert('Erro', 'Não foi possível carregar as configurações.')); }, []);
  useFocusEffect(load);
  const add = async () => {
    const holidayDate = parseBRDate(date);
    if (!holidayDate || !description.trim()) { Alert.alert('Dados incompletos', 'Informe uma data válida no formato DD/MM/AAAA e uma descrição.'); return; }
    try { await saveHoliday({ date: holidayDate, description, type: kind }); setDate(''); setDescription(''); load(); }
    catch { Alert.alert('Data já cadastrada', 'Já existe um feriado ou dia não útil nessa data.'); }
  };
  const doBackup = async () => { setWorking(true); try { await exportBackup(); } catch (e) { Alert.alert('Falha no backup', e instanceof Error ? e.message : 'Tente novamente.'); } finally { setWorking(false); } };
  const doRestore = () => Alert.alert('Substituir dados?', 'A restauração vai substituir as compras, vendedores, pagamentos e feriados deste aparelho.', [
    { text: 'Cancelar', style: 'cancel' }, { text: 'Escolher backup', style: 'destructive', onPress: () => { void (async () => { setWorking(true); try { const result = await restoreBackup(); if (result) Alert.alert('Backup restaurado', `${result.purchaseCount} compras recuperadas.`); load(); } catch (e) { Alert.alert('Backup inválido', e instanceof Error ? e.message : 'Não foi possível restaurar os dados.'); } finally { setWorking(false); } })(); } },
  ]);
  const remove = (holiday: Holiday) => Alert.alert('Excluir data?', `${holiday.description} · ${formatDate(holiday.date)}`, [{ text: 'Cancelar', style: 'cancel' }, { text: 'Excluir', style: 'destructive', onPress: () => { void deleteHoliday(holiday.id).then(load); } }]);
  const savePixCity = async () => {
    if (!normalizePixText(pixCity, 15)) { Alert.alert('Cidade inválida', 'Informe uma cidade com letras ou números para gerar o Pix Copia e Cola.'); return; }
    setSavingPixCity(true);
    try { await saveSetting('pix_city', pixCity.trim()); setPixCity(pixCity.trim()); Alert.alert('Cidade salva', 'A cidade será usada nos próximos códigos Pix.'); }
    catch { Alert.alert('Não foi possível salvar', 'Tente novamente.'); }
    finally { setSavingPixCity(false); }
  };
  return <Screen>
    <PageHeader title="Ajustes" subtitle="Dados locais e calendário de pagamentos." />
    <Card style={{ gap: 12 }}><SectionTitle>Pix Copia e Cola</SectionTitle><Text style={styles.copy}>A cidade é obrigatória no padrão Pix e será normalizada somente ao montar o código.</Text><Field label="Cidade para geração do Pix" value={pixCity} onChangeText={setPixCity} placeholder="Ex.: São Paulo" autoCapitalize="words" /><Button title={savingPixCity ? 'Salvando…' : 'Salvar cidade'} variant="secondary" onPress={() => void savePixCity()} disabled={savingPixCity} /></Card>
    <Card style={{ gap: 13 }}><SectionTitle>Backup e restauração</SectionTitle><Text style={styles.copy}>O arquivo inclui seus registros, pagamentos, vendedores, feriados e fotos.</Text><Button title={working ? 'Preparando…' : 'Exportar backup'} onPress={() => void doBackup()} disabled={working} icon={<Ionicons name="archive-outline" size={18} color="#fff" />} /><Button title="Restaurar backup" variant="secondary" onPress={doRestore} disabled={working} icon={<Ionicons name="refresh-outline" size={18} color={colors.green} />} /></Card>
    <Card style={{ gap: 12 }}><SectionTitle>Quinto dia útil</SectionTitle><Text style={styles.copy}>Feriados nacionais brasileiros são incluídos automaticamente. Você pode adicionar feriados locais ou dias sem expediente. Exclua um feriado nacional da lista para tratá-lo como dia útil.</Text><View style={styles.kindRow}><Pressable onPress={() => setKind('holiday')} style={[styles.kind, kind === 'holiday' && styles.kindActive]}><Text style={[styles.kindText, kind === 'holiday' && styles.kindTextActive]}>Feriado</Text></Pressable><Pressable onPress={() => setKind('non_working')} style={[styles.kind, kind === 'non_working' && styles.kindActive]}><Text style={[styles.kindText, kind === 'non_working' && styles.kindTextActive]}>Dia não útil</Text></Pressable></View><Field label="Data (DD/MM/AAAA)" value={date} onChangeText={setDate} placeholder="24/12/2026" keyboardType="numbers-and-punctuation" /><Field label="Descrição" value={description} onChangeText={setDescription} placeholder="Ex.: recesso da empresa" /><Button title="Adicionar data" variant="secondary" onPress={() => void add()} /></Card>
    <View style={{ gap: 10 }}><SectionTitle>Feriados cadastrados</SectionTitle>{holidays.map((holiday) => <Card key={holiday.id} style={styles.holiday}><View style={{ flex: 1 }}><Text style={styles.holidayName}>{holiday.description}</Text><Text style={styles.copy}>{formatDate(holiday.date)} · {holiday.type === 'holiday' ? 'Feriado' : 'Dia não útil'}</Text></View><Pressable onPress={() => remove(holiday)} accessibilityLabel={`Excluir ${holiday.description}`} style={styles.remove}><Ionicons name="trash-outline" color={colors.red} size={18} /></Pressable></Card>)}</View>
    <Card style={styles.about}><Ionicons name="phone-portrait-outline" size={22} color={colors.green} /><View style={{ flex: 1 }}><Text style={styles.aboutTitle}>Seus dados ficam no aparelho</Text><Text style={styles.copy}>O Conta Lanche funciona offline e não envia suas compras para um servidor.</Text></View></Card>
  </Screen>;
}

const styles = StyleSheet.create({ copy: { color: colors.muted, fontSize: 12, lineHeight: 19 }, kindRow: { flexDirection: 'row', gap: 8 }, kind: { paddingVertical: 8, paddingHorizontal: 13, borderRadius: 99, backgroundColor: '#EEF0ED' }, kindActive: { backgroundColor: colors.greenLight }, kindText: { color: colors.muted, fontSize: 12, fontWeight: '700' }, kindTextActive: { color: colors.green }, holiday: { flexDirection: 'row', alignItems: 'center', padding: 13 }, holidayName: { color: colors.ink, fontSize: 13, fontWeight: '700' }, remove: { width: 37, height: 37, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.redLight }, about: { flexDirection: 'row', alignItems: 'flex-start', gap: 13, backgroundColor: colors.greenLight, borderColor: colors.greenLight }, aboutTitle: { color: colors.ink, fontSize: 14, fontWeight: '800' } });
