import { useEffect } from 'react';

import { startSocial } from '@/cloud/social';
import { useLevel } from '@/hooks/useLevel';
import { useCurrentProfile, useStore } from '@/store/useStore';

// Arranca amigos y chat en tiempo real, y publica tu nivel para que lo vean tus amigos.
export function SocialBoot() {
  const uid = useStore((s) => s.cloudUserId);
  const profile = useCurrentProfile();
  const updateProfile = useStore((s) => s.updateProfile);
  const lv = useLevel();
  useEffect(() => (uid ? startSocial() : undefined), [uid]);
  useEffect(() => {
    if (!profile || lv.loading) return;
    if (profile.level !== lv.level || Math.abs((profile.xp ?? 0) - lv.xp) >= 100)
      updateProfile({ level: lv.level, xp: lv.xp });
  }, [profile, lv.level, lv.xp, lv.loading, updateProfile]);
  return null;
}
