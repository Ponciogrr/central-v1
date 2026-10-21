import { Stack } from 'expo-router'
import { useTema } from '@/theme'

export default function LayoutPessoa() {
  const { cores } = useTema()
  return (
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
    </Stack>
  )
}
