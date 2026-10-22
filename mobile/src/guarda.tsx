// Guarda de sessão e de PAPEL das áreas do app.
//
// Cada área (motoboy, lojista, pessoa física, admin) só abre para o perfil
// correspondente. O papel vem SEMPRE do servidor (GET /auth/me). Sem sessão,
// o app vai para o login. Com o papel errado, o app vai para a área certa.
//
// No modo de demonstração (apenas em desenvolvimento) as áreas podem abrir sem
// sessão, para testar as telas. A área ADMINISTRATIVA nunca aceita o modo de
// demonstração.

import { router, type Href } from 'expo-router'
import { useEffect, type ReactNode } from 'react'
import { View } from 'react-native'
import type { Papel } from '@/api/cliente'
import { MODO_DEMO } from '@/demo'
import { useSessao } from '@/sessao'
import { useTema } from '@/theme'

export const AREA_POR_PAPEL: Record<string, Href> = {
  admin: '/admin',
  motoboy: '/motoboy',
  lojista: '/lojista',
  pessoa_fisica: '/pessoa',
}

interface Opcoes {
  // Só a área administrativa usa isto (o modo de demonstração não vale lá).
  semDemo?: boolean
}

// Redireciona (sem mostrar o conteúdo protegido) quando não há sessão ou
// quando o papel não bate. Devolve `true` quando a área pode ser exibida.
export function useGuardaPapel(papel: Papel, opcoes: Opcoes = {}): boolean {
  const { usuario, carregando } = useSessao()
  const demoLiberado = MODO_DEMO && !opcoes.semDemo
  const permitido = demoLiberado || usuario?.papel === papel

  useEffect(() => {
    if (carregando || permitido) return
    router.replace(usuario ? AREA_POR_PAPEL[usuario.papel] : '/login')
  }, [carregando, permitido, usuario])

  return !carregando && permitido
}

// Versão em componente: enquanto a sessão é conferida, mostra só o fundo.
export function GuardaPapel({
  papel,
  semDemo = false,
  children,
}: {
  papel: Papel
  semDemo?: boolean
  children: ReactNode
}) {
  const { cores } = useTema()
  const permitido = useGuardaPapel(papel, { semDemo })
  if (!permitido) {
    return <View style={{ flex: 1, backgroundColor: cores.fundo }} />
  }
  return <>{children}</>
}
