import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router'
import { SessaoProvider } from '@/sessao'
import { TemaProvider, useTema } from '@/theme'

function Navegacao() {
  const { esquema, cores } = useTema()
  return (
    <ThemeProvider value={esquema === 'escuro' ? DarkTheme : DefaultTheme}>
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: cores.fundo },
          headerTintColor: cores.texto,
          headerTitleStyle: { fontWeight: '700' },
          contentStyle: { backgroundColor: cores.fundo },
        }}
      >
        <Stack.Screen name="admin" options={{ headerShown: false }} />
        <Stack.Screen name="motoboy" options={{ headerShown: false }} />
        <Stack.Screen name="lojista" options={{ headerShown: false }} />
        <Stack.Screen name="pessoa" options={{ headerShown: false }} />
      </Stack>
    </ThemeProvider>
  )
}

export default function Layout() {
  return (
    <TemaProvider>
      <SessaoProvider>
        <Navegacao />
      </SessaoProvider>
    </TemaProvider>
  )
}
