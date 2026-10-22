import { Stack } from 'expo-router'
import { GuardaPapel } from '@/guarda'
import { useTema } from '@/theme'

export default function LayoutPessoa() {
  const { cores } = useTema()
  return (
    <GuardaPapel papel="pessoa_fisica">
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: cores.fundo },
          headerTintColor: cores.texto,
          headerTitleStyle: { fontWeight: '700' },
          contentStyle: { backgroundColor: cores.fundo },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="solicitar" options={{ title: 'Solicitar entrega' }} />
        <Stack.Screen name="rotas-do-dia" options={{ title: 'Rotas do dia' }} />
      </Stack>
    </GuardaPapel>
  )
}
