// Sección plegable del perfil: título, un resumen y el contenido al abrirla.
import Ionicons from '@expo/vector-icons/Ionicons';
import { useState, type ReactNode } from 'react';
import { LayoutAnimation, Platform, Pressable, StyleSheet, UIManager, View } from 'react-native';

import { useStore } from '@/store/useStore';

import { Card, useIgnColors } from './ign';
import { ThemedText } from './ThemedText';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// Recuerda qué secciones dejaste abiertas mientras la app está abierta.
const remembered: Record<string, boolean> = {};

export function Collapsible({
  id,
  title,
  summary,
  icon,
  defaultOpen = false,
  children,
}: {
  id: string;
  title: string;
  summary?: string | null;
  icon?: keyof typeof Ionicons.glyphMap;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const c = useIgnColors();
  const skinId = useStore((s) => s.skin);
  const [open, setOpen] = useState(remembered[id] ?? defaultOpen);
  const toggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    remembered[id] = !open;
    setOpen(!open);
  };
  return (
    <Card padded={false} key={skinId}>
      <Pressable
        onPress={toggle}
        style={styles.head}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
      >
        {icon ? <Ionicons name={icon} size={22} color={c.text} /> : null}
        <View style={{ flex: 1 }}>
          <ThemedText variant="display" size={18}>
            {title}
          </ThemedText>
          {summary && !open ? (
            <ThemedText variant="muted" size={12} numberOfLines={1}>
              {summary}
            </ThemedText>
          ) : null}
        </View>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={22} color={c.muted} />
      </Pressable>
      {open ? <View style={styles.body}>{children}</View> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 18, paddingVertical: 16 },
  body: { paddingHorizontal: 18, paddingBottom: 18 },
});
