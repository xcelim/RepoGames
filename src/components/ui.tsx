import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps, ReactNode } from 'react';
import {
  Pressable,
  StyleSheet,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';

import { useSkin } from '@/theme/useSkin';

import { ThemedText } from './ThemedText';

export type IconName = ComponentProps<typeof Ionicons>['name'];

// ---------- Botón con icono ----------
type IconButtonProps = {
  icon: IconName;
  onPress: () => void;
  label: string; // para lectores de pantalla
  size?: number;
  color?: string;
  filled?: boolean;
  disabled?: boolean;
};

export function IconButton({
  icon,
  onPress,
  label,
  size = 22,
  color,
  filled,
  disabled,
}: IconButtonProps) {
  const skin = useSkin();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.iconButton,
        {
          backgroundColor: filled ? skin.colors.panel2 : 'transparent',
          borderRadius: Math.max(8, skin.radius / 2),
          opacity: disabled ? 0.35 : pressed ? 0.6 : 1,
        },
      ]}
    >
      <Ionicons name={icon} size={size} color={color ?? skin.colors.text} />
    </Pressable>
  );
}

// ---------- Chip (filtro / opción) ----------
type ChipProps = {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  icon?: IconName;
  color?: string;
  count?: number;
};

export function Chip({ label, selected, onPress, icon, color, count }: ChipProps) {
  const skin = useSkin();
  const tint = color ?? skin.colors.accent;
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      style={({ pressed }) => [
        styles.chip,
        {
          borderRadius: Math.min(skin.radius, 999) > 0 ? 999 : 0,
          borderColor: selected ? tint : skin.colors.line,
          backgroundColor: selected ? tint : skin.colors.panel,
          opacity: pressed ? 0.75 : 1,
        },
      ]}
    >
      {icon ? (
        <Ionicons name={icon} size={14} color={selected ? skin.colors.onAccent : tint} />
      ) : null}
      <ThemedText
        variant="bold"
        size={13}
        style={{ color: selected ? skin.colors.onAccent : skin.colors.text }}
      >
        {label}
      </ThemedText>
      {count !== undefined ? (
        <ThemedText
          size={12}
          style={{ color: selected ? skin.colors.onAccent : skin.colors.muted }}
        >
          {count}
        </ThemedText>
      ) : null}
    </Pressable>
  );
}

// ---------- Campo de texto ----------
type TextFieldProps = TextInputProps & { label?: string };

export function TextField({ label, style, ...rest }: TextFieldProps) {
  const skin = useSkin();
  return (
    <View style={styles.field}>
      {label ? (
        <ThemedText variant="muted" size={12}>
          {label}
        </ThemedText>
      ) : null}
      <TextInput
        placeholderTextColor={skin.colors.muted}
        {...rest}
        style={[
          styles.input,
          {
            color: skin.colors.text,
            backgroundColor: skin.colors.panel,
            borderColor: skin.colors.line,
            borderRadius: Math.min(skin.radius, 14),
            fontFamily: skin.fonts.body,
          },
          rest.multiline ? styles.multiline : null,
          style,
        ]}
      />
    </View>
  );
}

// ---------- Estado vacío ----------
export function EmptyState({
  icon,
  title,
  text,
  children,
}: {
  icon: IconName;
  title: string;
  text?: string;
  children?: ReactNode;
}) {
  const skin = useSkin();
  return (
    <View style={styles.empty}>
      <Ionicons name={icon} size={44} color={skin.colors.muted} />
      <ThemedText variant="display" size={20} style={styles.center}>
        {title}
      </ThemedText>
      {text ? (
        <ThemedText variant="muted" style={styles.center}>
          {text}
        </ThemedText>
      ) : null}
      {children}
    </View>
  );
}

// ---------- Avatar ----------
export function Avatar({ name, color, size = 44 }: { name: string; color: string; size?: number }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase())
    .join('');
  return (
    <View
      style={[
        styles.avatar,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: color },
      ]}
    >
      <ThemedText variant="bold" size={size * 0.38} style={styles.avatarText}>
        {initials || '?'}
      </ThemedText>
    </View>
  );
}

// ---------- Cifra destacada ----------
export function StatTile({
  value,
  label,
  style,
}: {
  value: string;
  label: string;
  style?: StyleProp<ViewStyle>;
}) {
  const skin = useSkin();
  return (
    <View
      style={[
        styles.stat,
        {
          backgroundColor: skin.colors.panel,
          borderColor: skin.colors.line,
          borderWidth: skin.borderWidth,
          borderRadius: skin.radius,
        },
        style,
      ]}
    >
      <ThemedText variant="display" size={24} style={{ color: skin.colors.accent }}>
        {value}
      </ThemedText>
      <ThemedText variant="muted" size={12}>
        {label}
      </ThemedText>
    </View>
  );
}

// ---------- Panel ----------
export function Panel({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const skin = useSkin();
  return (
    <View
      style={[
        styles.panel,
        {
          backgroundColor: skin.colors.panel,
          borderColor: skin.colors.line,
          borderWidth: skin.borderWidth,
          borderRadius: skin.radius,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

// ---------- Fila de ajustes / menú ----------
export function MenuRow({
  icon,
  label,
  detail,
  onPress,
  danger,
}: {
  icon: IconName;
  label: string;
  detail?: string;
  onPress: () => void;
  danger?: boolean;
}) {
  const skin = useSkin();
  const color = danger ? '#e5484d' : skin.colors.text;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.menuRow, { opacity: pressed ? 0.6 : 1 }]}
    >
      <Ionicons name={icon} size={20} color={danger ? color : skin.colors.accent} />
      <ThemedText variant="bold" style={[styles.flex, { color }]}>
        {label}
      </ThemedText>
      {detail ? (
        <ThemedText variant="muted" size={13}>
          {detail}
        </ThemedText>
      ) : null}
      <Ionicons name="chevron-forward" size={18} color={skin.colors.muted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  iconButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  field: { gap: 6 },
  input: { borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15 },
  multiline: { minHeight: 96, textAlignVertical: 'top' },
  empty: { alignItems: 'center', gap: 10, paddingVertical: 40, paddingHorizontal: 24 },
  center: { textAlign: 'center' },
  avatar: { alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#ffffff' },
  stat: { flex: 1, padding: 12, gap: 2, minWidth: 90 },
  panel: { padding: 16, gap: 12 },
  menuRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  flex: { flex: 1 },
});
