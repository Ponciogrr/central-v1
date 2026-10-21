// Rotas e encaixes (regras 10–14): hooks com atualização por CONSULTA PERIÓDICA.
//
// Mesmo padrão do painel do motoboy: um único temporizador, só enquanto a tela
// está em foco; nenhuma consulta em segundo plano. Sem WebSocket/push.
// Identidade sempre vem do token; o servidor filtra o que cada perfil pode ver.

import { useFocusEffect } from 'expo-router'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  aceitarContraproposta as aceitarContrapropostaApi,
  atualizarRota,
  cancelarEncaixe,
  contraproporEncaixe as contraproporApi,
  criarRota,
  encerrarRota as encerrarRotaApi,
  listarEncaixesRecebidos,
  listarMeusEncaixes,
  listarMinhasRotas,
  listarRotasDisponiveis,
  mensagemDeErro,
  recusarContraproposta as recusarContrapropostaApi,
  responderEncaixe,
  solicitarEncaixe,
  type DadosEncaixe,
  type DadosRota,
  type EncaixeMotoboyApi,
  type EncaixeSolicitanteApi,
  type RotaApi,
} from '@/api/cliente'
import { useSessao } from '@/sessao'

const INTERVALO_CONSULTA_MS = 5000

// ---------------------------------------------------------------------------
// Motoboy — rotas próprias e encaixes recebidos
// ---------------------------------------------------------------------------

export function useRotasMotoboy() {
  const { token, usuario } = useSessao()
  const [rotas, setRotas] = useState<RotaApi[]>([])
  const [encaixes, setEncaixes] = useState<EncaixeMotoboyApi[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const tokenRef = useRef<string | null>(token)
  tokenRef.current = token

  const desligarTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const consultar = useCallback(async (silencioso: boolean) => {
    const atual = tokenRef.current
    if (!atual) {
      if (!silencioso) {
        setRotas([])
        setEncaixes([])
        setErro('')
        setCarregando(false)
      }
      return
    }
    if (!silencioso) {
      setErro('')
      setCarregando(true)
    }
    try {
      const [listaRotas, listaEncaixes] = await Promise.all([
        listarMinhasRotas(atual),
        listarEncaixesRecebidos(atual),
      ])
      setRotas(listaRotas)
      setEncaixes(listaEncaixes)
    } catch (falha) {
      if (!silencioso) setErro(mensagemDeErro(falha))
    } finally {
      if (!silencioso) setCarregando(false)
    }
  }, [])

  const ligarTimer = useCallback(() => {
    if (timerRef.current !== null) return
    timerRef.current = setInterval(() => {
      void consultar(true)
    }, INTERVALO_CONSULTA_MS)
  }, [consultar])

  useFocusEffect(
    useCallback(() => {
      void consultar(false)
      ligarTimer()
      return () => desligarTimer()
    }, [consultar, ligarTimer, desligarTimer]),
  )

  useEffect(() => desligarTimer, [desligarTimer])

  const publicar = useCallback(
    async (dados: DadosRota): Promise<RotaApi> => {
      const atual = tokenRef.current
      if (!atual) throw new Error('Sessão não iniciada.')
      const rota = await criarRota(atual, dados)
      await consultar(true)
      return rota
    },
    [consultar],
  )

  const editar = useCallback(
    async (id: string, dados: DadosRota): Promise<RotaApi> => {
      const atual = tokenRef.current
      if (!atual) throw new Error('Sessão não iniciada.')
      const rota = await atualizarRota(atual, id, dados)
      await consultar(true)
      return rota
    },
    [consultar],
  )

  // Encerrar/cancelar: o servidor cancela os encaixes pendentes da rota.
  const encerrar = useCallback(
    async (id: string, acao: 'close' | 'cancel'): Promise<RotaApi> => {
      const atual = tokenRef.current
      if (!atual) throw new Error('Sessão não iniciada.')
      const rota = await encerrarRotaApi(atual, id, acao)
      await consultar(true)
      return rota
    },
    [consultar],
  )

  const responder = useCallback(
    async (id: string, acao: 'accept' | 'decline'): Promise<void> => {
      const atual = tokenRef.current
      if (!atual) throw new Error('Sessão não iniciada.')
      await responderEncaixe(atual, id, acao)
      await consultar(true)
    },
    [consultar],
  )

  // Contraproposta do motoboy: manda outro valor e espera a decisão do cliente.
  const contrapropor = useCallback(
    async (id: string, valor: number): Promise<void> => {
      const atual = tokenRef.current
      if (!atual) throw new Error('Sessão não iniciada.')
      await contraproporApi(atual, id, valor)
      await consultar(true)
    },
    [consultar],
  )

  return {
    logado: Boolean(usuario),
    rotas,
    encaixes,
    carregando,
    erro,
    publicar,
    editar,
    encerrar,
    responder,
    contrapropor,
    recarregar: () => consultar(false),
  }
}

// ---------------------------------------------------------------------------
// Lojista / pessoa física — rotas disponíveis e meus encaixes
// ---------------------------------------------------------------------------

export function useRotasDisponiveis() {
  const { token, usuario } = useSessao()
  const [rotas, setRotas] = useState<RotaApi[]>([])
  const [encaixes, setEncaixes] = useState<EncaixeSolicitanteApi[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const tokenRef = useRef<string | null>(token)
  tokenRef.current = token

  const desligarTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const consultar = useCallback(async (silencioso: boolean) => {
    const atual = tokenRef.current
    if (!atual) {
      if (!silencioso) {
        setRotas([])
        setEncaixes([])
        setErro('')
        setCarregando(false)
      }
      return
    }
    if (!silencioso) {
      setErro('')
      setCarregando(true)
    }
    try {
      const [listaRotas, meusEncaixes] = await Promise.all([
        listarRotasDisponiveis(atual),
        listarMeusEncaixes(atual),
      ])
      setRotas(listaRotas)
      setEncaixes(meusEncaixes)
    } catch (falha) {
      if (!silencioso) setErro(mensagemDeErro(falha))
    } finally {
      if (!silencioso) setCarregando(false)
    }
  }, [])

  const ligarTimer = useCallback(() => {
    if (timerRef.current !== null) return
    timerRef.current = setInterval(() => {
      void consultar(true)
    }, INTERVALO_CONSULTA_MS)
  }, [consultar])

  useFocusEffect(
    useCallback(() => {
      void consultar(false)
      ligarTimer()
      return () => desligarTimer()
    }, [consultar, ligarTimer, desligarTimer]),
  )

  useEffect(() => desligarTimer, [desligarTimer])

  const solicitar = useCallback(
    async (dados: DadosEncaixe): Promise<EncaixeSolicitanteApi> => {
      const atual = tokenRef.current
      if (!atual) throw new Error('Sessão não iniciada.')
      const encaixe = await solicitarEncaixe(atual, dados)
      await consultar(true)
      return encaixe
    },
    [consultar],
  )

  // Cancelamento pelo solicitante só é permitido ANTES do aceite (regra 11).
  const cancelar = useCallback(
    async (id: string): Promise<void> => {
      const atual = tokenRef.current
      if (!atual) throw new Error('Sessão não iniciada.')
      await cancelarEncaixe(atual, id)
      await consultar(true)
    },
    [consultar],
  )

  // Decisão do cliente sobre a CONTRAPROPOSTA do motoboy (aceitar → 'aceito';
  // recusar → 'recusado'). Só existe quando há contraproposta pendente.
  const decidirContraproposta = useCallback(
    async (id: string, decisao: 'aceitar' | 'recusar'): Promise<void> => {
      const atual = tokenRef.current
      if (!atual) throw new Error('Sessão não iniciada.')
      if (decisao === 'aceitar') await aceitarContrapropostaApi(atual, id)
      else await recusarContrapropostaApi(atual, id)
      await consultar(true)
    },
    [consultar],
  )

  return {
    logado: Boolean(usuario),
    rotas,
    encaixes,
    carregando,
    erro,
    solicitar,
    cancelar,
    decidirContraproposta,
    recarregar: () => consultar(false),
  }
}
