import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { searchUsers } from '@/cloud/social';
import { FriendButton } from '@/components/FriendButton';
import { IgnScreen, useIgnColors } from '@/components/ign';
import { PersonRow } from '@/components/PersonRow';
import { ThemedText } from '@/components/ThemedText';
import { TextField } from '@/components/ui';
import { useCurrentProfile } from '@/store/useStore';
import type { Profile } from '@/types';

// Buscar gente por @usuario o nombre y mandarle solicitud de amistad.
export default function FriendsSearchScreen() {
  const c = useIgnColors();
  const me = useCurrentProfile();
  const [q, setQ] = useState('');
  const [results, setResults] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (q.trim().replace(/^@/, '').length < 2) return;
    let alive = true;
    const t = setTimeout(() => {
      setLoading(true);
      setError('');
      searchUsers(q)
        .then((r) => alive && setResults(r))
        .catch((e: unknown) => alive && setError(e instanceof Error ? e.message : 'Error'))
        .finally(() => alive && setLoading(false));
    }, 300);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [q]);

  return (
    <IgnScreen narrow={860} title="Añadir amigos" back contentStyle={{ paddingHorizontal: 20, gap: 12 }}>
      <TextField
        value={q}
        onChangeText={setQ}
        placeholder="@usuario o nombre"
        autoFocus
        autoCapitalize="none"
        autoCorrect={false}
      />
      {me ? (
        <ThemedText variant="muted" size={12}>
          Tu usuario es @{me.username}. Pásaselo a tus amigos para que te encuentren.
        </ThemedText>
      ) : null}
      {loading ? <ActivityIndicator color={c.text} /> : null}
      {error ? (
        <ThemedText size={13} style={{ color: '#e5484d' }}>
          {error}
        </ThemedText>
      ) : null}
      <View>
        {(q.trim().replace(/^@/, '').length >= 2 ? results : []).map((p) => (
          <PersonRow key={p.id} profile={p}>
            <FriendButton id={p.id} />
          </PersonRow>
        ))}
      </View>
    </IgnScreen>
  );
}
