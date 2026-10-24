// Compartir una vista como imagen: en el móvil, con el menú de compartir; en la web, se descarga.
import * as Sharing from 'expo-sharing';
import type { RefObject } from 'react';
import { Platform, type View } from 'react-native';
import { captureRef } from 'react-native-view-shot';

export async function shareImage(ref: RefObject<View | null>, name: string, title?: string): Promise<void> {
  if (Platform.OS === 'web') {
    const uri = await captureRef(ref, { format: 'png', quality: 1, result: 'data-uri' });
    const a = document.createElement('a');
    a.href = uri;
    a.download = `${name.replace(/[^\w\-áéíóúñÁÉÍÓÚÑ ]+/g, '').trim() || 'saga-quest'}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    return;
  }
  const uri = await captureRef(ref, { format: 'png', quality: 1, result: 'tmpfile' });
  await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: title ?? name });
}
