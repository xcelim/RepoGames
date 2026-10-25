import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useState } from 'react';

import { createGroup, useSocial } from '@/cloud/social';
import { DarkButton, IgnScreen, useIgnColors } from '@/components/ign';
import { PersonRow } from '@/components/PersonRow';
import { ThemedText } from '@/components/ThemedText';
import { TextField } from '@/components/ui';
import { useStore } from '@/store/useStore';
import { notify } from '@/utils/notify';
import { useShallow } from 'zustand/react/shallow';

// Crear un chat de grupo con tus amigos.
export default function NewGroupScreen() {
  const c = useIgnColors();
  const uid = useStore((s) => s.cloudUserId);
  const { friendships, profiles } = useSocial(
    useShallow((s) => ({ friendships: s.friendships, profiles: s.profiles })),
  );
  const friends = friendships
    .filter((f) => f.status === 'accepted')
    .map((f) => (f.requester === uid ? f.addressee : f.requester));
  const [name, setName] = useState('');
  const [picked, setPicked] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const create = async () => {
    setBusy(true);
    try {
      const id = await createGroup(name.trim() || 'Grupo', picked);
      router.replace(`/group/${id}`);
    } catch (e) {
      notify(e instanceof Error ? e.message : 'No se pudo crear');
    } finally {
      setBusy(false);
    }
  };

  return (
    <IgnScreen title="Nuevo grupo" close contentStyle={{ paddingHorizontal: 20, gap: 14 }}>
      <TextField
        label="Nombre del grupo"
        value={name}
        onChangeText={setName}
        placeholder="Los del soulslike, Noche de Mario Party…"
        maxLength={60}
      />
      <ThemedText variant="bold" size={14}>
        Amigos ({picked.length})
      </ThemedText>
      {friends.map((f) => {
        const on = picked.includes(f);
        return (
          <PersonRow
            key={f}
            profile={profiles[f]}
            onPress={() => setPicked((x) => (on ? x.filter((y) => y !== f) : [...x, f]))}
          >
            <Ionicons name={on ? 'checkmark-circle' : 'ellipse-outline'} size={26} color={on ? c.accent : c.muted} />
          </PersonRow>
        );
      })}
      <DarkButton
        label={busy ? 'Creando…' : 'Crear grupo'}
        icon="people"
        disabled={busy || !picked.length}
        onPress={create}
      />
    </IgnScreen>
  );
}
