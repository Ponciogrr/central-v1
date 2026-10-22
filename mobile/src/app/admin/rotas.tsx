import { useCallback, useEffect, useState } from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { listarRotasDiaAdmin, mensagemDeErro, type RotaDiaApi } from '@/api/cliente'
import Cartao from '@/components/cartao'
import CartaoRotaDia from '@/components/cartao-rota-dia'
import Segmentado, { type Segmento } from '@/components/segmentado'
import { useSessao } from '@/sessao'
import { useTema } from '@/theme'

type Filtro = 'todas' | 'publicada' | 'contratada' | 'em_andamento' | 'concluida' | 'cancelada'

const FILTROS: Segmento<Filtro>[] = [
  { chave: 'todas', rotulo: 'Todas' },
  { chave: 'publicada', rotulo: 'Publicadas' },
  { chave: 'contratada', rotulo: 'Contratadas' },
  { chave: 'em_andamento', rotulo: 'Em curso' },
  { chave: 'concluida', rotulo: 'Concluídas' },
]

export default function AdminRotasDoDia() {
  const { cores } = useTema()
  const { token } = useSessao()
  const [rotas, setRotas] = useState<RotaDiaApi[]>([])
  const [total, setTotal] = useState(0)
  const [filtro, setFiltro] = useState<Filtro>('todas')
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')

  const carregar = useCallback(async () => {
    if (!token) return
    setErro('')
    try {
      const resposta = await listarRotasDiaAdmin(token, {
        limite: 50,
        status: filtro === 'todas' ? undefined : filtro,
      })
      setRotas(resposta.rotas)
      setTotal(resposta.total)
    } catch (falha) {
      setErro(mensagemDeErro(falha))
    } finally {
      setCarregando(false)
    }
  }, [token, filtro])

  useEffect(() => {
    void carregar()
  }, [carregar])

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: cores.fundo }}
      contentContainerStyle={styles.conteudo}
    >
      <Segmentado segmentos={FILTROS} valor={filtro} onChange={setFiltro} />

      {erro ? <Text style={[styles.mensagem, { color: cores.perigo }]}>{erro}</Text> : null}

      {carregando ? (
        <Text style={{ color: cores.textoSuave, fontSize: 14 }}>Carregando…</Text>
      ) : rotas.length === 0 ? (
        <Cartao>
          <Text style={{ color: cores.textoSuave, fontSize: 14 }}>
            Nenhuma rota do dia encontrada com esse filtro.
          </Text>
        </Cartao>
      ) : (
        <View style={styles.lista}>
          <Text style={[styles.total, { color: cores.textoSuave }]}>
            {rotas.length} de {total} rota(s)
          </Text>
          {rotas.map(rota => (
            <CartaoRotaDia key={rota.id} rota={rota} mostrarPublicador />
          ))}
        </View>
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  conteudo: {
    padding: 16,
    gap: 12,
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
  },
  lista: {
    gap: 12,
  },
  total: {
    fontSize: 12,
  },
  mensagem: {
    fontSize: 14,
    lineHeight: 19,
  },
})
