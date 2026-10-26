// Al abrir la app (y al volver a ella) mira si hay una APK nueva y ofrece instalarla.
import { useEffect, useState } from 'react';
import { AppState, Linking, View } from 'react-native';

import { checkForUpdate, type AppUpdate } from '@/utils/appUpdate';

import { DarkButton, LightButton, Sheet } from './ign';
import { ThemedText } from './ThemedText';

let skipped = 0; // versión que has dejado para luego (hasta que cierres la app)

export function UpdatePrompt() {
  const [update, setUpdate] = useState<AppUpdate | null>(null);
  useEffect(() => {
    let last = 0;
    const check = () => {
      if (Date.now() - last < 30 * 60_000) return;
      last = Date.now();
      checkForUpdate()
        .then((u) => u && u.build !== skipped && setUpdate(u))
        .catch(() => undefined);
    };
    const t = setTimeout(check, 4000);
    const sub = AppState.addEventListener('change', (s) => s === 'active' && check());
    return () => {
      clearTimeout(t);
      sub.remove();
    };
  }, []);
  if (!update) return null;
  const later = () => {
    skipped = update.build;
    setUpdate(null);
  };
  return (
    <Sheet visible title="Actualización" onClose={later} doneLabel={null}>
      <View style={{ gap: 10 }}>
        <ThemedText variant="display" size={22}>
          ¡Hay una versión nueva!
        </ThemedText>
        <ThemedText variant="muted" size={14}>
          {`Saga Quest ${update.tag} está lista. Se descarga la APK; ábrela al terminar y pulsa «Actualizar». No pierdes nada: tus datos están en tu cuenta.`}
        </ThemedText>
        <DarkButton
          label="Descargar e instalar"
          icon="download"
          onPress={() => {
            Linking.openURL(update.url).catch(() => undefined);
            later();
          }}
        />
        <LightButton label="Más tarde" onPress={later} />
      </View>
    </Sheet>
  );
}
