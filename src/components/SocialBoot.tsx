import { useEffect, useRef } from 'react';

import { claimFinishCards } from '@/cloud/cards';
import { loadBlocks } from '@/cloud/moderation';
import { startSocial } from '@/cloud/social';
import { notify } from '@/utils/notify';
import { useLevel } from '@/hooks/useLevel';
import { todayIso } from '@/hooks/useMyGames';
import { useEarnedTrophies } from '@/hooks/useTrophies';
import { useSeasonEvent } from '@/hooks/useSeasonEvent';
import { checkDeals } from '@/utils/dealAlerts';
import { PLATINUM_TROPHY, TROPHIES } from '@/utils/trophies';

import { celebrate } from './Celebration';
import { useCurrentProfile, useStore } from '@/store/useStore';

// Arranca amigos y chat en tiempo real, y publica tu nivel para que lo vean tus amigos.
export function SocialBoot() {
  const uid = useStore((s) => s.cloudUserId);
  const profile = useCurrentProfile();
  const updateProfile = useStore((s) => s.updateProfile);
  const lv = useLevel();
  useEffect(() => (uid ? startSocial() : undefined), [uid]);
  useEffect(() => {
    if (uid) loadBlocks().catch(() => undefined);
  }, [uid]);
  // Cada juego que terminas te da su cromo.
  const finished = useStore(
    (s) =>
      Object.values(s.userGames).filter(
        (u) => u.profileId === s.currentProfileId && (u.status === 'beaten' || u.status === 'completed'),
      ).length,
  );
  useEffect(() => {
    if (!uid || !finished) return;
    const t = setTimeout(() => {
      claimFinishCards()
        .then((n) => n.length && notify(`¡Nuevo cromo${n.length > 1 ? 's' : ''} en tu álbum! 🃏`))
        .catch(() => undefined);
    }, 4000);
    return () => clearTimeout(t);
  }, [uid, finished]);
  useEffect(() => {
    if (!profile || lv.loading) return;
    if (profile.level !== lv.level || Math.abs((profile.xp ?? 0) - lv.xp) >= 100)
      updateProfile({ level: lv.level, xp: lv.xp });
  }, [profile, lv.level, lv.xp, lv.loading, updateProfile]);
  // Ofertas de tus deseados: una mirada al día, sin prisa.
  useEffect(() => {
    const t = setTimeout(() => {
      checkDeals(todayIso()).catch(() => undefined);
    }, 15_000);
    return () => clearTimeout(t);
  }, []);
  return (
    <>
      <TrophyWatcher />
      <EventWatcher />
    </>
  );
}

// Cuando completas el reto del evento de temporada, la insignia queda en tu perfil.
function EventWatcher() {
  const s = useSeasonEvent();
  const updateProfile = useStore((st) => st.updateProfile);
  const id = s.window?.id;
  useEffect(() => {
    if (!id || !s.done || s.claimed) return;
    const t = setTimeout(() => {
      const st = useStore.getState();
      const now = st.currentProfileId ? st.profiles[st.currentProfileId] : undefined;
      if (!now || now.events?.[id]) return;
      updateProfile({ events: { ...(now.events ?? {}), [id]: todayIso() } });
      celebrate({
        kind: 'platinum',
        heading: '¡EVENTO COMPLETADO!',
        title: `${s.window!.event.emoji} Insignia «${s.window!.event.badge}»`,
      });
    }, 2500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, s.done, s.claimed]);
  return null;
}

// Apunta los trofeos nuevos en tu perfil (se sincroniza) y te avisa.
function TrophyWatcher() {
  const profile = useCurrentProfile();
  const updateProfile = useStore((s) => s.updateProfile);
  const { earned } = useEarnedTrophies();
  const armed = useRef(false);
  // Espera a que la biblioteca y el perfil lleguen de la nube antes de comparar.
  useEffect(() => {
    const t = setTimeout(() => {
      armed.current = true;
    }, 6000);
    return () => clearTimeout(t);
  }, []);
  const key = [...earned].sort().join(',');
  useEffect(() => {
    if (!profile) return;
    const t = setTimeout(
      () => {
        if (!armed.current) return;
        // El perfil de ahora mismo (puede haber llegado de la nube mientras esperábamos).
        const st = useStore.getState();
        const now = st.currentProfileId ? st.profiles[st.currentProfileId] : undefined;
        if (!now) return;
        const had = now.trophies ?? {};
        const fresh = [...earned].filter((id) => !had[id]);
        if (!fresh.length) return;
        const day = todayIso();
        updateProfile({ trophies: { ...had, ...Object.fromEntries(fresh.map((id) => [id, day])) } });
        // La primera vez (o si llegan muchos de golpe) un solo aviso, no veinte.
        if (!now.trophies || fresh.length > 2) {
          notify(`🏆 ${fresh.length} trofeos de Saga Quest desbloqueados`);
          return;
        }
        if (fresh.includes(PLATINUM_TROPHY.id)) {
          celebrate({ kind: 'platinum', heading: '¡TROFEO PLATINO!', title: PLATINUM_TROPHY.name });
          return;
        }
        for (const id of fresh) {
          const t = TROPHIES.find((x) => x.id === id);
          if (t) notify(`🏆 Trofeo desbloqueado: ${t.name}`);
        }
      },
      armed.current ? 1500 : 6500,
    );
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, !!profile]);
  return null;
}
