import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';

const folder = `${FileSystem.documentDirectory ?? ''}photos/`;

async function ensurePhotosDirectory() {
  const info = await FileSystem.getInfoAsync(folder);
  if (!info.exists) await FileSystem.makeDirectoryAsync(folder, { intermediates: true });
}

export async function persistPhoto(sourceUri: string): Promise<string> {
  try {
    await ensurePhotosDirectory();

    // Image compression is only an optimization; the original photo can still be saved
    // if the optional manipulator API is unavailable in a device build.
    let sourceToCopy = sourceUri;
    if (typeof ImageManipulator.manipulateAsync === 'function') {
      const compressed = await ImageManipulator.manipulateAsync(
        sourceUri,
        [{ resize: { width: 1440 } }],
        { compress: 0.82 },
      );
      sourceToCopy = compressed.uri;
    }

    const target = `${folder}lanche_${Date.now()}_${Math.random().toString(36).slice(2, 9)}.jpg`;
    await FileSystem.copyAsync({ from: sourceToCopy, to: target });
    return target;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Nao foi possivel armazenar a foto: ${message}`);
  }
}

export async function removePhoto(uri: string | null | undefined) {
  if (uri && uri.startsWith(folder)) await FileSystem.deleteAsync(uri, { idempotent: true });
}

export async function photoAsBase64(uri: string): Promise<string> {
  return FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
}

export async function restorePhoto(base64: string, extension = 'jpg'): Promise<string> {
  await ensurePhotosDirectory();
  const target = `${folder}backup_${Date.now()}_${Math.random().toString(36).slice(2, 9)}.${extension}`;
  await FileSystem.writeAsStringAsync(target, base64, { encoding: FileSystem.EncodingType.Base64 });
  return target;
}

export async function fileAsBase64(uri: string) {
  return FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
}
