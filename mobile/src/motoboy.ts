// Painel do motoboy (M4.3): disponibilidade, ofertas e entrega ativa.
//
// Atualização por CONSULTA PERIÓDICA (a cada 5 s) enquanto a tela está em foco
// E o motoboy está online. Não há WebSocket nem notificação em segundo plano
// nesta etapa: o estado só atualiza com o app aberto e consultando.
//
// Regras de recurso: no máximo UM temporizador; nada é consultado quando a tela
// sai de foco ou o motoboy fica offline; a lista vazia não recarrega a tela.

import { useFocusEffect } from 'expo-router'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  aceitarOferta as aceitarApi,
  buscarPainelMotoboy,
  cancelarEntregaMotoboy as cancelarApi,
  contarMotoboysOnline,
  definirDisponibilidade,
  finalizarEntrega as finalizarApi,
  iniciarEntrega as iniciarApi,
  listarEntregas,
  mensagemDeErro,
  recusarOferta as recusarApi,
  type EntregaApi,
  type OfertaApi,
  type PainelMotoboyApi,
} from '@/api/cliente'
import { useSessao } from '@/sessao'

const INTERVALO_CONSULTA_MS = 5000

export function usePainelMotoboy() {
  const { token, usuario } = useSessao()
  const [online, setOnline] = useState(false)
  const [ofertas, setOfertas] = useState<OfertaApi[]>([])
  const [entregaAtiva, setEntregaAtiva] = useState<EntregaApi | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [alternando, setAlternando] = useState(false)
  const [erro, setErro] = useState('')

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const tokenRef = useRef<string | null>(token)
  tokenRef.current = token

  const aplicar = useCallback((painel: PainelMotoboyApi) => {
    setOnline(painel.online)
    setOfertas(painel.ofertas)
    setEntregaAtiva(painel.entregaAtiva)
  }, [])

  const desligarTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [])

  // Consulta o painel. `silencioso` = consulta periódica (não mexe em "carregando").
  const consultar = useCallback(
    async (silencioso: boolean): Promise<PainelMotoboyApi | null> => {
      const atual = tokenRef.current
      if (!atual) {
        if (!silencioso) {
          setOfertas([])
          setEntregaAtiva(null)
          setErro('')
          setCarregando(false)
        }
        return null
      }
      if (!silencioso) {
        setErro('')
        setCarregando(true)
      }
      try {
        const painel = await buscarPainelMotoboy(atual)
        aplicar(painel)
        return painel
      } catch (falha) {
        if (!silencioso) setErro(mensagemDeErro(falha))
        return null
      } finally {
        if (!silencioso) setCarregando(false)
      }
    },
    [aplicar],
  )

  const ligarTimer = useCallback(() => {
    if (timerRef.current !== null) return
    timerRef.current = setInterval(() => {
      void consultar(true)
    }, INTERVALO_CONSULTA_MS)
  }, [consultar])

  // Ao ganhar foco: consulta e, se estiver online, começa o polling.
  // Ao perder o foco (sair da tela): para o polling imediatamente.
  useFocusEffect(
    useCallback(() => {
      let ativo = true
      ;(async () => {
        const painel = await consultar(false)
        if (ativo && painel?.online) ligarTimer()
      })()
      return () => {
        ativo = false
        desligarTimer()
      }
    }, [consultar, ligarTimer, desligarTimer]),
  )

  // Segurança extra: nunca deixa um temporizador sobreviver ao componente.
  useEffect(() => desligarTimer, [desligarTimer])

  const alternar = useCallback(
    async (proximo: boolean) => {
      const atual = tokenRef.current
      if (!atual) return
      setAlternando(true)
      setErro('')
      try {
        const ligado = await definirDisponibilidade(atual, proximo)
        setOnline(ligado)
        if (ligado) {
          await consultar(true)
          ligarTimer()
        } else {
          desligarTimer()
          setOfertas([])
        }
      } catch (falha) {
        setErro(mensagemDeErro(falha))
      } finally {
        setAlternando(false)
      }
    },
    [consultar, ligarTimer, desligarTimer],
  )

  const aceitar = useCallback(
    async (id: string): Promise<EntregaApi | null> => {
      const atual = tokenRef.current
      if (!atual) return null
      const entrega = await aceitarApi(atual, id)
      setOfertas([])
      setEntregaAtiva(entrega)
      void consultar(true)
      return entrega
    },
    [consultar],
  )

  const recusar = useCallback(
    async (id: string): Promise<void> => {
      const atual = tokenRef.current
      if (!atual) return
      await recusarApi(atual, id)
      setOfertas(prev => prev.filter(o => o.id !== id))
      void consultar(true)
    },
    [consultar],
  )

  // Iniciar/finalizar: só atualiza o estado local DEPOIS que a API confirma.
  // Em caso de erro a exceção sobe e a tela mostra o problema (nada é forjado).
  const iniciar = useCallback(
    async (id: string): Promise<EntregaApi> => {
      const atual = tokenRef.current
      if (!atual) throw new Error('Sessão não iniciada.')
      const entrega = await iniciarApi(atual, id)
      setEntregaAtiva(entrega)
      void consultar(true)
      return entrega
    },
    [consultar],
  )

  const finalizar = useCallback(
    async (id: string): Promise<EntregaApi> => {
      const atual = tokenRef.current
      if (!atual) throw new Error('Sessão não iniciada.')
      const entrega = await finalizarApi(atual, id)
      setEntregaAtiva(null)
      void consultar(true)
      return entrega
    },
    [consultar],
  )

  // Cancelar entrega (regra 4): motivo obrigatório; o estado só muda depois
  // que a API confirma (nada é forjado).
  const cancelar = useCallback(
    async (id: string, motivo: string): Promise<EntregaApi> => {
      const atual = tokenRef.current
      if (!atual) throw new Error('Sessão não iniciada.')
      const entrega = await cancelarApi(atual, id, motivo)
      setEntregaAtiva(null)
      void consultar(true)
      return entrega
    },
    [consultar],
  )

  return {
    logado: Boolean(usuario),
    online,
    ofertas,
    entregaAtiva,
    carregando,
    alternando,
    erro,
    alternar,
    aceitar,
    recusar,
    iniciar,
    finalizar,
    cancelar,
    recarregar: () => consultar(false),
  }
}

// Histórico do motoboy: entregas que ELE aceitou/concluiu. O servidor filtra
// por courier_id (identidade do token), então nunca mostramos entrega de outro.
export function useHistoricoMotoboy() {
  const { token } = useSessao()
  const [entregas, setEntregas] = useState<EntregaApi[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')

  const carregar = useCallback(async () => {
    if (!token) {
      setEntregas([])
      setErro('')
      setCarregando(false)
      return
    }
    setCarregando(true)
    setErro('')
    try {
      setEntregas(await listarEntregas(token))
    } catch (falha) {
      setErro(mensagemDeErro(falha))
    } finally {
      setCarregando(false)
    }
  }, [token])

  useFocusEffect(
    useCallback(() => {
      void carregar()
    }, [carregar]),
  )

  return { entregas, carregando, erro, carregar }
}

// Quantidade de motoboys online para o indicador de lojista/pessoa física.
// Busca imediatamente ao ganhar foco e repete a cada 15 s enquanto a tela
// estiver visível. Não é tempo real (sem WebSocket/push).
const INTERVALO_CONTADOR_ONLINE_MS = 15000

export function useMotoboysOnline(): number | null {
  const { token, usuario } = useSessao()
  const [online, setOnline] = useState<number | null>(null)

  useFocusEffect(
    useCallback(() => {
      if (!token || !usuario) {
        setOnline(null)
        return
      }

      const chave = token
      let ativo = true
      let buscando = false

      async function consultar() {
        if (buscando) return
        buscando = true
        try {
          const total = await contarMotoboysOnline(chave)
          if (ativo) setOnline(anterior => (anterior === total ? anterior : total))
        } catch {
          if (ativo) setOnline(null)
        } finally {
          buscando = false
        }
      }

      void consultar()
      const timer = setInterval(() => {
        void consultar()
      }, INTERVALO_CONTADOR_ONLINE_MS)

      return () => {
        ativo = false
        clearInterval(timer)
      }
    }, [token, usuario]),
  )

  return online
}
