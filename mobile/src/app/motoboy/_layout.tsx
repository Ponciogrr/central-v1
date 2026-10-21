import { Ionicons } from '@expo/vector-icons'
import { Tabs } from 'expo-router'
import { useTema } from '@/theme'
import { estiloTabBar } from '@/tela'

export default function LayoutMotoboy() {
  const { cores } = useTema()
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: cores.fundo },
        headerTintColor: cores.texto,
        headerTitleStyle: { fontSize: 16, fontWeight: '700' },
        tabBarLabelStyle: { fontSize: 12, fontWeight: '700' },
        sceneStyle: { backgroundColor: cores.fundo },
        tabBarStyle: estiloTabBar(cores),
        tabBarActiveTintColor: cores.acao,
        tabBarInactiveTintColor: cores.textoSuave,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Início',
          tabBarIcon: ({ color, size }) => <Ionicons name="home-outline" color={color as string} size={size} />,
        }}
      />
      <Tabs.Screen
        name="rotas"
        options={{
          title: 'Rotas',
          tabBarIcon: ({ color, size }) => <Ionicons name="navigate-outline" color={color as string} size={size} />,
        }}
      />
      <Tabs.Screen
        name="historico"
        options={{
          title: 'Histórico',
          tabBarIcon: ({ color, size }) => <Ionicons name="time-outline" color={color as string} size={size} />,
        }}
      />
      <Tabs.Screen
        name="perfil"
        options={{
          title: 'Perfil',
          tabBarIcon: ({ color, size }) => <Ionicons name="person-outline" color={color as string} size={size} />,
        }}
      />
    </Tabs>
  )
}
