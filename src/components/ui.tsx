import type { PropsWithChildren, ReactNode } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type StyleProp, type TextInputProps, type ViewStyle } from 'react-native';
import { SafeAreaView, useSafeAreaInsets, type Edge } from 'react-native-safe-area-context';
import { colors, radius } from '../theme';

export function Screen({ children, scroll = true, style, edges = ['top', 'bottom'] }: PropsWithChildren<{ scroll?: boolean; style?: ViewStyle; edges?: Edge[] }>) {
  const insets = useSafeAreaInsets();
  return <SafeAreaView style={[styles.safe, style]} edges={edges}>
    <KeyboardAvoidingView style={styles.keyboard} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top : 0}>
      {scroll ? <ScrollView contentContainerStyle={[styles.content, { paddingBottom: 28 + insets.bottom }]} keyboardShouldPersistTaps="handled" keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}>{children}</ScrollView> : children}
    </KeyboardAvoidingView>
  </SafeAreaView>;
}
export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return <View style={styles.header}><View style={{ flex: 1 }}><Text style={styles.title}>{title}</Text>{subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}</View>{action}</View>;
}
export function Card({ children, style }: PropsWithChildren<{ style?: StyleProp<ViewStyle> }>) { return <View style={[styles.card, style]}>{children}</View>; }
export function Button({ title, onPress, variant = 'primary', disabled = false, icon }: { title: string; onPress: () => void; variant?: 'primary' | 'secondary' | 'quiet' | 'danger'; disabled?: boolean; icon?: ReactNode }) {
  return <Pressable accessibilityRole="button" onPress={onPress} disabled={disabled} style={({ pressed }) => [styles.button, styles[`button_${variant}`], (pressed || disabled) && { opacity: disabled ? 0.55 : 0.82 }]}>
    {icon}{<Text style={[styles.buttonText, variant === 'secondary' || variant === 'quiet' ? { color: colors.green } : variant === 'danger' ? { color: colors.red } : null]}>{title}</Text>}
  </Pressable>;
}
export function Field({ label, ...props }: TextInputProps & { label: string }) {
  return <View style={styles.fieldWrap}><Text style={styles.fieldLabel}>{label}</Text><TextInput placeholderTextColor={colors.muted} {...props} style={[styles.input, props.multiline && { height: 96, textAlignVertical: 'top', paddingTop: 14 }, props.style]} /></View>;
}
export function EmptyState({ title, detail, icon }: { title: string; detail: string; icon?: ReactNode }) {
  return <View style={styles.empty}>{icon}<Text style={styles.emptyTitle}>{title}</Text><Text style={styles.emptyDetail}>{detail}</Text></View>;
}
export function Loading() { return <View style={styles.loading}><ActivityIndicator color={colors.green} /></View>; }
export function SectionTitle({ children, trailing }: PropsWithChildren<{ trailing?: ReactNode }>) { return <View style={styles.sectionHead}><Text style={styles.sectionTitle}>{children}</Text>{trailing}</View>; }
export const uiStyles = StyleSheet.create({ row: { flexDirection: 'row', alignItems: 'center' }, spaceBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, flex1: { flex: 1 } });

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background }, keyboard: { flex: 1 }, content: { paddingHorizontal: 20, paddingBottom: 28, gap: 18 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 10 }, title: { fontSize: 29, fontWeight: '800', color: colors.ink, letterSpacing: -0.5 }, subtitle: { fontSize: 14, color: colors.muted, marginTop: 4 },
  card: { backgroundColor: colors.surface, borderRadius: radius.md, padding: 18, borderWidth: 1, borderColor: colors.line },
  button: { minHeight: 48, paddingHorizontal: 16, borderRadius: 15, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 }, button_primary: { backgroundColor: colors.green }, button_secondary: { backgroundColor: colors.greenLight }, button_quiet: { backgroundColor: 'transparent' }, button_danger: { backgroundColor: colors.redLight }, buttonText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
  fieldWrap: { gap: 7 }, fieldLabel: { color: colors.ink, fontSize: 13, fontWeight: '700' }, input: { minHeight: 50, borderRadius: 13, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, paddingHorizontal: 14, color: colors.ink, fontSize: 15 },
  empty: { alignItems: 'center', justifyContent: 'center', padding: 28, gap: 9 }, emptyTitle: { fontSize: 16, fontWeight: '700', color: colors.ink, textAlign: 'center' }, emptyDetail: { color: colors.muted, textAlign: 'center', lineHeight: 21 }, loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, sectionTitle: { color: colors.ink, fontSize: 18, fontWeight: '800' },
});
