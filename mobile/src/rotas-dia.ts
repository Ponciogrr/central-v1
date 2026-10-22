// Rotas do Dia — hooks com atualização por CONSULTA PERIÓDICA (mesmo padrão do
// resto do app: um único temporizador, só enquanto a tela está em foco).
//
// Motoboy: rotas abertas para aceitar + as rotas que ele já contratou.
// Solicitante: as rotas que ele publicou (com o estado de cada uma).

import { useFocusEffect } from 'expo-router'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  aceitarRotaDia as aceitarApi,
  cancelarRotaDia as cancelarApi,
  concluirRotaDia as concluirApi,
  criarRotaDia as criarApi,
  iniciarRotaDia as iniciarApi,
  listarMinhasRotasDia as listarPublicadasApi,
  listarMinhasRotasDiaContratadas as listarContratadasApi,
  listarRotasDiaDisponiveis as listarDisponiveisApi,
  mensagemDeErro,
  publicarRotaDia as publicarApi,
  type DadosRotaDia,
  type RotaDiaApi,
} from '@/api/cliente'
import { useSessao } from '@/sessao'

const INTERVALO_CONSULTA_MS = 5000

// ---------------------------------------------------------------------------
// Motoboy
// ---------------------------------------------------------------------------

export function useRotasDiaMotoboy() {
  const { token, usuario } = useSessao()
  const [disponiveis, setDisponiveis] = useState<RotaDiaApi[]>([])
  const [contratadas, setContratadas] = useState<RotaDiaApi[]>([])
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
        setDisponiveis([])
        setContratadas([])
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
      const [abertas, minhas] = await Promise.all([
        listarDisponiveisApi(atual),
        listarContratadasApi(atual),
      ])
      setDisponiveis(abertas)
      setContratadas(minhas)
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

  const aceitar = useCallback(
    async (id: string, valorProposto?: string | null): Promise<RotaDiaApi> => {
      const atual = tokenRef.current
      if (!atual) throw new Error('Sessão não iniciada.')
      const rota = await aceitarApi(atual, id, valorProposto ?? null)
      await consultar(true)
      return rota
    },
    [consultar],
  )

  const iniciar = useCallback(
    async (id: string): Promise<RotaDiaApi> => {
      const atual = tokenRef.current
      if (!atual) throw new Error('Sessão não iniciada.')
      const rota = await iniciarApi(atual, id)
      await consultar(true)
      return rota
    },
    [consultar],
  )

  const concluir = useCallback(
    async (id: string, valorFinal?: string | null): Promise<RotaDiaApi> => {
      const atual = tokenRef.current
      if (!atual) throw new Error('Sessão não iniciada.')
      const rota = await concluirApi(atual, id, valorFinal ?? null)
      await consultar(true)
      return rota
    },
    [consultar],
  )

  return {
    logado: Boolean(usuario),
    disponiveis,
    contratadas,
    carregando,
    erro,
    aceitar,
    iniciar,
    concluir,
    recarregar: () => consultar(false),
  }
}

// ---------------------------------------------------------------------------
// Solicitante (lojista / pessoa física)
// ---------------------------------------------------------------------------

export function useMinhasRotasDia() {
  const { token, usuario } = useSessao()
  const [rotas, setRotas] = useState<RotaDiaApi[]>([])
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
      setRotas(await listarPublicadasApi(atual))
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

  const criar = useCallback(
    async (dados: DadosRotaDia): Promise<RotaDiaApi> => {
      const atual = tokenRef.current
      if (!atual) throw new Error('Sessão não iniciada.')
      const rota = await criarApi(atual, dados)
      await consultar(true)
      return rota
    },
    [consultar],
  )

  const publicar = useCallback(
    async (id: string): Promise<RotaDiaApi> => {
      const atual = tokenRef.current
      if (!atual) throw new Error('Sessão não iniciada.')
      const rota = await publicarApi(atual, id)
      await consultar(true)
      return rota
    },
    [consultar],
  )

  const cancelar = useCallback(
    async (id: string, motivo: string): Promise<RotaDiaApi> => {
      const atual = tokenRef.current
      if (!atual) throw new Error('Sessão não iniciada.')
      const rota = await cancelarApi(atual, id, motivo)
      await consultar(true)
      return rota
    },
    [consultar],
  )

  return {
    logado: Boolean(usuario),
    rotas,
    carregando,
    erro,
    criar,
    publicar,
    cancelar,
    recarregar: () => consultar(false),
  }
}
