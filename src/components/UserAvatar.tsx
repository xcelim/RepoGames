// Foto de otro usuario con su marco de nivel (el que eligió, si lo tiene desbloqueado).
import { frameIndexForLevel } from '@/theme/frames';
import type { Profile } from '@/types';

import { AvatarFrame } from './AvatarFrame';
import { Avatar } from './ui';

export function frameOf(p: Pick<Profile, 'frame' | 'level'>): number | null {
  const best = frameIndexForLevel(p.level ?? 0);
  if (p.frame === null) return null;
  if (p.frame !== undefined && p.frame <= best) return p.frame;
  return best >= 0 ? best : null;
}

export function UserAvatar({ profile, size = 44, frame = true }: { profile: Profile; size?: number; frame?: boolean }) {
  const avatar = <Avatar name={profile.displayName} color={profile.avatarColor} uri={profile.photo} size={size} />;
  if (!frame) return avatar;
  return (
    <AvatarFrame frame={frameOf(profile)} size={size}>
      {avatar}
    </AvatarFrame>
  );
}
