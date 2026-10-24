import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { sendMessage, useSocial } from '@/cloud/social';
import { GameCover } from '@/components/games';
import { DarkButton, IgnScreen, useIgnColors } from '@/components/ign';
import { PersonRow } from '@/components/PersonRow';
import { ThemedText } from '@/components/ThemedText';
import { TextField } from '@/components/ui';
import { useGame } from '@/hooks/useLists';
import { useStore } from '@/store/useStore';
import { notify } from '@/utils/notify';

// Recomendar un juego a uno o varios amigos (les llega al chat).
export default function ShareGameScreen() {
  const { gameId } = useLocalSearchParams<{ gameId: string }>();
  const id = decodeURIComponent(gameId ?? '');
  const c = useIgnColors();
  const game = useGame(id);
  const uid = useStore((s) => s.cloudUserId);
  const { friendships, profiles } = useSocial();
  const friends = friendships
    .filter((f) => f.status === 'accepted')
    .map((f) => (f.requester === uid ? f.addressee : f.requester));
  const [picked, setPicked] = useState<string[]>([]);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const send = async () => {
    setBusy(true);
    try {
      for (const f of picked) await sendMessage(f, note, id);
      notify(picked.length === 1 ? 'Recomendación enviada' : `Enviado a ${picked.length} amigos`);
      router.back();
    } catch (e) {
      notify(e instanceof Error ? e.message : 'No se pudo enviar');
    } finally {
      setBusy(false);
    }
  };

  return (
    <IgnScreen title="Recomendar" close contentStyle={{ paddingHorizontal: 20, gap: 14 }}>
      {game ? (
        <View style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}>
          <GameCover game={game} width={60} radius={6} />
          <ThemedText variant="display" size={18} style={{ flex: 1 }}>
            {game.title}
          </ThemedText>
        </View>
      ) : null}
      <TextField
        value={note}
        onChangeText={setNote}
        placeholder="¿Por qué se lo recomiendas? (opcional)"
        multiline
        maxLength={500}
      />
      {friends.length === 0 ? (
        <ThemedText variant="muted" size={14}>
          Aún no tienes amigos. Búscalos en la pestaña Amigos.
        </ThemedText>
      ) : (
        <View>
          {friends.map((f) => {
            const on = picked.includes(f);
            return (
              <PersonRow
                key={f}
                profile={profiles[f]}
                onPress={() => setPicked((p) => (on ? p.filter((x) => x !== f) : [...p, f]))}
              >
                <Pressable onPress={() => setPicked((p) => (on ? p.filter((x) => x !== f) : [...p, f]))}>
                  <Ionicons
                    name={on ? 'checkmark-circle' : 'ellipse-outline'}
                    size={26}
                    color={on ? c.accent : c.muted}
                  />
                </Pressable>
              </PersonRow>
            );
          })}
        </View>
      )}
      <DarkButton
        label={busy ? 'Enviando…' : picked.length ? `Enviar a ${picked.length}` : 'Elige amigos'}
        icon="paper-plane-outline"
        disabled={!picked.length || busy}
        onPress={send}
      />
    </IgnScreen>
  );
}
