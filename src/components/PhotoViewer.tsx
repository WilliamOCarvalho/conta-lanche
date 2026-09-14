import { useState } from 'react';
import { Image, Modal, Pressable, StyleSheet, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';

export function PhotoViewer({ uri, style, accessibilityLabel = 'Ampliar foto' }: {
  uri: string; style: StyleProp<ViewStyle>; accessibilityLabel?: string;
}) {
  const [visible, setVisible] = useState(false);
  return <>
    <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel} onPress={() => setVisible(true)} style={[styles.thumbnail, style]}>
      <Image source={{ uri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
    </Pressable>
    <Modal visible={visible} animationType="fade" presentationStyle="fullScreen" onRequestClose={() => setVisible(false)}>
      <View style={styles.fullscreen}>
        <StatusBar style="light" />
        <Image source={{ uri }} style={styles.fullImage} resizeMode="contain" />
        <Pressable accessibilityRole="button" accessibilityLabel="Fechar foto ampliada" onPress={() => setVisible(false)} hitSlop={10} style={styles.close}>
          <Ionicons name="close" size={25} color="#fff" />
        </Pressable>
      </View>
    </Modal>
  </>;
}

const styles = StyleSheet.create({
  thumbnail: { overflow: 'hidden' },
  fullscreen: { flex: 1, backgroundColor: '#080A09', justifyContent: 'center', alignItems: 'center' },
  fullImage: { width: '100%', height: '100%' },
  close: { position: 'absolute', top: 45, right: 18, width: 44, height: 44, borderRadius: 22, backgroundColor: '#202522CC', alignItems: 'center', justifyContent: 'center' },
});
