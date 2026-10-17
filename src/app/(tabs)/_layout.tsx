import Ionicons from '@expo/vector-icons/Ionicons';
import { Redirect } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';

import type { IconName } from '@/components/ui';
import { useCurrentProfile } from '@/store/useStore';
import { useSkin } from '@/theme/useSkin';

const TABS: { name: string; title: string; icon: IconName; iconActive: IconName }[] = [
  { name: 'index', title: 'Inicio', icon: 'compass-outline', iconActive: 'compass' },
  { name: 'library', title: 'Biblioteca', icon: 'game-controller-outline', iconActive: 'game-controller' },
  { name: 'lists', title: 'Listas', icon: 'folder-outline', iconActive: 'folder' },
  { name: 'profile', title: 'Perfil', icon: 'person-outline', iconActive: 'person' },
];

export default function TabsLayout() {
  const skin = useSkin();
  const profile = useCurrentProfile();
  if (!profile) return <Redirect href="/welcome" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: skin.colors.bg },
        tabBarActiveTintColor: skin.colors.accent,
        tabBarInactiveTintColor: skin.colors.muted,
        tabBarStyle: {
          backgroundColor: skin.colors.panel,
          borderTopColor: skin.colors.line,
        },
        tabBarLabelStyle: { fontFamily: skin.fonts.bodyBold, fontSize: 11 },
        animation: 'fade',
      }}
    >
      {TABS.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: tab.title,
            tabBarIcon: ({ focused, color, size }) => (
              <Ionicons name={focused ? tab.iconActive : tab.icon} size={size} color={color} />
            ),
          }}
        />
      ))}
    </Tabs>
  );
}
