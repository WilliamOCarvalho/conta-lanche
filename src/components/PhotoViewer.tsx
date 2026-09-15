import { useEffect, useState } from 'react';
import { Image, Modal, Pressable, StyleSheet, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme';

export function PhotoViewer({ uri, style, accessibilityLabel = 'Ampliar foto' }: {
  uri?: string | null; style: StyleProp<ViewStyle>; accessibilityLabel?: string;
}) {
  const [visible, setVisible] = useState(false);
  const [failed, setFailed] = useState(!uri);
  useEffect(() => { setFailed(!uri); setVisible(false); }, [uri]);
  const imageAvailable = Boolean(uri) && !failed;
  const fallback = <View style={styles.fallback}><Ionicons name="fast-food-outline" size={24} color={colors.green} /></View>;
  return <>
    <Pressable accessibilityRole={imageAvailable ? 'button' : undefined} accessibilityLabel={accessibilityLabel} onPress={() => imageAvailable && setVisible(true)} style={[styles.thumbnail, style]}>
      {imageAvailable ? <Image source={{ uri: uri as string }} onError={() => { setFailed(true); setVisible(false); }} style={StyleSheet.absoluteFill} resizeMode="cover" /> : fallback}
    </Pressable>
    <Modal visible={visible && imageAvailable} animationType="fade" presentationStyle="fullScreen" onRequestClose={() => setVisible(false)}>
      <View style={styles.fullscreen}>
        <StatusBar style="light" />
        <Image source={{ uri: uri as string }} onError={() => { setFailed(true); setVisible(false); }} style={styles.fullImage} resizeMode="contain" />
        <Pressable accessibilityRole="button" accessibilityLabel="Fechar foto ampliada" onPress={() => setVisible(false)} hitSlop={10} style={styles.close}>
          <Ionicons name="close" size={25} color="#fff" />
        </Pressable>
      </View>
    </Modal>
  </>;
}

const styles = StyleSheet.create({
  thumbnail: { overflow: 'hidden' },
  fallback: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.greenLight },
  fullscreen: { flex: 1, backgroundColor: '#080A09', justifyContent: 'center', alignItems: 'center' },
  fullImage: { width: '100%', height: '100%' },
  close: { position: 'absolute', top: 45, right: 18, width: 44, height: 44, borderRadius: 22, backgroundColor: '#202522CC', alignItems: 'center', justifyContent: 'center' },
});
