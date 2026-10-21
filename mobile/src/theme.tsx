import * as SecureStore from 'expo-secure-store'
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Platform, useColorScheme } from 'react-native'

export type Esquema = 'claro' | 'escuro'

// Identidade visual: preto, grafite e dourado (ações principais), com roxo
// discreto como destaque secundário. Temas claro e escuro.
export const PALETA = {
  claro: {
    fundo: '#F7F7F9',
    superficie: '#FFFFFF',
    superficie2: '#EFEFF3',
    texto: '#141417',
    textoSuave: '#5C5C66',
    borda: '#DDDDE3',
    acao: '#E8B400',
    acaoTexto: '#141417',
    acaoBorda: '#C89A00',
    destaque: '#6B4EFF',
    perigo: '#C0392B',
  },
  escuro: {
    fundo: '#000000',
    superficie: '#141417',
    superficie2: '#1F1F23',
    texto: '#F4F4F5',
    textoSuave: '#9A9AA5',
    borda: '#2A2A30',
    acao: '#F5C518',
    acaoTexto: '#141417',
    acaoBorda: '#F5C518',
    destaque: '#8B6CFF',
    perigo: '#E06A5A',
  },
} as const

export type Cores = (typeof PALETA)[Esquema]

// Números com dígitos de largura fixa (valores e métricas): no iOS usa
// 'tabular-nums'; na web usa uma fonte monoespaçada com o mesmo efeito.
export const NUMEROS: {
  fontFamily?: string
  fontVariant?: readonly ['tabular-nums']
} =
  Platform.OS === 'web'
    ? { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace' }
    : { fontVariant: ['tabular-nums'] }

interface ContextoTema {
  esquema: Esquema
  cores: Cores
  alternar: () => void
}

const TemaContext = createContext<ContextoTema | null>(null)

const CHAVE_TEMA = 'central_motoboys_tema'

async function lerTemaSalvo(): Promise<Esquema | null> {
  if (Platform.OS === 'web') {
    try {
      const salvo = globalThis.localStorage?.getItem(CHAVE_TEMA)
      return salvo === 'claro' || salvo === 'escuro' ? salvo : null
    } catch {
      return null
    }
  }
  try {
    const salvo = await SecureStore.getItemAsync(CHAVE_TEMA)
    return salvo === 'claro' || salvo === 'escuro' ? salvo : null
  } catch {
    return null
  }
}

async function gravarTema(esquema: Esquema): Promise<void> {
  if (Platform.OS === 'web') {
    try {
      globalThis.localStorage?.setItem(CHAVE_TEMA, esquema)
    } catch {
      // sem armazenamento no navegador: o tema vale só enquanto a tela durar
    }
    return
  }
  try {
    await SecureStore.setItemAsync(CHAVE_TEMA, esquema)
  } catch {
    // sem armazenamento no aparelho: o tema vale só enquanto o app durar
  }
}

export function TemaProvider({ children }: { children: ReactNode }) {
  const doSistema = useColorScheme()
  const [esquema, setEsquema] = useState<Esquema>('escuro')
  const [carregado, setCarregado] = useState(false)
  const [preferenciaSalva, setPreferenciaSalva] = useState(false)

  // O esquema inicial é fixo (mesmo valor no servidor e no cliente na web,
  // evitando erro de hydration). O armazenamento é lido só após a montagem.
  useEffect(() => {
    let ativo = true
    ;(async () => {
      const salvo = await lerTemaSalvo()
      if (!ativo) return
      if (salvo) {
        setEsquema(salvo)
        setPreferenciaSalva(true)
      }
      setCarregado(true)
    })()
    return () => {
      ativo = false
    }
  }, [])

  // Sem preferência salva pelo usuário, acompanha o tema do sistema.
  useEffect(() => {
    if (!carregado || preferenciaSalva) return
    if (doSistema === 'light') setEsquema('claro')
    else if (doSistema === 'dark') setEsquema('escuro')
  }, [carregado, preferenciaSalva, doSistema])

  const alternar = useCallback(() => {
    const proximo: Esquema = esquema === 'claro' ? 'escuro' : 'claro'
    setEsquema(proximo)
    setPreferenciaSalva(true)
    void gravarTema(proximo)
  }, [esquema])

  const valor = useMemo<ContextoTema>(
    () => ({ esquema, cores: PALETA[esquema], alternar }),
    [esquema, alternar],
  )

  return <TemaContext.Provider value={valor}>{children}</TemaContext.Provider>
}

export function useTema(): ContextoTema {
  const ctx = useContext(TemaContext)
  if (!ctx) throw new Error('useTema precisa estar dentro de TemaProvider')
  return ctx
}
