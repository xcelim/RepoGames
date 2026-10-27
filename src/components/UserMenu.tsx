// Menú «⋯» del perfil de otra persona: denunciar y bloquear.
import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { ActivityIndicator, Alert, View } from 'react-native';

import { blockUser, REPORT_REASONS, reportUser, unblockUser, useBlocks } from '@/cloud/moderation';
import { notify } from '@/utils/notify';

import { DotsButton, Sheet, SheetRow, useIgnColors } from './ign';
import { ThemedText } from './ThemedText';

export function UserMenu({ id, name }: { id: string; name: string }) {
  const c = useIgnColors();
  const blocked = useBlocks((s) => s.blocked.includes(id));
  const [open, setOpen] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [busy, setBusy] = useState(false);

  const run = async (fn: () => Promise<void>, done: string) => {
    setBusy(true);
    try {
      await fn();
      notify(done);
      setOpen(false);
      setReporting(false);
    } catch (e) {
      notify(e instanceof Error ? e.message : 'No se ha podido');
    } finally {
      setBusy(false);
    }
  };

  const toggleBlock = () => {
    if (blocked) return run(() => unblockUser(id), `Has desbloqueado a ${name}`);
    Alert.alert(
      `¿Bloquear a ${name}?`,
      'Dejaréis de ser amigos y no podrá escribirte ni pedirte amistad. No se le avisa.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Bloquear', style: 'destructive', onPress: () => run(() => blockUser(id), `Has bloqueado a ${name}`) },
      ],
    );
  };

  return (
    <>
      <DotsButton onPress={() => setOpen(true)} />
      <Sheet
        visible={open}
        title={reporting ? `Denunciar a ${name}` : name}
        onClose={() => {
          setOpen(false);
          setReporting(false);
        }}
        doneLabel={reporting ? 'Cancelar' : 'Cerrar'}
      >
        {busy ? <ActivityIndicator color={c.text} style={{ marginVertical: 16 }} /> : null}
        {reporting ? (
          <View>
            <ThemedText variant="muted" size={13} style={{ marginBottom: 6 }}>
              ¿Qué pasa? Lo revisaremos. No se le dice quién le ha denunciado.
            </ThemedText>
            {REPORT_REASONS.map((r, i) => (
              <SheetRow
                key={r}
                label={r}
                last={i === REPORT_REASONS.length - 1}
                onPress={() => run(() => reportUser({ target: id, reason: r }), 'Denuncia enviada. ¡Gracias!')}
              />
            ))}
          </View>
        ) : (
          <View>
            <SheetRow
              label="Denunciar"
              caption="SPAM, OFENSIVO, ACOSO…"
              left={<Ionicons name="flag-outline" size={20} color={c.text} />}
              onPress={() => setReporting(true)}
            />
            <SheetRow
              label={blocked ? 'Desbloquear' : 'Bloquear'}
              caption={blocked ? 'VOLVERÁ A PODER ESCRIBIRTE' : 'NO PODRÁ ESCRIBIRTE NI PEDIRTE AMISTAD'}
              left={<Ionicons name={blocked ? 'lock-open-outline' : 'ban'} size={20} color="#e5484d" />}
              onPress={toggleBlock}
              last
            />
          </View>
        )}
      </Sheet>
    </>
  );
}
