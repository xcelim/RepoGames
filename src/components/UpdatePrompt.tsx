// Al abrir la app (y al volver a ella) mira si hay una APK nueva y ofrece instalarla.
import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState } from 'react';
import { AppState, Linking, Modal, StyleSheet, View } from 'react-native';

import { checkForUpdate, requiredUpdate, type AppUpdate, type Required } from '@/utils/appUpdate';

import { DarkButton, LightButton, Sheet, useIgnColors } from './ign';
import { ThemedText } from './ThemedText';

let skipped = 0; // versión que has dejado para luego (hasta que cierres la app)

export function UpdatePrompt() {
  const [update, setUpdate] = useState<AppUpdate | null>(null);
  const [required, setRequired] = useState<Required | null>(null);
  useEffect(() => {
    let last = 0;
    const check = () => {
      if (Date.now() - last < 30 * 60_000) return;
      last = Date.now();
      requiredUpdate()
        .then(setRequired)
        .catch(() => undefined);
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
  if (required) return <RequiredScreen required={required} update={update} />;
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

// Actualización obligatoria: pantalla que no se puede cerrar hasta instalar la versión nueva.
function RequiredScreen({ required, update }: { required: Required; update: AppUpdate | null }) {
  const c = useIgnColors();
  const url = update?.url ?? 'https://github.com/xcelim/RepoGames/releases/latest';
  return (
    <Modal visible transparent={false} animationType="fade" onRequestClose={() => undefined} statusBarTranslucent>
      <View style={[styles.full, { backgroundColor: c.bg }]}>
        <Ionicons name="cloud-download" size={64} color={c.accent} />
        <ThemedText variant="display" size={26} style={{ textAlign: 'center' }}>
          Actualización necesaria
        </ThemedText>
        <ThemedText variant="muted" size={15} style={{ textAlign: 'center' }}>
          {required.message ||
            'Esta versión de Saga Quest ya no es compatible. Instala la nueva para seguir: tus datos están a salvo en tu cuenta.'}
        </ThemedText>
        <DarkButton
          label="Descargar la versión nueva"
          icon="download"
          onPress={() => Linking.openURL(url).catch(() => undefined)}
          style={{ alignSelf: 'stretch' }}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  full: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 18, padding: 32 },
});
