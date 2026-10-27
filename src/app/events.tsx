import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, Text, View } from 'react-native';

import { Card, IgnScreen, ProgressBar, useIgnColors } from '@/components/ign';
import { SeasonParticles } from '@/components/SeasonParticles';
import { ThemedText } from '@/components/ThemedText';
import { MONTHS_LONG } from '@/hooks/useMyGames';
import { useSeasonEvent } from '@/hooks/useSeasonEvent';
import { useCurrentProfile } from '@/store/useStore';
import { daysLeft, eventById, nextEvent, SEASON_EVENTS } from '@/utils/events';

const pretty = (iso: string) => `${Number(iso.slice(8, 10))} de ${MONTHS_LONG[Number(iso.slice(5, 7)) - 1]}`;

// Eventos de temporada: el reto de ahora, el próximo y tus insignias.
export default function EventsScreen() {
  const c = useIgnColors();
  const s = useSeasonEvent();
  const profile = useCurrentProfile();
  const next = nextEvent(s.today);
  const badges = Object.entries(profile?.events ?? {})
    .map(([id, when]) => ({ id, when, e: eventById(id) }))
    .filter((b) => b.e)
    .sort((a, b) => b.when.localeCompare(a.when));
  const w = s.window;

  return (
    <IgnScreen narrow={780} title="Eventos" back contentStyle={{ paddingHorizontal: 20, gap: 16 }}>
      {w ? (
        <LinearGradient colors={w.event.colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
          <SeasonParticles emojis={w.event.particles} count={16} height={300} />
          <Text style={{ fontSize: 64, lineHeight: 76, textAlign: 'center' }}>{w.event.emoji}</Text>
          <ThemedText variant="display" size={28} style={{ color: '#fff', textAlign: 'center' }}>
            {w.event.name}
          </ThemedText>
          <ThemedText size={13} style={{ color: '#ffffffcc', textAlign: 'center' }}>
            {`Del ${pretty(w.from)} al ${pretty(w.to)} · ${
              daysLeft(w, s.today) === 0 ? 'último día' : `quedan ${daysLeft(w, s.today)} días`
            }`}
          </ThemedText>
          <View style={styles.goal}>
            <ThemedText variant="bold" size={15} style={{ color: '#fff' }}>
              {w.event.goal}
            </ThemedText>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <ProgressBar pct={(s.progress / s.target) * 100} height={8} color="#fff" />
              </View>
              <ThemedText variant="bold" size={14} style={{ color: '#fff' }}>
                {`${s.progress}/${s.target}`}
              </ThemedText>
            </View>
            <ThemedText size={13} style={{ color: '#ffffffe0' }}>
              {s.claimed
                ? `¡Conseguiste la insignia «${w.event.badge}»! Solo la tienen quienes completaron este evento.`
                : `Recompensa: insignia de edición limitada «${w.event.badge}». Cuenta lo que hagas mientras dure el evento.`}
            </ThemedText>
          </View>
        </LinearGradient>
      ) : (
        <Card style={{ gap: 6 }}>
          <ThemedText variant="display" size={20}>
            Ahora no hay ningún evento
          </ThemedText>
          <ThemedText variant="muted" size={14}>
            Vuelve pronto: hay eventos repartidos por todo el año.
          </ThemedText>
        </Card>
      )}

      {next ? (
        <Card style={styles.row}>
          <Text style={{ fontSize: 30, lineHeight: 38 }}>{next.event.emoji}</Text>
          <View style={{ flex: 1 }}>
            <ThemedText variant="muted" size={12}>
              Próximo evento
            </ThemedText>
            <ThemedText variant="bold" size={15}>
              {next.event.name}
            </ThemedText>
            <ThemedText variant="muted" size={12}>
              {`Empieza el ${pretty(next.from)}`}
            </ThemedText>
          </View>
        </Card>
      ) : null}

      <ThemedText variant="bold" size={15}>
        Tus insignias de temporada
      </ThemedText>
      {badges.length ? (
        <View style={styles.badges}>
          {badges.map((b) => (
            <View
              key={b.id}
              style={[styles.badge, { backgroundColor: c.card, borderColor: b.e!.colors[0], borderRadius: c.radius }]}
            >
              <Text style={{ fontSize: 30, lineHeight: 38 }}>{b.e!.emoji}</Text>
              <ThemedText variant="bold" size={12} style={{ textAlign: 'center' }} numberOfLines={2}>
                {b.e!.badge}
              </ThemedText>
              <ThemedText variant="muted" size={11}>
                {b.id.slice(-4)}
              </ThemedText>
            </View>
          ))}
        </View>
      ) : (
        <Card>
          <ThemedText variant="muted" size={14}>
            Aún no tienes ninguna. Completa el reto de un evento para estrenar tu colección.
          </ThemedText>
        </Card>
      )}

      <ThemedText variant="bold" size={15}>
        Calendario
      </ThemedText>
      <Card style={{ gap: 12 }}>
        {SEASON_EVENTS.map((e) => (
          <View key={e.key} style={styles.row}>
            <Text style={{ fontSize: 22, lineHeight: 28 }}>{e.emoji}</Text>
            <View style={{ flex: 1 }}>
              <ThemedText variant="bold" size={14}>
                {e.name}
              </ThemedText>
              <ThemedText variant="muted" size={12}>
                {`${pretty(`2000-${e.start}`)} – ${pretty(`2000-${e.end}`)} · ${e.goal}`}
              </ThemedText>
            </View>
            {w?.event.key === e.key ? <Ionicons name="radio-button-on" size={16} color={e.colors[0]} /> : null}
          </View>
        ))}
      </Card>
    </IgnScreen>
  );
}

const styles = StyleSheet.create({
  hero: { borderRadius: 22, padding: 20, gap: 8, overflow: 'hidden' },
  goal: { marginTop: 10, gap: 10, backgroundColor: '#00000033', borderRadius: 14, padding: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  badge: { width: 104, alignItems: 'center', padding: 10, gap: 4, borderWidth: 2 },
});
