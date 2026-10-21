// Camada de sessão do app.
//
// Guarda APENAS o token. O papel do usuário NUNCA é salvo localmente: ele é
// sempre obtido do servidor (GET /auth/me). O código de acesso não é guardado.
//
// Armazenamento: nativo (iOS/Android) usa expo-secure-store (Keychain/Keystore);
// na web de desenvolvimento usa localStorage (protegido apenas pela origem —
// limitação declarada: não é seguro contra XSS e não serve para produção).

import * as SecureStore from 'expo-secure-store'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { Platform } from 'react-native'
import { buscarMeuUsuario, login as loginApi, type UsuarioApi } from '@/api/cliente'

const CHAVE_TOKEN = 'central_motoboys_token'

async function lerToken(): Promise<string | null> {
  if (Platform.OS === 'web') {
    try {
      return globalThis.localStorage?.getItem(CHAVE_TOKEN) ?? null
    } catch {
      return null
    }
  }
  try {
    return await SecureStore.getItemAsync(CHAVE_TOKEN)
  } catch {
    return null
  }
}

async function gravarToken(token: string): Promise<void> {
  if (Platform.OS === 'web') {
    try {
      globalThis.localStorage?.setItem(CHAVE_TOKEN, token)
    } catch {
      // sem armazenamento no navegador: a sessão vale só enquanto a tela durar
    }
    return
  }
  await SecureStore.setItemAsync(CHAVE_TOKEN, token)
}

async function apagarToken(): Promise<void> {
  if (Platform.OS === 'web') {
    try {
      globalThis.localStorage?.removeItem(CHAVE_TOKEN)
    } catch {
      // nada a fazer
    }
    return
  }
  try {
    await SecureStore.deleteItemAsync(CHAVE_TOKEN)
  } catch {
    // nada a fazer
  }
}

export interface ResultadoEntrada {
  usuario: UsuarioApi
  guardado: boolean
}

interface ContextoSessao {
  usuario: UsuarioApi | null
  // Token da sessão, usado nas chamadas autenticadas (ex.: entregas).
  // Fica só em memória durante a execução; a persistência é feita por ler/gravarToken.
  token: string | null
  carregando: boolean
  entrar: (codigo: string) => Promise<ResultadoEntrada>
  sair: () => Promise<void>
}

const SessaoContext = createContext<ContextoSessao | null>(null)

export function SessaoProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<UsuarioApi | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [carregando, setCarregando] = useState(true)

  // Ao abrir o app: se houver token, confere no servidor (GET /auth/me).
  // Token inválido/expirado/rejeitado é descartado.
  useEffect(() => {
    let ativo = true
    ;(async () => {
      const guardado = await lerToken()
      if (!guardado) {
        if (ativo) setCarregando(false)
        return
      }
      try {
        const atual = await buscarMeuUsuario(guardado)
        if (ativo) {
          setUsuario(atual)
          setToken(guardado)
        }
      } catch {
        await apagarToken()
        if (ativo) {
          setUsuario(null)
          setToken(null)
        }
      } finally {
        if (ativo) setCarregando(false)
      }
    })()
    return () => {
      ativo = false
    }
  }, [])

  const entrar = useCallback(async (codigo: string): Promise<ResultadoEntrada> => {
    const dados = await loginApi(codigo)
    // O papel vem do servidor; a sessão é persistida para todos os papéis
    // (admin incluído — o painel admin existe em /admin, na web e no app).
    await gravarToken(dados.token)
    setUsuario(dados.usuario)
    setToken(dados.token)
    return { usuario: dados.usuario, guardado: true }
  }, [])

  const sair = useCallback(async () => {
    await apagarToken()
    setUsuario(null)
    setToken(null)
  }, [])

  const valor = useMemo<ContextoSessao>(
    () => ({ usuario, token, carregando, entrar, sair }),
    [usuario, token, carregando, entrar, sair],
  )

  return <SessaoContext.Provider value={valor}>{children}</SessaoContext.Provider>
}

export function useSessao(): ContextoSessao {
  const ctx = useContext(SessaoContext)
  if (!ctx) throw new Error('useSessao precisa estar dentro de SessaoProvider')
  return ctx
}
