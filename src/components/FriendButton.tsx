import { useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { sendFriendRequest, useFriendState } from '@/cloud/social';
import { notify } from '@/utils/notify';

import { useIgnColors } from './ign';
import { ThemedText } from './ThemedText';

export function FriendButton({ id }: { id: string }) {
  const c = useIgnColors();
  const state = useFriendState(id);
  const [busy, setBusy] = useState(false);
  if (state === 'me') return null;
  const label = { none: 'Añadir', sent: 'Enviada', received: 'Aceptar', friends: 'Amigos' }[state];
  const active = state === 'none' || state === 'received';
  return (
    <Pressable
      disabled={!active || busy}
      onPress={async () => {
        setBusy(true);
        try {
          await sendFriendRequest(id);
          notify(state === 'received' ? 'Ahora sois amigos' : 'Solicitud enviada');
        } catch (e) {
          notify(e instanceof Error ? e.message : 'No se pudo');
        } finally {
          setBusy(false);
        }
      }}
      style={[styles.btn, { backgroundColor: active ? c.inverseBg : c.soft, opacity: busy ? 0.6 : 1 }]}
    >
      <ThemedText variant="bold" size={12} style={{ color: active ? c.inverseText : c.muted }}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 16 },
});
