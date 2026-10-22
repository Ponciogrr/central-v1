import { Stack } from 'expo-router'
import { GuardaPapel } from '@/guarda'
import { useTema } from '@/theme'

// Painel administrativo: Stack (não barra de abas) — o menu da tela inicial
// leva a cada módulo. A área é restrita ao administrador (papel do servidor);
// o modo de demonstração NUNCA abre aqui.
export default function LayoutAdmin() {
  const { cores } = useTema()
  return (
    <GuardaPapel papel="admin" semDemo>
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: cores.fundo },
          headerTintColor: cores.texto,
          headerTitleStyle: { fontWeight: '700' },
          contentStyle: { backgroundColor: cores.fundo },
        }}
      >
        <Stack.Screen name="index" options={{ title: 'Administração' }} />
        <Stack.Screen name="usuarios" options={{ title: 'Usuários' }} />
        <Stack.Screen name="reativacoes" options={{ title: 'Reativações' }} />
        <Stack.Screen name="rotas" options={{ title: 'Rotas do dia' }} />
        <Stack.Screen name="operacao" options={{ title: 'Operação' }} />
        <Stack.Screen name="bloqueios" options={{ title: 'Acessos bloqueados' }} />
        <Stack.Screen name="auditoria" options={{ title: 'Auditoria' }} />
        <Stack.Screen name="configuracoes" options={{ title: 'Configurações' }} />
        <Stack.Screen name="perfil" options={{ title: 'Meu perfil' }} />
      </Stack>
    </GuardaPapel>
  )
}
