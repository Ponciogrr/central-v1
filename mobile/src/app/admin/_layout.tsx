import { Ionicons } from '@expo/vector-icons'
import { Tabs, router, type Href } from 'expo-router'
import { useEffect } from 'react'
import { View } from 'react-native'
import { useSessao } from '@/sessao'
import { estiloTabBar } from '@/tela'
import { useTema } from '@/theme'

// O papel vem SEMPRE do servidor (GET /auth/me via useSessao). Este layout só
// renderiza as abas do admin para sessão com papel 'admin'; qualquer outra
// situação é redirecionada (sem mostrar conteúdo administrativo).
const AREA_POR_PAPEL: Record<string, Href> = {
  motoboy: '/motoboy',
  lojista: '/lojista',
  pessoa_fisica: '/pessoa',
}

function RedirecionarSemPermissao() {
  const { usuario } = useSessao()
  useEffect(() => {
    const area = usuario ? AREA_POR_PAPEL[usuario.papel] : undefined
    router.replace(area ?? '/login')
  }, [usuario])
  return null
}

export default function LayoutAdmin() {
  const { cores } = useTema()
  const { usuario, carregando } = useSessao()

  if (carregando) {
    return <View style={{ flex: 1, backgroundColor: cores.fundo }} />
  }
  if (!usuario || usuario.papel !== 'admin') {
    return <RedirecionarSemPermissao />
  }

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
        name="usuarios"
        options={{
          title: 'Usuários',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="people-outline" color={color as string} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="reativacoes"
        options={{
          title: 'Reativações',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="refresh-outline" color={color as string} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="perfil"
        options={{
          title: 'Perfil',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-outline" color={color as string} size={size} />
          ),
        }}
      />
    </Tabs>
  )
}
